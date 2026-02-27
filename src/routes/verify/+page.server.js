import { getCeremonyByHash } from '$lib/server/db.js';

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const hash = formData.get('hash')?.toString().trim().toLowerCase();

		if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
			return { error: 'Please enter a valid SHA-256 hash (64 hex characters)' };
		}

		const ceremony = getCeremonyByHash.get(hash);

		if (ceremony) {
			return {
				found: true,
				ceremonyReference: ceremony.ceremony_id,
				ceremonyDate: ceremony.ceremony_date,
				quorumRequired: ceremony.quorum_required,
				quorumTotal: ceremony.quorum_total,
				quorumAchieved: ceremony.quorum_achieved
			};
		}

		return { found: false };
	}
};
