import { error } from '@sveltejs/kit';
import { getWorkflowData } from '$lib/server/workflow.js';
import { getEncryptedPdf, clearEncryptedPdf } from '$lib/server/db.js';
import { decryptBufferForUser } from '$lib/server/encryption.js';

export function GET({ locals }) {
	const { user } = locals;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const data = getWorkflowData(user);

	if (!data.ceremonyReference) {
		throw error(404, 'No ceremony record available for download');
	}

	const row = getEncryptedPdf.get(user.user_id);
	if (!row?.encrypted_pdf || !row?.pdf_iv) {
		throw error(404, 'Ceremony record not found. It may have been generated before encrypted storage was enabled.');
	}

	const pdfBuffer = decryptBufferForUser(row.encrypted_pdf, row.pdf_iv, user.user_id);

	// Delete the encrypted PDF — single-use download
	clearEncryptedPdf.run(user.user_id);

	return new Response(pdfBuffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${data.ceremonyReference}.pdf"`,
			'Content-Length': pdfBuffer.length.toString()
		}
	});
}
