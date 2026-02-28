import { json } from '@sveltejs/kit';
import { getCredentialById, updateKeyCheck } from '$lib/server/db.js';
import db from '$lib/server/db.js';

// Update encrypted_dek and dek_iv on a credential
const updateCredentialDek = db.prepare(`
  UPDATE passkey_credentials SET encrypted_dek = ?, dek_iv = ? WHERE credential_id = ? AND user_id = ?
`);

export async function POST({ request, cookies }) {
	const userId = cookies.get('user_id');
	if (!userId) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	const { credentialId, wrappedDek, dekIv, keyCheck, keyCheckIv } = await request.json();

	if (!credentialId || !wrappedDek || !dekIv) {
		return json({ error: 'Missing encryption data' }, { status: 400 });
	}

	// Verify the credential belongs to this user
	const cred = getCredentialById.get(credentialId);
	if (!cred || cred.user_id !== userId) {
		return json({ error: 'Credential not found' }, { status: 404 });
	}

	// Store the wrapped DEK on the credential
	updateCredentialDek.run(
		Buffer.from(wrappedDek, 'base64'),
		dekIv,
		credentialId,
		userId
	);

	// Store the key check on the user
	if (keyCheck && keyCheckIv) {
		updateKeyCheck.run(
			Buffer.from(keyCheck, 'base64'),
			keyCheckIv,
			userId
		);
	}

	return json({ success: true });
}
