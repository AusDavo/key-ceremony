import { json } from '@sveltejs/kit';
import { startRegistration, finishRegistration } from '$lib/server/auth.js';

export async function GET({ cookies }) {
	let sessionId = cookies.get('session_id');
	if (!sessionId) {
		sessionId = crypto.randomUUID();
		cookies.set('session_id', sessionId, { path: '/', httpOnly: true, sameSite: 'strict', secure: true });
	}

	const { options, userId } = await startRegistration(sessionId);
	cookies.set('pending_user_id', userId, { path: '/', httpOnly: true, sameSite: 'strict', secure: true, maxAge: 300 });

	return json(options);
}

export async function POST({ request, cookies }) {
	const sessionId = cookies.get('session_id');
	const userId = cookies.get('pending_user_id');

	if (!sessionId || !userId) {
		return json({ error: 'Session expired' }, { status: 400 });
	}

	const body = await request.json();

	// Extract DEK data from the request (sent alongside the credential)
	const { credential, wrappedDek, dekIv, keyCheck, keyCheckIv } = body;

	try {
		const result = await finishRegistration(sessionId, userId, credential, {
			wrappedDek,
			dekIv,
			keyCheck,
			keyCheckIv
		});
		cookies.delete('pending_user_id', { path: '/' });
		cookies.set('user_id', result.userId, { path: '/', httpOnly: true, sameSite: 'strict', secure: true });
		return json({ verified: true });
	} catch (err) {
		return json({ error: err.message }, { status: 400 });
	}
}
