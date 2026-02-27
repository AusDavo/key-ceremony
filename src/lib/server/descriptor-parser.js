// descriptor-parser.js
// Extracted and refactored from https://github.com/AusDavo/gatekeeper/blob/main/modules/multisig-operations.js
// Standalone descriptor parsing module - pure logic, no DOM dependencies
// ESM exports for Node.js server-side use in SvelteKit

/**
 * Regex to match BIP32 derivation path segments from a descriptor.
 * Matches paths like /48h/0h/0h/2h, /44'/0'/0', etc.
 */
const pathsRegex = /\/[\dh'\/]+(?:[h'](?=\d)|[h'])/g;

/**
 * Regex to match extended public keys (xpub, ypub, zpub, tpub, etc.).
 */
const xpubsRegex = /\b\w*xpub\w*\b/g;

/**
 * Regex to match 8-character hex fingerprints (master key fingerprints).
 */
const xpubFingerprintRegex = /\b[A-Fa-f0-9]{8}\b/g;

/**
 * Regex to detect the descriptor wrapper type for determining address format.
 * Matches wsh(...), sh(wsh(...)), sh(...), tr(...), etc.
 */
const descriptorTypeRegex = /^(wsh|sh\(wsh|sh|tr|pk|pkh|wpkh|sh\(wpkh)\s*\(/i;

/**
 * Regex to extract the quorum (m-of-n threshold) from a sortedmulti or multi descriptor.
 * e.g. sortedmulti(2, ...) => m=2
 */
const quorumRegex = /(?:sorted)?multi\s*\(\s*(\d+)\s*,/i;

/**
 * Extract all matches of a regex from an input string.
 * @param {RegExp} regex - The regex pattern (must have global flag).
 * @param {string} input - The string to search.
 * @returns {string[]} Array of matched strings.
 */
function extractMatches(regex, input) {
  return [...input.matchAll(regex)].map((match) => match[0]);
}

/**
 * Normalize a derivation path: extract the path portion and replace 'h' with apostrophe notation.
 * @param {string} path - Raw path string from descriptor.
 * @returns {string} Normalized path like /48'/0'/0'/2'
 */
function formatPath(path) {
  return (path.match(pathsRegex) || ["unknown"])[0].replace(/h/g, "'");
}

/**
 * Detect the address type from the descriptor wrapper.
 * @param {string} descriptor - The raw descriptor string.
 * @returns {string} Address type identifier.
 */
function detectAddressType(descriptor) {
  const trimmed = descriptor.trim();

  if (/^wsh\s*\(/i.test(trimmed)) {
    return "wsh"; // P2WSH (native segwit multisig)
  }
  if (/^sh\s*\(\s*wsh\s*\(/i.test(trimmed)) {
    return "sh-wsh"; // P2SH-P2WSH (wrapped segwit multisig)
  }
  if (/^sh\s*\(\s*wpkh\s*\(/i.test(trimmed)) {
    return "sh-wpkh"; // P2SH-P2WPKH (wrapped segwit singlesig)
  }
  if (/^sh\s*\(/i.test(trimmed)) {
    return "sh"; // P2SH (legacy multisig)
  }
  if (/^wpkh\s*\(/i.test(trimmed)) {
    return "wpkh"; // P2WPKH (native segwit singlesig)
  }
  if (/^tr\s*\(/i.test(trimmed)) {
    return "tr"; // P2TR (taproot)
  }
  if (/^pkh\s*\(/i.test(trimmed)) {
    return "pkh"; // P2PKH (legacy singlesig)
  }

  return "unknown";
}

/**
 * Map short address type codes to human-readable labels.
 */
const ADDRESS_TYPE_LABELS = {
  wsh: "P2WSH (Native SegWit Multisig)",
  "sh-wsh": "P2SH-P2WSH (Wrapped SegWit Multisig)",
  "sh-wpkh": "P2SH-P2WPKH (Wrapped SegWit)",
  sh: "P2SH (Legacy Multisig)",
  wpkh: "P2WPKH (Native SegWit)",
  tr: "P2TR (Taproot)",
  pkh: "P2PKH (Legacy)",
  unknown: "Unknown",
};

/**
 * Extract the quorum threshold from a descriptor.
 * @param {string} descriptor - The raw descriptor string.
 * @returns {{ required: number, total: number } | null} The m-of-n quorum, or null if not a multisig descriptor.
 */
function extractQuorum(descriptor, totalKeys) {
  const match = descriptor.match(quorumRegex);
  if (!match) return null;

  const required = parseInt(match[1], 10);
  return {
    required,
    total: totalKeys,
  };
}

/**
 * Extract xpubs and their associated derivation paths and fingerprints from a descriptor.
 * This is the core extraction logic from Gatekeeper's multisig-operations module.
 *
 * @param {string} descriptor - The raw wallet descriptor string.
 * @returns {Array<{ path: string, xpub: string, xpubFingerprint: string }>}
 */
function extractPathsAndXpubs(descriptor) {
  const xpubs = extractMatches(xpubsRegex, descriptor);
  const xpubFingerprints = extractMatches(xpubFingerprintRegex, descriptor);
  const parts = descriptor.split(/\b\w*xpub\w*\b/);

  return xpubs.map((xpub, index) => ({
    path: formatPath(parts[index]),
    xpub,
    xpubFingerprint: xpubFingerprints[index] || "unknown",
  }));
}

/**
 * Format map from BSMS/Coldcard "Format:" field to internal address type codes.
 */
const BSMS_FORMAT_MAP = {
  P2WSH: "wsh",
  "P2SH-P2WSH": "sh-wsh",
  P2SH: "sh",
  P2WPKH: "wpkh",
  "P2SH-P2WPKH": "sh-wpkh",
  P2TR: "tr",
  P2PKH: "pkh",
};

/**
 * Detect and parse a Coldcard/Sparrow BSMS multisig setup file.
 * Returns a parsed descriptor object if detected, or null if not in BSMS format.
 *
 * Example format:
 *   # Coldcard Multisig setup file (created by Sparrow)
 *   Name: Deposit
 *   Policy: 2 of 3
 *   Derivation: m/48'/0'/0'/2'
 *   Format: P2WSH
 *
 *   B5CC8C8B: xpub6...
 *   B86B3E97: xpub6...
 *   B66A3A70: xpub6...
 *
 * @param {string} text - The raw input text.
 * @returns {object|null} Parsed descriptor object or null.
 */
function parseBsmsFormat(text) {
  // Detect BSMS format by looking for "Policy:" line with "M of N"
  const policyMatch = text.match(/^Policy:\s*(\d+)\s+of\s+(\d+)/im);
  if (!policyMatch) return null;

  const required = parseInt(policyMatch[1], 10);
  const total = parseInt(policyMatch[2], 10);

  // Extract derivation path
  const derivationMatch = text.match(/^Derivation:\s*(m\/[\d'h\/]+)/im);
  const derivationPath = derivationMatch
    ? derivationMatch[1].replace(/^m/, "").replace(/h/g, "'")
    : "unknown";

  // Extract format (address type)
  const formatMatch = text.match(/^Format:\s*(\S+)/im);
  const formatStr = formatMatch ? formatMatch[1].trim() : "";
  const addressType = BSMS_FORMAT_MAP[formatStr] || "unknown";

  // Extract fingerprint: xpub lines
  const xpubLineRegex = /^([A-Fa-f0-9]{8}):\s*(\w*xpub\w+)/gm;
  const xpubs = [];
  let match;
  while ((match = xpubLineRegex.exec(text)) !== null) {
    xpubs.push({
      path: derivationPath,
      xpub: match[2],
      xpubFingerprint: match[1],
    });
  }

  if (xpubs.length === 0) return null;

  return {
    raw: text.trim(),
    addressType,
    addressTypeLabel: ADDRESS_TYPE_LABELS[addressType] || ADDRESS_TYPE_LABELS.unknown,
    quorum: { required, total },
    xpubs,
  };
}

/**
 * Parse a raw wallet descriptor string into a structured object.
 * Supports both standard output descriptors and BSMS/Coldcard multisig setup files.
 *
 * @param {string} descriptor - The raw descriptor string, e.g.:
 *   "wsh(sortedmulti(2,[abc12345/48h/0h/0h/2h]xpub6..., [def67890/48h/0h/0h/2h]xpub6...))"
 *
 * @returns {{
 *   raw: string,
 *   addressType: string,
 *   addressTypeLabel: string,
 *   quorum: { required: number, total: number } | null,
 *   xpubs: Array<{ path: string, xpub: string, xpubFingerprint: string }>
 * }}
 */
export function parseDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "string") {
    throw new Error("Descriptor must be a non-empty string");
  }

  const trimmed = descriptor.trim();

  // Try BSMS/Coldcard multisig setup file format first
  const bsmsResult = parseBsmsFormat(trimmed);
  if (bsmsResult) return bsmsResult;

  // If the input contains a standard descriptor embedded in other text
  // (e.g. BSMS 1.0 format with header/footer lines), extract it
  let descriptorLine = trimmed;
  const embeddedMatch = trimmed.match(/((?:wsh|sh|wpkh|pkh|tr)\s*\(.*\))(?:#\w+)?/s);
  if (embeddedMatch) {
    descriptorLine = embeddedMatch[1];
  }

  // Fall back to standard output descriptor parsing
  const addressType = detectAddressType(descriptorLine);
  const xpubs = extractPathsAndXpubs(descriptorLine);
  const quorum = extractQuorum(descriptorLine, xpubs.length);

  return {
    raw: trimmed,
    addressType,
    addressTypeLabel: ADDRESS_TYPE_LABELS[addressType] || ADDRESS_TYPE_LABELS.unknown,
    quorum,
    xpubs,
  };
}

export {
  extractPathsAndXpubs,
  extractMatches,
  formatPath,
  detectAddressType,
  extractQuorum,
  parseBsmsFormat,
  pathsRegex,
  xpubsRegex,
  xpubFingerprintRegex,
  ADDRESS_TYPE_LABELS,
};
