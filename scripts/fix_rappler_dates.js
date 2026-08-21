const Database = require('better-sqlite3');
const { DB_PATH } = require('../src/lib/paths');

const db = new Database(DB_PATH);

async function fixRapplerDates() {
  console.log('=== Fixing Rappler Missing Dates via Fallback HTTP Meta-Parser ===\n');

  const rows = db.prepare("SELECT id, article_url FROM articles WHERE source_name = 'Rappler' AND (publish_date IS NULL OR publish_date = '')").all();
  console.log(`Found ${rows.length} Rappler articles with missing dates.`);

  if (rows.length === 0) {
    db.close();
    return;
  }

  const updateStmt = db.prepare('UPDATE articles SET publish_date = ? WHERE id = ?');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`[${i+1}/${rows.length}] Fetching meta tags for: ${row.article_url}`);
    
    try {
      const response = await fetch(row.article_url, { signal: AbortSignal.timeout(6000) });
      const html = await response.text();
      
      const match = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]*)"/i)
        || html.match(/<meta[^>]*content="([^"]*)"[^>]*property="article:published_time"/i)
        || html.match(/<time[^>]*datetime="([^"]*)"/i);

      if (match && match[1]) {
        const date = match[1].trim();
        updateStmt.run(date, row.id);
        console.log(`   [SUCCESS] Extracted date: ${date}`);
      } else {
        console.log('   [WARN] No date meta tag found on page.');
      }
    } catch (err) {
      console.error(`   [ERROR] Failed to fetch article:`, err.message);
    }
  }

  console.log('\nFinished updating Rappler dates.');
  db.close();
}

fixRapplerDates();
