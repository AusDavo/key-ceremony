const APP_SALT = new TextEncoder().encode('key-ceremony-prf-v1');
const HKDF_INFO = new TextEncoder().encode('key-ceremony-dek');

/**
 * Derive a KEK (Key Encryption Key) from PRF output using HKDF-SHA256.
 * @param {ArrayBuffer} prfOutput - Raw PRF output from the authenticator
 * @returns {Promise<CryptoKey>} AES-256-GCM key for wrapping/unwrapping the DEK
 */
export async function deriveKeyFromPrf(prfOutput) {
	const ikm = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: APP_SALT, info: HKDF_INFO },
		ikm,
		{ name: 'AES-GCM', length: 256 },
		false,
		['wrapKey', 'unwrapKey', 'encrypt', 'decrypt']
	);
}

/**
 * Generate a random 256-bit Data Encryption Key.
 * @returns {Promise<CryptoKey>}
 */
export async function generateDek() {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Wrap (encrypt) a DEK with a KEK.
 * @param {CryptoKey} dek - The data encryption key to wrap
 * @param {CryptoKey} kek - The key encryption key (derived from PRF)
 * @returns {Promise<{wrappedDek: string, dekIv: string}>} Base64-encoded wrapped key and IV
 */
export async function wrapDek(dek, kek) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv });
	return {
		wrappedDek: bufToBase64(wrapped),
		dekIv: bufToBase64(iv)
	};
}

/**
 * Unwrap (decrypt) a DEK with a KEK.
 * @param {string} wrappedDekB64 - Base64-encoded wrapped key
 * @param {string} dekIvB64 - Base64-encoded IV
 * @param {CryptoKey} kek - The key encryption key (derived from PRF)
 * @returns {Promise<CryptoKey>}
 */
export async function unwrapDek(wrappedDekB64, dekIvB64, kek) {
	const wrapped = base64ToBuf(wrappedDekB64);
	const iv = base64ToBuf(dekIvB64);
	return crypto.subtle.unwrapKey(
		'raw', wrapped, kek,
		{ name: 'AES-GCM', iv },
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt']
	);
}

/**
 * Encrypt a JSON-serialisable object with the DEK.
 * @param {object} data - Object to encrypt
 * @param {CryptoKey} dek - The data encryption key
 * @returns {Promise<{ciphertext: string, iv: string}>} Base64-encoded ciphertext and IV
 */
export async function encryptBlob(data, dek) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode(JSON.stringify(data));
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, plaintext);
	return {
		ciphertext: bufToBase64(encrypted),
		iv: bufToBase64(iv)
	};
}

/**
 * Decrypt a blob back to a JSON object.
 * @param {string} ciphertextB64 - Base64-encoded ciphertext
 * @param {string} ivB64 - Base64-encoded IV
 * @param {CryptoKey} dek - The data encryption key
 * @returns {Promise<object>}
 */
export async function decryptBlob(ciphertextB64, ivB64, dek) {
	const ciphertext = base64ToBuf(ciphertextB64);
	const iv = base64ToBuf(ivB64);
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ciphertext);
	return JSON.parse(new TextDecoder().decode(plaintext));
}

/**
 * Encrypt a known test value to verify the DEK later.
 * @param {CryptoKey} dek
 * @returns {Promise<{keyCheck: string, keyCheckIv: string}>}
 */
export async function encryptTestValue(dek) {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode('key-ceremony-check');
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, plaintext);
	return {
		keyCheck: bufToBase64(encrypted),
		keyCheckIv: bufToBase64(iv)
	};
}

/**
 * Verify a DEK by decrypting the test value.
 * @param {string} keyCheckB64
 * @param {string} keyCheckIvB64
 * @param {CryptoKey} dek
 * @returns {Promise<boolean>}
 */
export async function verifyTestValue(keyCheckB64, keyCheckIvB64, dek) {
	try {
		const ciphertext = base64ToBuf(keyCheckB64);
		const iv = base64ToBuf(keyCheckIvB64);
		const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, ciphertext);
		return new TextDecoder().decode(plaintext) === 'key-ceremony-check';
	} catch {
		return false;
	}
}

// --- sessionStorage helpers ---

const DEK_STORAGE_KEY = 'kc_dek';

/**
 * Store the DEK in sessionStorage (exported as raw key bytes).
 * @param {CryptoKey} dek
 */
export async function storeDek(dek) {
	const raw = await crypto.subtle.exportKey('raw', dek);
	sessionStorage.setItem(DEK_STORAGE_KEY, bufToBase64(raw));
}

/**
 * Retrieve the DEK from sessionStorage.
 * @returns {Promise<CryptoKey|null>}
 */
export async function getDek() {
	const stored = sessionStorage.getItem(DEK_STORAGE_KEY);
	if (!stored) return null;
	const raw = base64ToBuf(stored);
	return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Clear the DEK from sessionStorage.
 */
export function clearDek() {
	sessionStorage.removeItem(DEK_STORAGE_KEY);
}

/**
 * Check if a DEK is available in sessionStorage.
 * @returns {boolean}
 */
export function hasDek() {
	return sessionStorage.getItem(DEK_STORAGE_KEY) !== null;
}

// --- PRF salt ---

/**
 * Get the fixed app salt for PRF evaluation.
 * @returns {Uint8Array}
 */
export function getPrfSalt() {
	return APP_SALT;
}

// --- Encoding helpers ---

function bufToBase64(buf) {
	const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function base64ToBuf(b64) {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
