const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const { DB_PATH, SCRATCH_DIR } = require('./lib/paths');

const COLLECTORS = [
  { name: 'Al Jazeera', id: 'c_mt0s3rbf1xzxyyduqz', url: 'https://www.aljazeera.com/news/' },
  { name: 'Balkan Insight', id: 'c_mt0s6sdg7gm0v9y04', url: 'https://balkaninsight.com/' },
  { name: 'Daily Maverick', id: 'c_mt0s530w9ffw3kedm', url: 'https://www.dailymaverick.co.za/section/business/' },
  { name: 'InSight Crime', id: 'c_mt0ueuyidwksjfpyv', url: 'https://insightcrime.org/news/' },
  { name: 'Moscow Times', id: 'c_mt0s6bveu3sh7c7i8', url: 'https://www.themoscowtimes.com/news' },
  { name: 'OCCRP', id: 'c_mt0s4o1e1met6dsy3z', url: 'https://www.occrp.org/en/investigations' },
  { name: 'Rappler', id: 'c_mt0ucuyp68vaz3uz9', url: 'https://www.rappler.com/business/' },
  { name: 'Middle East Eye', id: 'c_mt0sjczi1xlj5a2mvx', url: 'https://www.middleeasteye.net/news' },
  { name: 'New York Times', id: 'c_mt1saqvu2pj0tuzypj', url: 'https://www.nytimes.com/section/world' }
];

const dbPath = DB_PATH;

function runCollector(c) {
  return new Promise((resolve) => {
    console.log(`[${new Date().toISOString()}] Starting run for ${c.name}...`);
    const tempFile = path.join(SCRATCH_DIR, `temp_${c.id}.json`);
    
    // Ensure scratch directory exists
    if (!fs.existsSync(path.dirname(tempFile))) {
      fs.mkdirSync(path.dirname(tempFile), { recursive: true });
    }

    const cmd = `npx -p @brightdata/cli bdata scraper run ${c.id} "${c.url}" --pretty -o "${tempFile}"`;
    
    exec(cmd, (error, stdout, stderr) => {
      const db = new Database(dbPath);
      
      if (error) {
        console.error(`[ERROR] Failed command for ${c.name}:`, error.message);
        db.prepare('INSERT INTO scraper_runs (source_name, collector_id, status, error_message) VALUES (?, ?, ?, ?)')
          .run(c.name, c.id, 'failed', error.message);
        db.close();
        resolve();
        return;
      }

      if (!fs.existsSync(tempFile)) {
        console.error(`[ERROR] Output file not found for ${c.name}`);
        db.prepare('INSERT INTO scraper_runs (source_name, collector_id, status, error_message) VALUES (?, ?, ?, ?)')
          .run(c.name, c.id, 'failed', 'No output file generated');
        db.close();
        resolve();
        return;
      }

      try {
        const rawData = fs.readFileSync(tempFile, 'utf8');
        const items = JSON.parse(rawData);
        const articlesList = Array.isArray(items) ? items : [items];
        
        console.log(`[SUCCESS] ${c.name} returned ${articlesList.length} items.`);
        
        let savedCount = 0;
        let driftDetected = false;
        
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

        for (const item of articlesList) {
          // Check for potential layout drift (empty headline or body)
          const headline = ensureString(item.headline || 'Untitled Article');
          const body = ensureString(item.article_body || item.body || 'No content');
          const url = ensureString(item.article_url || item.product_page_url || '');
          
          if (!item.headline || !(item.article_body || item.body)) {
            driftDetected = true;
          }

          // Normalize fields based on source
          const summary = ensureString(item.summary || item.key_findings || item.subheadline || item.article_summary || null);
          const author = ensureString(item.author || item.author_name || item.authors || null);
          
          let publish_date = ensureString(item.publish_date || item.publication_date || null);
          if (!publish_date && url && url.includes('nytimes.com/')) {
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

          if (url) {
            try {
              insertArticle.run(c.name, c.id, headline, summary, author, publish_date, body, url, section, tags);
              savedCount++;
            } catch (dbErr) {
              console.error(`[DB ERROR] Failed to save article ${url}:`, dbErr.message);
            }
          }
        }

        const runStatus = driftDetected ? 'warning_drift_detected' : 'success';
        if (driftDetected) {
          console.warn(`[WARNING] Layout drift detected for ${c.name}! Headline or body fields extracted empty.`);
        }

        db.prepare('INSERT INTO scraper_runs (source_name, collector_id, status, items_scraped) VALUES (?, ?, ?, ?)')
          .run(c.name, c.id, runStatus, savedCount);

        console.log(`[PIPELINE] Saved/Updated ${savedCount} articles for ${c.name} into database.`);
      } catch (parseErr) {
        console.error(`[ERROR] JSON parsing or database save failed for ${c.name}:`, parseErr.message);
        db.prepare('INSERT INTO scraper_runs (source_name, collector_id, status, error_message) VALUES (?, ?, ?, ?)')
          .run(c.name, c.id, 'failed', parseErr.message);
      } finally {
        db.close();
        try {
          fs.unlinkSync(tempFile);
        } catch {}
        resolve();
      }
    });
  });
}

async function runPipeline() {
  console.log(`\n=== Starting Scheduled adverse-media scraper run: ${new Date().toISOString()} ===`);
  for (const c of COLLECTORS) {
    await runCollector(c);
  }
  console.log(`=== Scraper pipeline run completed: ${new Date().toISOString()} ===\n`);
}

// News-heavy sources refresh hourly; the full roster sweeps nightly.
const HOURLY_SOURCES = ['OCCRP', 'Al Jazeera', 'Middle East Eye', 'Balkan Insight'];

function collectorsByNames(names) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return COLLECTORS.filter((c) => wanted.has(c.name.toLowerCase()));
}

async function runCollectors(list) {
  for (const c of list) {
    await runCollector(c);
  }
}

module.exports = { COLLECTORS, HOURLY_SOURCES, runCollector, runPipeline, runCollectors, collectorsByNames };

// CLI mode only when executed directly — importing this module from the API
// server must not start a second scheduler or trigger runs.
if (require.main === module) {
  if (process.argv.includes('--now')) {
    runPipeline();
  } else {
    // Standalone daemon mode (kept for manual operation)
    console.log('Starting Argus Pipeline Scheduler Daemon...');
    console.log('Schedule: Every day at midnight (0 0 * * *)');
    cron.schedule('0 0 * * *', () => {
      runPipeline();
    });
  }
}
