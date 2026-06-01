import path from 'path';
import fs from 'fs';

// We lazy-import better-sqlite3 to avoid issues in edge runtime
let _db: import('better-sqlite3').Database | null = null;

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'querybot.db');

export function getDb(): import('better-sqlite3').Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Dynamic require to support Next.js build
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  _db = new Database(DB_PATH) as import('better-sqlite3').Database;

  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

function initSchema(db: import('better-sqlite3').Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      size        INTEGER NOT NULL DEFAULT 0,
      chunks_count INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'processing',
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id          TEXT PRIMARY KEY,
      source_id   TEXT NOT NULL,
      content     TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      metadata    TEXT NOT NULL DEFAULT '{}',
      FOREIGN KEY (source_id) REFERENCES knowledge_sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS qa_pairs (
      id         TEXT PRIMARY KEY,
      question   TEXT NOT NULL,
      answer     TEXT NOT NULL,
      category   TEXT NOT NULL DEFAULT 'General',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      active     INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT 'New Conversation',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      sources         TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  `);
}
