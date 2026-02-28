import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowData, saveWorkflowData } from '$lib/server/workflow.js';

const WALLET_TYPES = [
	'Native SegWit (P2WSH)',
	'Nested SegWit (P2SH-P2WSH)',
	'Taproot (P2TR)',
	'Legacy (P2SH)',
	'Other'
];

export function load({ locals }) {
	const { user } = locals;
	const data = getWorkflowData(user);

	return {
		walletTypes: WALLET_TYPES,
		savedConfig: data.walletConfig || null
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();

		const keyCount = parseInt(formData.get('keyCount')?.toString(), 10);
		const quorumRequired = parseInt(formData.get('quorumRequired')?.toString(), 10);
		const walletType = formData.get('walletType')?.toString().trim() || '';
		const customWalletType = formData.get('customWalletType')?.toString().trim() || '';

		if (isNaN(keyCount) || keyCount < 1 || keyCount > 15) {
			return fail(400, { error: 'Number of keys must be between 1 and 15.' });
		}

		if (isNaN(quorumRequired) || quorumRequired < 1 || quorumRequired > keyCount) {
			return fail(400, { error: `Quorum must be between 1 and ${keyCount}.` });
		}

		const walletConfig = {
			keyCount,
			quorumRequired,
			walletType: walletType === 'Other' ? customWalletType : walletType
		};

		const data = getWorkflowData(user);

		// If key count changed, reset key holders
		const keyCountChanged = data.walletConfig && data.walletConfig.keyCount !== keyCount;
		const updates = { walletConfig };
		if (keyCountChanged) {
			updates.keyHolders = undefined;
		}

		saveWorkflowData(
			user.user_id,
			data,
			updates,
			'setup',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/key-holders');
	}
};
