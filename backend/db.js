const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const dataDir = path.resolve(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new Database(dbPath);

// Init table
db.exec(`
CREATE TABLE IF NOT EXISTS downloads (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  format TEXT,
  quality TEXT,
  audio_only INTEGER DEFAULT 0,
  status TEXT,
  filename TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// Ensure optional columns exist for forward-compatible schema changes
try {
  const cols = db.prepare("PRAGMA table_info('downloads')").all();
  const colNames = new Set(cols.map(c => c.name));
  if (!colNames.has('filepath')) {
    db.exec("ALTER TABLE downloads ADD COLUMN filepath TEXT");
  }
} catch (e) {
  // Ignore migration errors to avoid crashing on startup
}

module.exports = db;
