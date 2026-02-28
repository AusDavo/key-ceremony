<script>
	import { getDek, encryptBlob, decryptBlob } from '$lib/crypto.js';

	let { data, form } = $props();

	let loading = $state(true);
	let submitting = $state(false);
	let ceremonyData = $state({});

	let quorumRequired = $derived(ceremonyData.walletConfig?.quorumRequired || 0);
	let keyCount = $derived(ceremonyData.walletConfig?.keyCount || 0);
	let walletType = $derived(ceremonyData.walletConfig?.walletType || '');

	let walletSoftware = $state('');
	let descriptorStorage = $state('');
	let emergencySteps = $state('');
	let emergencyContacts = $state('');
	let additionalNotes = $state('');

	// Decrypt on mount
	$effect(() => {
		if (data.encryptedBlob && data.iv) {
			getDek().then(dek => {
				if (dek) {
					decryptBlob(data.encryptedBlob, data.iv, dek).then(d => {
						ceremonyData = d;
						if (d.recoveryInstructions) {
							walletSoftware = d.recoveryInstructions.walletSoftware || '';
							descriptorStorage = d.recoveryInstructions.descriptorStorage || '';
							emergencySteps = d.recoveryInstructions.emergencySteps || '';
							emergencyContacts = d.recoveryInstructions.emergencyContacts || '';
							additionalNotes = d.recoveryInstructions.additionalNotes || '';
						}
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

	async function handleSubmit(event) {
		event.preventDefault();
		submitting = true;

		try {
			const dek = await getDek();
			if (!dek) {
				window.location.href = '/?login';
				return;
			}

			const updated = {
				...ceremonyData,
				recoveryInstructions: {
					walletSoftware,
					descriptorStorage,
					emergencySteps,
					emergencyContacts,
					additionalNotes
				}
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

<h2>Recovery Instructions</h2>

{#if loading}
	<p class="status">Decrypting your data...</p>
{:else}
	<p>Document how your wallet can be reconstructed. This information will be included in your ceremony record.</p>

	{#if walletType || keyCount}
		<div class="wallet-context">
			<dl>
				{#if walletType}
					<dt>Wallet Type</dt>
					<dd>{walletType}</dd>
				{/if}
				{#if keyCount}
					<dt>Quorum</dt>
					<dd>{quorumRequired} of {keyCount} keys required</dd>
				{/if}
			</dl>
		</div>
	{/if}

	<form method="POST" onsubmit={handleSubmit}>
		<input type="hidden" name="encryptedBlob" />
		<input type="hidden" name="iv" />

		<div class="question-group">
			<h3>Wallet Software</h3>
			<p class="question-hint">What software should be used to reconstruct this wallet?</p>
			<label>
				<span>Recommended wallet software</span>
				<input type="text" bind:value={walletSoftware}
					placeholder="e.g. Sparrow Wallet, Electrum, Nunchuk" />
			</label>
		</div>

		<div class="question-group">
			<h3>Where is the descriptor stored?</h3>
			<p class="question-hint">The descriptor is essential for recovery. Without it, the wallet cannot be reconstructed even with all seed phrases.</p>
			<label>
				<span>Descriptor storage locations</span>
				<textarea bind:value={descriptorStorage} rows="3"
					placeholder="e.g. Saved in Sparrow Wallet on laptop. Printed copy in fireproof safe. Encrypted backup in vault."></textarea>
			</label>
		</div>

		<div class="question-group">
			<h3>Emergency Recovery Steps</h3>
			<p class="question-hint">What should someone do first in an emergency? Walk through the numbered steps to reconstruct the wallet.</p>
			<label>
				<span>Step-by-step instructions</span>
				<textarea bind:value={emergencySteps} rows="6"
					placeholder="1. Install Sparrow Wallet on a secure computer&#10;2. Go to File > Import Wallet&#10;3. Paste the output descriptor from [location]&#10;4. Verify the wallet addresses match&#10;5. Connect hardware wallets to sign transactions&#10;6. At least {quorumRequired} of {keyCount} keys must sign each transaction"></textarea>
			</label>
		</div>

		<div class="question-group">
			<h3>Emergency Contacts</h3>
			<p class="question-hint">Who should be contacted if the primary holder is unavailable?</p>
			<label>
				<span>Contact information</span>
				<textarea bind:value={emergencyContacts} rows="3"
					placeholder="e.g. Spouse: Jane Doe (0400 000 000). Lawyer: Smith & Associates. Bitcoin advisor: [name/company]."></textarea>
			</label>
		</div>

		<div class="question-group">
			<h3>Additional Notes</h3>
			<label>
				<span>Any other recovery information</span>
				<textarea bind:value={additionalNotes} rows="3"
					placeholder="e.g. Passphrase used on Coldcard key. testnet descriptor available for practice."></textarea>
			</label>
		</div>

		<button type="submit" disabled={submitting}>
			{submitting ? 'Encrypting...' : 'Continue to Review'}
		</button>
	</form>
{/if}

<style>
	.wallet-context {
		padding: 0.75rem 1rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		margin-bottom: 1.5rem;
	}

	dl {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 0.25rem 1rem;
		margin: 0;
		font-size: 0.875rem;
	}

	dt { color: var(--text-muted); }
	dd { color: var(--text); margin: 0; }

	form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		max-width: 600px;
	}

	.question-group {
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 1.25rem;
		background: var(--bg-surface);
	}

	.question-group h3 {
		color: var(--accent);
		font-size: 1rem;
		margin-bottom: 0.25rem;
	}

	.question-hint {
		color: var(--text-muted);
		font-size: 0.8rem;
		margin-bottom: 0.75rem;
		line-height: 1.5;
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

	input[type="text"], textarea {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-size: 0.875rem;
	}

	input[type="text"]:focus, textarea:focus {
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

	.status {
		color: var(--accent);
	}
</style>
