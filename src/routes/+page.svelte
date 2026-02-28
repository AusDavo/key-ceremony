<script>
	import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
	import { onMount } from 'svelte';
	let status = $state('');
	let error = $state('');

	onMount(() => {
		if (new URLSearchParams(window.location.search).has('login')) {
			login();
		}
	});

	async function register() {
		try {
			error = '';
			status = 'Starting registration...';

			const optionsResp = await fetch('/auth/register');
			const options = await optionsResp.json();

			status = 'Waiting for passkey...';
			const credential = await startRegistration({ optionsJSON: options });

			status = 'Verifying...';
			const verifyResp = await fetch('/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(credential)
			});

			const result = await verifyResp.json();
			if (result.verified) {
				window.location.href = '/ceremony/setup';
			} else {
				error = result.error || 'Registration failed';
			}
		} catch (err) {
			error = err.message;
		} finally {
			status = '';
		}
	}

	async function login() {
		try {
			error = '';
			status = 'Starting login...';

			const optionsResp = await fetch('/auth/login');
			const options = await optionsResp.json();

			status = 'Waiting for passkey...';
			const credential = await startAuthentication({ optionsJSON: options });

			status = 'Verifying...';
			const verifyResp = await fetch('/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(credential)
			});

			const result = await verifyResp.json();
			if (result.verified) {
				window.location.href = result.redirectTo || '/ceremony/setup';
			} else {
				error = result.error || 'Login failed';
			}
		} catch (err) {
			error = err.message;
		} finally {
			status = '';
		}
	}
</script>

<div class="landing">
	<h1>Key Ceremony</h1>
	<p class="tagline">Document your Bitcoin multisig wallet setup</p>

	<p class="description">Document your Bitcoin multisig wallet setup. Record who holds each key, where devices and backups are stored, and how to recover. Generate a professional ceremony record PDF. Free and open source.</p>

	<div class="steps">
		<div class="step">
			<div class="step-number">1</div>
			<h3>Set up your wallet</h3>
			<p>Enter your key count and quorum</p>
		</div>
		<div class="step">
			<div class="step-number">2</div>
			<h3>Document key holders</h3>
			<p>Record who holds each key and where</p>
		</div>
		<div class="step">
			<div class="step-number">3</div>
			<h3>Get your record</h3>
			<p>Add recovery steps and download a ceremony PDF</p>
		</div>
	</div>

	<div class="privacy">
		<p>No wallet descriptor, seed phrases, or private keys are entered. No sensitive wallet data touches the server. All data encrypted at rest. No tracking, no analytics, no third-party scripts. <a href="https://github.com/AusDavo/key-ceremony">Open source</a> and self-hostable.</p>
	</div>

	<div class="features">
		<a href="/verify">Verify an existing ceremony record</a>
		<span class="sep">&middot;</span>
		<a href="/key-ceremony-blank-template.pdf">Download blank template (PDF)</a>
	</div>

	<div class="auth-buttons">
		<button onclick={register}>Get Started</button>
		<button class="secondary" onclick={login}>Sign In</button>
	</div>

	<p class="passkey-hint">No email or password required — secured with passkeys.</p>

	{#if status}
		<p class="status">{status}</p>
	{/if}

	{#if error}
		<p class="error">{error}</p>
	{/if}

</div>

<style>
	.landing {
		max-width: 600px;
		margin: 0 auto;
		padding: 4rem 2rem;
		text-align: center;
	}

	h1 {
		font-size: 2.5rem;
		color: var(--accent);
		margin-bottom: 0.25rem;
	}

	.tagline {
		color: var(--text-muted);
		font-size: 1.1rem;
		margin-bottom: 2rem;
	}

	.description {
		color: var(--text-muted);
		line-height: 1.6;
		margin-bottom: 2rem;
	}

	.steps {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		text-align: left;
	}

	.step {
		flex: 1;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 1.25rem 1rem;
	}

	.step-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		background: var(--accent);
		color: #000;
		font-weight: bold;
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
	}

	.step h3 {
		font-size: 0.95rem;
		margin-bottom: 0.25rem;
	}

	.step p {
		font-size: 0.85rem;
		color: var(--text-muted);
		margin: 0;
		line-height: 1.4;
	}

	@media (max-width: 600px) {
		.steps {
			flex-direction: column;
		}
	}

	.privacy {
		padding: 1rem 1.25rem;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		margin-bottom: 2rem;
		text-align: left;
	}

	.privacy p {
		font-size: 0.8rem;
		color: var(--text-dim);
		line-height: 1.6;
		margin: 0;
	}

	.privacy a {
		color: var(--text-muted);
		text-decoration: underline;
	}

	.privacy a:hover {
		color: var(--accent);
	}

	.features {
		margin-bottom: 1.5rem;
		font-size: 0.95rem;
	}

	.features a {
		color: var(--text-muted);
		text-decoration: none;
	}

	.features a:hover {
		color: var(--accent);
	}

	.features .sep {
		color: var(--border);
		margin: 0 0.25rem;
	}

	.auth-buttons {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-bottom: 0.5rem;
	}

	button {
		padding: 0.875rem 2rem;
		background: var(--accent);
		color: #000;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		font-size: 1rem;
		cursor: pointer;
		white-space: nowrap;
	}

	button.secondary {
		background: var(--border);
		color: var(--text);
	}

	button:hover {
		opacity: 0.9;
	}

	.passkey-hint {
		color: var(--text-dim);
		font-size: 0.85rem;
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.status {
		color: var(--accent);
	}

	.error {
		color: var(--danger);
	}
</style>
