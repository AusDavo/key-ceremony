import { randomUUID } from 'crypto';
import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse
} from '@simplewebauthn/server';
import {
	createUser,
	getUser,
	addCredential,
	getCredentialsByUser,
	getCredentialById,
	updateCredentialCounter,
	setPurgeAfter
} from './db.js';

import { env } from '$env/dynamic/private';

const RP_NAME = env.RP_NAME || 'Key Ceremony';
const RP_ID = env.RP_ID || 'localhost';
const RP_ORIGIN = env.RP_ORIGIN || 'http://localhost:5173';

// Memorable passkey display names — Bitcoin/finance themed
const ADJECTIVES = [
	'steady', 'golden', 'bright', 'swift', 'bold', 'silent', 'iron', 'crimson',
	'noble', 'lunar', 'coral', 'amber', 'arctic', 'copper', 'marble', 'onyx',
	'silver', 'vivid', 'rustic', 'sonic', 'primal', 'cosmic', 'frozen', 'scarlet'
];
const NOUNS = [
	'falcon', 'anchor', 'ledger', 'summit', 'cipher', 'vault', 'beacon', 'forge',
	'keystone', 'sentinel', 'compass', 'phoenix', 'tower', 'bridge', 'shield', 'orbit',
	'lantern', 'horizon', 'circuit', 'prism', 'quarry', 'raven', 'flint', 'ember'
];

function generateDisplayName() {
	const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
	const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
	return `${adj}-${noun}`;
}

// In-memory challenge store (short-lived, keyed by session ID)
const challengeStore = new Map();

function storeChallenge(sessionId, challenge) {
	challengeStore.set(sessionId, { challenge, expires: Date.now() + 5 * 60 * 1000 });
	// Clean up expired entries
	for (const [key, val] of challengeStore) {
		if (val.expires < Date.now()) challengeStore.delete(key);
	}
}

function getChallenge(sessionId) {
	const entry = challengeStore.get(sessionId);
	if (!entry || entry.expires < Date.now()) {
		challengeStore.delete(sessionId);
		return null;
	}
	challengeStore.delete(sessionId);
	return entry.challenge;
}

/**
 * Generate registration options for a new user.
 */
export async function startRegistration(sessionId) {
	const userId = randomUUID();

	const options = await generateRegistrationOptions({
		rpName: RP_NAME,
		rpID: RP_ID,
		userName: generateDisplayName(),
		userID: new TextEncoder().encode(userId),
		attestationType: 'none',
		authenticatorSelection: {
			residentKey: 'required',
			userVerification: 'preferred'
		}
	});

	storeChallenge(sessionId, options.challenge);

	return { options, userId };
}

/**
 * Verify registration response and create the user + credential.
 */
export async function finishRegistration(sessionId, userId, response) {
	const expectedChallenge = getChallenge(sessionId);
	if (!expectedChallenge) {
		throw new Error('Registration challenge expired or not found');
	}

	const verification = await verifyRegistrationResponse({
		response,
		expectedChallenge,
		expectedOrigin: RP_ORIGIN,
		expectedRPID: RP_ID
	});

	if (!verification.verified || !verification.registrationInfo) {
		throw new Error('Registration verification failed');
	}

	const { credential } = verification.registrationInfo;

	createUser.run(userId);

	// Set purge timer for abandoned accounts (90 days); cleared on ceremony completion
	setPurgeAfter.run(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), userId);

	addCredential.run(
		credential.id,
		userId,
		Buffer.from(credential.publicKey),
		credential.counter,
		JSON.stringify(credential.transports || [])
	);

	return { verified: true, userId };
}

/**
 * Generate authentication options (for login).
 */
export async function startLogin(sessionId) {
	const options = await generateAuthenticationOptions({
		rpID: RP_ID,
		userVerification: 'preferred'
	});

	storeChallenge(sessionId, options.challenge);

	return { options };
}

/**
 * Verify authentication response.
 */
export async function finishLogin(sessionId, response) {
	const expectedChallenge = getChallenge(sessionId);
	if (!expectedChallenge) {
		throw new Error('Authentication challenge expired or not found');
	}

	const credentialId = response.id;
	const stored = getCredentialById.get(credentialId);
	if (!stored) {
		throw new Error('Credential not found');
	}

	const verification = await verifyAuthenticationResponse({
		response,
		expectedChallenge,
		expectedOrigin: RP_ORIGIN,
		expectedRPID: RP_ID,
		credential: {
			id: stored.credential_id,
			publicKey: stored.public_key,
			counter: stored.counter,
			transports: JSON.parse(stored.transports || '[]')
		}
	});

	if (!verification.verified) {
		throw new Error('Authentication verification failed');
	}

	updateCredentialCounter.run(
		verification.authenticationInfo.newCounter,
		credentialId
	);

	return { verified: true, userId: stored.user_id };
}

/**
 * Generate options to add an additional passkey to an existing user.
 */
export async function startAddPasskey(sessionId, userId) {
	const existingCredentials = getCredentialsByUser.all(userId);

	const options = await generateRegistrationOptions({
		rpName: RP_NAME,
		rpID: RP_ID,
		userName: generateDisplayName(),
		userID: new TextEncoder().encode(userId),
		attestationType: 'none',
		excludeCredentials: existingCredentials.map((c) => ({
			id: c.credential_id,
			transports: JSON.parse(c.transports || '[]')
		})),
		authenticatorSelection: {
			residentKey: 'required',
			userVerification: 'preferred'
		}
	});

	storeChallenge(sessionId, options.challenge);

	return { options };
}

/**
 * Verify and add an additional passkey for an existing user.
 */
export async function finishAddPasskey(sessionId, userId, response) {
	const expectedChallenge = getChallenge(sessionId);
	if (!expectedChallenge) {
		throw new Error('Challenge expired or not found');
	}

	const verification = await verifyRegistrationResponse({
		response,
		expectedChallenge,
		expectedOrigin: RP_ORIGIN,
		expectedRPID: RP_ID
	});

	if (!verification.verified || !verification.registrationInfo) {
		throw new Error('Passkey registration verification failed');
	}

	const { credential } = verification.registrationInfo;

	addCredential.run(
		credential.id,
		userId,
		Buffer.from(credential.publicKey),
		credential.counter,
		JSON.stringify(credential.transports || [])
	);

	return { verified: true };
}
