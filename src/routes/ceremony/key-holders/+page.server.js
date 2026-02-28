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
	if (!canAccessStep(user.workflow_state, 'setup')) {
		throw redirect(303, '/ceremony/setup');
	}

	const data = getWorkflowData(user);
	const config = data.walletConfig;

	return {
		keyCount: config.keyCount,
		quorumRequired: config.quorumRequired,
		walletType: config.walletType,
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
		const keyCount = data.walletConfig.keyCount;

		// Validate each key has at least one holder with a name
		for (let i = 0; i < keyCount; i++) {
			const holders = keyHolders[i];
			if (!holders) {
				return fail(400, {
					error: `Please enter a name for Key ${i + 1}.`
				});
			}
			const holderList = Array.isArray(holders) ? holders : [holders];
			if (holderList.length === 0 || !holderList[0].name || !holderList[0].name.trim()) {
				return fail(400, {
					error: `Please enter a name for Key ${i + 1}.`
				});
			}
			keyHolders[i] = holderList;
		}

		saveWorkflowData(
			user.user_id,
			data,
			{ keyHolders },
			'key_holders',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/recovery');
	}
};
