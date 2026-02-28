import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowData, saveWorkflowData, canAccessStep } from '$lib/server/workflow.js';
import { setPurgeAfter, insertCeremony, updateEncryptedPdf } from '$lib/server/db.js';
import { generateCeremonyDocument, cleanupBuild } from '$lib/server/report-generator.js';
import { encryptBufferForUser, encryptForUser } from '$lib/server/encryption.js';

export function load({ locals }) {
	const { user } = locals;
	if (!canAccessStep(user.workflow_state, 'recovery')) {
		throw redirect(303, '/ceremony/recovery');
	}

	const data = getWorkflowData(user);

	return {
		walletConfig: data.walletConfig,
		keyHolders: data.keyHolders || {},
		recoveryInstructions: data.recoveryInstructions || {}
	};
}

export const actions = {
	generate: async ({ locals }) => {
		const { user } = locals;
		const data = getWorkflowData(user);

		let result;
		try {
			result = generateCeremonyDocument({
				walletConfig: data.walletConfig,
				keyHolders: data.keyHolders || {},
				recoveryInstructions: data.recoveryInstructions || {}
			});
		} catch (err) {
			console.error('Ceremony document generation failed:', err);
			return fail(500, { error: `Document generation failed: ${err.message}` });
		}

		// Encrypt the PDF and store in database
		const { encrypted: encryptedPdf, iv: pdfIv } = encryptBufferForUser(result.pdfBuffer, user.user_id);
		updateEncryptedPdf.run(encryptedPdf, pdfIv, user.user_id);

		// Clean up temp files immediately
		cleanupBuild(result.buildDir);

		// Encrypt ceremony metadata
		const metadata = {
			ceremonyDate: result.ceremonyDate,
			quorumRequired: data.walletConfig.quorumRequired,
			quorumTotal: data.walletConfig.keyCount
		};
		const { encrypted: encryptedMeta, iv: metaIv } = encryptForUser(metadata, user.user_id);

		insertCeremony.run(
			result.ceremonyReference,
			user.user_id,
			result.ceremonyDate,
			result.documentHash,
			encryptedMeta,
			metaIv
		);

		// Clear purge timer — completed users are not purged
		setPurgeAfter.run(null, user.user_id);

		// Only keep display data after generation
		saveWorkflowData(
			user.user_id,
			{},
			{
				ceremonyReference: result.ceremonyReference,
				documentHash: result.documentHash
			},
			'completed',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/dashboard');
	}
};
