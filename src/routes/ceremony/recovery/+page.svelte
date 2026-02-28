<script>
	let { data, form } = $props();

	let walletSoftware = $state(data.savedRecovery?.walletSoftware || '');
	let descriptorStorage = $state(data.savedRecovery?.descriptorStorage || '');
	let emergencySteps = $state(data.savedRecovery?.emergencySteps || '');
	let emergencyContacts = $state(data.savedRecovery?.emergencyContacts || '');
	let additionalNotes = $state(data.savedRecovery?.additionalNotes || '');
</script>

<h2>Recovery Instructions</h2>
<p>Document how your wallet can be reconstructed. This information will be included in your ceremony record.</p>

<div class="wallet-context">
	<dl>
		{#if data.walletType}
			<dt>Wallet Type</dt>
			<dd>{data.walletType}</dd>
		{/if}
		<dt>Quorum</dt>
		<dd>{data.quorumRequired} of {data.keyCount} keys required</dd>
	</dl>
</div>

<form method="POST">
	<div class="question-group">
		<h3>Wallet Software</h3>
		<p class="question-hint">What software should be used to reconstruct this wallet?</p>
		<label>
			<span>Recommended wallet software</span>
			<input type="text" name="walletSoftware" bind:value={walletSoftware}
				placeholder="e.g. Sparrow Wallet, Electrum, Nunchuk" />
		</label>
	</div>

	<div class="question-group">
		<h3>Where is the descriptor stored?</h3>
		<p class="question-hint">The descriptor is essential for recovery. Without it, the wallet cannot be reconstructed even with all seed phrases.</p>
		<label>
			<span>Descriptor storage locations</span>
			<textarea name="descriptorStorage" bind:value={descriptorStorage} rows="3"
				placeholder="e.g. Saved in Sparrow Wallet on laptop. Printed copy in fireproof safe. Encrypted backup in vault."></textarea>
		</label>
	</div>

	<div class="question-group">
		<h3>Emergency Recovery Steps</h3>
		<p class="question-hint">What should someone do first in an emergency? Walk through the numbered steps to reconstruct the wallet.</p>
		<label>
			<span>Step-by-step instructions</span>
			<textarea name="emergencySteps" bind:value={emergencySteps} rows="6"
				placeholder="1. Install Sparrow Wallet on a secure computer&#10;2. Go to File > Import Wallet&#10;3. Paste the output descriptor from [location]&#10;4. Verify the wallet addresses match&#10;5. Connect hardware wallets to sign transactions&#10;6. At least {data.quorumRequired} of {data.keyCount} keys must sign each transaction"></textarea>
		</label>
	</div>

	<div class="question-group">
		<h3>Emergency Contacts</h3>
		<p class="question-hint">Who should be contacted if the primary holder is unavailable?</p>
		<label>
			<span>Contact information</span>
			<textarea name="emergencyContacts" bind:value={emergencyContacts} rows="3"
				placeholder="e.g. Spouse: Jane Doe (0400 000 000). Lawyer: Smith & Associates. Bitcoin advisor: [name/company]."></textarea>
		</label>
	</div>

	<div class="question-group">
		<h3>Additional Notes</h3>
		<label>
			<span>Any other recovery information</span>
			<textarea name="additionalNotes" bind:value={additionalNotes} rows="3"
				placeholder="e.g. Passphrase used on Coldcard key. testnet descriptor available for practice."></textarea>
		</label>
	</div>

	<button type="submit">Continue to Review</button>
</form>

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
</style>
