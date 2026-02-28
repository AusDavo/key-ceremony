import { redirect } from '@sveltejs/kit';

export function load({ locals, url }) {
	const { user } = locals;

	if (user.workflow_state === 'completed'
		&& !url.pathname.startsWith('/ceremony/dashboard')) {
		throw redirect(303, '/ceremony/dashboard');
	}

	return {
		workflowState: user.workflow_state,
		userId: user.user_id
	};
}
