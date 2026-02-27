import { json, error } from '@sveltejs/kit';
import { getVaultEntry, deleteVaultEntry } from '$lib/server/db.js';

export async function GET({ params, locals }) {
	const { user } = locals;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const entry = getVaultEntry.get(params.id, user.user_id);
	if (!entry) {
		return json({ error: 'Entry not found' }, { status: 404 });
	}

	return json({
		id: entry.id,
		credential_id: entry.credential_id,
		encrypted_descriptor: Buffer.from(entry.encrypted_descriptor).toString('base64'),
		iv: entry.iv,
		salt: entry.salt,
		label: entry.label
	});
}

export async function DELETE({ params, locals }) {
	const { user } = locals;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const result = deleteVaultEntry.run(params.id, user.user_id);
	if (result.changes === 0) {
		return json({ error: 'Entry not found' }, { status: 404 });
	}

	return json({ ok: true });
}
