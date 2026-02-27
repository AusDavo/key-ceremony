<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import SignatureInput from '$lib/components/SignatureInput.svelte';

	let { data, form } = $props();

	let copiedIndex = $state(null);
	let pollInterval = $state(null);
	let qrDataUrls = $state({});
	let qrScanUrls = $state({});
	let qrModalIndex = $state(null);

	const hasMultisigPaths = $derived(data.xpubs.some(x => x.path && x.path.includes("48'")));

	let xpubSettings = $state(
		data.xpubs.map((x) => ({
			derivationPath: x.derivationFromXpub,
			keyType: x.keyType,
			address: x.address,
			signatureText: ''
		}))
	);

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
			const thumbOpts = { width: 200, margin: 1, color: { dark: '#f7931a', light: '#0a0a1a' } };
			const scanOpts = { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } };
			for (let i = 0; i < data.xpubs.length; i++) {
				const xpub = data.xpubs[i];
				if (!xpub.path || xpub.path === 'unknown') continue;
				const fullPath = `m${xpub.path}/${xpubSettings[i].derivationPath}`;
				const content = `signmessage ${fullPath} ascii:${data.challenge}`;
				qrDataUrls[i] = await QRCode.toDataURL(content, thumbOpts);
				qrScanUrls[i] = await QRCode.toDataURL(content, scanOpts);
			}
		} catch { /* non-critical */ }
	});

	onMount(() => {
		const hasSharedLinks = Object.keys(data.shareTokens || {}).length > 0;
		if (hasSharedLinks && !data.quorumMet) {
			pollInterval = setInterval(() => invalidateAll(), 10_000);
		}
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	$effect(() => {
		const hasSharedLinks = Object.keys(data.shareTokens || {}).length > 0;
		if (hasSharedLinks && !data.quorumMet && !pollInterval) {
			pollInterval = setInterval(() => invalidateAll(), 10_000);
		}
		if (data.quorumMet && pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	});

	function downloadColdcardFile(xpubIndex) {
		const xpub = data.xpubs[xpubIndex];
		const settings = xpubSettings[xpubIndex];
		const fullPath = xpub.path && xpub.path !== 'unknown'
			? `m${xpub.path}/${settings.derivationPath}`
			: null;
		const lines = [data.challenge];
		if (fullPath) lines.push(fullPath);
		const content = lines.join('\n') + '\n';
		const blob = new Blob([content], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `signing-challenge-key${xpubIndex + 1}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function createAndCopyShareLink(xpubIndex) {
		let token = data.shareTokens?.[xpubIndex];
		if (!token) {
			const formData = new FormData();
			formData.set('xpubIndex', String(xpubIndex));
			try {
				const resp = await fetch('?/share', { method: 'POST', body: formData });
				const result = await resp.json();
				token = result?.data?.[1]?.shareToken;
				await invalidateAll();
			} catch { return; }
		}
		if (!token) { await invalidateAll(); return; }
		const url = `${window.location.origin}/sign/${token}`;
		await navigator.clipboard.writeText(url);
		copiedIndex = xpubIndex;
		setTimeout(() => { copiedIndex = null; }, 2000);
	}

	async function updateDerivedAddress(xpubIndex) {
		const settings = xpubSettings[xpubIndex];
		try {
			const response = await fetch('/api/derive-address', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					xpubIndex,
					derivationPath: settings.derivationPath,
					keyType: settings.keyType
				})
			});
			const result = await response.json();
			if (result.address) {
				xpubSettings[xpubIndex].address = result.address;
			}
		} catch { /* informational */ }
	}
</script>

<div class="page-header">
	<div>
		<h2>Key Verification</h2>
		<p>Sign the challenge message with your keys to prove ownership.
			{#if data.quorum}
				At least <strong>{data.quorum.required}</strong> of <strong>{data.quorum.total}</strong> signatures required.
			{/if}
		</p>
	</div>
	<form method="POST" action="?/reset" use:enhance={() => {
		if (!confirm('This will discard the current descriptor and all signatures. Continue?')) {
			return ({ update }) => update({ reset: false });
		}
	}}>
		<button type="submit" class="reset-btn">Reset</button>
	</form>
</div>

<div class="challenge-box">
	<div class="challenge-main">
		<span class="challenge-label">Signing Challenge</span>
		<code class="challenge">{data.challenge}</code>
		<span class="challenge-meta">Block height: {data.blockHeight}</span>
	</div>
</div>

{#if hasMultisigPaths}
	<div class="info-notice">
		<strong>SeedSigner users:</strong> The standard SeedSigner firmware does not support signing messages
		at multisig derivation paths. You will need the
		<a href="https://github.com/AusDavo/seedsigner/releases/tag/0.8.6-multisig-msg-signing" target="_blank" rel="noopener">modified firmware (0.8.6-multisig-msg-signing)</a>.
		<a href="https://github.com/SeedSigner/seedsigner/pull/874" target="_blank" rel="noopener" class="pr-link">Upstream PR #874</a>
	</div>
{/if}

<div class="info-notice">
	<strong>SeedSigner tip:</strong> Message signing is disabled by default.
	Go to <strong>Settings, Advanced, Message signing, Enabled</strong>.
</div>

<details class="help-block">
	<summary>How do I sign with my hardware wallet?</summary>
	<div class="help-content">
		<h4>Coldcard</h4>
		<ol>
			<li>Click <strong>Download .txt (Coldcard)</strong> and save to your SD card.</li>
			<li>On Coldcard: <strong>Advanced/Tools, Sign Message</strong>, select the file.</li>
			<li>Copy the base64 signature from the <code>-signed.txt</code> file and paste below.</li>
		</ol>
		<h4>SeedSigner</h4>
		<ol>
			<li>Tap the QR code to enlarge it, then scan with SeedSigner.</li>
			<li>Load your seed, review and approve.</li>
			<li>Click <strong>Scan QR</strong> below and point your camera at the SeedSigner screen.</li>
		</ol>
		<h4>Other wallets</h4>
		<p>Any wallet supporting BIP-137 or BIP-322 message signing will work.</p>
	</div>
</details>

<div class="xpub-list">
	{#each data.xpubs as xpub, i}
		{@const signed = data.signatures.includes(String(i))}
		{@const settings = xpubSettings[i]}
		{@const holder = data.keyHolders[i]}
		<div class="xpub-card" class:signed>
			<div class="xpub-header">
				<span class="xpub-label">
					Key {i + 1}: <span class="fingerprint">{xpub.xpubFingerprint}</span>
				</span>
				{#if signed}
					<span class="status-badge signed">Verified</span>
				{:else}
					<span class="status-badge pending">Pending</span>
				{/if}
			</div>

			{#if holder}
				<div class="holder-info">
					<span>{holder.name}</span>
					<span class="holder-role">{holder.role === 'Custom' ? holder.customRole : holder.role}</span>
					<span class="holder-device">{holder.deviceType}</span>
				</div>
			{/if}

			<div class="xpub-body">
				<div class="xpub-detail">
					<div class="detail-row">
						<span class="detail-label">Xpub</span>
						<code>{xpub.xpub.slice(0, 16)}...{xpub.xpub.slice(-8)}</code>
					</div>
					<div class="detail-row">
						<span class="detail-label">Derivation path</span>
						<code>{xpub.path && xpub.path !== 'unknown' ? `m${xpub.path}/${settings.derivationPath}` : `m/\u2026/${settings.derivationPath}`}</code>
					</div>
					<div class="detail-row">
						<span class="detail-label">Signing address</span>
						<code class="address">{settings.address || 'Unable to derive'}</code>
					</div>
				</div>

				{#if qrDataUrls[i]}
					<button type="button" class="xpub-qr" onclick={() => { qrModalIndex = i; }}>
						<div class="qr-thumb-wrapper">
							<img src={qrDataUrls[i]} alt="Signing QR for Key {i + 1}" width="100" height="100" />
							<span class="qr-expand-icon" aria-hidden="true">&#x2922;</span>
						</div>
						<span class="qr-hint">Tap to enlarge</span>
					</button>
				{/if}
			</div>

			{#if !signed}
				<details class="derivation-options">
					<summary>Derivation options</summary>
					<div class="options-grid">
						<label>
							<span>Derivation from xpub</span>
							<input
								type="text"
								value={settings.derivationPath}
								placeholder="0/0"
								oninput={(e) => { xpubSettings[i].derivationPath = e.target.value; }}
								onblur={() => updateDerivedAddress(i)}
							/>
						</label>
						<label>
							<span>Address type</span>
							<select
								value={settings.keyType}
								onchange={(e) => { xpubSettings[i].keyType = e.target.value; updateDerivedAddress(i); }}
							>
								{#each data.keyTypes as kt}
									<option value={kt.value}>{kt.label}</option>
								{/each}
							</select>
						</label>
					</div>
				</details>

				<form method="POST" action="?/sign" use:enhance class="sign-form">
					<input type="hidden" name="xpubIndex" value={i} />
					<input type="hidden" name="derivationPath" value={settings.derivationPath} />
					<input type="hidden" name="keyType" value={settings.keyType} />

					<label>
						<span>Paste, scan, or upload signature</span>
						<textarea
							name="signature"
							rows="3"
							placeholder="Base64-encoded signature"
							required
							bind:value={settings.signatureText}
						></textarea>
					</label>
					<SignatureInput onResult={(sig) => {
						xpubSettings[i].signatureText = sig;
					}} />
					{#if detectSigFormat(settings.signatureText)}
						<span class="detected-format">Detected: {detectSigFormat(settings.signatureText)}</span>
					{/if}

					{#if form?.error && form?.xpubIndex === i}
						<p class="error">{form.error}</p>
					{/if}

					<div class="form-actions">
						<button type="submit">Verify Signature</button>
						<button type="button" class="action-btn" onclick={() => downloadColdcardFile(i)}>
							Download .txt (Coldcard)
						</button>
						<button type="button" class="action-btn" onclick={() => createAndCopyShareLink(i)}>
							{copiedIndex === i ? 'Copied!' : 'Copy Share Link'}
						</button>
					</div>
				</form>
			{/if}
		</div>
	{/each}
</div>

{#if form?.error && form?.xpubIndex == null}
	<p class="error global-error">{form.error}</p>
{/if}

<div class="proceed-section">
	{#if data.quorumMet}
		<p class="quorum-met">Quorum reached — {data.signatures.length} of {data.quorum.total} keys verified.</p>
		<form method="POST" action="?/proceed" use:enhance>
			<button type="submit" class="proceed-button">Continue to Recovery Instructions</button>
		</form>
	{:else}
		<p class="quorum-pending">
			{data.signatures.length} of {data.quorum.required} required signatures verified.
		</p>
	{/if}
</div>

{#if qrModalIndex != null && qrScanUrls[qrModalIndex]}
	<div class="qr-overlay" role="dialog" aria-label="Scan QR code"
		onclick={() => { qrModalIndex = null; }}
		onkeydown={(e) => { if (e.key === 'Escape') qrModalIndex = null; }}
	>
		<div class="qr-modal" onclick={(e) => e.stopPropagation()}>
			<img src={qrScanUrls[qrModalIndex]} alt="Scan with SeedSigner" />
			<div class="qr-modal-info">
				<span class="qr-modal-label">Key {qrModalIndex + 1}: {data.xpubs[qrModalIndex].xpubFingerprint}</span>
				<code>{data.challenge}</code>
			</div>
			<button type="button" class="qr-modal-close" onclick={() => { qrModalIndex = null; }}>Close</button>
		</div>
	</div>
{/if}

<style>
	.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.5rem; }
	.reset-btn { background: none; color: var(--danger); border: 1px solid var(--danger); padding: 0.375rem 0.75rem; font-size: 0.8rem; font-weight: normal; white-space: nowrap; }
	.reset-btn:hover { background: rgba(239, 68, 68, 0.1); }
	.challenge-box { display: flex; gap: 1.5rem; padding: 1.25rem; background: var(--bg-input); border: 1px solid var(--accent); border-radius: 0.5rem; margin-bottom: 2rem; align-items: center; }
	.challenge-main { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
	.challenge-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
	.challenge { font-size: 1.25rem; color: var(--accent); font-weight: bold; }
	.challenge-meta { font-size: 0.75rem; color: var(--text-dim); }
	.info-notice { padding: 0.75rem 1rem; background: rgba(142, 202, 230, 0.08); border: 1px solid var(--info); border-radius: 0.5rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.5; }
	.info-notice strong { color: var(--info); }
	.info-notice a { color: var(--accent); }
	.info-notice .pr-link { display: inline; margin-left: 0.25rem; font-size: 0.75rem; color: var(--text-dim); }
	.xpub-list { display: flex; flex-direction: column; gap: 1rem; }
	.xpub-card { padding: 1.25rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--bg-surface); }
	.xpub-card.signed { border-color: var(--success); }
	.xpub-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
	.xpub-label { font-weight: bold; font-family: var(--font-mono); color: var(--text); font-size: 1rem; }
	.fingerprint { color: var(--accent); }
	.status-badge { font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 1rem; font-weight: bold; }
	.status-badge.signed { background: rgba(34, 197, 94, 0.15); color: var(--success); }
	.status-badge.pending { background: rgba(247, 147, 26, 0.15); color: var(--accent); }
	.holder-info { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.75rem; font-size: 0.85rem; flex-wrap: wrap; }
	.holder-role { color: var(--text-muted); }
	.holder-device { color: var(--text-dim); font-size: 0.8rem; }
	.xpub-body { display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1rem; }
	.xpub-detail { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; min-width: 0; }
	.detail-row { display: flex; gap: 0.75rem; align-items: baseline; font-size: 0.8rem; }
	.detail-label { color: var(--text-muted); min-width: 120px; flex-shrink: 0; }
	.detail-row code { color: var(--text); font-size: 0.8rem; word-break: break-all; overflow-wrap: anywhere; }
	.address { color: var(--info) !important; }
	.xpub-qr { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex-shrink: 0; background: none; border: none; padding: 0; cursor: pointer; font-weight: normal; min-width: auto; }
	.qr-thumb-wrapper { position: relative; display: inline-block; border: 1px solid var(--border); border-radius: 0.375rem; overflow: hidden; transition: transform 0.15s ease, border-color 0.15s ease; }
	.xpub-qr:hover .qr-thumb-wrapper { transform: scale(1.05); border-color: var(--accent); }
	.qr-expand-icon { position: absolute; bottom: 4px; right: 4px; font-size: 0.85rem; color: var(--accent); background: rgba(0, 0, 0, 0.6); border-radius: 0.2rem; padding: 1px 3px; line-height: 1; pointer-events: none; }
	.qr-hint { font-size: 0.65rem; color: var(--text-dim); }
	.qr-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.85); display: flex; align-items: center; justify-content: center; padding: 1rem; }
	.qr-modal { display: flex; flex-direction: column; align-items: center; gap: 1rem; max-width: 90vw; }
	.qr-modal img { width: min(80vw, 400px); height: min(80vw, 400px); border-radius: 0.5rem; }
	.qr-modal-info { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
	.qr-modal-label { color: var(--text-muted); font-size: 0.85rem; }
	.qr-modal-info code { color: var(--accent); font-size: 1.25rem; font-weight: bold; }
	.qr-modal-close { padding: 0.5rem 2rem; background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--border); font-weight: normal; font-size: 0.875rem; }
	.derivation-options { margin-bottom: 1rem; border: 1px solid var(--border-subtle); border-radius: 0.375rem; padding: 0.5rem 0.75rem; }
	.derivation-options summary { cursor: pointer; color: var(--text-muted); font-size: 0.8rem; }
	.options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.75rem; }
	.options-grid label { display: flex; flex-direction: column; gap: 0.25rem; }
	.options-grid label span { font-size: 0.75rem; color: var(--text-muted); }
	.options-grid input, .options-grid select { padding: 0.5rem; border: 1px solid var(--border); border-radius: 0.375rem; background: var(--bg-input); color: var(--text); font-family: var(--font-mono); font-size: 0.8rem; }
	.options-grid input:focus, .options-grid select:focus { outline: none; border-color: var(--accent); }
	.sign-form { display: flex; flex-direction: column; gap: 0.75rem; }
	.sign-form label { display: flex; flex-direction: column; gap: 0.25rem; }
	.sign-form label span { font-size: 0.75rem; color: var(--text-muted); }
	textarea { padding: 0.75rem; border: 1px solid var(--border); border-radius: 0.375rem; background: var(--bg-input); color: var(--text); font-family: var(--font-mono); font-size: 0.8rem; }
	textarea:focus { outline: none; border-color: var(--accent); }
	.detected-format { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }
	.form-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
	button { padding: 0.5rem 1rem; background: var(--accent); color: #000; border: none; border-radius: 0.375rem; font-weight: bold; cursor: pointer; font-size: 0.875rem; }
	button:hover { opacity: 0.9; }
	.action-btn { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--border); font-weight: normal; font-size: 0.8rem; }
	.action-btn:hover { border-color: var(--accent); color: var(--accent); }
	.error { color: var(--danger); font-size: 0.875rem; }
	.global-error { margin-top: 1rem; }
	.proceed-section { margin-top: 2rem; padding: 1.25rem; border: 1px solid var(--border); border-radius: 0.5rem; background: var(--bg-surface); }
	.quorum-met { color: var(--success); font-weight: bold; margin-bottom: 1rem; }
	.quorum-pending { color: var(--text-muted); }
	.proceed-button { padding: 0.75rem 2rem; font-size: 1rem; }
	.help-block { border: 1px solid var(--border); border-radius: 0.375rem; padding: 0.5rem 0.75rem; margin-bottom: 1.5rem; }
	.help-block summary { cursor: pointer; color: var(--text-muted); font-size: 0.85rem; }
	.help-block summary:hover { color: var(--accent); }
	.help-content { margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; }
	.help-content h4 { color: var(--text); margin: 1rem 0 0.25rem; font-size: 0.85rem; }
	.help-content ol { margin: 0.25rem 0 0.75rem; padding-left: 1.25rem; }
	.help-content li { margin-bottom: 0.3rem; }
	@media (max-width: 600px) {
		.detail-row { flex-direction: column; gap: 0.1rem; }
		.detail-label { min-width: unset; font-size: 0.7rem; }
		.xpub-body { flex-direction: column; }
		.xpub-qr { flex-direction: row; gap: 0.5rem; }
		.xpub-qr img { width: 80px; height: 80px; }
	}
</style>
