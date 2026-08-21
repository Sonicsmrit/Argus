const Database = require('better-sqlite3');
const db = new Database('scrape_verse.db');

console.log('=== Updated Database Statistics ===');
const stats = db.prepare('SELECT source_name, count(*) as count, min(publish_date) as oldest, max(publish_date) as newest FROM articles GROUP BY source_name').all();
console.table(stats);

console.log('\n=== Rappler Date Verification ===');
const rapplerNullCount = db.prepare("SELECT count(*) as count FROM articles WHERE source_name = 'Rappler' AND (publish_date IS NULL OR publish_date = '')").get().count;
console.log('Rappler articles with NULL or empty date:', rapplerNullCount);

db.close();
