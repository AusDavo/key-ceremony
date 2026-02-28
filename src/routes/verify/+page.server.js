import { getCeremonyByHash } from '$lib/server/db.js';
import { decryptForUser } from '$lib/server/encryption.js';

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const hash = formData.get('hash')?.toString().trim().toLowerCase();

		if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
			return { error: 'Please enter a valid SHA-256 hash (64 hex characters)' };
		}

		const ceremony = getCeremonyByHash.get(hash);

		if (ceremony) {
			// Decrypt metadata if available (new format)
			if (ceremony.encrypted_metadata && ceremony.metadata_iv) {
				const metadata = decryptForUser(ceremony.encrypted_metadata, ceremony.metadata_iv, ceremony.user_id);
				return {
					found: true,
					ceremonyReference: ceremony.ceremony_id,
					ceremonyDate: metadata.ceremonyDate,
					quorumRequired: metadata.quorumRequired,
					quorumTotal: metadata.quorumTotal,
					quorumAchieved: metadata.quorumAchieved
				};
			}

			// Fallback for legacy plaintext records
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
