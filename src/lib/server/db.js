import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
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
    descriptor_hash TEXT NOT NULL DEFAULT '',
    quorum_required INTEGER,
    quorum_total INTEGER,
    quorum_achieved INTEGER,
    document_hash TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Schema migrations — add columns if they don't exist
const migrations = [
	'ALTER TABLE users ADD COLUMN encrypted_pdf BLOB',
	'ALTER TABLE users ADD COLUMN pdf_iv TEXT',
	'ALTER TABLE ceremonies ADD COLUMN encrypted_metadata BLOB',
	'ALTER TABLE ceremonies ADD COLUMN metadata_iv TEXT',
	'ALTER TABLE users ADD COLUMN key_check BLOB',
	'ALTER TABLE users ADD COLUMN key_check_iv TEXT',
	'ALTER TABLE passkey_credentials ADD COLUMN encrypted_dek BLOB',
	'ALTER TABLE passkey_credentials ADD COLUMN dek_iv TEXT'
];

for (const sql of migrations) {
	try {
		db.exec(sql);
	} catch (err) {
		if (!err.message.includes('duplicate column')) throw err;
	}
}

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

export const updateKeyCheck = db.prepare(`
  UPDATE users SET key_check = ?, key_check_iv = ? WHERE user_id = ?
`);

// Passkey credentials
export const addCredential = db.prepare(`
  INSERT INTO passkey_credentials (credential_id, user_id, public_key, counter, transports, encrypted_dek, dek_iv)
  VALUES (?, ?, ?, ?, ?, ?, ?)
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

export const getCredentialDek = db.prepare(`
  SELECT encrypted_dek, dek_iv FROM passkey_credentials WHERE credential_id = ?
`);

// Settings
export const getSetting = db.prepare(`
  SELECT value FROM settings WHERE key = ?
`);

export const upsertSetting = db.prepare(`
  INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

export default db;
