import { error, fail } from '@sveltejs/kit';
import { getHashedToken, getUser } from '$lib/server/db.js';
import { getWorkflowData, saveWorkflowData } from '$lib/server/workflow.js';
import { validateSignature, deriveAddress } from '$lib/server/bitcoin-utils.js';

/**
 * Extract the base64 signature from Coldcard armored format if present,
 * otherwise return the input as-is.
 */
function extractSignature(raw) {
	const match = raw.match(
		/-----BEGIN (?:BITCOIN )?SIGNATURE-----\s*\n.+\n(.+)\n\s*-----END BITCOIN SIGN(?:ATURE|ED MESSAGE)-----/
	);
	return match ? match[1].trim() : raw;
}

export function load({ params }) {
	const tokenRow = getHashedToken(params.token);
	if (!tokenRow) {
		throw error(404, 'This signing link is invalid or has expired.');
	}

	const user = getUser.get(tokenRow.user_id);
	if (!user) {
		throw error(404, 'This signing link is invalid or has expired.');
	}

	const data = getWorkflowData(user);
	if (!data?.signingChallenge || !data?.descriptorParsed) {
		throw error(404, 'This signing link is invalid or has expired.');
	}

	const parsed = data.descriptorParsed;
	const xpub = parsed.xpubs[tokenRow.xpub_index];
	if (!xpub) {
		throw error(404, 'Invalid key reference.');
	}

	const signatures = data.signatures || {};
	const alreadySigned = String(tokenRow.xpub_index) in signatures;

	const addrTypeMap = {
		wsh: 'segwit', 'sh-wsh': 'segwit-wrapped', sh: 'legacy',
		wpkh: 'segwit', 'sh-wpkh': 'segwit-wrapped', pkh: 'legacy', tr: 'taproot'
	};
	const defaultKeyType = addrTypeMap[parsed.addressType] || 'segwit';

	let defaultAddress = null;
	try {
		defaultAddress = deriveAddress(xpub.xpub, '0/0', defaultKeyType).address;
	} catch { /* ignore */ }

	const keyTypes = [
		{ value: 'segwit', label: 'Native SegWit (bc1q...)' },
		{ value: 'segwit-wrapped', label: 'Wrapped SegWit (3...)' },
		{ value: 'legacy', label: 'Legacy (1...)' },
		{ value: 'taproot', label: 'Taproot (bc1p...)' }
	];

	return {
		challenge: data.signingChallenge.challenge,
		blockHeight: data.signingChallenge.blockHeight,
		xpubIndex: tokenRow.xpub_index,
		xpubFingerprint: xpub.xpubFingerprint,
		xpubPreview: `${xpub.xpub.slice(0, 20)}...${xpub.xpub.slice(-8)}`,
		path: xpub.path,
		addressType: parsed.addressType,
		defaultKeyType,
		defaultAddress,
		keyTypes,
		token: params.token,
		alreadySigned
	};
}

export const actions = {
	default: async ({ params, request }) => {
		const tokenRow = getHashedToken(params.token);
		if (!tokenRow) {
			return fail(400, { error: 'This signing link is invalid or has expired.' });
		}

		const user = getUser.get(tokenRow.user_id);
		if (!user) {
			return fail(400, { error: 'This signing link is invalid or has expired.' });
		}

		const formData = await request.formData();
		const signature = extractSignature(formData.get('signature')?.toString().trim());
		const derivationPath = formData.get('derivationPath')?.toString().trim() || '0/0';
		const keyType = formData.get('keyType')?.toString() || null;

		if (!signature) {
			return fail(400, { error: 'Signature is required.' });
		}

		const data = getWorkflowData(user);
		const parsed = data.descriptorParsed;
		const xpubEntry = parsed.xpubs[tokenRow.xpub_index];

		if (!xpubEntry) {
			return fail(400, { error: 'Invalid key reference.' });
		}

		const addrTypeMap = {
			wsh: 'segwit', 'sh-wsh': 'segwit-wrapped', sh: 'legacy',
			wpkh: 'segwit', 'sh-wpkh': 'segwit-wrapped', pkh: 'legacy', tr: 'taproot'
		};
		const individualAddrType = keyType || addrTypeMap[parsed.addressType] || 'segwit';
		const addressInfo = deriveAddress(xpubEntry.xpub, derivationPath, individualAddrType);
		const challenge = data.signingChallenge;

		try {
			const valid = validateSignature(challenge.challenge, signature, addressInfo.address);
			if (!valid) {
				return fail(400, { error: 'Signature verification failed. Please check and try again.' });
			}
		} catch (err) {
			return fail(400, { error: `Verification error: ${err.message}` });
		}

		// Store the verified signature
		const signatures = { ...(data.signatures || {}) };
		signatures[tokenRow.xpub_index] = signature;
		saveWorkflowData(user.user_id, data, { signatures });

		return { success: true };
	}
};
