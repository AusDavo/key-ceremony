<script>
	import PrfEncryption from '$lib/components/PrfEncryption.svelte';

	let { data } = $props();
	let entries = $state(data.entries);
	let error = $state('');
	let success = $state('');
	let decryptedText = $state('');
	let label = $state('');
	let prfComponent;
	let saving = $state(false);

	async function handleEncrypt() {
		error = '';
		success = '';
		prfComponent.encrypt();
	}

	async function handleEncrypted(result) {
		saving = true;
		try {
			const resp = await fetch('/api/vault', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...result,
					label: label || 'Wallet descriptor'
				})
			});

			const json = await resp.json();
			if (json.error) {
				error = json.error;
			} else {
				success = 'Descriptor encrypted and saved to vault.';
				entries = [...entries, {
					id: json.id,
					credentialId: result.credentialId,
					label: label || 'Wallet descriptor',
					createdAt: new Date().toISOString()
				}];
				label = '';
			}
		} catch (err) {
			error = err.message;
		} finally {
			saving = false;
		}
	}

	async function handleDecrypt(entry) {
		error = '';
		success = '';
		decryptedText = '';

		const resp = await fetch(`/api/vault/${entry.id}`);
		const json = await resp.json();
		if (json.error) {
			error = json.error;
			return;
		}

		prfComponent.decrypt(json);
	}

	async function handleDelete(entryId) {
		if (!confirm('Delete this vault entry? This cannot be undone.')) return;

		const resp = await fetch(`/api/vault/${entryId}`, { method: 'DELETE' });
		const json = await resp.json();
		if (json.error) {
			error = json.error;
		} else {
			entries = entries.filter(e => e.id !== entryId);
			success = 'Vault entry deleted.';
		}
	}
</script>

<div class="vault-page">
	<h2>Encrypted Vault</h2>
	<p>Store your wallet descriptor encrypted with your passkey. The server never sees the plaintext — encryption happens entirely in your browser using WebAuthn PRF.</p>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if success}
		<p class="success">{success}</p>
	{/if}

	<PrfEncryption
		bind:this={prfComponent}
		descriptorText={data.descriptorRaw || ''}
		onEncrypted={handleEncrypted}
		onDecrypted={(text) => { decryptedText = text; }}
		onError={(msg) => { error = msg; }}
	/>

	{#if data.hasDescriptor}
		<div class="save-section">
			<h3>Save Current Descriptor</h3>
			<label>
				<span>Label (optional)</span>
				<input type="text" bind:value={label} placeholder="e.g. Family multisig" />
			</label>
			<button onclick={handleEncrypt} disabled={saving}>
				{saving ? 'Saving...' : 'Encrypt & Save'}
			</button>
		</div>
	{/if}

	{#if entries.length > 0}
		<div class="entries-section">
			<h3>Saved Entries</h3>
			{#each entries as entry}
				<div class="vault-entry">
					<div class="entry-info">
						<span class="entry-label">{entry.label || 'Wallet descriptor'}</span>
						<span class="entry-date">{new Date(entry.createdAt).toLocaleDateString()}</span>
					</div>
					<div class="entry-actions">
						<button class="small" onclick={() => handleDecrypt(entry)}>Decrypt</button>
						<button class="small danger" onclick={() => handleDelete(entry.id)}>Delete</button>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<p class="empty">No vault entries yet. Save a descriptor after completing a ceremony.</p>
	{/if}

	{#if decryptedText}
		<div class="decrypted-section">
			<h3>Decrypted Descriptor</h3>
			<pre>{decryptedText}</pre>
			<button class="small" onclick={() => {
				navigator.clipboard.writeText(decryptedText);
				success = 'Copied to clipboard.';
			}}>Copy</button>
			<button class="small" onclick={() => { decryptedText = ''; }}>Close</button>
		</div>
	{/if}
</div>

<style>
	.vault-page {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.save-section {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
		margin: 1.5rem 0;
	}

	.save-section h3 {
		color: var(--accent);
		font-size: 1rem;
		margin-bottom: 0.75rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
	}

	label span {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	input[type="text"] {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-size: 0.875rem;
	}

	input:focus {
		outline: none;
		border-color: var(--accent);
	}

	button {
		padding: 0.75rem 1.5rem;
		background: var(--accent);
		color: #000;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		cursor: pointer;
	}

	button:hover {
		background: var(--accent-hover);
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	button.small {
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
		font-weight: normal;
	}

	button.danger {
		background: var(--danger);
		color: #fff;
	}

	button.danger:hover {
		opacity: 0.9;
	}

	.entries-section {
		margin-top: 1.5rem;
	}

	.entries-section h3 {
		color: var(--accent);
		font-size: 1rem;
		margin-bottom: 0.75rem;
	}

	.vault-entry {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		margin-bottom: 0.5rem;
		background: var(--bg-surface);
	}

	.entry-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.entry-label {
		font-weight: bold;
		font-size: 0.875rem;
	}

	.entry-date {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.entry-actions {
		display: flex;
		gap: 0.5rem;
	}

	.decrypted-section {
		margin-top: 1.5rem;
		padding: 1.25rem;
		border: 1px solid var(--success);
		border-radius: 0.5rem;
		background: rgba(34, 197, 94, 0.05);
	}

	.decrypted-section h3 {
		color: var(--success);
		font-size: 1rem;
		margin-bottom: 0.75rem;
	}

	pre {
		background: var(--bg-input);
		padding: 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
		margin-bottom: 0.75rem;
	}

	.empty {
		color: var(--text-muted);
		font-size: 0.875rem;
		padding: 1rem;
		text-align: center;
	}

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}

	.success {
		color: var(--success);
		padding: 0.75rem;
		border: 1px solid var(--success);
		border-radius: 0.375rem;
		background: rgba(34, 197, 94, 0.1);
	}
</style>
