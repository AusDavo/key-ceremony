<script>
	import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
	import { onMount } from 'svelte';
	import {
		deriveKeyFromPrf, generateDek, wrapDek, unwrapDek,
		encryptTestValue, storeDek, getPrfSalt
	} from '$lib/crypto.js';

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

			// Request PRF evaluation during registration
			const salt = getPrfSalt();
			const optionsWithPrf = {
				...options,
				extensions: {
					...options.extensions,
					prf: { eval: { first: salt } }
				}
			};

			const credential = await startRegistration({ optionsJSON: optionsWithPrf });

			// Check PRF support
			const prfResult = credential.clientExtensionResults?.prf;
			if (!prfResult?.enabled) {
				error = 'Your passkey does not support PRF encryption. Use the blank template instead.';
				status = '';
				return;
			}

			// Complete registration on server first (creates user + credential)
			status = 'Verifying...';
			const verifyResp = await fetch('/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ credential })
			});

			const result = await verifyResp.json();
			if (!result.verified) {
				error = result.error || 'Registration failed';
				status = '';
				return;
			}

			// Now derive the encryption key
			let prfOutput = prfResult.results?.first;

			// If PRF output wasn't available at registration (e.g. YubiKeys),
			// authenticate to get it — requires a second touch
			if (!prfOutput) {
				status = 'Touch your key again to set up encryption...';
				prfOutput = await authenticateForPrf(credential.id);
			}

			if (!prfOutput) {
				error = 'Failed to derive encryption key from passkey. Use the blank template instead.';
				status = '';
				return;
			}

			// Derive KEK from PRF output, generate random DEK, wrap it
			const kek = await deriveKeyFromPrf(prfOutput);
			const dek = await generateDek();
			const { wrappedDek, dekIv } = await wrapDek(dek, kek);
			const { keyCheck, keyCheckIv } = await encryptTestValue(dek);

			// Send wrapped DEK to server (user is now registered and authenticated)
			const setupResp = await fetch('/auth/setup-encryption', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					credentialId: credential.id,
					wrappedDek,
					dekIv,
					keyCheck,
					keyCheckIv
				})
			});

			const setupResult = await setupResp.json();
			if (setupResult.error) {
				error = setupResult.error;
				status = '';
				return;
			}

			await storeDek(dek);
			window.location.href = '/ceremony/setup';
		} catch (err) {
			if (err.name !== 'NotAllowedError') {
				error = err.message;
			}
		} finally {
			status = '';
		}
	}

	/**
	 * Authenticate with a specific credential to get PRF output.
	 * Used when PRF evaluation during registration isn't supported.
	 */
	async function authenticateForPrf(credentialId) {
		try {
			const authOptionsResp = await fetch('/auth/login');
			const authOptions = await authOptionsResp.json();

			const salt = getPrfSalt();
			const authOptionsWithPrf = {
				...authOptions,
				extensions: {
					...authOptions.extensions,
					prf: { eval: { first: salt } }
				},
				allowCredentials: [{
					id: credentialId,
					type: 'public-key'
				}]
			};

			const authCredential = await startAuthentication({ optionsJSON: authOptionsWithPrf });

			// Verify on server to keep counter in sync
			await fetch('/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(authCredential)
			});

			return authCredential.clientExtensionResults?.prf?.results?.first || null;
		} catch {
			return null;
		}
	}

	async function login() {
		try {
			error = '';
			status = 'Starting login...';

			const optionsResp = await fetch('/auth/login');
			const options = await optionsResp.json();

			// Add PRF evaluation extension to authentication options
			const salt = getPrfSalt();
			const optionsWithPrf = {
				...options,
				extensions: {
					...options.extensions,
					prf: { eval: { first: salt } }
				}
			};

			status = 'Waiting for passkey...';
			const credential = await startAuthentication({ optionsJSON: optionsWithPrf });

			status = 'Verifying...';
			const verifyResp = await fetch('/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(credential)
			});

			const result = await verifyResp.json();
			if (result.verified) {
				// Derive KEK and unwrap DEK
				const prfOutput = credential.clientExtensionResults?.prf?.results?.first;
				if (prfOutput && result.wrappedDek && result.dekIv) {
					const kek = await deriveKeyFromPrf(prfOutput);
					const dek = await unwrapDek(result.wrappedDek, result.dekIv, kek);
					await storeDek(dek);
				} else if (result.wrappedDek) {
					error = 'Your browser did not return PRF output. Please try a different browser or authenticator.';
					return;
				}
				// If no wrappedDek exists (legacy user without PRF), proceed without encryption
				window.location.href = result.redirectTo || '/ceremony/setup';
			} else {
				error = result.error || 'Login failed';
			}
		} catch (err) {
			if (err.name !== 'NotAllowedError') {
				error = err.message;
			}
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
		<p>Your data never leaves your browser unencrypted. The server cannot read your ceremony details — it only stores scrambled data that your passkey can unlock. No seed phrases or private keys are entered. No tracking, no analytics. <a href="https://github.com/AusDavo/key-ceremony">Open source</a> and self-hostable.</p>
	</div>

	<div class="features">
		<a href="/key-ceremony-blank-template.pdf">Download blank template (PDF)</a>
	</div>

	<div class="auth-buttons">
		<button onclick={register}>Get Started</button>
		<button class="secondary" onclick={login}>Sign In</button>
	</div>

	<p class="passkey-hint">No email or password required — secured with passkeys. Requires a PRF-capable authenticator (YubiKey, Windows Hello, iCloud Keychain).</p>

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
