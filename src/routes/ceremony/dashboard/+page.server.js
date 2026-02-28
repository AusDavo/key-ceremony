import { redirect } from '@sveltejs/kit';
import { getWorkflowData, saveWorkflowData } from '$lib/server/workflow.js';
import { isDonationsEnabled } from '$lib/server/donation.js';

export function load({ locals }) {
	const { user } = locals;
	if (user.workflow_state !== 'completed') {
		throw redirect(303, '/ceremony/descriptor');
	}

	const data = getWorkflowData(user);

	return {
		ceremonyReference: data.ceremonyReference,
		documentHash: data.documentHash,
		descriptorHash: data.descriptorHash,
		donationsEnabled: isDonationsEnabled(),
		hasDescriptor: !!data.descriptorRaw,
		hasPdf: !!(user.encrypted_pdf && user.pdf_iv)
	};
}

export const actions = {
	reset: async ({ locals }) => {
		const { user } = locals;
		saveWorkflowData(user.user_id, {}, {}, 'registered');
		throw redirect(303, '/ceremony/descriptor');
	},

	deleteDescriptor: async ({ locals }) => {
		const { user } = locals;
		const data = getWorkflowData(user);
		const { descriptorRaw, ...rest } = data;
		saveWorkflowData(user.user_id, {}, rest, 'completed', user.workflow_state);
		return { descriptorDeleted: true };
	}
};
