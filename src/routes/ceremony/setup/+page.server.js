import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowBlob, saveWorkflowBlob } from '$lib/server/workflow.js';

const WALLET_TYPES = [
	'Native SegWit (P2WSH)',
	'Nested SegWit (P2SH-P2WSH)',
	'Taproot (P2TR)',
	'Legacy (P2SH)',
	'Other'
];

export function load({ locals }) {
	const { user } = locals;
	const { encryptedBlob, iv } = getWorkflowBlob(user);

	return {
		walletTypes: WALLET_TYPES,
		encryptedBlob,
		iv
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();

		const encryptedBlob = formData.get('encryptedBlob')?.toString();
		const iv = formData.get('iv')?.toString();

		if (!encryptedBlob || !iv) {
			return fail(400, { error: 'Encryption error. Please try again.' });
		}

		saveWorkflowBlob(
			user.user_id,
			Buffer.from(encryptedBlob, 'base64'),
			iv,
			'setup',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/key-holders');
	}
};
