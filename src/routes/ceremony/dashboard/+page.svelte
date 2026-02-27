<script>
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();
	let countdown = $state('');

	function updateCountdown() {
		if (!data.purgeAfter) {
			countdown = '';
			return;
		}
		const now = Date.now();
		const purge = new Date(data.purgeAfter).getTime();
		const diff = purge - now;

		if (diff <= 0) {
			countdown = 'Purge imminent';
			return;
		}

		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days >= 1) {
			countdown = `${days} day${days !== 1 ? 's' : ''} remaining`;
		} else {
			const hours = Math.floor(diff / (1000 * 60 * 60));
			const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
			countdown = `${hours}h ${mins}m remaining`;
		}
	}

	onMount(() => {
		updateCountdown();
		const timer = setInterval(updateCountdown, 60000);
		return () => clearInterval(timer);
	});
</script>

<h2>Ceremony Complete</h2>

<div class="ceremony-card">
	<div class="ceremony-details">
		<dl>
			<dt>Reference</dt>
			<dd>{data.ceremonyReference}</dd>
			<dt>Document SHA-256</dt>
			<dd><code>{data.documentHash}</code></dd>
			<dt>Descriptor SHA-256</dt>
			<dd><code>{data.descriptorHash}</code></dd>
		</dl>
	</div>

	<a href="/ceremony/download" class="download-button">Download Ceremony PDF</a>
</div>

{#if data.hasDescriptor}
	<div class="vault-cta">
		<h3>Save Descriptor to Vault</h3>
		<p>Encrypt your wallet descriptor with your passkey. Only you can decrypt it — the server never sees the plaintext.</p>
		<a href="/vault" class="vault-button">Open Vault</a>
	</div>
{/if}

{#if data.donationsEnabled}
	<div class="donate-cta">
		<h3>Support Key Ceremony</h3>
		<p>This tool is free and open source. If you found it useful, consider making a Bitcoin donation.</p>
		<a href="/api/donate" class="donate-button" target="_blank">Donate with Bitcoin</a>
	</div>
{/if}

<div class="upsell-cta">
	<h3>Need Proof-of-Reserves?</h3>
	<p>CertainKey generates audit-ready Bitcoin proof-of-reserves reports for SMSFs and institutions.</p>
	<a href="https://certainkey.com" class="upsell-link" target="_blank" rel="noopener">Learn more at certainkey.com</a>
</div>

<div class="purge-notice">
	{#if countdown}
		<p>Your data will be automatically purged for privacy. <strong>{countdown}</strong> until deletion.</p>
	{/if}
	<p>Save your ceremony record — once purged, it cannot be recovered. The document's SHA-256 hash remains on file for verification.</p>
</div>

<div class="actions">
	<form method="POST" action="?/reset" use:enhance>
		<button type="submit" class="secondary" onclick={(e) => {
			if (!confirm('This will clear all your data and start fresh. Make sure you have downloaded your ceremony record.')) {
				e.preventDefault();
			}
		}}>Start New Ceremony</button>
	</form>
</div>

<style>
	.ceremony-card {
		padding: 1.5rem;
		border: 1px solid var(--success);
		border-radius: 0.5rem;
		background: rgba(34, 197, 94, 0.05);
		margin-bottom: 1.5rem;
	}

	.ceremony-details {
		margin-bottom: 1rem;
	}

	dl {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: 0.5rem 1rem;
		margin: 0;
	}

	dt {
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	dd {
		color: var(--text);
		margin: 0;
	}

	dd code {
		font-size: 0.75rem;
		word-break: break-all;
	}

	.download-button {
		display: inline-block;
		padding: 0.875rem 2rem;
		background: var(--accent);
		color: #000;
		border-radius: 0.375rem;
		font-weight: bold;
		text-decoration: none;
		margin: 1rem 0;
	}

	.download-button:hover {
		background: var(--accent-hover);
	}

	.vault-cta, .donate-cta, .upsell-cta {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
		margin-bottom: 1rem;
	}

	.vault-cta h3, .donate-cta h3, .upsell-cta h3 {
		color: var(--accent);
		font-size: 1rem;
		margin-bottom: 0.25rem;
	}

	.vault-cta p, .donate-cta p, .upsell-cta p {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
		line-height: 1.5;
	}

	.vault-button, .donate-button {
		display: inline-block;
		padding: 0.625rem 1.25rem;
		background: var(--accent);
		color: #000;
		border-radius: 0.375rem;
		font-weight: bold;
		font-size: 0.875rem;
		text-decoration: none;
	}

	.vault-button:hover, .donate-button:hover {
		background: var(--accent-hover);
	}

	.upsell-link {
		color: var(--accent);
		font-size: 0.875rem;
	}

	.purge-notice {
		padding: 1rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.purge-notice strong {
		color: var(--accent);
	}

	.actions {
		margin-bottom: 1.5rem;
	}

	button.secondary {
		padding: 0.625rem 1.25rem;
		background: var(--border);
		color: var(--text);
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	button.secondary:hover {
		opacity: 0.9;
	}
</style>
