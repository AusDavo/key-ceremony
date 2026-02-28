import { json } from '@sveltejs/kit';
import { getWorkflowData } from '$lib/server/workflow.js';
import { deriveAddress } from '$lib/server/bitcoin-utils.js';
import { getHashedToken, getUser } from '$lib/server/db.js';

export async function POST({ request, locals }) {
	const { xpubIndex, token, derivationPath, keyType } = await request.json();

	let xpubStr;
	if (token) {
		// Token-based — used by shared signing page (no auth required)
		const tokenRow = getHashedToken(token);
		if (!tokenRow) {
			return json({ error: 'Invalid or expired signing token' }, { status: 400 });
		}
		const user = getUser.get(tokenRow.user_id);
		if (!user) {
			return json({ error: 'Invalid signing token' }, { status: 400 });
		}
		const data = getWorkflowData(user);
		const parsed = data.descriptorParsed;
		if (!parsed?.xpubs[tokenRow.xpub_index]) {
			return json({ error: 'Invalid key reference' }, { status: 400 });
		}
		xpubStr = parsed.xpubs[tokenRow.xpub_index].xpub;
	} else {
		// Index-based — requires auth
		const user = locals.user;
		if (!user) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}
		const data = getWorkflowData(user);
		const parsed = data.descriptorParsed;
		if (!parsed?.xpubs[xpubIndex]) {
			return json({ error: 'Invalid xpub index' }, { status: 400 });
		}
		xpubStr = parsed.xpubs[xpubIndex].xpub;
	}

	try {
		const result = deriveAddress(xpubStr, derivationPath || '0/0', keyType || 'segwit');
		return json({ address: result.address });
	} catch (err) {
		return json({ error: err.message }, { status: 400 });
	}
}
