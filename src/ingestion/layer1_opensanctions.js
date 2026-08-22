const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const Database = require('better-sqlite3');
const readline = require('readline');
const { DB_PATH, DATA_DIR } = require('../lib/paths');

const SANCTIONS_URL = 'https://data.opensanctions.org/datasets/latest/default/targets.simple.csv';
const CSV_PATH = path.join(DATA_DIR, 'opensanctions_targets.csv');

// ─── Step 0: Ensure data dir ───
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Step 1: Download OpenSanctions bulk CSV ───
function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`[DOWNLOAD] Fetching OpenSanctions bulk dataset...`);
    console.log(`  URL: ${url}`);

    const follow = (u) => {
      const mod = u.startsWith('https') ? https : http;
      mod.get(u, { headers: { 'User-Agent': 'Argus-SanctionsTracker/1.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`  Redirect → ${res.headers.location}`);
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes % (5 * 1024 * 1024) < chunk.length) {
            console.log(`  Downloaded ${(bytes / 1024 / 1024).toFixed(1)} MB...`);
          }
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`  Complete: ${(bytes / 1024 / 1024).toFixed(1)} MB saved to ${dest}`);
          resolve();
        });
      }).on('error', reject);
    };
    follow(url);
  });
}

// ─── Step 2: Parse CSV and load into SQLite ───
async function loadSanctionsIntoDb() {
  const db = new Database(DB_PATH);

  // Create sanctions table
  db.exec(`
    DROP TABLE IF EXISTS sanctioned_entities;
    CREATE TABLE sanctioned_entities (
      id TEXT PRIMARY KEY,
      schema TEXT,
      name TEXT NOT NULL,
      aliases TEXT,
      birth_date TEXT,
      countries TEXT,
      addresses TEXT,
      identifiers TEXT,
      sanctions TEXT,
      phones TEXT,
      emails TEXT,
      dataset TEXT,
      first_seen TEXT,
      last_seen TEXT,
      last_change TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_entity_name ON sanctioned_entities(name);
  `);

  // Parse CSV line by line
  const fileStream = fs.createReadStream(CSV_PATH, 'utf8');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = null;
  let count = 0;
  const insert = db.prepare(`
    INSERT OR REPLACE INTO sanctioned_entities 
    (id, schema, name, aliases, birth_date, countries, addresses, identifiers, sanctions, phones, emails, dataset, first_seen, last_seen, last_change)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });

  let batch = [];

  for await (const line of rl) {
    if (!headers) {
      headers = parseCSVLine(line);
      console.log(`[PARSE] CSV headers: ${headers.join(', ')}`);
      continue;
    }

    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || null; });

    // Only load Person and Organization entities (skip vessels, aircraft, etc. for speed)
    if (row.schema !== 'Person' && row.schema !== 'Organization' && row.schema !== 'LegalEntity' && row.schema !== 'Company') continue;

    batch.push([
      row.id, row.schema, row.name, row.aliases, row.birth_date,
      row.countries, row.addresses, row.identifiers, row.sanctions,
      row.phones, row.emails, row.dataset,
      row.first_seen, row.last_seen, row.last_change
    ]);

    if (batch.length >= 5000) {
      insertMany(batch);
      count += batch.length;
      batch = [];
      if (count % 50000 === 0) console.log(`  Loaded ${count} entities...`);
    }
  }

  if (batch.length > 0) {
    insertMany(batch);
    count += batch.length;
  }

  console.log(`[DONE] Loaded ${count} sanctioned entities into database.`);

  // Print stats
  const schemas = db.prepare('SELECT schema, count(*) as cnt FROM sanctioned_entities GROUP BY schema').all();
  console.table(schemas);

  const datasets = db.prepare("SELECT dataset, count(*) as cnt FROM sanctioned_entities GROUP BY dataset ORDER BY cnt DESC LIMIT 10").all();
  console.log('\nTop 10 sanctions datasets:');
  console.table(datasets);

  db.close();
}

// Simple CSV line parser that handles quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── Main ───
async function main() {
  // Download if not already cached
  if (!fs.existsSync(CSV_PATH) || fs.statSync(CSV_PATH).size < 1000) {
    await download(SANCTIONS_URL, CSV_PATH);
  } else {
    console.log(`[CACHE] OpenSanctions CSV already downloaded (${(fs.statSync(CSV_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
  }

  await loadSanctionsIntoDb();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
