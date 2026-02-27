import { error } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getWorkflowData } from '$lib/server/workflow.js';

export function GET({ locals }) {
	const { user } = locals;
	if (!user) {
		throw error(401, 'Not authenticated');
	}

	const data = getWorkflowData(user);

	if (!data.ceremonyBuildDir || !data.ceremonyReference) {
		throw error(404, 'No ceremony record available for download');
	}

	let pdfBuffer;
	try {
		pdfBuffer = readFileSync(join(data.ceremonyBuildDir, 'report.pdf'));
	} catch {
		throw error(404, 'Ceremony record file not found. It may have been cleaned up.');
	}

	return new Response(pdfBuffer, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `attachment; filename="${data.ceremonyReference}.pdf"`,
			'Content-Length': pdfBuffer.length.toString()
		}
	});
}
