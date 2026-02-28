import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowBlob, saveWorkflowBlob, canAccessStep } from '$lib/server/workflow.js';

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

	const { encryptedBlob, iv } = getWorkflowBlob(user);

	return {
		encryptedBlob,
		iv,
		deviceTypes: DEVICE_TYPES,
		roleOptions: ROLE_OPTIONS
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
			'key_holders',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/recovery');
	}
};
