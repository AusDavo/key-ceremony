<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	async function downloadPdf() {
		const link = document.createElement('a');
		link.href = '/ceremony/download';
		link.download = '';
		document.body.appendChild(link);
		link.click();
		link.remove();
		// Wait briefly for the download to start, then refresh data
		await new Promise(r => setTimeout(r, 1000));
		await invalidateAll();
	}
</script>

<h2>Ceremony Complete</h2>

<div class="ceremony-card">
	<div class="ceremony-details">
		<dl>
			<dt>Reference</dt>
			<dd>{data.ceremonyReference}</dd>
			<dt>Document SHA-256</dt>
			<dd><code>{data.documentHash}</code></dd>
		</dl>
	</div>

	{#if data.hasPdf}
		<p class="download-notice">Your ceremony PDF is available for a single download. It will be permanently deleted from the server once downloaded.</p>
		<button class="download-button" onclick={downloadPdf}>Download Ceremony PDF</button>
	{:else}
		<p class="downloaded-notice">Your ceremony PDF has been downloaded and deleted from the server.</p>
	{/if}
</div>

<div class="next-steps">
	<div class="next-actions">
		<form method="POST" action="?/reset" use:enhance>
			<button type="submit" class="secondary" onclick={(e) => {
				if (!confirm('Start a new ceremony? This will clear all remaining data.')) {
					e.preventDefault();
				}
			}}>Start New Ceremony</button>
		</form>

		<a href="/settings" class="secondary-link">Delete Account</a>
	</div>
</div>

{#if data.donationsEnabled}
	<div class="cta-card">
		<h3>Support Key Ceremony</h3>
		<p>This tool is free and open source. If you found it useful, consider making a Bitcoin donation.</p>
		<a href="/api/donate" class="cta-link" target="_blank">Donate with Bitcoin</a>
	</div>
{/if}

<div class="cta-card">
	<h3>Need Proof-of-Reserves?</h3>
	<p>CertainKey generates audit-ready Bitcoin proof-of-reserves reports for SMSFs and institutions.</p>
	<a href="https://app.certainkey.dpinkerton.com" class="cta-link" target="_blank" rel="noopener">Try CertainKey</a>
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
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		font-size: 1rem;
		cursor: pointer;
		margin: 1rem 0;
	}

	.download-button:hover {
		background: var(--accent-hover);
	}

	.download-notice {
		font-size: 0.85rem;
		color: var(--warning, #e2a308);
		margin-bottom: 0.5rem;
	}

	.downloaded-notice {
		font-size: 0.85rem;
		color: var(--text-muted);
		font-style: italic;
	}

	.next-steps {
		margin-bottom: 1.5rem;
	}

	.next-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
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

	.secondary-link {
		font-size: 0.875rem;
		color: var(--text-muted);
		text-decoration: underline;
	}

	.secondary-link:hover {
		color: var(--danger, #ef4444);
	}

	.cta-card {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
		margin-bottom: 1rem;
	}

	.cta-card h3 {
		color: var(--accent);
		font-size: 1rem;
		margin-bottom: 0.25rem;
	}

	.cta-card p {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
		line-height: 1.5;
	}

	.cta-link {
		color: var(--accent);
		font-size: 0.875rem;
	}
</style>
