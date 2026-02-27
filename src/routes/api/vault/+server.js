import { json, error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { insertVaultEntry, getVaultEntriesByUser } from '$lib/server/db.js';

export async function POST({ request, locals }) {
	const { user } = locals;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json();
	const { credentialId, encryptedDescriptor, iv, salt, label } = body;

	if (!credentialId || !encryptedDescriptor || !iv || !salt) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	const id = randomUUID();

	try {
		insertVaultEntry.run(
			id,
			user.user_id,
			credentialId,
			Buffer.from(encryptedDescriptor, 'base64'),
			iv,
			salt,
			label || null
		);
	} catch (err) {
		console.error('Failed to insert vault entry:', err);
		return json({ error: 'Failed to save vault entry' }, { status: 500 });
	}

	return json({ id });
}

export async function GET({ locals }) {
	const { user } = locals;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const entries = getVaultEntriesByUser.all(user.user_id).map(e => ({
		id: e.id,
		credentialId: e.credential_id,
		label: e.label,
		createdAt: e.created_at
	}));

	return json({ entries });
}
