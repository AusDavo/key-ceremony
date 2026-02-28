<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { startRegistration } from '@simplewebauthn/browser';
	import { getDek, deriveKeyFromPrf, wrapDek, getPrfSalt } from '$lib/crypto.js';

	let { data, form } = $props();
	let adding = $state(false);
	let addError = $state('');

	async function addPasskey() {
		adding = true;
		addError = '';
		try {
			const optionsRes = await fetch('/auth/add-passkey');
			const options = await optionsRes.json();
			if (options.error) throw new Error(options.error);

			const credential = await startRegistration({ optionsJSON: options });

			// Check PRF support on the new passkey
			const prfResult = credential.clientExtensionResults?.prf;
			if (!prfResult?.enabled) {
				throw new Error('This passkey does not support PRF encryption. Please use a PRF-capable authenticator.');
			}

			// Get the current session DEK
			const dek = await getDek();
			if (!dek) {
				throw new Error('Encryption key not available. Please sign in again.');
			}

			// Evaluate PRF with the new passkey to derive its KEK
			// We need to authenticate with this new passkey to get PRF output
			// Since it was just registered, do a quick auth
			const authOptionsRes = await fetch('/auth/login');
			const authOptions = await authOptionsRes.json();
			const salt = getPrfSalt();

			const { startAuthentication } = await import('@simplewebauthn/browser');
			const authOptionsWithPrf = {
				...authOptions,
				extensions: {
					...authOptions.extensions,
					prf: { eval: { first: salt } }
				},
				allowCredentials: [{
					id: credential.id,
					type: 'public-key'
				}]
			};

			const authCredential = await startAuthentication({ optionsJSON: authOptionsWithPrf });
			const prfOutput = authCredential.clientExtensionResults?.prf?.results?.first;

			if (!prfOutput) {
				throw new Error('Failed to derive encryption key from new passkey.');
			}

			// Wrap the existing DEK with the new passkey's KEK
			const kek = await deriveKeyFromPrf(prfOutput);
			const { wrappedDek, dekIv } = await wrapDek(dek, kek);

			const verifyRes = await fetch('/auth/add-passkey', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					credential,
					wrappedDek,
					dekIv
				})
			});
			const result = await verifyRes.json();
			if (result.error) throw new Error(result.error);

			await invalidateAll();
		} catch (err) {
			if (err.name !== 'NotAllowedError') {
				addError = err.message || 'Failed to add passkey';
			}
		} finally {
			adding = false;
		}
	}
</script>

<div class="settings-page">
	<h2>Settings</h2>

	<div class="section">
		<h3>Passkeys</h3>
		<p>Manage your registered passkeys. You need at least one passkey to sign in.</p>

		<div class="passkey-list">
			{#each data.credentials as cred, i}
				<div class="passkey-item">
					<div class="passkey-info">
						<span class="passkey-name">Passkey {i + 1}</span>
						<span class="passkey-id">{cred.credentialId.slice(0, 16)}...</span>
						<span class="passkey-date">Added {new Date(cred.createdAt).toLocaleDateString()}</span>
						{#if cred.transports.length > 0}
							<span class="passkey-transports">{cred.transports.join(', ')}</span>
						{/if}
					</div>
					{#if data.credentials.length > 1}
						<form method="POST" action="?/deletePasskey" use:enhance>
							<input type="hidden" name="credentialId" value={cred.credentialId} />
							<button type="submit" class="delete-btn" onclick={(e) => {
								if (!confirm('Remove this passkey? You cannot undo this.')) e.preventDefault();
							}}>Remove</button>
						</form>
					{/if}
				</div>
			{/each}
		</div>

		{#if form?.error}
			<p class="error">{form.error}</p>
		{/if}
		{#if addError}
			<p class="error">{addError}</p>
		{/if}

		<button class="add-btn" onclick={addPasskey} disabled={adding}>
			{adding ? 'Adding...' : '+ Add Passkey'}
		</button>
	</div>

	<div class="section danger-zone">
		<h3>Danger Zone</h3>
		<p>Deleting your account will permanently remove all data. This cannot be undone.</p>
		<form method="POST" action="?/deleteAccount" use:enhance>
			<button type="submit" class="delete-account-btn" onclick={(e) => {
				if (!confirm('Are you sure you want to delete your account? All data and passkeys will be permanently deleted.')) {
					e.preventDefault();
				}
			}}>Delete Account</button>
		</form>
	</div>

	<div class="nav-links">
		<a href="/ceremony/setup">Back to Ceremony</a>
	</div>
</div>

<style>
	.settings-page {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.section {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
		margin-bottom: 1.5rem;
	}

	.section h3 {
		color: var(--accent);
		font-size: 1rem;
		margin: 0 0 0.25rem;
	}

	.section p {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin: 0 0 1rem;
		line-height: 1.5;
	}

	.passkey-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.passkey-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
	}

	.passkey-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.passkey-name {
		font-weight: bold;
		font-size: 0.9rem;
	}

	.passkey-id {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.passkey-date {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.passkey-transports {
		font-size: 0.7rem;
		color: var(--text-dim);
	}

	.delete-btn {
		padding: 0.3rem 0.6rem;
		background: none;
		color: var(--danger);
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		font-size: 0.75rem;
		cursor: pointer;
		font-weight: normal;
	}

	.delete-btn:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.add-btn {
		padding: 0.625rem 1.25rem;
		background: var(--accent);
		color: #000;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.add-btn:hover {
		background: var(--accent-hover);
	}

	.add-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.danger-zone {
		border-color: var(--danger);
	}

	.danger-zone h3 {
		color: var(--danger);
	}

	.delete-account-btn {
		padding: 0.625rem 1.25rem;
		background: var(--danger);
		color: #fff;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.delete-account-btn:hover {
		opacity: 0.9;
	}

	.error {
		color: var(--danger);
		font-size: 0.85rem;
		margin: 0.5rem 0;
	}

	.nav-links {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.nav-links a {
		color: var(--accent);
	}
</style>
