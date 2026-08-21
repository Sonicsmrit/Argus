const db = require('better-sqlite3')('c:/Users/dell/OneDrive/Desktop/Reg/scrape_verse.db');
console.log('Tables:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
console.log('Articles sample:', db.prepare("SELECT id, source_name, headline, publish_date FROM articles ORDER BY id DESC LIMIT 3").all());
console.log('Matches sample:', db.prepare("SELECT id, entity_name, entity_countries, article_source, score FROM entity_matches ORDER BY id DESC LIMIT 3").all());
console.log('Total articles:', db.prepare("SELECT count(*) as c FROM articles").get().c);
console.log('Total matches:', db.prepare("SELECT count(*) as c FROM entity_matches").get().c);