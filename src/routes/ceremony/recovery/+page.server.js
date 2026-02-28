import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowBlob, saveWorkflowBlob, canAccessStep } from '$lib/server/workflow.js';

export function load({ locals }) {
	const { user } = locals;
	if (!canAccessStep(user.workflow_state, 'key_holders')) {
		throw redirect(303, '/ceremony/key-holders');
	}

	const { encryptedBlob, iv } = getWorkflowBlob(user);

	return {
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
			'recovery',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/review');
	}
};
