import { json } from '@sveltejs/kit';
import { startLogin, finishLogin } from '$lib/server/auth.js';
import { getUser, getCredentialDek } from '$lib/server/db.js';
import { getResumeUrl } from '$lib/server/workflow.js';

export async function GET({ cookies }) {
	let sessionId = cookies.get('session_id');
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		cookies.set('session_id', sessionId, { path: '/', httpOnly: true, sameSite: 'strict', secure: true });
	}

	const { options } = await startLogin(sessionId);
	return json(options);
}

export async function POST({ request, cookies }) {
	const sessionId = cookies.get('session_id');
	if (!sessionId) {
		return json({ error: 'Session expired' }, { status: 400 });
	}

	const body = await request.json();

	try {
		const result = await finishLogin(sessionId, body);
		cookies.set('user_id', result.userId, { path: '/', httpOnly: true, sameSite: 'strict', secure: true });

		const user = getUser.get(result.userId);
		const redirectTo = getResumeUrl(user?.workflow_state);

		// Return the wrapped DEK for the authenticating credential
		const dekRow = getCredentialDek.get(result.credentialId);
		const wrappedDek = dekRow?.encrypted_dek
			? Buffer.from(dekRow.encrypted_dek).toString('base64')
			: null;

		return json({
			verified: true,
			redirectTo,
			wrappedDek,
			dekIv: dekRow?.dek_iv || null
		});
	} catch (err) {
		return json({ error: err.message }, { status: 400 });
	}
}
