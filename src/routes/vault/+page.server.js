import { redirect } from '@sveltejs/kit';
import { getVaultEntriesByUser } from '$lib/server/db.js';
import { getWorkflowData } from '$lib/server/workflow.js';

export function load({ locals }) {
	const { user } = locals;
	if (!user) {
		throw redirect(303, '/');
	}

	const entries = getVaultEntriesByUser.all(user.user_id).map(e => ({
		id: e.id,
		credentialId: e.credential_id,
		label: e.label,
		createdAt: e.created_at
	}));

	const data = getWorkflowData(user);
	const hasDescriptor = !!(data.descriptorRaw);

	return {
		entries,
		hasDescriptor,
		descriptorRaw: data.descriptorRaw || null
	};
}
