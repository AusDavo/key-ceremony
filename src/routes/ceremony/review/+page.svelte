<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let generating = $state(false);

	function computeRating() {
		const q = data.descriptorParsed.quorum;
		if (!q) return 'A+';
		if (data.quorumAchieved >= q.total) return 'A+';
		if (data.quorumAchieved >= q.required) return 'A';
		return 'F';
	}

	const rating = computeRating();
</script>

<h2>Review & Generate</h2>
<p>Review all sections of your ceremony record before generating the PDF.</p>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<div class="review-cards">
	<div class="review-card">
		<div class="card-header">
			<h3>Wallet Setup</h3>
			<a href="/ceremony/descriptor" class="edit-link">Edit</a>
		</div>
		<dl>
			<dt>Script Type</dt>
			<dd>{data.descriptorParsed.addressTypeLabel}</dd>
			{#if data.descriptorParsed.quorum}
				<dt>Quorum</dt>
				<dd>{data.descriptorParsed.quorum.required}-of-{data.descriptorParsed.quorum.total}</dd>
			{/if}
			<dt>Keys</dt>
			<dd>{data.descriptorParsed.xpubs.length}</dd>
		</dl>
	</div>

	<div class="review-card">
		<div class="card-header">
			<h3>Key Holders</h3>
			<a href="/ceremony/key-holders" class="edit-link">Edit</a>
		</div>
		<div class="keyholder-list">
			{#each data.descriptorParsed.xpubs as xpub, i}
				{@const holder = data.keyHolders[i]}
				{@const signed = data.signatures.includes(String(i))}
				<div class="keyholder-row">
					<span class="kh-fingerprint">{xpub.xpubFingerprint}</span>
					<span class="kh-name">{holder?.name || 'Unknown'}</span>
					<span class="kh-role">{holder?.role === 'Custom' ? holder?.customRole : holder?.role || ''}</span>
					<span class="kh-device">{holder?.deviceType || ''}</span>
					{#if signed}
						<span class="kh-verified">Verified</span>
					{:else}
						<span class="kh-unverified">Not verified</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<div class="review-card">
		<div class="card-header">
			<h3>Verification</h3>
			<a href="/ceremony/verification" class="edit-link">Edit</a>
		</div>
		<dl>
			<dt>Challenge</dt>
			<dd><code>{data.challenge}</code></dd>
			<dt>Block Height</dt>
			<dd>{data.blockHeight?.toLocaleString()}</dd>
			<dt>Keys Verified</dt>
			<dd>{data.quorumAchieved} of {data.descriptorParsed.xpubs.length}</dd>
			<dt>Grade</dt>
			<dd>
				<span class="grade" class:pass={rating !== 'F'} class:fail={rating === 'F'}>{rating}</span>
			</dd>
		</dl>
	</div>

	<div class="review-card">
		<div class="card-header">
			<h3>Recovery Instructions</h3>
			<a href="/ceremony/recovery" class="edit-link">Edit</a>
		</div>
		<dl>
			{#if data.recoveryInstructions.walletSoftware}
				<dt>Software</dt>
				<dd>{data.recoveryInstructions.walletSoftware}</dd>
			{/if}
			{#if data.recoveryInstructions.descriptorStorage}
				<dt>Descriptor Location</dt>
				<dd>{data.recoveryInstructions.descriptorStorage}</dd>
			{/if}
			{#if data.recoveryInstructions.emergencySteps}
				<dt>Recovery Steps</dt>
				<dd class="pre-wrap">{data.recoveryInstructions.emergencySteps}</dd>
			{/if}
			{#if data.recoveryInstructions.emergencyContacts}
				<dt>Contacts</dt>
				<dd>{data.recoveryInstructions.emergencyContacts}</dd>
			{/if}
		</dl>
	</div>
</div>

<form method="POST" action="?/generate" use:enhance={() => {
	generating = true;
	return async ({ update }) => {
		generating = false;
		await update();
	};
}}>
	<button type="submit" class="generate-btn" disabled={generating}>
		{#if generating}
			Generating ceremony record...
		{:else}
			Generate Ceremony PDF
		{/if}
	</button>
</form>

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
	dd code { font-size: 0.8rem; }

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

	.kh-fingerprint {
		font-family: var(--font-mono);
		color: var(--accent);
		font-size: 0.8rem;
	}

	.kh-name { font-weight: bold; }
	.kh-role { color: var(--text-muted); }
	.kh-device { color: var(--text-dim); font-size: 0.8rem; }

	.kh-verified {
		color: var(--success);
		font-size: 0.75rem;
		font-weight: bold;
		padding: 0.1rem 0.5rem;
		background: rgba(34, 197, 94, 0.1);
		border-radius: 1rem;
	}

	.kh-unverified {
		color: var(--text-dim);
		font-size: 0.75rem;
	}

	.grade {
		font-weight: bold;
		font-size: 1rem;
	}

	.grade.pass { color: var(--success); }
	.grade.fail { color: var(--danger); }

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

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}
</style>
