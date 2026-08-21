const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { DB_PATH, DATA_DIR } = require('../src/lib/paths');

const db = new Database(DB_PATH);

// ─── Generate Sanctions Alert Report ───
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║         SCRAPE-VERSE SANCTIONS TRACKER — ALERT REPORT      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// 1. Database overview
console.log('=== LAYER 1: OpenSanctions Entities ===');
const entityCount = db.prepare('SELECT count(*) as cnt FROM sanctioned_entities').get();
const schemaBreakdown = db.prepare('SELECT schema, count(*) as cnt FROM sanctioned_entities GROUP BY schema ORDER BY cnt DESC').all();
console.log(`Total sanctioned entities loaded: ${entityCount.cnt}`);
console.table(schemaBreakdown);

console.log('\n=== LAYER 2: Adverse Media Articles ===');
const articleCount = db.prepare('SELECT count(*) as cnt FROM articles').get();
const sourceBreakdown = db.prepare('SELECT source_name, count(*) as cnt FROM articles GROUP BY source_name ORDER BY cnt DESC').all();
console.log(`Total articles ingested: ${articleCount.cnt}`);
console.table(sourceBreakdown);

// 2. Matching summary
console.log('\n=== ENTITY-ARTICLE MATCHES ===');
const matchCount = db.prepare('SELECT count(*) as cnt FROM entity_matches').get();
const uniqueEntities = db.prepare('SELECT count(DISTINCT entity_id) as cnt FROM entity_matches').get();
const uniqueArticles = db.prepare('SELECT count(DISTINCT article_id) as cnt FROM entity_matches').get();
console.log(`Total matches: ${matchCount.cnt}`);
console.log(`Unique sanctioned entities mentioned in media: ${uniqueEntities.cnt}`);
console.log(`Articles containing sanctioned entity mentions: ${uniqueArticles.cnt}`);

// 3. Top sanctioned entities by media exposure
console.log('\n=== TOP 20 SANCTIONED ENTITIES BY ADVERSE MEDIA EXPOSURE ===');
const topEntities = db.prepare(`
  SELECT 
    entity_name,
    entity_schema as type,
    entity_countries as countries,
    entity_sanctions as lists,
    COUNT(DISTINCT article_id) as articles,
    GROUP_CONCAT(DISTINCT article_source) as sources,
    MAX(score) as top_score
  FROM entity_matches 
  GROUP BY entity_id
  ORDER BY articles DESC
  LIMIT 20
`).all();

topEntities.forEach((e, i) => {
  console.log(`\n  #${i+1} ${e.entity_name} [${e.type}]`);
  console.log(`     Countries: ${e.countries || 'N/A'}`);
  console.log(`     Sanctions Lists: ${(e.lists || '').substring(0, 100)}`);
  console.log(`     Articles: ${e.articles} | Sources: ${e.sources} | Top Score: ${e.top_score}`);
});

// 4. Headline matches (highest signal)
console.log('\n\n=== HEADLINE-LEVEL MATCHES (Highest Confidence) ===');
const headlineMatches = db.prepare(`
  SELECT 
    entity_name,
    entity_sanctions,
    article_source,
    article_headline,
    article_date,
    article_url,
    match_name,
    score
  FROM entity_matches
  WHERE match_location = 'headline'
  ORDER BY score DESC
  LIMIT 15
`).all();

headlineMatches.forEach((m, i) => {
  console.log(`\n  [ALERT ${i+1}] Sanctioned entity in headline`);
  console.log(`  Entity:   ${m.entity_name}`);
  console.log(`  Lists:    ${(m.entity_sanctions || '').substring(0, 80)}`);
  console.log(`  Matched:  "${m.match_name}"`);
  console.log(`  Source:   ${m.article_source} (${m.article_date || 'undated'})`);
  console.log(`  Headline: ${m.article_headline}`);
  console.log(`  URL:      ${m.article_url}`);
  console.log(`  Score:    ${m.score}`);
});

// 5. Matches by sanctions list
console.log('\n\n=== MATCHES BY SANCTIONS LIST ===');
const byList = db.prepare(`
  SELECT 
    CASE
      WHEN entity_sanctions LIKE '%ofac%' THEN 'US OFAC (SDN)'
      WHEN entity_sanctions LIKE '%eu_fsf%' THEN 'EU Financial Sanctions'
      WHEN entity_sanctions LIKE '%un_sc%' THEN 'UN Security Council'
      WHEN entity_sanctions LIKE '%gb_hmt%' THEN 'UK HMT Sanctions'
      WHEN entity_sanctions LIKE '%ua_sfms%' THEN 'Ukraine SFMS'
      WHEN entity_sanctions LIKE '%au_dfat%' THEN 'Australia DFAT'
      WHEN entity_sanctions LIKE '%ca_dfatd%' THEN 'Canada DFATD'
      WHEN entity_sanctions LIKE '%interpol%' THEN 'INTERPOL Red Notice'
      ELSE 'Other Lists'
    END as sanctions_list,
    COUNT(*) as match_count,
    COUNT(DISTINCT entity_id) as unique_entities
  FROM entity_matches
  GROUP BY sanctions_list
  ORDER BY match_count DESC
`).all();
console.table(byList);

// 6. Export JSON report
const report = {
  generated_at: new Date().toISOString(),
  layer1: {
    total_entities: entityCount.cnt,
    by_schema: schemaBreakdown
  },
  layer2: {
    total_articles: articleCount.cnt,
    by_source: sourceBreakdown
  },
  matching: {
    total_matches: matchCount.cnt,
    unique_entities_mentioned: uniqueEntities.cnt,
    articles_with_matches: uniqueArticles.cnt
  },
  top_entities: topEntities,
  headline_alerts: headlineMatches
};

const reportPath = path.join(DATA_DIR, 'sanctions_alert_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n[EXPORT] Full report saved to ${reportPath}`);

db.close();
