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
	const parsed = data.descriptorParsed;

	return {
		descriptorParsed: parsed,
		keyHolders: data.keyHolders || {},
		quorumAchieved: data.quorumAchieved || Object.keys(data.signatures || {}).length,
		signatures: Object.keys(data.signatures || {}),
		recoveryInstructions: data.recoveryInstructions || {},
		challenge: data.signingChallenge?.challenge,
		blockHeight: data.signingChallenge?.blockHeight
	};
}

export const actions = {
	generate: async ({ locals }) => {
		const { user } = locals;
		const data = getWorkflowData(user);

		let result;
		try {
			result = generateCeremonyDocument({
				descriptorParsed: data.descriptorParsed,
				descriptorRaw: data.descriptorRaw,
				signingChallenge: data.signingChallenge,
				quorumAchieved: data.quorumAchieved || Object.keys(data.signatures || {}).length,
				signatures: data.signatures || {},
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

		// Clean up temp files immediately — PDF is now in the database
		cleanupBuild(result.buildDir);

		// Encrypt ceremony metadata
		const quorum = data.descriptorParsed.quorum || { required: 1, total: data.descriptorParsed.xpubs.length };
		const quorumAchieved = data.quorumAchieved || Object.keys(data.signatures || {}).length;
		const metadata = {
			ceremonyDate: result.ceremonyDate,
			descriptorHash: result.descriptorHash,
			quorumRequired: quorum.required,
			quorumTotal: quorum.total,
			quorumAchieved
		};
		const { encrypted: encryptedMeta, iv: metaIv } = encryptForUser(metadata, user.user_id);

		insertCeremony.run(
			result.ceremonyReference,
			user.user_id,
			result.documentHash,
			encryptedMeta,
			metaIv
		);

		// Clear purge timer — completed users are not purged
		setPurgeAfter.run(null, user.user_id);

		saveWorkflowData(
			user.user_id,
			{},
			{
				ceremonyReference: result.ceremonyReference,
				documentHash: result.documentHash,
				descriptorHash: result.descriptorHash,
				descriptorRaw: data.descriptorRaw,
				descriptorParsed: data.descriptorParsed,
				keyHolders: data.keyHolders,
				signatures: data.signatures,
				recoveryInstructions: data.recoveryInstructions,
				signingChallenge: data.signingChallenge,
				quorumAchieved
			},
			'completed',
			user.workflow_state
		);

		throw redirect(303, '/ceremony/dashboard');
	}
};
