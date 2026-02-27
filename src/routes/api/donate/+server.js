import { redirect } from '@sveltejs/kit';
import { createDonationInvoice, isDonationsEnabled } from '$lib/server/donation.js';

export async function GET() {
	if (!isDonationsEnabled()) {
		throw redirect(303, '/');
	}

	try {
		const invoice = await createDonationInvoice(0, 'BTC');
		if (invoice.checkoutLink) {
			throw redirect(303, invoice.checkoutLink);
		}
		throw redirect(303, '/');
	} catch (err) {
		if (err.status === 303) throw err;
		console.error('Failed to create donation invoice:', err);
		throw redirect(303, '/');
	}
}
