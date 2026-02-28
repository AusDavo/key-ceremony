<script>
	let { data, form } = $props();

	let keyCount = $state(data.savedConfig?.keyCount || 3);
	let quorumRequired = $state(data.savedConfig?.quorumRequired || 2);
	let walletType = $state(
		data.walletTypes.includes(data.savedConfig?.walletType)
			? data.savedConfig.walletType
			: data.savedConfig?.walletType
				? 'Other'
				: data.walletTypes[0]
	);
	let customWalletType = $state(
		data.walletTypes.includes(data.savedConfig?.walletType) ? '' : (data.savedConfig?.walletType || '')
	);

	$effect(() => {
		if (quorumRequired > keyCount) {
			quorumRequired = keyCount;
		}
	});
</script>

<h2>Wallet Setup</h2>
<p>Describe your multisig wallet configuration. No wallet descriptor or private key material is needed.</p>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST">
	<div class="field-group">
		<label>
			<span>Number of keys <span class="required">*</span></span>
			<input type="number" name="keyCount" min="1" max="15" bind:value={keyCount} required />
			<span class="hint">How many keys are in this multisig wallet?</span>
		</label>

		<label>
			<span>Quorum required <span class="required">*</span></span>
			<input type="number" name="quorumRequired" min="1" max={keyCount} bind:value={quorumRequired} required />
			<span class="hint">How many keys are needed to sign a transaction? ({quorumRequired}-of-{keyCount})</span>
		</label>

		<label>
			<span>Wallet type</span>
			<select name="walletType" bind:value={walletType}>
				{#each data.walletTypes as wt}
					<option value={wt}>{wt}</option>
				{/each}
			</select>
		</label>

		{#if walletType === 'Other'}
			<label>
				<span>Custom wallet type</span>
				<input type="text" name="customWalletType" bind:value={customWalletType} placeholder="e.g. Custom Miniscript" />
			</label>
		{/if}
	</div>

	<div class="summary">
		<p>You are documenting a <strong>{quorumRequired}-of-{keyCount}</strong> multisig wallet{walletType && walletType !== 'Other' ? ` (${walletType})` : customWalletType ? ` (${customWalletType})` : ''}.</p>
	</div>

	<button type="submit">Continue to Key Holders</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 500px;
	}

	.field-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	label > span {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.required {
		color: var(--accent);
	}

	.hint {
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	input[type="number"], input[type="text"], select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-size: 0.875rem;
	}

	input:focus, select:focus {
		outline: none;
		border-color: var(--accent);
	}

	.summary {
		padding: 0.75rem 1rem;
		background: var(--bg-surface);
		border: 1px solid var(--accent);
		border-radius: 0.375rem;
		font-size: 0.9rem;
	}

	.summary p {
		margin: 0;
		color: var(--text);
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

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}
</style>
