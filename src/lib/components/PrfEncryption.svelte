<script>
	import { startAuthentication } from '@simplewebauthn/browser';

	let { onEncrypted, onDecrypted, onError, descriptorText = '', mode = 'encrypt' } = $props();
	let status = $state('');
	let working = $state(false);

	async function getPrfKey(salt) {
		status = 'Authenticating with passkey...';

		const optionsResp = await fetch('/auth/login');
		const options = await optionsResp.json();

		options.extensions = {
			...options.extensions,
			prf: {
				eval: {
					first: salt
				}
			}
		};

		const credential = await startAuthentication({ optionsJSON: options });

		const prfResults = credential.clientExtensionResults?.prf;
		if (!prfResults?.results?.first) {
			throw new Error('Your authenticator does not support PRF. Try a different passkey (e.g. a platform authenticator or FIDO2 key with PRF support).');
		}

		// Complete the login so the session stays valid
		const verifyResp = await fetch('/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(credential)
		});

		const verifyResult = await verifyResp.json();
		if (!verifyResult.verified) {
			throw new Error('Authentication failed');
		}

		return {
			prfOutput: new Uint8Array(prfResults.results.first),
			credentialId: credential.id
		};
	}

	async function deriveKey(prfOutput, salt) {
		const keyMaterial = await crypto.subtle.importKey(
			'raw', prfOutput, 'HKDF', false, ['deriveKey']
		);

		return crypto.subtle.deriveKey(
			{
				name: 'HKDF',
				hash: 'SHA-256',
				salt: salt,
				info: new TextEncoder().encode('key-ceremony-vault')
			},
			keyMaterial,
			{ name: 'AES-GCM', length: 256 },
			false,
			['encrypt', 'decrypt']
		);
	}

	function arrayToBase64(arr) {
		return btoa(String.fromCharCode(...new Uint8Array(arr)));
	}

	function base64ToArray(b64) {
		return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
	}

	async function encrypt() {
		if (!descriptorText?.trim()) {
			onError?.('No descriptor to encrypt');
			return;
		}

		working = true;
		try {
			const salt = crypto.getRandomValues(new Uint8Array(32));
			const { prfOutput, credentialId } = await getPrfKey(salt);

			status = 'Deriving encryption key...';
			const key = await deriveKey(prfOutput, salt);

			status = 'Encrypting descriptor...';
			const iv = crypto.getRandomValues(new Uint8Array(12));
			const plaintext = new TextEncoder().encode(descriptorText.trim());
			const ciphertext = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv },
				key,
				plaintext
			);

			onEncrypted?.({
				credentialId,
				encryptedDescriptor: arrayToBase64(ciphertext),
				iv: arrayToBase64(iv),
				salt: arrayToBase64(salt)
			});

			status = '';
		} catch (err) {
			onError?.(err.message);
			status = '';
		} finally {
			working = false;
		}
	}

	async function decrypt(entry) {
		working = true;
		try {
			const salt = base64ToArray(entry.salt);
			const { prfOutput } = await getPrfKey(salt);

			status = 'Deriving decryption key...';
			const key = await deriveKey(prfOutput, salt);

			status = 'Decrypting descriptor...';
			const iv = base64ToArray(entry.iv);
			const ciphertext = base64ToArray(entry.encrypted_descriptor);
			const plaintext = await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv },
				key,
				ciphertext
			);

			const decrypted = new TextDecoder().decode(plaintext);
			onDecrypted?.(decrypted);
			status = '';
		} catch (err) {
			if (err.name === 'OperationError') {
				onError?.('Decryption failed. This descriptor may have been encrypted with a different passkey.');
			} else {
				onError?.(err.message);
			}
			status = '';
		} finally {
			working = false;
		}
	}

	export { encrypt, decrypt };
</script>

{#if status}
	<p class="prf-status">{status}</p>
{/if}

{#if working}
	<div class="prf-working">Processing...</div>
{/if}

<style>
	.prf-status {
		color: var(--accent);
		font-size: 0.85rem;
		font-style: italic;
	}

	.prf-working {
		padding: 0.5rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
</style>
