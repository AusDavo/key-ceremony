import { json } from '@sveltejs/kit';
import { verifyWebhookSignature } from '$lib/server/donation.js';

export async function POST({ request }) {
	const body = await request.text();
	const signature = request.headers.get('BTCPay-Sig');

	if (!verifyWebhookSignature(body, signature)) {
		return json({ error: 'Invalid signature' }, { status: 401 });
	}

	const event = JSON.parse(body);

	if (event.type === 'InvoiceSettled') {
		console.log(`Donation received: invoice ${event.invoiceId}`);
	}

	return json({ ok: true });
}
