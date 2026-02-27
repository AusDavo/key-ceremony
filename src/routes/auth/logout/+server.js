import { redirect } from '@sveltejs/kit';

export function POST({ cookies }) {
	cookies.delete('user_id', { path: '/' });
	throw redirect(303, '/');
}
