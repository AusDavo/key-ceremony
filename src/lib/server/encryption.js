import { randomBytes, createCipheriv, createDecipheriv, hkdfSync } from 'crypto';
import { env } from '$env/dynamic/private';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
	const key = env.ENCRYPTION_KEY;
	if (!key) {
		throw new Error('ENCRYPTION_KEY environment variable is required');
	}
	const buf = Buffer.from(key, 'hex');
	if (buf.length !== 32) {
		throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
	}
	return buf;
}

/**
 * Encrypt a plaintext string into an encrypted blob.
 * Returns { encrypted: Buffer, iv: string (hex) }
 */
export function encrypt(plaintext) {
	const key = getEncryptionKey();
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

	const encrypted = Buffer.concat([
		cipher.update(plaintext, 'utf8'),
		cipher.final(),
		cipher.getAuthTag()
	]);

	return {
		encrypted,
		iv: iv.toString('hex')
	};
}

/**
 * Decrypt an encrypted blob back to a plaintext string.
 * @param {Buffer} encrypted - The encrypted data (ciphertext + auth tag)
 * @param {string} ivHex - The IV as a hex string
 */
export function decrypt(encrypted, ivHex) {
	const key = getEncryptionKey();
	const iv = Buffer.from(ivHex, 'hex');

	const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);
	const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	decipher.setAuthTag(authTag);

	return decipher.update(ciphertext, null, 'utf8') + decipher.final('utf8');
}

/**
 * Derive a per-user encryption key using HKDF-SHA256.
 * @param {string} userId - The user's unique ID, used as salt
 * @returns {Buffer} 32-byte derived key
 */
function deriveUserKey(userId) {
	const masterKey = getEncryptionKey();
	return Buffer.from(hkdfSync('sha256', masterKey, userId, 'key-ceremony-user', 32));
}

/**
 * Encrypt a buffer using a specific key.
 * Returns { encrypted: Buffer, iv: string (hex) }
 */
function encryptWithKey(key, data) {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

	const encrypted = Buffer.concat([
		cipher.update(data),
		cipher.final(),
		cipher.getAuthTag()
	]);

	return { encrypted, iv: iv.toString('hex') };
}

/**
 * Decrypt a buffer using a specific key.
 * @param {Buffer} key
 * @param {Buffer} encrypted - ciphertext + auth tag
 * @param {string} ivHex
 * @returns {Buffer}
 */
function decryptWithKey(key, encrypted, ivHex) {
	const iv = Buffer.from(ivHex, 'hex');
	const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);
	const ciphertext = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
	decipher.setAuthTag(authTag);

	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt a JavaScript object for a specific user.
 */
export function encryptForUser(obj, userId) {
	const key = deriveUserKey(userId);
	return encryptWithKey(key, Buffer.from(JSON.stringify(obj), 'utf8'));
}

/**
 * Decrypt a JavaScript object for a specific user.
 * Graceful migration: tries per-user key first, falls back to master key.
 */
export function decryptForUser(encrypted, ivHex, userId) {
	const userKey = deriveUserKey(userId);
	try {
		return JSON.parse(decryptWithKey(userKey, encrypted, ivHex).toString('utf8'));
	} catch {
		// Fallback: data was encrypted with the master key (pre-migration)
		return JSON.parse(decryptWithKey(getEncryptionKey(), encrypted, ivHex).toString('utf8'));
	}
}

/**
 * Encrypt a raw buffer for a specific user.
 */
export function encryptBufferForUser(buffer, userId) {
	const key = deriveUserKey(userId);
	return encryptWithKey(key, buffer);
}

/**
 * Decrypt a raw buffer for a specific user.
 */
export function decryptBufferForUser(encrypted, ivHex, userId) {
	const key = deriveUserKey(userId);
	return decryptWithKey(key, encrypted, ivHex);
}

/**
 * Encrypt a JavaScript object (serialized as JSON).
 */
export function encryptObject(obj) {
	return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt back to a JavaScript object.
 */
export function decryptObject(encrypted, ivHex) {
	return JSON.parse(decrypt(encrypted, ivHex));
}
