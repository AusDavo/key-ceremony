import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
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
