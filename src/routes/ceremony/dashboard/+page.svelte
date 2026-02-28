<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
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

	{#if data.hasPdf}
		<p class="download-notice">Your ceremony PDF is available for a single download. It will be permanently deleted from the server once downloaded.</p>
		<a href="/ceremony/download" class="download-button">Download Ceremony PDF</a>
	{:else}
		<p class="downloaded-notice">Your ceremony PDF has been downloaded and deleted from the server.</p>
	{/if}
</div>

{#if data.hasDescriptor}
	<div class="your-data">
		<h3>Your Descriptor</h3>
		<p>Your wallet output descriptor is currently stored (encrypted) on the server. Choose what to do with it:</p>

		<div class="data-actions">
			<div class="data-action">
				<a href="/vault" class="action-button primary">Save to Vault</a>
				<span class="action-desc">Encrypt with your passkey (zero-knowledge). Requires PRF support (e.g. YubiKey, Windows Hello).</span>
			</div>

			<div class="data-action">
				<form method="POST" action="?/deleteDescriptor" use:enhance>
					<button type="submit" class="action-button danger" onclick={(e) => {
						if (!confirm('Delete your descriptor from the server? Make sure you have a copy (in your vault, on paper, or in your wallet software).')) {
							e.preventDefault();
						}
					}}>Delete from Server</button>
				</form>
				<span class="action-desc">Permanently remove the descriptor. Keep a copy elsewhere first.</span>
			</div>
		</div>
	</div>
{:else}
	<div class="data-clear">
		{#if form?.descriptorDeleted}
			<p class="success">Descriptor deleted from the server.</p>
		{:else}
			<p>No sensitive data remains on the server. Your descriptor has been removed.</p>
		{/if}
	</div>
{/if}

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
		border-radius: 0.375rem;
		font-weight: bold;
		text-decoration: none;
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

	/* Your data section */
	.your-data {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
		margin-bottom: 1.5rem;
	}

	.your-data h3 {
		color: var(--accent);
		font-size: 1rem;
		margin-bottom: 0.25rem;
	}

	.your-data > p {
		color: var(--text-muted);
		font-size: 0.875rem;
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.data-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.data-action {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.action-button {
		display: inline-block;
		padding: 0.625rem 1.25rem;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		font-size: 0.875rem;
		text-decoration: none;
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.action-button.primary {
		background: var(--accent);
		color: #000;
	}

	.action-button.primary:hover {
		background: var(--accent-hover);
	}

	.action-button.danger {
		background: var(--danger, #ef4444);
		color: #fff;
	}

	.action-button.danger:hover {
		opacity: 0.9;
	}

	.action-desc {
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.4;
	}

	/* Data cleared state */
	.data-clear {
		padding: 1rem 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	.data-clear .success {
		color: var(--success);
	}

	/* Next steps */
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

	/* CTA cards */
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
