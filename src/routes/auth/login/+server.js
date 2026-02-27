import { json } from '@sveltejs/kit';
import { startLogin, finishLogin } from '$lib/server/auth.js';
import { getUser } from '$lib/server/db.js';
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
		const redirectTo = getResumeUrl(getUser.get(result.userId)?.workflow_state);
		return json({ verified: true, redirectTo });
	} catch (err) {
		return json({ error: err.message }, { status: 400 });
	}
}
