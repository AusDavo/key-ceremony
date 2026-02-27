<script>
	import { onDestroy } from 'svelte';

	let { data, form } = $props();

	let scanning = $state(false);
	let scanError = $state('');
	let readerEl = $state(null);
	let scanner = null;

	onDestroy(() => { stopScanning(); });

	function handleFileUpload(event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				document.querySelector('textarea[name=descriptor]').value = e.target.result;
			};
			reader.readAsText(file);
		}
	}

	async function startScanning() {
		scanError = '';
		scanning = true;
		try {
			const { Html5Qrcode } = await import('html5-qrcode');
			scanner = new Html5Qrcode(readerEl.id);
			await scanner.start(
				{ facingMode: 'environment' },
				{ fps: 10, qrbox: { width: 250, height: 250 } },
				(decodedText) => {
					document.querySelector('textarea[name=descriptor]').value = decodedText.trim();
					stopScanning();
				},
				() => {}
			);
		} catch (err) {
			scanError = err?.message || 'Camera access denied or unavailable';
			scanning = false;
		}
	}

	async function stopScanning() {
		if (scanner) {
			try {
				await scanner.stop();
				scanner.clear();
			} catch { /* Already stopped */ }
			scanner = null;
		}
		scanning = false;
	}
</script>

<h2>Wallet Descriptor</h2>
<p>Paste your wallet output descriptor to begin the key ceremony.</p>

<details class="help-block">
	<summary>What is a wallet descriptor and where do I find it?</summary>
	<div class="help-content">
		<p>A wallet output descriptor describes your wallet's structure — the keys involved and how they combine to form addresses. This tool uses it to identify each key in your multisig setup and verify ownership.</p>
		<p>How to export it depends on your wallet software:</p>
		<ul>
			<li><strong>Sparrow Wallet:</strong> Go to <em>Settings</em> tab for your wallet, click <em>Copy</em> next to the output descriptor, or use <em>File, Export Wallet, Output Descriptor</em>.</li>
			<li><strong>Coldcard:</strong> Insert your SD card, <em>Advanced/Tools, Export Wallet, Descriptor</em>. Upload the <code>.txt</code> file here.</li>
			<li><strong>SeedSigner:</strong> Go to <em>Seeds, select your seed, Descriptors, Descriptor Type, Export as QR</em>. Click <strong>Scan QR</strong> below.</li>
			<li><strong>Nunchuk:</strong> Open your wallet, <em>Wallet Settings, Wallet Configuration, Export</em>.</li>
		</ul>
		<p>The descriptor looks something like:<br>
		<code>wsh(sortedmulti(2,[73c5da0a/48h/0h/0h/2h]xpub6E..., [f57ec65d/48h/0h/0h/2h]xpub6D...))</code></p>
	</div>
</details>

{#if form?.error}
	<p class="error">{form.error}</p>
{/if}

<form method="POST">
	<label>
		Wallet Descriptor
		<textarea
			name="descriptor"
			rows="6"
			placeholder="wsh(sortedmulti(2,[fingerprint/48h/0h/0h/2h]xpub6...,[fingerprint/48h/0h/0h/2h]xpub6...))"
			required
		>{form?.descriptorRaw || data.descriptor || ''}</textarea>
	</label>

	<p class="hint">You can also upload a file or scan a QR code:</p>
	<div class="import-actions">
		<input type="file" accept=".txt,.bsms" onchange={handleFileUpload} />
		{#if scanning}
			<div class="scanner-wrapper">
				<div bind:this={readerEl} id="qr-reader-descriptor"></div>
				<button type="button" class="secondary" onclick={stopScanning}>Cancel</button>
			</div>
		{:else}
			<button type="button" class="secondary" onclick={startScanning}>Scan QR</button>
		{/if}
		{#if scanError}
			<p class="error">{scanError}</p>
		{/if}
	</div>

	<button type="submit">Continue</button>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		max-width: 600px;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	textarea {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	textarea:focus {
		outline: none;
		border-color: var(--accent);
	}

	.hint {
		font-size: 0.8rem;
		color: var(--text-dim);
		margin: 0;
	}

	.import-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.scanner-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 350px;
	}

	.scanner-wrapper :global(video) {
		border-radius: 0.375rem;
	}

	input[type="file"] {
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	button.secondary {
		padding: 0.5rem 0.75rem;
		background: var(--bg-elevated, var(--border));
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.8rem;
		cursor: pointer;
		align-self: flex-start;
	}

	button.secondary:hover {
		border-color: var(--accent);
		color: var(--accent);
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

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}

	.help-block {
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.5rem;
	}

	.help-block summary {
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.85rem;
	}

	.help-block summary:hover {
		color: var(--accent);
	}

	.help-content {
		margin-top: 0.75rem;
		font-size: 0.85rem;
		color: var(--text-muted);
		line-height: 1.6;
	}

	.help-content p {
		margin: 0.5rem 0;
	}

	.help-content ul {
		margin: 0.5rem 0;
		padding-left: 1.25rem;
	}

	.help-content li {
		margin-bottom: 0.4rem;
	}

	.help-content code {
		font-size: 0.8rem;
		color: var(--text);
		word-break: break-all;
	}
</style>
