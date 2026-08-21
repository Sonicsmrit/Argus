const Database = require('better-sqlite3');
const { DB_PATH } = require('../src/lib/paths');

const db = new Database(DB_PATH);

// Create table for scraped articles
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    collector_id TEXT NOT NULL,
    headline TEXT NOT NULL,
    summary TEXT,
    author TEXT,
    publish_date TEXT,
    article_body TEXT,
    article_url TEXT UNIQUE,
    section TEXT,
    tags TEXT,
    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scraper_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    collector_id TEXT NOT NULL,
    status TEXT NOT NULL,
    items_scraped INTEGER DEFAULT 0,
    error_message TEXT,
    run_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log('Database initialized successfully at:', dbPath);
db.close();
