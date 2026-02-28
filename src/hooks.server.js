import { redirect } from '@sveltejs/kit';
import { getUser } from '$lib/server/db.js';
import { startPurgeScheduler } from '$lib/server/purge.js';

startPurgeScheduler();

const PROTECTED_PATHS = ['/ceremony', '/vault', '/settings'];

export async function handle({ event, resolve }) {
	const userId = event.cookies.get('user_id');

	if (userId) {
		const user = getUser.get(userId);
		if (user) {
			event.locals.user = user;
		} else {
			event.cookies.delete('user_id', { path: '/' });
		}
	}

	const isProtected = PROTECTED_PATHS.some((p) => event.url.pathname.startsWith(p));
	if (isProtected && !event.locals.user) {
		throw redirect(303, '/');
	}

	return resolve(event);
}
