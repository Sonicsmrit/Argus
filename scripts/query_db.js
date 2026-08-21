const Database = require('better-sqlite3');
const { DB_PATH } = require('../src/lib/paths');

const db = new Database(DB_PATH);

console.log('=== SCRAPE-VERSE DATABASE REPORT ===\n');

// 1. Show Collector Run Statuses
console.log('--- Scraper Studio Run Log ---');
const runs = db.prepare('SELECT source_name, status, items_scraped, error_message, run_at FROM scraper_runs ORDER BY id DESC LIMIT 15').all();
if (runs.length === 0) {
  console.log('No runs recorded yet.');
} else {
  console.table(runs);
}
console.log('\n');

// 2. Show Article Count per Source
console.log('--- Total Articles Ingested ---');
const counts = db.prepare('SELECT source_name, COUNT(*) as total_articles FROM articles GROUP BY source_name').all();
if (counts.length === 0) {
  console.log('No articles found in database.');
} else {
  console.table(counts);
}
console.log('\n');

// 3. Sample Recent Adverse Media Alerts
console.log('--- Sample Adverse Media Articles ---');
const sample = db.prepare('SELECT source_name, headline, author, publish_date, article_url FROM articles ORDER BY id DESC LIMIT 5').all();
if (sample.length === 0) {
  console.log('No sample articles found.');
} else {
  sample.forEach((a, i) => {
    console.log(`[${i+1}] ${a.source_name} - ${a.publish_date}`);
    console.log(`    Headline: ${a.headline}`);
    console.log(`    Author:   ${a.author}`);
    console.log(`    URL:      ${a.article_url}\n`);
  });
}

db.close();
