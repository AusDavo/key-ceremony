import { json } from '@sveltejs/kit';
import { startAddPasskey, finishAddPasskey } from '$lib/server/auth.js';

export async function GET({ cookies }) {
	const sessionId = cookies.get('session_id');
	const userId = cookies.get('user_id');

	if (!sessionId || !userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const { options } = await startAddPasskey(sessionId, userId);
	return json(options);
}

export async function POST({ request, cookies }) {
	const sessionId = cookies.get('session_id');
	const userId = cookies.get('user_id');

	if (!sessionId || !userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const body = await request.json();

	try {
		const result = await finishAddPasskey(sessionId, userId, body);
		return json({ verified: true });
	} catch (err) {
		return json({ error: err.message }, { status: 400 });
	}
}
