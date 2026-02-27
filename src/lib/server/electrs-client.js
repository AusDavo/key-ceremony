const NODES = [
	{ url: 'https://electrs.dpinkerton.com:50002', primary: true },
	{ url: 'https://blockstream.info', primary: false },
	{ url: 'https://mempool.space', primary: false }
];

const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		return response;
	} finally {
		clearTimeout(timer);
	}
}

async function queryWithFallback(path, format = 'json') {
	let lastError;
	for (const node of NODES) {
		try {
			const response = await fetchWithTimeout(`${node.url}${path}`);
			return format === 'text' ? await response.text() : await response.json();
		} catch (err) {
			lastError = err;
			if (node.primary) {
				console.warn(`Primary Electrs node failed: ${err.message}, trying fallbacks...`);
			}
		}
	}
	throw new Error(`All Electrs nodes failed. Last error: ${lastError?.message}`);
}

/**
 * Get the current blockchain tip (latest block height and hash).
 */
export async function getBlockTip() {
	const heightText = await queryWithFallback('/api/blocks/tip/height', 'text');
	const hash = await queryWithFallback('/api/blocks/tip/hash', 'text');
	return { height: parseInt(heightText, 10), hash: hash.trim() };
}

/**
 * Get block hash at a specific height.
 */
export async function getBlockHashAtHeight(height) {
	const hash = await queryWithFallback(`/api/block-height/${height}`, 'text');
	return hash.trim();
}

/**
 * Build the BIP-322 signing challenge from current chain tip.
 * Format: {block_height}-{last 8 hex of block hash}
 */
export async function buildSigningChallenge() {
	const tip = await getBlockTip();
	const hashSuffix = typeof tip.hash === 'string'
		? tip.hash.slice(-8)
		: tip.hash.toString(16).slice(-8);
	return {
		challenge: `${tip.height}-${hashSuffix}`,
		blockHeight: tip.height,
		blockHash: tip.hash
	};
}

/**
 * Verify a signing challenge against the blockchain.
 */
export async function verifyChallenge(challenge) {
	const [heightStr, hashSuffix] = challenge.split('-');
	const height = parseInt(heightStr, 10);
	if (isNaN(height) || !hashSuffix || hashSuffix.length !== 8) {
		throw new Error('Invalid challenge format. Expected: {height}-{8 hex chars}');
	}

	const hash = await getBlockHashAtHeight(height);
	const actualSuffix = typeof hash === 'string' ? hash.slice(-8) : hash.toString(16).slice(-8);

	if (actualSuffix !== hashSuffix) {
		throw new Error(`Challenge verification failed: expected ${hashSuffix}, got ${actualSuffix}`);
	}

	return { valid: true, height, hash };
}
