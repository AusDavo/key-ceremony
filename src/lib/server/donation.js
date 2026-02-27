import { createHmac } from 'crypto';
import { env } from '$env/dynamic/private';

const BTCPAY_URL = env.BTCPAY_URL || 'https://btcpay.dpinkerton.com';
const BTCPAY_STORE_ID = env.BTCPAY_STORE_ID;
const BTCPAY_API_KEY = env.BTCPAY_API_KEY;
const BTCPAY_WEBHOOK_SECRET = env.BTCPAY_WEBHOOK_SECRET;

async function btcpayRequest(path, options = {}) {
	const url = `${BTCPAY_URL}/api/v1${path}`;
	const response = await fetch(url, {
		...options,
		headers: {
			'Authorization': `token ${BTCPAY_API_KEY}`,
			'Content-Type': 'application/json',
			...options.headers
		}
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`BTCPay API error ${response.status}: ${text}`);
	}

	return response.json();
}

/**
 * Create a donation invoice via BTCPay.
 */
export async function createDonationInvoice(amount, currency = 'AUD') {
	if (!BTCPAY_API_KEY || !BTCPAY_STORE_ID) {
		throw new Error('BTCPay not configured');
	}

	return btcpayRequest(`/stores/${BTCPAY_STORE_ID}/invoices`, {
		method: 'POST',
		body: JSON.stringify({
			amount,
			currency,
			metadata: {
				product: 'Key Ceremony Donation'
			}
		})
	});
}

/**
 * Verify a BTCPay webhook signature.
 */
export function verifyWebhookSignature(body, sigHeader) {
	if (!BTCPAY_WEBHOOK_SECRET || !sigHeader) return false;

	const expected = createHmac('sha256', BTCPAY_WEBHOOK_SECRET)
		.update(body)
		.digest('hex');

	const provided = sigHeader.replace('sha256=', '');
	return expected === provided;
}

export function isDonationsEnabled() {
	return !!(BTCPAY_API_KEY && BTCPAY_STORE_ID);
}
