// bitcoin-utils.js
// Ported from https://github.com/AusDavo/gatekeeper/blob/main/bitcoin-utils.js
// Converted to ESM for Node.js server-side use in SvelteKit

import * as ecc from "@bitcoinerlab/secp256k1";
import { BIP32Factory } from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import bitcoinMessage from "bitcoinjs-message";
import { Verifier } from "bip322-js";

// Initialize libraries with the secp256k1 implementation
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

export const ADDRESS_TYPES = {
  legacy: "legacy", // P2PKH - starts with 1
  segwitWrapped: "segwit-wrapped", // P2SH-P2WPKH - starts with 3
  segwit: "segwit", // P2WPKH - starts with bc1q
  taproot: "taproot", // P2TR - starts with bc1p
};

export const SIGNATURE_FORMATS = {
  electrum: "electrum", // Standard/Electrum format (ECDSA)
  bip137: "bip137", // BIP-137 (Trezor) format (ECDSA with address type header)
  bip322: "bip322", // BIP-322 (Simple) format (works with all address types)
};

/**
 * Detects the address type from a Bitcoin address string.
 */
export function detectAddressType(address) {
  if (address.startsWith("bc1p") || address.startsWith("tb1p")) {
    return ADDRESS_TYPES.taproot;
  } else if (address.startsWith("bc1q") || address.startsWith("tb1q")) {
    return ADDRESS_TYPES.segwit;
  } else if (address.startsWith("3") || address.startsWith("2")) {
    return "segwit-wrapped"; // P2SH-P2WPKH
  } else {
    return ADDRESS_TYPES.legacy; // P2PKH (starts with 1 or m/n for testnet)
  }
}

/**
 * Derives a child node from an xpub using a relative path.
 * Only non-hardened derivation is possible from an xpub.
 */
export function deriveFromPath(xpub, relativePath) {
  const node = bip32.fromBase58(xpub);

  if (!relativePath || relativePath === "") {
    return node;
  }

  const segments = relativePath.split("/").filter((s) => s !== "");

  let derived = node;
  for (const segment of segments) {
    if (segment.includes("'") || segment.includes("h")) {
      throw new Error(
        "Hardened derivation not possible from xpub. Use only non-hardened indices."
      );
    }

    const index = parseInt(segment, 10);
    if (isNaN(index) || index < 0 || index > 2147483647) {
      throw new Error(`Invalid path segment: ${segment}`);
    }

    derived = derived.derive(index);
  }

  return derived;
}

/**
 * Converts a 33-byte compressed public key to x-only (32-byte) format for Taproot.
 */
function toXOnly(pubkey) {
  return pubkey.subarray(1, 33);
}

/**
 * Derives an address from an xpub at a given relative path.
 */
export function deriveAddress(xpub, relativePath, addressType = ADDRESS_TYPES.legacy) {
  const derived = deriveFromPath(xpub, relativePath);
  const publicKey = derived.publicKey;

  let payment;
  switch (addressType) {
    case ADDRESS_TYPES.taproot:
      payment = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(publicKey),
      });
      break;
    case ADDRESS_TYPES.segwit:
      payment = bitcoin.payments.p2wpkh({ pubkey: publicKey });
      break;
    case ADDRESS_TYPES.segwitWrapped:
      // P2SH-P2WPKH: wrap P2WPKH in P2SH
      payment = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey: publicKey }),
      });
      break;
    case ADDRESS_TYPES.legacy:
    default:
      payment = bitcoin.payments.p2pkh({ pubkey: publicKey });
      break;
  }

  return {
    address: payment.address,
    publicKey: publicKey.toString("hex"),
  };
}

/**
 * Detect signature format from the raw base64 signature.
 * A 65-byte signature with a recovery header is ECDSA (BIP-137/Electrum).
 * Anything else is likely BIP-322 (witness-based).
 */
function detectSignatureFormat(signature) {
  try {
    const buf = Buffer.from(signature, "base64");
    if (buf.length === 65 && buf[0] >= 27 && buf[0] <= 42) {
      return "ecdsa"; // BIP-137 or Electrum style
    }
  } catch {
    // Not valid base64 — let the verifier handle it
  }
  return "bip322";
}

/**
 * Validates a Bitcoin signed message.
 *
 * Auto-detects whether the signature is ECDSA (65-byte BIP-137/Electrum)
 * or BIP-322 (witness-based) from the signature bytes, regardless of
 * the user-selected format hint. Falls back across formats if the
 * primary attempt fails.
 */
export function validateSignature(message, signature, address, signatureFormat) {
  const detectedType = detectAddressType(address);
  const detectedSigFormat = detectSignatureFormat(signature);

  // If the signature is clearly ECDSA (65 bytes with recovery header),
  // use ECDSA verification regardless of what the user selected
  if (detectedSigFormat === "ecdsa") {
    // For legacy addresses, use bitcoinjs-message
    if (detectedType === ADDRESS_TYPES.legacy) {
      try {
        return bitcoinMessage.verify(message, address, signature);
      } catch {
        // Fall through to bip322-js
      }
    }

    // For segwit addresses with ECDSA sigs, try bip322-js (handles BIP-137 style)
    try {
      return Verifier.verifySignature(address, message, signature);
    } catch {
      // Fall through
    }

    // Try bitcoinjs-message as last resort (some wallets use P2PKH headers for segwit)
    try {
      return bitcoinMessage.verify(message, address, signature);
    } catch {
      return false;
    }
  }

  // BIP-322 witness-based signature
  try {
    return Verifier.verifySignature(address, message, signature);
  } catch {
    return false;
  }
}

/**
 * Derives a multisig address from multiple xpubs at a given relative path.
 * Handles sortedmulti by sorting pubkeys lexicographically.
 *
 * @param {string[]} xpubs - Array of xpub strings
 * @param {string} relativePath - e.g. "0/0" for first receive address
 * @param {number} requiredSigs - m in m-of-n
 * @param {string} descriptorType - "wsh", "sh-wsh", "sh", etc.
 * @returns {{ address: string, pubkeys: string[] }}
 */
export function deriveMultisigAddress(xpubs, relativePath, requiredSigs, descriptorType) {
  const pubkeys = xpubs.map((xpub) => deriveFromPath(xpub, relativePath).publicKey);
  const sortedPubkeys = [...pubkeys].sort(Buffer.compare);

  let payment;
  switch (descriptorType) {
    case "wsh": {
      // P2WSH multisig (native segwit)
      const p2ms = bitcoin.payments.p2ms({ m: requiredSigs, pubkeys: sortedPubkeys });
      payment = bitcoin.payments.p2wsh({ redeem: p2ms });
      break;
    }
    case "sh-wsh": {
      // P2SH-P2WSH multisig (wrapped segwit)
      const p2ms = bitcoin.payments.p2ms({ m: requiredSigs, pubkeys: sortedPubkeys });
      const p2wsh = bitcoin.payments.p2wsh({ redeem: p2ms });
      payment = bitcoin.payments.p2sh({ redeem: p2wsh });
      break;
    }
    case "sh": {
      // P2SH multisig (legacy)
      const p2ms = bitcoin.payments.p2ms({ m: requiredSigs, pubkeys: sortedPubkeys });
      payment = bitcoin.payments.p2sh({ redeem: p2ms });
      break;
    }
    default:
      throw new Error(`Unsupported multisig descriptor type: ${descriptorType}`);
  }

  return {
    address: payment.address,
    pubkeys: sortedPubkeys.map((pk) => pk.toString("hex")),
  };
}

/**
 * Returns information about signature format compatibility with address types.
 */
export function getFormatCompatibility(signatureFormat, addressType) {
  // BIP-322 works with everything
  if (signatureFormat === SIGNATURE_FORMATS.bip322) {
    return { compatible: true, note: null };
  }

  // Electrum and BIP-137 don't work with Taproot (requires Schnorr)
  if (addressType === ADDRESS_TYPES.taproot) {
    return {
      compatible: false,
      note: "Taproot addresses require BIP-322 format for signature verification.",
    };
  }

  return { compatible: true, note: null };
}
