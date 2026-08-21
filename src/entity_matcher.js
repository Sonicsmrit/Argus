const Database = require('better-sqlite3');
const { DB_PATH } = require('./lib/paths');

const CONTEXT_WINDOW = 150;

function main() {
  const db = new Database(DB_PATH);

  // ─── Step 1: Create matches table ───
  db.exec(`
    DROP TABLE IF EXISTS entity_matches;
    CREATE TABLE entity_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id TEXT NOT NULL,
      entity_name TEXT NOT NULL,
      entity_schema TEXT,
      entity_countries TEXT,
      entity_sanctions TEXT,
      article_id INTEGER NOT NULL,
      article_source TEXT,
      article_headline TEXT,
      article_url TEXT,
      article_date TEXT,
      match_type TEXT NOT NULL,
      match_name TEXT NOT NULL,
      match_location TEXT,
      context_snippet TEXT,
      score REAL DEFAULT 1.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_id, article_id, match_name)
    );
    CREATE INDEX IF NOT EXISTS idx_match_entity ON entity_matches(entity_id);
    CREATE INDEX IF NOT EXISTS idx_match_article ON entity_matches(article_id);
  `);

  // ─── Step 2: Load ONLY real sanctions-listed entities ───
  // Filter to entities from actual sanctions programs, not PEPs/wanted/wikidata
  console.log('[MATCHER] Loading sanctions-listed entities (filtering out PEPs/wanted)...');
  
  const SANCTIONS_KEYWORDS = [
    'ofac', 'sdn', 'eu_fsf', 'eu_sanctions', 'un_sc_sanctions',
    'gb_hmt', 'ca_dfatd', 'au_dfat', 'ch_seco', 'jp_mof',
    'ua_sfms', 'ua_nsdc', 'ru_nsd', 'kz_afmrk',
    'sanctions', 'designated', 'frozen', 'blacklist',
    'interpol_red', 'fbi_most_wanted'
  ];

  const allEntities = db.prepare(`
    SELECT id, schema, name, aliases, countries, sanctions, dataset
    FROM sanctioned_entities 
    WHERE sanctions IS NOT NULL AND sanctions != ''
  `).all();

  console.log(`  Entities with non-empty sanctions field: ${allEntities.length}`);

  // Further filter: only keep entities whose sanctions/dataset field mentions real sanctions lists
  const sanctionedEntities = allEntities.filter(e => {
    const combined = ((e.sanctions || '') + ' ' + (e.dataset || '')).toLowerCase();
    return SANCTIONS_KEYWORDS.some(kw => combined.includes(kw));
  });

  console.log(`  After filtering to real sanctions lists: ${sanctionedEntities.length}`);

  // ─── Step 3: Build name index ───
  // For each entity, extract all name variants (primary + aliases)
  // Only keep names with 2+ tokens and 5+ chars to reduce false positives
  const entityIndex = [];
  const allSearchNames = new Map(); // name -> [entity refs]

  for (const ent of sanctionedEntities) {
    const names = new Set();

    if (ent.name && ent.name.length >= 5) names.add(ent.name.trim());

    if (ent.aliases) {
      for (const alias of ent.aliases.split(';')) {
        const trimmed = alias.trim();
        if (trimmed.length >= 5) names.add(trimmed);
      }
    }

    const validNames = [];
    for (const n of names) {
      const tokens = n.split(/\s+/).filter(t => t.length > 1);
      if (tokens.length >= 2 && !isGenericName(n.toLowerCase())) {
        validNames.push(n);
        // Add to global index
        const lower = n.toLowerCase();
        if (!allSearchNames.has(lower)) allSearchNames.set(lower, []);
        allSearchNames.get(lower).push({
          id: ent.id,
          primaryName: ent.name,
          schema: ent.schema,
          countries: ent.countries,
          sanctions: ent.sanctions,
          searchName: n
        });
      }
    }

    if (validNames.length > 0) {
      entityIndex.push({ ...ent, validNames });
    }
  }

  const totalVariants = allSearchNames.size;
  console.log(`  Unique searchable name variants: ${totalVariants}`);

  // ─── Step 4: Load articles and build word index for fast pre-filtering ───
  console.log('[MATCHER] Loading articles...');
  const articles = db.prepare('SELECT id, source_name, headline, article_body, article_url, publish_date FROM articles').all();
  console.log(`  Loaded ${articles.length} articles.`);

  // For each article, build a set of lowercased words for fast pre-filtering
  const articleData = articles.map(a => {
    const rawText = (a.headline || '') + ' ' + (a.article_body || '');
    const lowerText = rawText.toLowerCase();
    // Build word set for pre-filtering
    const words = new Set(lowerText.split(/[^a-záéíóúàèìòùäëïöüñçşğžšćčřůýăîâșțøåæðþ'-]+/).filter(w => w.length > 2));
    return {
      id: a.id,
      source: a.source_name,
      headline: a.headline || '',
      url: a.article_url,
      date: a.publish_date,
      rawText,
      lowerText,
      words
    };
  });

  // ─── Step 5: Fast matching using word pre-filter ───
  console.log('[MATCHER] Running entity-article matching with word pre-filter...');

  const insertMatch = db.prepare(`
    INSERT OR IGNORE INTO entity_matches 
    (entity_id, entity_name, entity_schema, entity_countries, entity_sanctions,
     article_id, article_source, article_headline, article_url, article_date,
     match_type, match_name, match_location, context_snippet, score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBatch = db.transaction((rows) => {
    for (const row of rows) insertMatch.run(...row);
  });

  let totalMatches = 0;
  let namesProcessed = 0;
  let matchBuffer = [];

  // For each unique search name, check all articles
  for (const [lowerName, entityRefs] of allSearchNames) {
    namesProcessed++;
    if (namesProcessed % 5000 === 0) {
      console.log(`  Progress: ${namesProcessed}/${totalVariants} names, ${totalMatches} matches...`);
    }

    // Pre-filter: split name into words, check if ALL words exist in article word set
    const nameWords = lowerName.split(/\s+/).filter(w => w.length > 2);
    if (nameWords.length === 0) continue;

    for (const article of articleData) {
      // Fast check: do all name words appear in article?
      const allWordsPresent = nameWords.every(w => article.words.has(w));
      if (!allWordsPresent) continue;

      // Confirmed candidate — do exact substring match
      const idx = article.lowerText.indexOf(lowerName);
      if (idx === -1) continue;

      // Word boundary check to reduce partial matches
      const charBefore = idx > 0 ? article.lowerText[idx - 1] : ' ';
      const charAfter = idx + lowerName.length < article.lowerText.length
        ? article.lowerText[idx + lowerName.length] : ' ';
      if (/[a-z]/.test(charBefore) || /[a-z]/.test(charAfter)) continue;

      // Match confirmed!
      const matchLocation = idx < (article.headline.length + 1) ? 'headline' : 'body';
      const contextStart = Math.max(0, idx - CONTEXT_WINDOW);
      const contextEnd = Math.min(article.rawText.length, idx + lowerName.length + CONTEXT_WINDOW);
      const context = '...' + article.rawText.substring(contextStart, contextEnd).replace(/\s+/g, ' ').trim() + '...';

      // Insert a match for each entity that uses this name
      for (const ref of entityRefs) {
        let score = matchLocation === 'headline' ? 2.0 : 1.0;
        if (ref.searchName === ref.primaryName) score += 0.5;

        matchBuffer.push([
          ref.id, ref.primaryName, ref.schema, ref.countries, ref.sanctions,
          article.id, article.source, article.headline, article.url, article.date,
          'exact_substring', ref.searchName, matchLocation, context, score
        ]);
        totalMatches++;
      }

      if (matchBuffer.length >= 2000) {
        insertBatch(matchBuffer);
        matchBuffer = [];
      }
    }
  }

  if (matchBuffer.length > 0) {
    insertBatch(matchBuffer);
  }

  console.log(`\n[DONE] Entity matching complete!`);
  console.log(`  Names scanned: ${namesProcessed}`);
  console.log(`  Total matches: ${totalMatches}`);

  // ─── Step 6: Summary ───
  console.log('\n=== TOP SANCTIONED ENTITIES WITH ADVERSE MEDIA HITS ===');
  const topEntities = db.prepare(`
    SELECT entity_name, entity_schema as type, entity_countries as countries,
           entity_sanctions as lists,
           COUNT(DISTINCT article_id) as articles,
           GROUP_CONCAT(DISTINCT article_source) as sources
    FROM entity_matches 
    GROUP BY entity_id
    ORDER BY articles DESC
    LIMIT 25
  `).all();

  topEntities.forEach((e, i) => {
    console.log(`  #${i + 1} ${e.entity_name} [${e.type}]`);
    console.log(`     Countries: ${e.countries || 'N/A'}`);
    console.log(`     Lists: ${(e.lists || '').substring(0, 120)}`);
    console.log(`     Articles: ${e.articles} | Sources: ${e.sources}`);
  });

  console.log('\n=== MATCHES BY SOURCE ===');
  const bySource = db.prepare(`
    SELECT article_source, COUNT(*) as matches, COUNT(DISTINCT entity_id) as entities
    FROM entity_matches GROUP BY article_source ORDER BY matches DESC
  `).all();
  console.table(bySource);

  console.log('\n=== HEADLINE MATCHES (Highest Signal) ===');
  const headlineHits = db.prepare(`
    SELECT entity_name, entity_sanctions, article_source, article_headline, 
           match_name, score, article_date
    FROM entity_matches WHERE match_location = 'headline'
    ORDER BY score DESC LIMIT 10
  `).all();
  headlineHits.forEach((m, i) => {
    console.log(`  [${i + 1}] "${m.match_name}" → ${m.entity_name}`);
    console.log(`      ${m.article_source}: ${m.article_headline}`);
    console.log(`      Lists: ${(m.entity_sanctions || '').substring(0, 80)} | Score: ${m.score}`);
  });

  db.close();
}

function isGenericName(name) {
  const generics = new Set([
    'the state', 'the bank', 'the company', 'the group', 'the government',
    'first bank', 'the trust', 'the agency', 'the office', 'the ministry',
    'the department', 'the council', 'the committee', 'the commission',
    'the authority', 'the board', 'the fund', 'the corporation',
    'the institute', 'the center', 'the centre', 'national bank',
    'state bank', 'central bank', 'news agency', 'press agency',
    'the republic', 'the federation', 'the union', 'the people',
    'the united', 'the islamic', 'the democratic', 'the royal',
    'al jazeera', 'the guardian', 'the times', 'the post',
    'the independent', 'daily mail', 'the telegraph', 'the observer',
    'the economist', 'the atlantic', 'the new york', 'el pais',
    'le monde', 'la nacion', 'al arabiya', 'sky news',
    'human rights', 'united nations', 'red cross', 'world bank',
    'european union', 'african union', 'arab league',
    'south africa', 'north korea', 'sri lanka', 'costa rica',
    'sierra leone', 'el salvador', 'hong kong', 'new york',
    'los angeles', 'san francisco', 'buenos aires', 'new delhi',
    'rio de janeiro', 'sao paulo', 'tel aviv', 'middle east',
    'latin america', 'central america', 'south america', 'north america',
    'east africa', 'west africa', 'north africa', 'south asia',
    'southeast asia', 'central asia', 'east asia', 'middle east eye',
    'daily maverick', 'moscow times', 'insight crime', 'balkan insight',
  ]);
  return generics.has(name);
}

main();
