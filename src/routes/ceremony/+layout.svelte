<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { hasDek } from '$lib/crypto.js';

	let { data, children } = $props();

	const steps = [
		{ id: 'setup', label: 'Setup', state: 'registered' },
		{ id: 'key-holders', label: 'Key Holders', state: 'setup' },
		{ id: 'recovery', label: 'Recovery', state: 'key_holders' },
		{ id: 'review', label: 'Review', state: 'recovery' }
	];

	const stateOrder = ['registered', 'setup', 'key_holders', 'recovery', 'review', 'completed'];

	function stepStatus(stepState) {
		const current = stateOrder.indexOf(data.workflowState);
		const required = stateOrder.indexOf(stepState);
		if (current > required) return 'completed';
		if (current === required) return 'current';
		return 'locked';
	}

	// Check DEK availability — redirect to login if not available
	onMount(() => {
		if (browser && data.workflowState !== 'completed' && !hasDek()) {
			window.location.href = '/?login';
		}
	});
</script>

<div class="wizard-layout">
	<header class="wizard-header">
		{#if data.workflowState !== 'completed'}
			<nav class="wizard-steps">
				{#each steps as step, i}
					{@const status = stepStatus(step.state)}
					<a
						href="/ceremony/{step.id}"
						class="step"
						class:completed={status === 'completed'}
						class:current={status === 'current'}
						class:locked={status === 'locked'}
						aria-disabled={status === 'locked'}
						title={step.label}
					>
						<span class="step-number">{i + 1}</span>
						<span class="step-label">{step.label}</span>
					</a>
				{/each}
			</nav>
		{/if}
		<div class="header-actions">
			<a href="/settings" class="settings-link">Settings</a>
			<form method="POST" action="/auth/logout">
				<button type="submit" class="logout-btn">Log out</button>
			</form>
		</div>
	</header>

	<main class="wizard-content">
		{@render children()}
	</main>
</div>

<style>
	.wizard-layout {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	.wizard-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}

	.wizard-steps {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.settings-link {
		font-size: 0.75rem;
		color: var(--text-muted);
		text-decoration: none;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
	}

	.settings-link:hover {
		color: var(--accent);
		border-color: var(--accent);
	}

	.logout-btn {
		padding: 0.375rem 0.75rem;
		background: none;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		font-size: 0.75rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.logout-btn:hover {
		color: var(--danger);
		border-color: var(--danger);
	}

	.step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		text-decoration: none;
		color: var(--text-dim);
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.step.completed {
		color: var(--success);
	}

	.step.current {
		color: var(--accent);
		background: rgba(247, 147, 26, 0.1);
	}

	.step.locked {
		pointer-events: none;
		opacity: 0.4;
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 2px solid currentColor;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.step.completed .step-number {
		background: var(--success);
		color: #000;
		border-color: var(--success);
	}

	@media (max-width: 600px) {
		.wizard-layout {
			padding: 1rem;
		}
		.wizard-steps {
			gap: 0.25rem;
			flex-wrap: nowrap;
		}
		.step {
			padding: 0.25rem;
			gap: 0;
		}
		.step-label {
			display: none;
		}
		.step-number {
			width: 1.75rem;
			height: 1.75rem;
			font-size: 0.8rem;
		}
	}

	@media print {
		.wizard-header {
			display: none;
		}
		.wizard-layout {
			padding: 0;
		}
	}
</style>
