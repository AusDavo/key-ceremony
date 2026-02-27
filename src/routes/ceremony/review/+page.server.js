import { redirect, fail } from '@sveltejs/kit';
import { getWorkflowData, saveWorkflowData, canAccessStep } from '$lib/server/workflow.js';
import { setPurgeAfter, insertCeremony } from '$lib/server/db.js';
import { generateCeremonyDocument, cleanupBuild } from '$lib/server/report-generator.js';

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

		const quorum = data.descriptorParsed.quorum || { required: 1, total: data.descriptorParsed.xpubs.length };

		insertCeremony.run(
			result.ceremonyReference,
			user.user_id,
			result.ceremonyDate,
			result.descriptorHash,
			quorum.required,
			quorum.total,
			data.quorumAchieved || Object.keys(data.signatures || {}).length,
			result.documentHash
		);

		const purgeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
		setPurgeAfter.run(purgeDate, user.user_id);

		saveWorkflowData(
			user.user_id,
			{},
			{
				ceremonyReference: result.ceremonyReference,
				documentHash: result.documentHash,
				descriptorHash: result.descriptorHash,
				ceremonyBuildDir: result.buildDir,
				descriptorRaw: data.descriptorRaw,
				descriptorParsed: data.descriptorParsed
			},
			'completed'
		);

		throw redirect(303, '/ceremony/dashboard');
	}
};
