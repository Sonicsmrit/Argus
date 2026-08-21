const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH, COLLECTOR_RESULTS_DIR } = require('../src/lib/paths');

const db = new Database(DB_PATH);

const collectors = [
  { name: 'Al Jazeera', file: 'al_jazeera_test_results.json', id: 'c_mt0s3rbf1xzxyyduqz' },
  { name: 'Balkan Insight', file: 'balkan_insight_test_results.json', id: 'c_mt0s6sdg7gm0v9y04' },
  { name: 'Daily Maverick', file: 'daily_maverick_test_results.json', id: 'c_mt0s530w9ffw3kedm' },
  { name: 'InSight Crime', file: 'insight_crime_v3_test_results.json', id: 'c_mt0ueuyidwksjfpyv' },
  { name: 'Moscow Times', file: 'moscow_times_test_results.json', id: 'c_mt0s6bveu3sh7c7i8' },
  { name: 'OCCRP', file: 'occrp_test_results.json', id: 'c_mt0s4o1e1met6dsy3z' },
  { name: 'Rappler', file: 'rappler_v2_test_results.json', id: 'c_mt0ucuyp68vaz3uz9' },
  { name: 'Middle East Eye', file: 'middle_east_eye_test_results.json', id: 'c_mt0sjczi1xlj5a2mvx' },
  { name: 'New York Times', file: 'nytimes_test_results.json', id: 'c_mt1saqvu2pj0tuzypj' }
];

console.log('=== Ingesting Existing Test Data into SQLite Database ===\n');

const insertArticle = db.prepare(`
  INSERT INTO articles (source_name, collector_id, headline, summary, author, publish_date, article_body, article_url, section, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(article_url) DO UPDATE SET
    headline=excluded.headline,
    summary=excluded.summary,
    author=excluded.author,
    publish_date=excluded.publish_date,
    article_body=excluded.article_body,
    section=excluded.section,
    tags=excluded.tags
`);

function ensureString(val) {
  if (val === undefined || val === null) return null;
  if (Array.isArray(val)) return val.filter(x => x !== null && x !== undefined).join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

let totalImported = 0;

for (const col of collectors) {
  const filePath = path.join(COLLECTOR_RESULTS_DIR, col.file);
  if (!fs.existsSync(filePath)) {
    console.log(`[SKIP] No existing results for ${col.name}`);
    continue;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    
    let imported = 0;
    
    for (const item of list) {
      const headline = ensureString(item.headline || 'Untitled Article');
      const body = ensureString(item.article_body || item.body || 'No content');
      const url = ensureString(item.article_url || item.product_page_url || '');
      
      if (!url) continue;

      const summary = ensureString(item.summary || item.key_findings || item.subheadline || item.article_summary || null);
      const author = ensureString(item.author || item.author_name || item.authors || null);
      
      let publish_date = ensureString(item.publish_date || item.publication_date || null);
      if (!publish_date && url && url.includes('nytimes.com/')) {
        // Extract /YYYY/MM/DD/ from NYT URL
        const dateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        if (dateMatch) {
          publish_date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        }
      }

      const section = ensureString(item.section || item.category || item.investigation_type || null);
      
      let tags = null;
      if (item.tags) {
        tags = ensureString(item.tags);
      } else if (item.categories) {
        tags = ensureString(item.categories);
      } else if (item.countries_mentioned) {
        tags = ensureString(item.countries_mentioned);
      }

      insertArticle.run(
        col.name, 
        col.id, 
        headline, 
        summary, 
        author, 
        publish_date, 
        body, 
        url, 
        section, 
        tags
      );
      imported++;
    }

    console.log(`[IMPORT] Ingested ${imported}/${list.length} articles for ${col.name}`);
    totalImported += imported;

    // Check if run log exists for this source, insert if not
    const runExists = db.prepare('SELECT COUNT(*) as count FROM scraper_runs WHERE source_name = ?').get(col.name);
    if (runExists.count === 0) {
      db.prepare('INSERT INTO scraper_runs (source_name, collector_id, status, items_scraped) VALUES (?, ?, ?, ?)')
        .run(col.name, col.id, 'success', imported);
    }

  } catch (e) {
    console.error(`[ERROR] Failed importing results for ${col.name}:`, e.message);
  }
}

console.log(`\n[COMPLETE] Successfully imported a total of ${totalImported} articles into scrape_verse.db!`);
db.close();
