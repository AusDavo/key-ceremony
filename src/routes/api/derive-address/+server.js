import { json } from '@sveltejs/kit';
import { getWorkflowData } from '$lib/server/workflow.js';
import { deriveAddress } from '$lib/server/bitcoin-utils.js';

export async function POST({ request, locals }) {
	const { xpubIndex, xpub: rawXpub, derivationPath, keyType } = await request.json();

	let xpubStr;
	if (rawXpub) {
		// Direct xpub — used by shared signing page (no auth required)
		xpubStr = rawXpub;
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
