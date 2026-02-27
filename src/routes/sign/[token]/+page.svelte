<script>
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import SignatureInput from '$lib/components/SignatureInput.svelte';

	let { data, form } = $props();
	let signatureText = $state('');
	let qrDataUrl = $state(null);
	let derivationPath = $state('0/0');
	let keyType = $state(data.defaultKeyType);
	let signingAddress = $state(data.defaultAddress);

	const hasMultisigPath = data.path && data.path.includes("48'");

	function detectSigFormat(sig) {
		if (!sig) return null;
		try {
			const bytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
			if (bytes.length === 65 && bytes[0] >= 27 && bytes[0] <= 42) {
				return 'BIP-137 (ECDSA)';
			}
			return 'BIP-322';
		} catch {
			return null;
		}
	}

	onMount(async () => {
		try {
			const QRCode = (await import('qrcode')).default;
			qrDataUrl = await QRCode.toDataURL(data.challenge, {
				width: 200,
				margin: 1,
				color: { dark: '#f7931a', light: '#0a0a1a' }
			});
		} catch {
			// QR generation failed — non-critical
		}
	});

	async function updateDerivedAddress() {
		try {
			const response = await fetch('/api/derive-address', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					xpub: data.xpubRaw,
					derivationPath,
					keyType
				})
			});
			const result = await response.json();
			if (result.address) signingAddress = result.address;
		} catch { /* ignore */ }
	}

	function downloadColdcardFile() {
		const fullPath = data.path && data.path !== 'unknown'
			? `m${data.path}/${derivationPath}`
			: null;
		const lines = [data.challenge];
		if (fullPath) lines.push(fullPath);
		const content = lines.join('\n') + '\n';
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `signing-challenge-key${data.xpubIndex + 1}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Key Ceremony — Sign Challenge</title>
</svelte:head>

<div class="container">
	<h1>Key Ceremony</h1>
	<h2>Remote Key Signing</h2>

	{#if data.alreadySigned && !form?.success}
		<div class="success-box">
			<p>This key has already been signed and verified. No further action needed.</p>
		</div>
	{:else if form?.success}
		<div class="success-box">
			<p>Signature verified successfully. You can close this page.</p>
			<p class="hint">The wallet owner will see your signature on their next refresh.</p>
		</div>
	{:else}
		<p>You've been asked to sign a challenge to verify ownership of a key.</p>

		<div class="challenge-box">
			<div class="challenge-main">
				<span class="challenge-label">Signing Challenge</span>
				<code class="challenge">{data.challenge}</code>
				<span class="challenge-meta">Block height: {data.blockHeight}</span>
				<div class="challenge-actions">
					<button type="button" class="action-btn" onclick={downloadColdcardFile}>
						Download .txt (Coldcard)
					</button>
				</div>
			</div>
			{#if qrDataUrl}
				<div class="challenge-qr">
					<img src={qrDataUrl} alt="Signing challenge QR code" width="160" height="160" />
					<span class="qr-hint">Scan with SeedSigner</span>
				</div>
			{/if}
		</div>

		{#if hasMultisigPath}
			<div class="seedsigner-notice">
				<strong>SeedSigner users:</strong> The standard SeedSigner firmware does not support signing messages
				at multisig derivation paths. You will need the
				<a href="https://github.com/AusDavo/seedsigner/releases/tag/0.8.6-multisig-msg-signing" target="_blank" rel="noopener">modified firmware (0.8.6-multisig-msg-signing)</a>
				to sign via the QR code above.
			</div>
		{/if}

		<div class="key-info">
			<h3>Your Key</h3>
			<dl>
				<dt>Key</dt>
				<dd>Key {data.xpubIndex + 1}: <span class="fingerprint">{data.xpubFingerprint}</span></dd>

				<dt>Xpub</dt>
				<dd><code>{data.xpubPreview}</code></dd>

				<dt>Path</dt>
				<dd><code>{data.path && data.path !== 'unknown' ? `m${data.path}/${derivationPath}` : `m/\u2026/${derivationPath}`}</code></dd>

				<dt>Signing address</dt>
				<dd><code class="address">{signingAddress || 'Unable to derive'}</code></dd>
			</dl>

			<details class="derivation-options">
				<summary>Derivation options</summary>
				<div class="options-grid">
					<label>
						<span>Derivation from xpub</span>
						<input
							type="text"
							bind:value={derivationPath}
							placeholder="0/0"
							onblur={updateDerivedAddress}
						/>
					</label>
					<label>
						<span>Address type</span>
						<select bind:value={keyType} onchange={updateDerivedAddress}>
							{#each data.keyTypes as kt}
								<option value={kt.value}>{kt.label}</option>
							{/each}
						</select>
					</label>
				</div>
			</details>
		</div>

		<form method="POST" use:enhance>
			<input type="hidden" name="derivationPath" value={derivationPath} />
			<input type="hidden" name="keyType" value={keyType} />
			<label>
				<span>Paste, scan, or upload signature</span>
				<textarea
					name="signature"
					rows="3"
					placeholder="Base64-encoded signature"
					required
					bind:value={signatureText}
				></textarea>
			</label>
			<SignatureInput onResult={(sig) => {
				signatureText = sig;
			}} />
			{#if detectSigFormat(signatureText)}
				<span class="detected-format">Detected: {detectSigFormat(signatureText)}</span>
			{/if}

			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}

			<button type="submit">Verify Signature</button>
		</form>
	{/if}
</div>

<style>
	.container {
		max-width: 600px;
		margin: 2rem auto;
		padding: 0 1rem;
		color: var(--text);
	}

	h1 {
		color: var(--accent);
		font-size: 1.5rem;
		margin-bottom: 0.25rem;
	}

	h2 {
		color: var(--text-muted);
		font-size: 1.125rem;
		margin-bottom: 1.5rem;
	}

	h3 {
		color: var(--accent);
		margin-bottom: 0.75rem;
	}

	.challenge-box {
		display: flex;
		gap: 1.5rem;
		padding: 1.25rem;
		background: var(--bg-input);
		border: 1px solid var(--accent);
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		align-items: center;
	}

	.challenge-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.challenge-label {
		font-size: 0.7rem;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.challenge {
		font-size: 1.25rem;
		color: var(--accent);
		font-weight: bold;
	}

	.challenge-meta {
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.challenge-actions {
		margin-top: 0.5rem;
	}

	.action-btn {
		padding: 0.4rem 0.75rem;
		background: var(--bg-elevated);
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.8rem;
		cursor: pointer;
		font-weight: normal;
	}

	.action-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.challenge-qr {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.challenge-qr img {
		border-radius: 0.375rem;
	}

	.qr-hint {
		font-size: 0.65rem;
		color: var(--text-dim);
	}

	.seedsigner-notice {
		padding: 0.75rem 1rem;
		background: rgba(142, 202, 230, 0.08);
		border: 1px solid var(--info);
		border-radius: 0.5rem;
		font-size: 0.8rem;
		color: var(--text-muted);
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}

	.seedsigner-notice strong {
		color: var(--info);
	}

	.seedsigner-notice a {
		color: var(--accent);
	}

	.key-info {
		padding: 1rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
	}

	dl {
		display: grid;
		grid-template-columns: 80px 1fr;
		gap: 0.5rem 1rem;
	}

	dt {
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	dd {
		color: var(--text);
		margin: 0;
		font-size: 0.875rem;
	}

	.fingerprint {
		color: var(--accent);
	}

	.address {
		color: var(--info) !important;
		word-break: break-all;
	}

	.derivation-options {
		margin-top: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
	}

	.derivation-options summary {
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.derivation-options summary:hover {
		color: var(--text);
	}

	.options-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.options-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.options-grid label span {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.options-grid input, .options-grid select {
		padding: 0.5rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.options-grid input:focus, .options-grid select:focus {
		outline: none;
		border-color: var(--accent);
	}

	form {
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
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	textarea {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	textarea:focus {
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
		opacity: 0.9;
	}

	.detected-format {
		font-size: 0.75rem;
		color: var(--text-muted);
		font-style: italic;
	}

	.error {
		color: var(--danger);
		font-size: 0.875rem;
	}

	.success-box {
		padding: 1.5rem;
		border: 1px solid var(--success);
		border-radius: 0.5rem;
		background: rgba(34, 197, 94, 0.05);
	}

	.success-box p {
		color: var(--success);
		font-weight: bold;
	}

	.hint {
		color: var(--text-muted) !important;
		font-weight: normal !important;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}
</style>
