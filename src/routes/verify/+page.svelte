<script>
	import { enhance } from '$app/forms';

	let { form } = $props();
	let hashing = $state(false);
	let computedHash = $state('');
	let dragOver = $state(false);
	let manualOpen = $state(false);
	let formEl;

	async function hashFile(file) {
		hashing = true;
		computedHash = '';
		try {
			const buffer = await file.arrayBuffer();
			const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
			const hashHex = Array.from(new Uint8Array(hashBuffer))
				.map(b => b.toString(16).padStart(2, '0'))
				.join('');
			computedHash = hashHex;
			await new Promise(r => setTimeout(r, 0));
			formEl.requestSubmit();
		} finally {
			hashing = false;
		}
	}

	function handleDrop(e) {
		dragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file && file.type === 'application/pdf') {
			hashFile(file);
		}
	}

	function handleFileInput(e) {
		const file = e.target.files[0];
		if (file) {
			hashFile(file);
		}
	}
</script>

<div class="verify-page">
	<h2>Verify a Ceremony Record</h2>
	<p>Drop or select a Key Ceremony PDF to verify its authenticity.</p>

	<div
		class="drop-zone"
		class:drag-over={dragOver}
		class:hashing
		role="button"
		tabindex="0"
		ondragover={(e) => { e.preventDefault(); dragOver = true; }}
		ondragleave={() => (dragOver = false)}
		ondrop={(e) => { e.preventDefault(); handleDrop(e); }}
		onclick={() => document.getElementById('file-input').click()}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('file-input').click(); }}
	>
		{#if hashing}
			<span class="hashing-text">Hashing...</span>
		{:else}
			<span class="drop-icon">&#128196;</span>
			<span>Drop your PDF here or click to browse</span>
		{/if}
		<input
			id="file-input"
			type="file"
			accept=".pdf,application/pdf"
			onchange={handleFileInput}
			hidden
		/>
	</div>

	<p class="privacy-note">Your file is hashed in your browser and never uploaded. Only the hash is sent for verification.</p>

	{#if computedHash}
		<p class="computed-hash">
			<span class="computed-label">Computed hash:</span>
			<code>{computedHash}</code>
		</p>
	{/if}

	<form method="POST" use:enhance bind:this={formEl}>
		{#if !manualOpen}
			<input type="hidden" name="hash" value={computedHash} />
		{/if}

		<details bind:open={manualOpen}>
			<summary>Or enter hash manually</summary>
			<div class="manual-input">
				<label>
					Document SHA-256 Hash
					<input
						type="text"
						name="hash"
						placeholder="e.g. a1b2c3d4e5f6..."
						maxlength="64"
						pattern="[a-fA-F0-9]{'{'}64{'}'}"
					/>
				</label>
				<button type="submit">Verify</button>
			</div>
		</details>
	</form>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	{#if form?.found === true}
		<div class="result valid">
			<h3>Valid Ceremony Record</h3>
			<p>This hash corresponds to a Key Ceremony record.</p>
			<dl>
				<dt>Reference</dt>
				<dd>{form.ceremonyReference}</dd>
				<dt>Date</dt>
				<dd>{form.ceremonyDate}</dd>
				<dt>Quorum</dt>
				<dd>{form.quorumRequired}-of-{form.quorumTotal}</dd>
			</dl>
		</div>
	{:else if form?.found === false}
		<div class="result invalid">
			<h3>No Match</h3>
			<p>This hash does not correspond to any ceremony record issued by Key Ceremony.</p>
		</div>
	{/if}
</div>

<style>
	.verify-page {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.drop-zone {
		border: 2px dashed var(--border);
		border-radius: 0.5rem;
		padding: 2rem;
		text-align: center;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-muted);
		transition: border-color 0.15s, background 0.15s;
		margin: 1.5rem 0 0.75rem;
	}

	.drop-zone:hover,
	.drop-zone.drag-over {
		border-color: var(--accent);
		background: rgba(255, 255, 255, 0.02);
	}

	.drop-zone.hashing {
		border-color: var(--accent);
		cursor: default;
	}

	.drop-icon {
		font-size: 2rem;
	}

	.hashing-text {
		font-style: italic;
		color: var(--accent);
	}

	.privacy-note {
		font-size: 0.75rem;
		color: var(--text-dim);
		text-align: center;
		margin: 0 0 1rem;
	}

	.computed-hash {
		font-size: 0.8rem;
		word-break: break-all;
	}

	.computed-label {
		color: var(--text-muted);
		font-size: 0.75rem;
	}

	.computed-hash code {
		background: var(--bg-elevated);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
	}

	form {
		margin: 1rem 0;
	}

	details {
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		padding: 0.75rem;
	}

	summary {
		cursor: pointer;
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	.manual-input {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-top: 1rem;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.875rem;
		color: var(--text-muted);
	}

	input[type="text"] {
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	input[type="text"]:focus {
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
		background: var(--accent-hover);
	}

	.result {
		padding: 1.5rem;
		border-radius: 0.5rem;
		margin-top: 1.5rem;
	}

	.result.valid {
		border: 1px solid var(--success);
		background: rgba(34, 197, 94, 0.05);
	}

	.result.invalid {
		border: 1px solid var(--danger);
		background: rgba(239, 68, 68, 0.05);
	}

	.result h3 {
		margin-top: 0;
	}

	.result.valid h3 {
		color: var(--success);
	}

	.result.invalid h3 {
		color: var(--danger);
	}

	dl {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 0.5rem 1rem;
		margin-top: 1rem;
	}

	dt {
		color: var(--text-muted);
		font-size: 0.875rem;
	}

	dd {
		color: var(--text);
		margin: 0;
	}

	.error {
		color: var(--danger);
		padding: 0.75rem;
		border: 1px solid var(--danger);
		border-radius: 0.375rem;
		background: rgba(239, 68, 68, 0.1);
	}
</style>
