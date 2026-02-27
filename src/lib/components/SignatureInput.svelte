<script>
	import { onDestroy } from 'svelte';

	/**
	 * @param {string} signature - The extracted signature text
	 * @param {string|null} detectedFormat - Auto-detected format ('bip137') or null
	 */
	let { onResult } = $props();

	let scanning = $state(false);
	let error = $state('');
	let readerEl = $state(null);
	let fileInput = $state(null);
	let scanner = null;

	onDestroy(() => {
		stopScanning();
	});

	/**
	 * Parse Coldcard ASCII-armored signed message format.
	 * Returns { signature, address } or null if not in that format.
	 *
	 * Coldcard outputs two known variants:
	 *   -----BEGIN BITCOIN SIGNED MESSAGE-----
	 *   <message>
	 *   -----BEGIN SIGNATURE-----          (or -----BEGIN BITCOIN SIGNATURE-----)
	 *   <address>
	 *   <base64 signature>
	 *   -----END BITCOIN SIGNED MESSAGE----- (or -----END BITCOIN SIGNATURE-----)
	 */
	function parseColdcardSignedFile(text) {
		const sigBlockMatch = text.match(
			/-----BEGIN (?:BITCOIN )?SIGNATURE-----\s*\n(.+)\n(.+)\n\s*-----END BITCOIN SIGN(?:ATURE|ED MESSAGE)-----/
		);
		if (!sigBlockMatch) return null;

		return {
			address: sigBlockMatch[1].trim(),
			signature: sigBlockMatch[2].trim()
		};
	}

	function handleFileUpload(event) {
		const file = event.target.files[0];
		if (!file) return;
		error = '';

		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target.result.trim();

			// Try Coldcard ASCII-armored format
			const coldcard = parseColdcardSignedFile(text);
			if (coldcard) {
				onResult(coldcard.signature, 'bip137');
				return;
			}

			// Otherwise treat as raw signature (base64 text)
			onResult(text, null);
		};
		reader.readAsText(file);

		// Reset so the same file can be re-selected
		if (fileInput) fileInput.value = '';
	}

	async function startScanning() {
		error = '';
		scanning = true;

		try {
			const { Html5Qrcode } = await import('html5-qrcode');
			scanner = new Html5Qrcode(readerEl.id);

			await scanner.start(
				{ facingMode: 'environment' },
				{ fps: 10, qrbox: { width: 250, height: 250 } },
				(decodedText) => {
					onResult(decodedText.trim(), null);
					stopScanning();
				},
				() => {}
			);
		} catch (err) {
			error = err?.message || 'Camera access denied or unavailable';
			scanning = false;
		}
	}

	async function stopScanning() {
		if (scanner) {
			try {
				await scanner.stop();
				scanner.clear();
			} catch {
				// Already stopped
			}
			scanner = null;
		}
		scanning = false;
	}
</script>

<div class="sig-input-actions">
	{#if scanning}
		<div class="scanner-wrapper">
			<div bind:this={readerEl} id="qr-reader-{Math.random().toString(36).slice(2, 8)}"></div>
			<button type="button" class="cancel-btn" onclick={stopScanning}>Cancel</button>
		</div>
	{:else}
		<button type="button" class="action-btn" onclick={startScanning}>Scan QR</button>
		<label class="action-btn file-label">
			Upload File
			<input
				bind:this={fileInput}
				type="file"
				accept=".txt,.sig"
				onchange={handleFileUpload}
				hidden
			/>
		</label>
	{/if}
</div>

{#if error}
	<p class="input-error">{error}</p>
{/if}

<style>
	.sig-input-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.scanner-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-width: 350px;
		width: 100%;
	}

	.scanner-wrapper :global(video) {
		border-radius: 0.375rem;
	}

	.action-btn, .file-label {
		padding: 0.4rem 0.75rem;
		background: var(--bg-elevated);
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.action-btn:hover, .file-label:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.cancel-btn {
		padding: 0.4rem 0.75rem;
		background: var(--bg-elevated);
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.8rem;
		cursor: pointer;
		align-self: flex-start;
	}

	.cancel-btn:hover {
		border-color: var(--danger);
		color: var(--danger);
	}

	.input-error {
		color: var(--danger);
		font-size: 0.8rem;
	}
</style>
