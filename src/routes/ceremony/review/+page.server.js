import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowBlob, saveWorkflowBlob, canAccessStep } from '$lib/server/workflow.js';
import { setPurgeAfter, updateEncryptedBlob } from '$lib/server/db.js';

export function load({ locals }) {
	const { user } = locals;
	if (!canAccessStep(user.workflow_state, 'recovery')) {
		throw redirect(303, '/ceremony/recovery');
	}

	const { encryptedBlob, iv } = getWorkflowBlob(user);

	return {
		encryptedBlob,
		iv
	};
}

export const actions = {
	complete: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();

		const ceremonyReference = formData.get('ceremonyReference')?.toString();

		if (!ceremonyReference) {
			return fail(400, { error: 'Missing ceremony reference.' });
		}

		// Clear purge timer — completed users are not purged
		setPurgeAfter.run(null, user.user_id);

		// Clear the encrypted blob — no ceremony data needs to persist after completion
		updateEncryptedBlob.run(null, null, user.user_id);

		// Save only the ceremony reference (unencrypted, for dashboard display)
		// Store it as a simple JSON blob
		const displayData = JSON.stringify({ ceremonyReference });
		updateEncryptedBlob.run(Buffer.from(displayData), 'plain', user.user_id);

		// Advance to completed state
		saveWorkflowBlob(
			user.user_id,
			Buffer.from(displayData),
			'plain',
			'completed',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/dashboard');
	}
};
