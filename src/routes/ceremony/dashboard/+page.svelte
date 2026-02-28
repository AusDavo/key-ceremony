<script>
	import { enhance } from '$app/forms';

	let { data } = $props();
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
		<p class="downloaded-notice">Your ceremony PDF has already been downloaded and deleted from the server.</p>
	{/if}
</div>

{#if data.hasDescriptor}
	<div class="vault-cta">
		<h3>Save Descriptor to Vault</h3>
		<p>Encrypt your wallet descriptor with your passkey. Only you can decrypt it — the server never sees the plaintext. Requires a passkey with PRF support (e.g. YubiKey, Windows Hello).</p>
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
	<a href="https://app.certainkey.dpinkerton.com" class="upsell-link" target="_blank" rel="noopener">Try CertainKey</a>
</div>

<div class="purge-notice">
	<p>Your ceremony data is encrypted at rest on the server (AES-256-GCM). Vault entries use zero-knowledge encryption — the server cannot decrypt them. You can <a href="/settings">delete your account</a> and all data from Settings at any time.</p>
</div>

<div class="actions">
	<form method="POST" action="?/reset" use:enhance>
		<button type="submit" class="secondary" onclick={(e) => {
			if (!confirm('This will clear all ceremony data and start fresh. This cannot be undone.')) {
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

	.purge-notice a {
		color: var(--text);
		text-decoration: underline;
	}

	.purge-notice a:hover {
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
