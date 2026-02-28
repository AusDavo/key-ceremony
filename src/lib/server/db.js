import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { env } from '$env/dynamic/private';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = env.DB_PATH || join(__dirname, '..', '..', '..', 'data', 'key-ceremony.db');

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    workflow_state TEXT NOT NULL DEFAULT 'registered',
    encrypted_blob BLOB,
    iv TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    purge_after TEXT
  );

  CREATE TABLE IF NOT EXISTS passkey_credentials (
    credential_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key BLOB NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ceremonies (
    ceremony_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ceremony_date TEXT NOT NULL,
    descriptor_hash TEXT NOT NULL,
    quorum_required INTEGER,
    quorum_total INTEGER,
    quorum_achieved INTEGER,
    document_hash TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS signing_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    xpub_index INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vault_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    encrypted_descriptor BLOB NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (credential_id) REFERENCES passkey_credentials(credential_id) ON DELETE CASCADE
  );
`);

// Users
export const createUser = db.prepare(`
  INSERT INTO users (user_id) VALUES (?)
`);

export const getUser = db.prepare(`
  SELECT * FROM users WHERE user_id = ?
`);

export const updateWorkflowState = db.prepare(`
  UPDATE users SET workflow_state = ? WHERE user_id = ?
`);

export const updateEncryptedBlob = db.prepare(`
  UPDATE users SET encrypted_blob = ?, iv = ? WHERE user_id = ?
`);

export const setPurgeAfter = db.prepare(`
  UPDATE users SET purge_after = ? WHERE user_id = ?
`);

export const purgeUser = db.prepare(`
  DELETE FROM users WHERE user_id = ?
`);

export const getExpiredUsers = db.prepare(`
  SELECT user_id FROM users WHERE purge_after IS NOT NULL AND purge_after < datetime('now')
`);

// Passkey credentials
export const addCredential = db.prepare(`
  INSERT INTO passkey_credentials (credential_id, user_id, public_key, counter, transports)
  VALUES (?, ?, ?, ?, ?)
`);

export const getCredentialsByUser = db.prepare(`
  SELECT * FROM passkey_credentials WHERE user_id = ?
`);

export const getCredentialById = db.prepare(`
  SELECT * FROM passkey_credentials WHERE credential_id = ?
`);

export const updateCredentialCounter = db.prepare(`
  UPDATE passkey_credentials SET counter = ? WHERE credential_id = ?
`);

export const deleteCredential = db.prepare(`
  DELETE FROM passkey_credentials WHERE credential_id = ? AND user_id = ?
`);

export const countCredentialsByUser = db.prepare(`
  SELECT COUNT(*) as count FROM passkey_credentials WHERE user_id = ?
`);

// Ceremonies
export const insertCeremony = db.prepare(`
  INSERT INTO ceremonies (ceremony_id, user_id, ceremony_date, descriptor_hash, quorum_required, quorum_total, quorum_achieved, document_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

export const getCeremonyByHash = db.prepare(`
  SELECT * FROM ceremonies WHERE document_hash = ?
`);

export const getCeremonyById = db.prepare(`
  SELECT * FROM ceremonies WHERE ceremony_id = ?
`);

// Signing tokens
function hashToken(rawToken) {
	return createHash('sha256').update(rawToken).digest('hex');
}

const _insertSigningToken = db.prepare(`
  INSERT OR REPLACE INTO signing_tokens (token, user_id, xpub_index) VALUES (?, ?, ?)
`);

export function insertHashedToken(rawToken, userId, xpubIndex) {
	return _insertSigningToken.run(hashToken(rawToken), userId, xpubIndex);
}

const _getSigningToken = db.prepare(`
  SELECT * FROM signing_tokens WHERE token = ? AND created_at > datetime('now', '-1 day')
`);

export function getHashedToken(rawToken) {
	return _getSigningToken.get(hashToken(rawToken));
}

export const deleteSigningTokensForUser = db.prepare(`
  DELETE FROM signing_tokens WHERE user_id = ?
`);

// Settings
export const getSetting = db.prepare(`
  SELECT value FROM settings WHERE key = ?
`);

export const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

// Vault entries
export const insertVaultEntry = db.prepare(`
  INSERT INTO vault_entries (id, user_id, credential_id, encrypted_descriptor, iv, salt, label)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const getVaultEntriesByUser = db.prepare(`
  SELECT * FROM vault_entries WHERE user_id = ?
`);

export const getVaultEntry = db.prepare(`
  SELECT * FROM vault_entries WHERE id = ? AND user_id = ?
`);

export const deleteVaultEntry = db.prepare(`
  DELETE FROM vault_entries WHERE id = ? AND user_id = ?
`);

export default db;
