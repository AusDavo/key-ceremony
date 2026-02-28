import { readable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Readable store that indicates whether a DEK is available in sessionStorage.
 * Re-checks on subscription. For reactive UI components that need to know
 * if encryption is available.
 */
export const dekAvailable = readable(false, (set) => {
	if (!browser) return;

	function check() {
		set(sessionStorage.getItem('kc_dek') !== null);
	}

	check();

	// Re-check on storage events (e.g. if another tab clears it)
	window.addEventListener('storage', check);
	return () => window.removeEventListener('storage', check);
});
