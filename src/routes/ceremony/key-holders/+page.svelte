<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let keyHolders = $state(
		data.xpubs.map((x, i) => {
			const saved = data.savedKeyHolders?.[i];
			return {
				name: saved?.name || '',
				role: saved?.role || 'Primary Holder',
				customRole: saved?.customRole || '',
				deviceType: saved?.deviceType || data.deviceTypes[0],
				deviceLocation: saved?.deviceLocation || '',
				seedBackupLocation: saved?.seedBackupLocation || ''
			};
		})
	);

	const allNamed = $derived(keyHolders.every(kh => kh.name.trim()));
</script>

<h2>Key Holders</h2>
<p>Identify who holds each key in your {data.quorum ? `${data.quorum.required}-of-${data.quorum.total}` : ''} multisig wallet.</p>

<div class="wallet-summary">
	<span class="wallet-type">{data.addressTypeLabel}</span>
	{#if data.quorum}
		<span class="quorum">{data.quorum.required}-of-{data.quorum.total} multisig</span>
	{/if}
</div>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST" use:enhance>
	<input type="hidden" name="keyHolders" value={JSON.stringify(
		Object.fromEntries(keyHolders.map((kh, i) => [i, kh]))
	)} />

	<div class="key-list">
		{#each data.xpubs as xpub, i}
			{@const kh = keyHolders[i]}
			<div class="key-card">
				<div class="key-header">
					<span class="key-label">
						Key {i + 1}: <span class="fingerprint">{xpub.fingerprint}</span>
					</span>
					<code class="xpub-preview">{xpub.xpubPreview}</code>
				</div>

				<div class="fields">
					<label>
						<span>Name <span class="required">*</span></span>
						<input type="text" placeholder="e.g. David Pinkerton" bind:value={kh.name} required />
					</label>

					<label>
						<span>Role</span>
						<select bind:value={kh.role}>
							{#each data.roleOptions as role}
								<option value={role}>{role}</option>
							{/each}
						</select>
					</label>

					{#if kh.role === 'Custom'}
						<label>
							<span>Custom Role</span>
							<input type="text" placeholder="e.g. Estate Executor" bind:value={kh.customRole} />
						</label>
					{/if}

					<label>
						<span>Device Type</span>
						<select bind:value={kh.deviceType}>
							{#each data.deviceTypes as device}
								<option value={device}>{device}</option>
							{/each}
						</select>
					</label>

					<label>
						<span>Device Storage Location</span>
						<input type="text" placeholder="e.g. Home safe, Bank safe deposit box" bind:value={kh.deviceLocation} />
					</label>

					<label>
						<span>Seed Backup Location (optional)</span>
						<input type="text" placeholder="e.g. Fireproof safe at home" bind:value={kh.seedBackupLocation} />
					</label>
				</div>
			</div>
		{/each}
	</div>

	<button type="submit" disabled={!allNamed}>Continue to Verification</button>
</form>

<style>
	.wallet-summary {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 0.75rem 1rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
	}

	.wallet-type {
		color: var(--text-muted);
	}

	.quorum {
		color: var(--accent);
		font-weight: bold;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 600px;
	}

	.key-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.key-card {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
	}

	.key-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.key-label {
		font-weight: bold;
		font-family: var(--font-mono);
		font-size: 1rem;
	}

	.fingerprint {
		color: var(--accent);
	}

	.xpub-preview {
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	label span {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.required {
		color: var(--accent);
	}

	input[type="text"], select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-size: 0.875rem;
	}

	input[type="text"]:focus, select:focus {
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
		align-self: flex-start;
	}

	button:hover {
		background: var(--accent-hover);
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}
</style>
