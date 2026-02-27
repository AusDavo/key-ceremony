import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowData, saveWorkflowData, canAccessStep } from '$lib/server/workflow.js';

export function load({ locals }) {
	const { user } = locals;
	if (!canAccessStep(user.workflow_state, 'verified')) {
		throw redirect(303, '/ceremony/verification');
	}

	const data = getWorkflowData(user);
	const parsed = data.descriptorParsed;

	return {
		quorum: parsed.quorum,
		addressTypeLabel: parsed.addressTypeLabel,
		addressType: parsed.addressType,
		xpubCount: parsed.xpubs.length,
		savedRecovery: data.recoveryInstructions || null
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();

		const recoveryInstructions = {
			walletSoftware: formData.get('walletSoftware')?.toString().trim() || '',
			descriptorStorage: formData.get('descriptorStorage')?.toString().trim() || '',
			emergencySteps: formData.get('emergencySteps')?.toString().trim() || '',
			emergencyContacts: formData.get('emergencyContacts')?.toString().trim() || '',
			additionalNotes: formData.get('additionalNotes')?.toString().trim() || ''
		};

		const data = getWorkflowData(user);

		saveWorkflowData(
			user.user_id,
			data,
			{ recoveryInstructions },
			'recovery'
		);

		throw redirect(303, '/ceremony/review');
	}
};
