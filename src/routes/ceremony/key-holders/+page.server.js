import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowData, saveWorkflowData, canAccessStep } from '$lib/server/workflow.js';

const DEVICE_TYPES = [
	'Coldcard Mk4', 'Coldcard Q', 'SeedSigner', 'Ledger Nano S Plus',
	'Ledger Nano X', 'Trezor Model T', 'Trezor Safe 3', 'BitBox02',
	'Foundation Passport', 'Blockstream Jade', 'Keystone Pro', 'Other'
];

const ROLE_OPTIONS = [
	'Primary Holder', 'Trustee', 'Spouse', 'Backup', 'Custodian', 'Custom'
];

export function load({ locals }) {
	const { user } = locals;
	if (!canAccessStep(user.workflow_state, 'descriptor')) {
		throw redirect(303, '/ceremony/descriptor');
	}

	const data = getWorkflowData(user);
	const parsed = data.descriptorParsed;

	return {
		xpubs: parsed.xpubs.map((x, i) => ({
			fingerprint: x.xpubFingerprint,
			path: x.path,
			xpubPreview: `${x.xpub.slice(0, 16)}...${x.xpub.slice(-8)}`
		})),
		quorum: parsed.quorum,
		addressTypeLabel: parsed.addressTypeLabel,
		savedKeyHolders: data.keyHolders || null,
		deviceTypes: DEVICE_TYPES,
		roleOptions: ROLE_OPTIONS
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();

		let keyHolders;
		try {
			const raw = formData.get('keyHolders')?.toString();
			if (raw) keyHolders = JSON.parse(raw);
		} catch {
			return fail(400, { error: 'Invalid key holder data' });
		}

		if (!keyHolders) {
			return fail(400, { error: 'Key holder information is required' });
		}

		const data = getWorkflowData(user);
		const parsed = data.descriptorParsed;

		// Validate each key has at least one holder with a name
		for (let i = 0; i < parsed.xpubs.length; i++) {
			const holders = keyHolders[i];
			if (!holders) {
				return fail(400, {
					error: `Please enter a name for Key ${i + 1} (${parsed.xpubs[i].xpubFingerprint}).`
				});
			}
			// Support both array format and legacy single-holder format
			const holderList = Array.isArray(holders) ? holders : [holders];
			if (holderList.length === 0 || !holderList[0].name || !holderList[0].name.trim()) {
				return fail(400, {
					error: `Please enter a name for Key ${i + 1} (${parsed.xpubs[i].xpubFingerprint}).`
				});
			}
			// Normalize to array format
			keyHolders[i] = holderList;
		}

		saveWorkflowData(
			user.user_id,
			data,
			{ keyHolders },
			'key_holders',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/verification');
	}
};
