import { updateWorkflowState, updateEncryptedBlob } from './db.js';

const WORKFLOW_STATES = [
	'registered',
	'setup',
	'key_holders',
	'recovery',
	'review',
	'completed'
];

/**
 * Get the raw encrypted blob for a user (no decryption — that happens client-side).
 * @returns {{ encryptedBlob: string|null, iv: string|null }}
 */
export function getWorkflowBlob(user) {
	if (!user.encrypted_blob || !user.iv) {
		return { encryptedBlob: null, iv: null };
	}
	return {
		encryptedBlob: Buffer.from(user.encrypted_blob).toString('base64'),
		iv: user.iv
	};
}

/**
 * Save an opaque encrypted blob and optionally advance the workflow state.
 * The server never decrypts this — it's encrypted client-side with the user's DEK.
 *
 * @param {string} userId
 * @param {Buffer|null} encryptedBlob - Raw encrypted bytes (or null to clear)
 * @param {string|null} iv - Base64 IV string
 * @param {string} newState - Target workflow state
 * @param {string} [currentState] - Current state (for high-water-mark check)
 */
export function saveWorkflowBlob(userId, encryptedBlob, iv, newState, currentState) {
	updateEncryptedBlob.run(encryptedBlob, iv, userId);

	if (newState) {
		const newIndex = WORKFLOW_STATES.indexOf(newState);
		const currentIndex = currentState ? WORKFLOW_STATES.indexOf(currentState) : -1;
		if (newIndex > currentIndex) {
			updateWorkflowState.run(newState, userId);
		}
	}
}

/**
 * Check if a user can access a given workflow step.
 */
export function canAccessStep(currentState, requiredState) {
	const currentIndex = WORKFLOW_STATES.indexOf(currentState);
	const requiredIndex = WORKFLOW_STATES.indexOf(requiredState);
	return currentIndex >= requiredIndex;
}

/**
 * Map a workflow state to the URL the user should resume at.
 */
const STATE_RESUME_URL = {
	registered:   '/ceremony/setup',
	setup:        '/ceremony/key-holders',
	key_holders:  '/ceremony/recovery',
	recovery:     '/ceremony/review',
	review:       '/ceremony/review',
	completed:    '/ceremony/dashboard'
};

export function getResumeUrl(workflowState) {
	return STATE_RESUME_URL[workflowState] || '/ceremony/setup';
}

export { WORKFLOW_STATES };
