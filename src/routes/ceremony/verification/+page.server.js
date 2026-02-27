import { redirect, fail } from '@sveltejs/kit';
import { randomBytes } from 'crypto';
import { getWorkflowData, saveWorkflowData, canAccessStep } from '$lib/server/workflow.js';
import { buildSigningChallenge } from '$lib/server/electrs-client.js';
import { validateSignature, deriveAddress } from '$lib/server/bitcoin-utils.js';
import { insertSigningToken } from '$lib/server/db.js';

const ADDR_TYPE_MAP = {
	wsh: 'segwit', 'sh-wsh': 'segwit-wrapped', sh: 'legacy',
	wpkh: 'segwit', 'sh-wpkh': 'segwit-wrapped', pkh: 'legacy', tr: 'taproot'
};

const KEY_TYPES = [
	{ value: 'segwit', label: 'Native SegWit (bc1q...)' },
	{ value: 'segwit-wrapped', label: 'Wrapped SegWit (3...)' },
	{ value: 'legacy', label: 'Legacy (1...)' },
	{ value: 'taproot', label: 'Taproot (bc1p...)' }
];

export async function load({ locals }) {
	const { user } = locals;
	if (!canAccessStep(user.workflow_state, 'key_holders')) {
		throw redirect(303, '/ceremony/key-holders');
	}

	const data = getWorkflowData(user);
	const parsed = data.descriptorParsed;

	let challenge = data.signingChallenge;
	const updates = {};

	if (!challenge) {
		challenge = await buildSigningChallenge();
		updates.signingChallenge = challenge;
	}

	if (Object.keys(updates).length > 0) {
		saveWorkflowData(user.user_id, data, updates);
	}

	const signatures = data.signatures || {};
	const quorum = parsed.quorum || { required: 1, total: parsed.xpubs.length };
	const signedCount = Object.keys(signatures).length;
	const quorumMet = signedCount >= quorum.required;

	const defaultKeyType = ADDR_TYPE_MAP[parsed.addressType] || 'segwit';

	const xpubsWithAddresses = parsed.xpubs.map((xpub) => {
		const derivationFromXpub = '0/0';
		let address;
		try {
			address = deriveAddress(xpub.xpub, derivationFromXpub, defaultKeyType).address;
		} catch {
			address = null;
		}
		return {
			...xpub,
			derivationFromXpub,
			address,
			keyType: defaultKeyType
		};
	});

	return {
		xpubs: xpubsWithAddresses,
		addressType: parsed.addressType,
		defaultKeyType,
		keyTypes: KEY_TYPES,
		challenge: challenge.challenge,
		blockHeight: challenge.blockHeight,
		signatures: Object.keys(signatures),
		quorum,
		quorumMet,
		shareTokens: data.shareTokens || {},
		keyHolders: data.keyHolders || {}
	};
}

function extractSignature(raw) {
	const match = raw.match(
		/-----BEGIN (?:BITCOIN )?SIGNATURE-----\s*\n.+\n(.+)\n\s*-----END BITCOIN SIGN(?:ATURE|ED MESSAGE)-----/
	);
	return match ? match[1].trim() : raw;
}

export const actions = {
	sign: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();

		const xpubIndex = parseInt(formData.get('xpubIndex')?.toString(), 10);
		const signature = extractSignature(formData.get('signature')?.toString().trim());
		const derivationPath = formData.get('derivationPath')?.toString().trim() || '0/0';
		const keyType = formData.get('keyType')?.toString() || null;

		if (isNaN(xpubIndex) || !signature) {
			return fail(400, { error: 'Xpub index and signature are required' });
		}

		const data = getWorkflowData(user);
		const parsed = data.descriptorParsed;
		const xpubEntry = parsed.xpubs[xpubIndex];

		if (!xpubEntry) {
			return fail(400, { error: 'Invalid xpub index' });
		}

		const individualAddrType = keyType || ADDR_TYPE_MAP[parsed.addressType] || 'segwit';
		const addressInfo = deriveAddress(xpubEntry.xpub, derivationPath, individualAddrType);
		const challenge = data.signingChallenge;

		try {
			const valid = validateSignature(challenge.challenge, signature, addressInfo.address);
			if (!valid) {
				return fail(400, {
					error: `Signature verification failed for Key ${xpubIndex + 1}. Address used: ${addressInfo.address}`,
					xpubIndex
				});
			}
		} catch (err) {
			return fail(400, { error: `Verification error: ${err.message}`, xpubIndex });
		}

		const signatures = { ...(data.signatures || {}) };
		signatures[xpubIndex] = signature;

		saveWorkflowData(user.user_id, data, { signatures });
		return { success: true, signedIndex: xpubIndex };
	},

	share: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();
		const xpubIndex = parseInt(formData.get('xpubIndex')?.toString(), 10);

		if (isNaN(xpubIndex)) {
			return fail(400, { error: 'Invalid xpub index' });
		}

		const data = getWorkflowData(user);
		const parsed = data.descriptorParsed;

		if (!parsed.xpubs[xpubIndex]) {
			return fail(400, { error: 'Invalid xpub index' });
		}

		const shareTokens = { ...(data.shareTokens || {}) };
		let token = shareTokens[xpubIndex];

		if (!token) {
			token = randomBytes(24).toString('hex');
			shareTokens[xpubIndex] = token;
			insertSigningToken.run(token, user.user_id, xpubIndex);
			saveWorkflowData(user.user_id, data, { shareTokens });
		}

		return { shareToken: token, shareXpubIndex: xpubIndex };
	},

	reset: async ({ locals }) => {
		const { user } = locals;
		const data = getWorkflowData(user);

		saveWorkflowData(user.user_id, {}, {}, 'registered');
		throw redirect(303, '/ceremony/descriptor');
	},

	proceed: async ({ locals }) => {
		const { user } = locals;
		const data = getWorkflowData(user);
		const parsed = data.descriptorParsed;
		const signatures = data.signatures || {};
		const signedCount = Object.keys(signatures).length;
		const quorum = parsed.quorum || { required: 1, total: parsed.xpubs.length };

		if (signedCount < quorum.required) {
			return fail(400, {
				error: `At least ${quorum.required} of ${quorum.total} signatures required. Currently have ${signedCount}.`
			});
		}

		saveWorkflowData(user.user_id, data, {
			quorumAchieved: signedCount
		}, 'verified');

		throw redirect(303, '/ceremony/recovery');
	}
};
