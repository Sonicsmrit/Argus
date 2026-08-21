const Database = require('better-sqlite3');
const db = new Database('scrape_verse.db');

db.prepare("DELETE FROM articles WHERE source_name = 'InSight Crime'").run();
db.prepare("DELETE FROM articles WHERE source_name = 'Rappler'").run();
console.log('Cleaned old records for InSight Crime and Rappler');
db.close();
