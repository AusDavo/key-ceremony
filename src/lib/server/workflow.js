import { updateWorkflowState, updateEncryptedBlob } from './db.js';
import { encryptObject, decryptObject } from './encryption.js';

const WORKFLOW_STATES = [
	'registered',
	'descriptor',
	'key_holders',
	'verification',
	'verified',
	'recovery',
	'review',
	'completed'
];

/**
 * Get the current workflow data (decrypted) for a user.
 */
export function getWorkflowData(user) {
	if (!user.encrypted_blob || !user.iv) {
		return {};
	}
	return decryptObject(user.encrypted_blob, user.iv);
}

/**
 * Save workflow data (encrypted) and optionally advance the state.
 * State never regresses — if newState is earlier than current, current is kept.
 */
export function saveWorkflowData(userId, currentData, newData, newState, currentState) {
	const merged = { ...currentData, ...newData };
	const { encrypted, iv } = encryptObject(merged);
	updateEncryptedBlob.run(encrypted, iv, userId);

	if (newState) {
		const newIndex = WORKFLOW_STATES.indexOf(newState);
		const currentIndex = currentState ? WORKFLOW_STATES.indexOf(currentState) : -1;
		if (newIndex > currentIndex) {
			updateWorkflowState.run(newState, userId);
		}
	}

	return merged;
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
	registered:   '/ceremony/descriptor',
	descriptor:   '/ceremony/key-holders',
	key_holders:  '/ceremony/verification',
	verification: '/ceremony/verification',
	verified:     '/ceremony/recovery',
	recovery:     '/ceremony/review',
	review:       '/ceremony/review',
	completed:    '/ceremony/dashboard'
};

export function getResumeUrl(workflowState) {
	return STATE_RESUME_URL[workflowState] || '/ceremony/descriptor';
}

export { WORKFLOW_STATES };
