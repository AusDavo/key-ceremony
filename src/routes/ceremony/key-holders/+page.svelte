<script>
	import { getDek, encryptBlob, decryptBlob } from '$lib/crypto.js';

	let { data, form } = $props();

	let loading = $state(true);
	let submitting = $state(false);
	let ceremonyData = $state({});

	// Derived from decrypted data
	let keyCount = $derived(ceremonyData.walletConfig?.keyCount || 0);
	let quorumRequired = $derived(ceremonyData.walletConfig?.quorumRequired || 0);
	let walletType = $derived(ceremonyData.walletConfig?.walletType || '');

	function newHolder() {
		return {
			name: '',
			role: 'Primary Holder',
			customRole: '',
			deviceType: data.deviceTypes[0],
			fingerprint: '',
			deviceLocation: '',
			seedBackupLocation: ''
		};
	}

	function loadSaved(saved) {
		if (Array.isArray(saved) && saved.length > 0) {
			return saved.map(h => ({
				name: h.name || '',
				role: h.role || 'Primary Holder',
				customRole: h.customRole || '',
				deviceType: h.deviceType || data.deviceTypes[0],
				fingerprint: h.fingerprint || '',
				deviceLocation: h.deviceLocation || '',
				seedBackupLocation: h.seedBackupLocation || ''
			}));
		}
		if (saved && typeof saved === 'object' && !Array.isArray(saved) && saved.name) {
			return [{
				name: saved.name || '',
				role: saved.role || 'Primary Holder',
				customRole: saved.customRole || '',
				deviceType: saved.deviceType || data.deviceTypes[0],
				fingerprint: saved.fingerprint || '',
				deviceLocation: saved.deviceLocation || '',
				seedBackupLocation: saved.seedBackupLocation || ''
			}];
		}
		return [newHolder()];
	}

	let keyHolders = $state([]);

	// Decrypt on mount
	$effect(() => {
		if (data.encryptedBlob && data.iv) {
			getDek().then(dek => {
				if (dek) {
					decryptBlob(data.encryptedBlob, data.iv, dek).then(d => {
						ceremonyData = d;
						const kc = d.walletConfig?.keyCount || 0;
						keyHolders = Array.from({ length: kc }, (_, i) =>
							loadSaved(d.keyHolders?.[i])
						);
						loading = false;
					}).catch(() => { loading = false; });
				} else {
					loading = false;
				}
			});
		} else {
			loading = false;
		}
	});

	function addHolder(keyIndex) {
		keyHolders[keyIndex] = [...keyHolders[keyIndex], newHolder()];
	}

	function removeHolder(keyIndex, holderIndex) {
		keyHolders[keyIndex] = keyHolders[keyIndex].filter((_, j) => j !== holderIndex);
	}

	const allNamed = $derived(keyHolders.length > 0 && keyHolders.every(holders => holders.length > 0 && holders[0].name.trim()));

	async function handleSubmit(event) {
		event.preventDefault();
		submitting = true;

		try {
			const dek = await getDek();
			if (!dek) {
				window.location.href = '/?login';
				return;
			}

			// Validate each key has at least one named holder
			for (let i = 0; i < keyCount; i++) {
				const holders = keyHolders[i];
				if (!holders || holders.length === 0 || !holders[0].name.trim()) {
					submitting = false;
					return;
				}
			}

			const updated = {
				...ceremonyData,
				keyHolders: Object.fromEntries(keyHolders.map((holders, i) => [i, holders]))
			};

			const { ciphertext, iv } = await encryptBlob(updated, dek);

			const formEl = event.target;
			formEl.querySelector('[name="encryptedBlob"]').value = ciphertext;
			formEl.querySelector('[name="iv"]').value = iv;
			formEl.submit();
		} catch (err) {
			submitting = false;
		}
	}
</script>

<h2>Key Holders</h2>

{#if loading}
	<p class="status">Decrypting your data...</p>
{:else if keyCount === 0}
	<p class="error">No wallet configuration found. <a href="/ceremony/setup">Go back to setup.</a></p>
{:else}
	<p>Identify who holds each key in your {quorumRequired}-of-{keyCount} multisig wallet.</p>

	<div class="wallet-summary">
		{#if walletType}
			<span class="wallet-type">{walletType}</span>
		{/if}
		<span class="quorum">{quorumRequired}-of-{keyCount} multisig</span>
	</div>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<form method="POST" onsubmit={handleSubmit}>
		<input type="hidden" name="encryptedBlob" />
		<input type="hidden" name="iv" />

		<div class="key-list">
			{#each Array.from({ length: keyCount }) as _, i}
				<div class="key-card">
					<div class="key-header">
						<span class="key-label">Key {i + 1}</span>
					</div>

					{#each keyHolders[i] as kh, j}
						<div class="holder-section" class:additional={j > 0}>
							{#if j > 0}
								<div class="holder-divider">
									<span>Holder {j + 1}</span>
									<button type="button" class="remove-holder" onclick={() => removeHolder(i, j)}>Remove</button>
								</div>
							{/if}

							<div class="fields">
								<label>
									<span>Name {#if j === 0}<span class="required">*</span>{/if}</span>
									<input type="text" placeholder="e.g. David Pinkerton" bind:value={kh.name} required={j === 0} />
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
									<span>Key Fingerprint (optional)</span>
									<input type="text" placeholder="e.g. 73c5da0a" bind:value={kh.fingerprint} maxlength="8" />
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

					<button type="button" class="add-holder" onclick={() => addHolder(i)}>+ Add another holder for this key</button>
				</div>
			{/each}
		</div>

		<button type="submit" disabled={!allNamed || submitting}>
			{submitting ? 'Encrypting...' : 'Continue to Recovery Instructions'}
		</button>
	</form>
{/if}

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
		margin-bottom: 1rem;
	}

	.key-label {
		font-weight: bold;
		font-size: 1rem;
		color: var(--accent);
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

	.holder-section.additional {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
	}

	.holder-divider {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		padding-bottom: 0.25rem;
		border-top: 1px dashed var(--border);
		padding-top: 0.75rem;
	}

	.holder-divider span {
		font-size: 0.8rem;
		color: var(--text-muted);
		font-weight: bold;
	}

	.remove-holder {
		padding: 0.2rem 0.5rem;
		background: none;
		color: var(--danger);
		border: 1px solid var(--danger);
		font-size: 0.7rem;
		font-weight: normal;
		min-width: auto;
	}

	.remove-holder:hover {
		background: rgba(239, 68, 68, 0.1);
	}

	.add-holder {
		margin-top: 0.75rem;
		padding: 0.375rem 0.75rem;
		background: var(--bg-elevated);
		color: var(--text-muted);
		border: 1px dashed var(--border);
		font-size: 0.8rem;
		font-weight: normal;
		align-self: stretch;
		width: 100%;
	}

	.add-holder:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}

	.error a {
		color: var(--accent);
	}

	.status {
		color: var(--accent);
	}
</style>
