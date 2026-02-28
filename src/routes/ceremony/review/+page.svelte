<script>
	import { getDek, decryptBlob } from '$lib/crypto.js';
	import { generateCeremonyPdf } from '$lib/ceremony-pdf.js';

	let { data, form } = $props();

	let loading = $state(true);
	let ceremonyData = $state({});
	let pdfDownloaded = $state(false);
	let generating = $state(false);
	let completing = $state(false);
	let ceremonyRef = $state('');

	let walletConfig = $derived(ceremonyData.walletConfig || {});
	let keyHolders = $derived(ceremonyData.keyHolders || {});
	let recoveryInstructions = $derived(ceremonyData.recoveryInstructions || {});

	// Decrypt on mount
	$effect(() => {
		if (data.encryptedBlob && data.iv) {
			getDek().then(dek => {
				if (dek) {
					decryptBlob(data.encryptedBlob, data.iv, dek).then(d => {
						ceremonyData = d;
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

	async function downloadPdf() {
		generating = true;
		try {
			const result = generateCeremonyPdf({
				walletConfig,
				keyHolders,
				recoveryInstructions
			});
			ceremonyRef = result.ceremonyReference;
			pdfDownloaded = true;
		} catch (err) {
			console.error('PDF generation failed:', err);
		} finally {
			generating = false;
		}
	}

	function handleComplete(event) {
		completing = true;
		// ceremonyReference is set in the hidden field
	}
</script>

<h2>Review & Generate</h2>

{#if loading}
	<p class="status">Decrypting your data...</p>
{:else}
	<p>Review all sections of your ceremony record before generating the PDF.</p>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<div class="review-cards">
		<div class="review-card">
			<div class="card-header">
				<h3>Wallet Setup</h3>
				<a href="/ceremony/setup" class="edit-link">Edit</a>
			</div>
			<dl>
				{#if walletConfig.walletType}
					<dt>Wallet Type</dt>
					<dd>{walletConfig.walletType}</dd>
				{/if}
				<dt>Quorum</dt>
				<dd>{walletConfig.quorumRequired}-of-{walletConfig.keyCount}</dd>
			</dl>
		</div>

		<div class="review-card">
			<div class="card-header">
				<h3>Key Holders</h3>
				<a href="/ceremony/key-holders" class="edit-link">Edit</a>
			</div>
			<div class="keyholder-list">
				{#each Array.from({ length: walletConfig.keyCount || 0 }) as _, i}
					{@const holders = Array.isArray(keyHolders[i]) ? keyHolders[i] : keyHolders[i] ? [keyHolders[i]] : [{ name: 'Unknown' }]}
					{#each holders as holder, j}
						<div class="keyholder-row">
							{#if j === 0}
								<span class="kh-key">Key {i + 1}</span>
							{:else}
								<span class="kh-key"></span>
							{/if}
							<span class="kh-name">{holder.name || 'Unknown'}</span>
							<span class="kh-role">{holder.role === 'Custom' ? holder.customRole : holder.role || ''}</span>
							<span class="kh-device">{holder.deviceType || ''}</span>
							{#if holder.fingerprint}
								<span class="kh-fingerprint">{holder.fingerprint}</span>
							{/if}
						</div>
					{/each}
				{/each}
			</div>
		</div>

		<div class="review-card">
			<div class="card-header">
				<h3>Recovery Instructions</h3>
				<a href="/ceremony/recovery" class="edit-link">Edit</a>
			</div>
			<dl>
				{#if recoveryInstructions.walletSoftware}
					<dt>Software</dt>
					<dd>{recoveryInstructions.walletSoftware}</dd>
				{/if}
				{#if recoveryInstructions.descriptorStorage}
					<dt>Descriptor Location</dt>
					<dd>{recoveryInstructions.descriptorStorage}</dd>
				{/if}
				{#if recoveryInstructions.emergencySteps}
					<dt>Recovery Steps</dt>
					<dd class="pre-wrap">{recoveryInstructions.emergencySteps}</dd>
				{/if}
				{#if recoveryInstructions.emergencyContacts}
					<dt>Contacts</dt>
					<dd>{recoveryInstructions.emergencyContacts}</dd>
				{/if}
			</dl>
		</div>
	</div>

	<div class="actions">
		<button class="generate-btn" onclick={downloadPdf} disabled={generating || pdfDownloaded}>
			{#if generating}
				Generating PDF...
			{:else if pdfDownloaded}
				PDF Downloaded
			{:else}
				Download Ceremony PDF
			{/if}
		</button>

		{#if pdfDownloaded}
			<form method="POST" action="?/complete" onsubmit={handleComplete}>
				<input type="hidden" name="ceremonyReference" value={ceremonyRef} />
				<button type="submit" class="complete-btn" disabled={completing}>
					{completing ? 'Completing...' : 'Complete Ceremony'}
				</button>
			</form>
		{/if}
	</div>
{/if}

<style>
	.review-cards {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.review-card {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.card-header h3 {
		color: var(--accent);
		margin: 0;
		font-size: 1rem;
	}

	.edit-link {
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.edit-link:hover {
		color: var(--accent);
	}

	dl {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: 0.5rem 1rem;
		margin: 0;
	}

	dt { color: var(--text-muted); font-size: 0.875rem; }
	dd { color: var(--text); margin: 0; font-size: 0.875rem; }

	.pre-wrap { white-space: pre-wrap; }

	.keyholder-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.keyholder-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		font-size: 0.85rem;
		flex-wrap: wrap;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-subtle);
	}

	.keyholder-row:last-child { border-bottom: none; }

	.kh-key {
		color: var(--accent);
		font-weight: bold;
		font-size: 0.8rem;
		min-width: 3rem;
	}

	.kh-name { font-weight: bold; }
	.kh-role { color: var(--text-muted); }
	.kh-device { color: var(--text-dim); font-size: 0.8rem; }

	.kh-fingerprint {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.actions {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		flex-wrap: wrap;
	}

	.generate-btn {
		padding: 0.875rem 2rem;
		background: var(--accent);
		color: #000;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		font-size: 1rem;
		cursor: pointer;
	}

	.generate-btn:hover { background: var(--accent-hover); }
	.generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.complete-btn {
		padding: 0.875rem 2rem;
		background: var(--success, #22c55e);
		color: #000;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		font-size: 1rem;
		cursor: pointer;
	}

	.complete-btn:hover { opacity: 0.9; }
	.complete-btn:disabled { opacity: 0.4; cursor: not-allowed; }

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}

	.status {
		color: var(--accent);
	}
</style>
