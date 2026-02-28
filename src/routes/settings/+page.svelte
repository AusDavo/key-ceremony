<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
</script>

<div class="settings-page">
	<h2>Settings</h2>

	<div class="section">
		<h3>Passkey</h3>
		<p>Your registered passkey is used for sign-in and to encrypt your ceremony data.</p>

		<div class="passkey-list">
			{#each data.credentials as cred, i}
				<div class="passkey-item">
					<div class="passkey-info">
						<span class="passkey-name">Passkey {i + 1}</span>
						<span class="passkey-id">{cred.credentialId.slice(0, 16)}...</span>
						<span class="passkey-date">Added {new Date(cred.createdAt).toLocaleDateString()}</span>
						{#if cred.transports.length > 0}
							<span class="passkey-transports">{cred.transports.join(', ')}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="section danger-zone">
		<h3>Danger Zone</h3>
		<p>Deleting your account will permanently remove all data. This cannot be undone.</p>
		<form method="POST" action="?/deleteAccount" use:enhance>
			<button type="submit" class="delete-account-btn" onclick={(e) => {
				if (!confirm('Are you sure you want to delete your account? All data and passkeys will be permanently deleted.')) {
					e.preventDefault();
				}
			}}>Delete Account</button>
		</form>
	</div>

	<div class="nav-links">
		<a href="/ceremony/setup">Back to Ceremony</a>
	</div>
</div>

<style>
	.settings-page {
		max-width: 600px;
		margin: 0 auto;
		padding: 2rem;
	}

	.section {
		padding: 1.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-surface);
		margin-bottom: 1.5rem;
	}

	.section h3 {
		color: var(--accent);
		font-size: 1rem;
		margin: 0 0 0.25rem;
	}

	.section p {
		color: var(--text-muted);
		font-size: 0.85rem;
		margin: 0 0 1rem;
		line-height: 1.5;
	}

	.passkey-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.passkey-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background: var(--bg-input);
	}

	.passkey-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.passkey-name {
		font-weight: bold;
		font-size: 0.9rem;
	}

	.passkey-id {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-dim);
	}

	.passkey-date {
		font-size: 0.75rem;
		color: var(--text-muted);
	}

	.passkey-transports {
		font-size: 0.7rem;
		color: var(--text-dim);
	}

	.danger-zone {
		border-color: var(--danger);
	}

	.danger-zone h3 {
		color: var(--danger);
	}

	.delete-account-btn {
		padding: 0.625rem 1.25rem;
		background: var(--danger);
		color: #fff;
		border: none;
		border-radius: 0.375rem;
		font-weight: bold;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.delete-account-btn:hover {
		opacity: 0.9;
	}

	.nav-links {
		display: flex;
		gap: 1rem;
		font-size: 0.875rem;
	}

	.nav-links a {
		color: var(--accent);
	}
</style>
