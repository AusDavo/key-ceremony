import { redirect } from '@sveltejs/kit';
import { isDonationsEnabled } from '$lib/server/donation.js';
import { updateEncryptedBlob, updateWorkflowState } from '$lib/server/db.js';

export function load({ locals }) {
	const { user } = locals;
	if (user.workflow_state !== 'completed') {
		throw redirect(303, '/ceremony/setup');
	}

	// The ceremony reference is stored as a plain JSON blob after completion
	let ceremonyReference = null;
	if (user.encrypted_blob && user.iv === 'plain') {
		try {
			const data = JSON.parse(Buffer.from(user.encrypted_blob).toString());
			ceremonyReference = data.ceremonyReference;
		} catch { /* ignore */ }
	}

	return {
		ceremonyReference,
		donationsEnabled: isDonationsEnabled()
	};
}

export const actions = {
	reset: async ({ locals }) => {
		const { user } = locals;
		updateEncryptedBlob.run(null, null, user.user_id);
		updateWorkflowState.run('registered', user.user_id);
		throw redirect(303, '/ceremony/setup');
	}
};
