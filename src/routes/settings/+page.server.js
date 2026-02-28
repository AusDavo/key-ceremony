import { redirect } from '@sveltejs/kit';
import { getCredentialsByUser, purgeUser } from '$lib/server/db.js';

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
	deleteAccount: async ({ locals, cookies }) => {
		const { user } = locals;
		purgeUser.run(user.user_id);
		cookies.delete('session_id', { path: '/' });
		cookies.delete('user_id', { path: '/' });
		throw redirect(303, '/');
	}
};
