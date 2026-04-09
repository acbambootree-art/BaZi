const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let db;

function getDb() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || path.join(__dirname, 'bazi.db');
  const dbDir = path.dirname(dbPath);

  // Ensure the directory exists (important for production persistent disk)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Migrations: add columns to existing tables before running full schema
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (tableExists) {
    const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    if (!cols.includes('session_token')) {
      db.exec("ALTER TABLE users ADD COLUMN session_token TEXT");
      db.exec("ALTER TABLE users ADD COLUMN session_expires_at TEXT");
      console.log('[DB] Migrated: added session_token columns');
    }
  }

  // Run schema (creates tables + indexes if not exist)
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  console.log(`[DB] SQLite initialized at ${dbPath}`);
  return db;
}

module.exports = { getDb };
