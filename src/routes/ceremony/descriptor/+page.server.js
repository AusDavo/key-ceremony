import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowData, saveWorkflowData } from '$lib/server/workflow.js';
import { parseDescriptor } from '$lib/server/descriptor-parser.js';

export function load({ locals }) {
	const { user } = locals;
	const data = getWorkflowData(user);
	return {
		descriptor: data.descriptorRaw || ''
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();

		const descriptorRaw = formData.get('descriptor')?.toString().trim();

		if (!descriptorRaw) {
			return fail(400, { error: 'Wallet descriptor is required', descriptorRaw });
		}

		let parsed;
		try {
			parsed = parseDescriptor(descriptorRaw);
		} catch (err) {
			return fail(400, { error: `Invalid descriptor: ${err.message}`, descriptorRaw });
		}

		if (parsed.xpubs.length === 0) {
			return fail(400, { error: 'No xpubs found in descriptor', descriptorRaw });
		}

		const currentData = getWorkflowData(user);

		const descriptorChanged = descriptorRaw !== currentData.descriptorRaw;

		const newData = {
			descriptorRaw,
			descriptorParsed: parsed
		};

		if (descriptorChanged) {
			newData.signingChallenge = null;
			newData.signatures = null;
			newData.shareTokens = null;
			newData.keyHolders = null;
			newData.quorumAchieved = null;
			// Descriptor changed — force state reset since downstream data is invalidated
			saveWorkflowData(user.user_id, {}, newData, 'descriptor');
		} else {
			saveWorkflowData(user.user_id, currentData, newData, 'descriptor', user.workflow_state);
		}

		throw redirect(303, '/ceremony/key-holders');
	}
};
