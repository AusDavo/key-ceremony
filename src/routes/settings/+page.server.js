import { json, redirect, fail } from '@sveltejs/kit';
import { getCredentialsByUser, deleteCredential, countCredentialsByUser, purgeUser } from '$lib/server/db.js';

export function load({ locals }) {
	const { user } = locals;

	const credentials = getCredentialsByUser.all(user.user_id).map(c => ({
		credentialId: c.credential_id,
		createdAt: c.created_at,
		transports: JSON.parse(c.transports || '[]')
	}));

	return { credentials };
}

export const actions = {
	deletePasskey: async ({ request, locals }) => {
		const { user } = locals;
		const formData = await request.formData();
		const credentialId = formData.get('credentialId')?.toString();

		if (!credentialId) {
			return fail(400, { error: 'Credential ID required' });
		}

		const { count } = countCredentialsByUser.get(user.user_id);
		if (count <= 1) {
			return fail(400, { error: 'Cannot delete your only passkey. Add another passkey first.' });
		}

		deleteCredential.run(credentialId, user.user_id);
		return { deleted: true };
	},

	deleteAccount: async ({ locals, cookies }) => {
		const { user } = locals;
		purgeUser.run(user.user_id);
		cookies.delete('session_id', { path: '/' });
		cookies.delete('user_id', { path: '/' });
		throw redirect(303, '/');
	}
};
