const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { DB_PATH, DIST_DIR, DATA_DIR } = require('./lib/paths');

const app = express();
// Render injects PORT; fall back to 3001 for local dev
const port = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

let db;
try {
    db = new Database(DB_PATH, { fileMustExist: false });
} catch (err) {
    console.error("Failed to connect to database:", err.message);
    process.exit(1);
}

// Compliance action audit trail (created on demand for existing databases)
db.exec(`
    CREATE TABLE IF NOT EXISTS audit_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_id TEXT,
        entity_name TEXT,
        action TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
    )
`);

// Investigator watchlists: monitored entities for live adverse-media alerts
db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT DEFAULT 'local',
        entity_id TEXT UNIQUE,
        entity_name TEXT,
        countries TEXT,
        added_at TEXT DEFAULT (datetime('now'))
    )
`);

// Scrapers capture raw page HTML in match/article snippets; strip tags and
// decode entities once at the API layer so every consumer renders clean text.
const HTML_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '\u2014', ndash: '\u2013', rsquo: '\u2019', lsquo: '\u2018',
    ldquo: '\u201C', rdquo: '\u201D', hellip: '\u2026',
};

function cleanSnippet(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    return raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/&([a-zA-Z]+|#\d+);/g, (match, name) => {
            const key = name.toLowerCase();
            if (HTML_ENTITIES[key]) return HTML_ENTITIES[key];
            if (/^#\d+$/.test(name)) {
                try { return String.fromCodePoint(parseInt(name.slice(1), 10)); } catch (_) { return match; }
            }
            return match;
        })
        .replace(/\s+/g, ' ')
        .trim();
}

// Collectors emit mixed date formats (ISO timestamps from some sources,
// display strings like "Published date: 17 August 2026 ..." from others).
// Normalize everything to ISO so sorting and client rendering are reliable;
// returns null when no date can be extracted.
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function normalizeArticleDate(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    const direct = Date.parse(str);
    if (!Number.isNaN(direct)) return new Date(direct).toISOString();
    const m = str.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
    if (m) {
        const d = new Date(Date.UTC(parseInt(m[3], 10), MONTHS[m[2].toLowerCase()], parseInt(m[1], 10)));
        if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return null;
}

// Country stats: in-memory cache over a disk-persisted snapshot.
// The full aggregation scans 1.1M+ rows, so it must never run per-request.
// The snapshot is invalidated when new media matches arrive (watermark check
// on the tiny entity_matches table) or after MAX_AGE, whichever comes first.
const COUNTRY_STATS_FILE = path.join(DATA_DIR, 'country-stats.json');
const COUNTRY_STATS_TTL = 5 * 60 * 1000; // serve-from-memory window
const COUNTRY_STATS_MAX_AGE = 6 * 60 * 60 * 1000; // disk snapshot validity

let countryStatsCache = {
    data: null,
    timestamp: 0,
};

function currentMediaWatermark() {
    return db.prepare('SELECT MAX(created_at) as wm FROM entity_matches').get().wm || '';
}

function loadCountryStatsFromDisk(watermark) {
    try {
        const raw = JSON.parse(fs.readFileSync(COUNTRY_STATS_FILE, 'utf8'));
        const ageOk = Date.now() - raw.computedAt < COUNTRY_STATS_MAX_AGE;
        if (ageOk && raw.watermark === watermark && raw.stats) {
            return raw.stats;
        }
    } catch (_) { /* no snapshot yet */ }
    return null;
}

function computeCountryStats() {
    const matchCountsMap = new Map();
    for (const row of db.prepare(`
        SELECT entity_id, COUNT(*) as matchCount
        FROM entity_matches
        GROUP BY entity_id
    `).all()) {
        matchCountsMap.set(row.entity_id, row.matchCount);
    }

    const stats = {};
    const iter = db.prepare(`
        SELECT id, countries 
        FROM sanctioned_entities 
        WHERE countries IS NOT NULL AND countries != ''
    `).iterate();

    for (const entity of iter) {
        const hasHit = matchCountsMap.has(entity.id) ? 1 : 0;
        const mc = matchCountsMap.get(entity.id) || 0;
        const codes = entity.countries.toLowerCase().split(';');
        for (let i = 0; i < codes.length; i++) codes[i] = codes[i].trim();
        for (let i = 0; i < codes.length; i++) {
            const code = codes[i];
            if (!code || codes.indexOf(code) !== i) continue; // skip empties and duplicates
            let bucket = stats[code];
            if (!bucket) {
                bucket = stats[code] = { entityCount: 0, mediaHitEntities: 0, mediaHitCount: 0 };
            }
            bucket.entityCount += 1;
            bucket.mediaHitEntities += hasHit;
            bucket.mediaHitCount += mc;
        }
    }

    return stats;
}

// Returns { stats, fromCache } — fromCache is false only when the heavy
// computation actually ran.
function getCountryStats() {
    const now = Date.now();
    if (countryStatsCache.data && now - countryStatsCache.timestamp < COUNTRY_STATS_TTL) {
        return { stats: countryStatsCache.data, fromCache: true };
    }

    const watermark = currentMediaWatermark();
    const fromDisk = loadCountryStatsFromDisk(watermark);
    if (fromDisk) {
        countryStatsCache.data = fromDisk;
        countryStatsCache.timestamp = now;
        return { stats: fromDisk, fromCache: true };
    }

    const stats = computeCountryStats();
    countryStatsCache.data = stats;
    countryStatsCache.timestamp = now;

    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(
            COUNTRY_STATS_FILE,
            JSON.stringify({ computedAt: now, watermark, stats })
        );
    } catch (err) {
        console.error('Failed to persist country stats:', err.message);
    }

    return { stats, fromCache: false };
}

// GET /api/countries/stats
app.get('/api/countries/stats', (req, res) => {
    try {
        const { stats, fromCache } = getCountryStats();
        res.json({ stats, cached: fromCache });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/screen?q=<name> — interactive denied-party screening against the
// full registry (1.17M entities). Tiered scoring: exact > starts-with >
// contains > alias hit. A full scan measures ~50ms on the current dataset.
app.get('/api/screen', (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (q.length < 2) {
            return res.json({ query: q, total: 0, results: [] });
        }

        const rows = db.prepare(`
            SELECT id, name, aliases, countries, sanctions, dataset
            FROM sanctioned_entities
            WHERE LOWER(name) LIKE ? OR LOWER(aliases) LIKE ?
        `).all(`%${q}%`, `%${q}%`);

        const results = [];
        for (const r of rows) {
            const name = String(r.name || '').toLowerCase();
            let score = 0;
            let matchedVia = 'name';
            if (name === q) {
                score = 100;
            } else if (name.startsWith(q)) {
                score = 90;
            } else if (name.includes(q)) {
                score = 75;
            } else {
                const aliases = String(r.aliases || '').toLowerCase();
                const aliasList = aliases.split(';').map((a) => a.trim()).filter(Boolean);
                if (aliasList.includes(q)) {
                    score = 85;
                    matchedVia = 'alias';
                } else if (aliases.includes(q)) {
                    score = 60;
                    matchedVia = 'alias';
                } else {
                    continue;
                }
            }
            results.push({
                id: r.id,
                name: r.name,
                countries: r.countries,
                sanctions: r.sanctions,
                dataset: r.dataset,
                score,
                matchedVia,
            });
        }

        results.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));

        res.json({ query: q, total: results.length, results: results.slice(0, 10) });
    } catch (err) {
        console.error('Screen Error:', err);
        res.status(500).json({ error: 'Screening failed' });
    }
});

// GET /api/countries/:code/entities
app.get('/api/countries/:code/entities', (req, res) => {
    try {
        const code = req.params.code.toLowerCase();
        let { list, page = 1, limit = 50, search = '' } = req.query;
        
        page = parseInt(page);
        limit = parseInt(limit);
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1 || limit > 100) limit = 50;
        
        const offset = (page - 1) * limit;
        
        // Exact match or part of semicolon separated list
        let conditions = ["(LOWER(countries) = ? OR LOWER(countries) LIKE ? OR LOWER(countries) LIKE ? OR LOWER(countries) LIKE ?)"];
        let params = [code, `${code};%`, `%;${code};%`, `%;${code}`];
        
        if (search) {
            conditions.push("(LOWER(name) LIKE ? OR LOWER(aliases) LIKE ?)");
            const searchPattern = `%${search.toLowerCase()}%`;
            params.push(searchPattern, searchPattern);
        }
        
        if (list) {
            let listConditions = [];
            const listType = list.toLowerCase();
            
            if (listType === 'ofac') {
                const terms = ['ofac', 'sdn', 'EO1'];
                terms.forEach(term => {
                    listConditions.push(`sanctions LIKE '%${term}%'`);
                    listConditions.push(`dataset LIKE '%${term}%'`);
                });
            } else if (listType === 'eu') {
                const terms = ['UE', 'EU', 'eu_fsf'];
                terms.forEach(term => {
                    listConditions.push(`sanctions LIKE '%${term}%'`);
                    listConditions.push(`dataset LIKE '%${term}%'`);
                });
            } else if (listType === 'uk') {
                const terms = ['gb_hmt', 'OFSI', 'UK'];
                terms.forEach(term => {
                    listConditions.push(`sanctions LIKE '%${term}%'`);
                    listConditions.push(`dataset LIKE '%${term}%'`);
                });
            } else if (listType === 'un') {
                const terms = ['un_sc', 'RCSNU', 'UNSC'];
                terms.forEach(term => {
                    listConditions.push(`sanctions LIKE '%${term}%'`);
                    listConditions.push(`dataset LIKE '%${term}%'`);
                });
            }
            
            if (listConditions.length > 0) {
                conditions.push(`(${listConditions.join(' OR ')})`);
            }
        }
        
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const countQuery = `SELECT COUNT(*) as total FROM sanctioned_entities ${whereClause}`;
        const totalRow = db.prepare(countQuery).get(...params);
        const total = totalRow.total;
        
        // Prioritize entities that have BOTH Layer 1 listing AND Layer 2 Adverse Media Hits
        // Order: has media hits first, highest score first, highest hit count first, alphabetical
        const entitiesQuery = `
            SELECT se.id, se.schema, se.name, se.aliases, se.countries, se.sanctions, se.dataset,
                   COUNT(em.id) as matchCount,
                   MAX(em.score) as topScore
            FROM sanctioned_entities se
            LEFT JOIN entity_matches em ON em.entity_id = se.id
            ${whereClause.replace(/\bcountries\b/g, 'se.countries').replace(/\bname\b/g, 'se.name').replace(/\baliases\b/g, 'se.aliases').replace(/\bsanctions\b/g, 'se.sanctions').replace(/\bdataset\b/g, 'se.dataset')}
            GROUP BY se.id
            ORDER BY 
              (CASE WHEN COUNT(em.id) > 0 THEN 1 ELSE 0 END) DESC,
              MAX(em.score) DESC,
              COUNT(em.id) DESC,
              se.name ASC
            LIMIT ? OFFSET ?
        `;
        
        const entitiesParams = [...params, limit, offset];
        const entities = db.prepare(entitiesQuery).all(...entitiesParams);
        
        // For each entity, attach topMatch details
        const getTopMatchStmt = db.prepare(`
            SELECT article_headline as headline, article_source as source, 
                   article_url as url, article_date as date, score 
            FROM entity_matches 
            WHERE entity_id = ? 
            ORDER BY score DESC 
            LIMIT 1
        `);
        
        for (const entity of entities) {
            if (entity.matchCount > 0) {
                entity.topMatch = getTopMatchStmt.get(entity.id) || null;
            } else {
                entity.topMatch = null;
            }
        }
        
        res.json({
            entities,
            total,
            page,
            limit
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/ai/bilateral-risk
const { analyzeBilateralRisk, analyzeEntity } = require('./ai_service');

app.post('/api/ai/bilateral-risk', async (req, res) => {
    try {
        const from = req.body.from || req.body.fromCountry;
        const to = req.body.to || req.body.toCountry;
        const fromName = req.body.fromName;
        const toName = req.body.toName;
        const bilateralRisk = req.body.bilateralRisk;

        if (!from || !to) {
            return res.status(400).json({ error: 'Missing from or to country codes' });
        }

        const targetCode = to.toLowerCase();
        
        // Get layer 1 & 2 stats for target
        const entityCount = db.prepare(`
            SELECT COUNT(*) as count FROM sanctioned_entities 
            WHERE LOWER(countries) = ? OR LOWER(countries) LIKE ? OR LOWER(countries) LIKE ? OR LOWER(countries) LIKE ?
        `).get(targetCode, `${targetCode};%`, `%;${targetCode};%`, `%;${targetCode}`).count;

        const mediaHitEntities = db.prepare(`
            SELECT COUNT(DISTINCT se.id) as count 
            FROM sanctioned_entities se
            JOIN entity_matches em ON em.entity_id = se.id
            WHERE LOWER(se.countries) = ? OR LOWER(se.countries) LIKE ? OR LOWER(se.countries) LIKE ? OR LOWER(se.countries) LIKE ?
        `).get(targetCode, `${targetCode};%`, `%;${targetCode};%`, `%;${targetCode}`).count;

        // Get top exposed entities
        const topEntities = db.prepare(`
            SELECT se.name, se.sanctions, COUNT(em.id) as matchCount
            FROM sanctioned_entities se
            JOIN entity_matches em ON em.entity_id = se.id
            WHERE LOWER(se.countries) = ? OR LOWER(se.countries) LIKE ? OR LOWER(se.countries) LIKE ? OR LOWER(se.countries) LIKE ?
            GROUP BY se.id
            ORDER BY matchCount DESC
            LIMIT 8
        `).all(targetCode, `${targetCode};%`, `%;${targetCode};%`, `%;${targetCode}`);

        const aiAnalysis = await analyzeBilateralRisk({
            fromCountry: from.toUpperCase(),
            toCountry: to.toUpperCase(),
            fromName: fromName || from,
            toName: toName || to,
            bilateralRisk: bilateralRisk || {},
            stats: { entityCount, mediaHitEntities },
            topEntities
        });

        res.json({ analysis: aiAnalysis });
    } catch (err) {
        console.error('AI Bilateral Analysis Error:', err);
        res.status(500).json({ error: err.message || 'AI generation failed' });
    }
});

// GET /api/ai/entity-analysis/:id
app.get('/api/ai/entity-analysis/:id', async (req, res) => {
    try {
        const entityId = req.params.id;
        const entity = db.prepare(`
            SELECT id, name, schema, countries, sanctions, aliases, dataset
            FROM sanctioned_entities
            WHERE id = ?
        `).get(entityId);

        if (!entity) {
            return res.status(404).json({ error: 'Entity not found' });
        }

        const aiArticles = db.prepare(`
            SELECT article_id as id, article_headline as headline, article_source as source, 
                   article_url as url, article_date as date, match_name as matchName, 
                   match_location as matchLocation, score, context_snippet as context
            FROM entity_matches
            WHERE entity_id = ?
            ORDER BY score DESC
            LIMIT 6
        `).all(entityId).map((a) => ({ ...a, context: cleanSnippet(a.context) }));

        const aiAnalysis = await analyzeEntity({ entity, articles: aiArticles });

        res.json({ analysis: aiAnalysis });
    } catch (err) {
        console.error('AI Entity Analysis Error:', err);
        res.status(500).json({ error: err.message || 'AI entity analysis failed' });
    }
});

// GET /api/entities/:id/articles
app.get('/api/entities/:id/articles', (req, res) => {
    try {
        const entityId = req.params.id;
        
        const entity = db.prepare(`
            SELECT id, name, schema, countries, sanctions, aliases, dataset
            FROM sanctioned_entities
            WHERE id = ?
        `).get(entityId);
        
        if (!entity) {
            return res.status(404).json({ error: 'Entity not found' });
        }
        
        const articles = db.prepare(`
            SELECT article_id as id, article_headline as headline, article_source as source, 
                   article_url as url, article_date as date, match_name as matchName, 
                   match_location as matchLocation, score, context_snippet as context
            FROM entity_matches
            WHERE entity_id = ?
            ORDER BY score DESC, article_date DESC
        `).all(entityId);
        
        res.json({
            entity,
            articles: articles.map((a) => ({
                ...a,
                context: cleanSnippet(a.context),
                date: normalizeArticleDate(a.date) || a.date,
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/media/signals
app.get('/api/media/signals', (req, res) => {
    try {
        const country = (req.query.country || '').toLowerCase();
        const limit = parseInt(req.query.limit || '10', 10);

        let query = `
            SELECT em.id, em.article_id, em.article_headline as headline, 
                   em.article_source as source, em.article_url as url, 
                   em.article_date as date, em.entity_name as entityName, 
                   em.entity_countries as entityCountries, em.score, 
                   em.context_snippet as context, em.created_at
            FROM entity_matches em
        `;
        let params = [];

        if (country) {
            query += ` WHERE LOWER(em.entity_countries) = ? OR LOWER(em.entity_countries) LIKE ? OR LOWER(em.entity_countries) LIKE ? OR LOWER(em.entity_countries) LIKE ?`;
            params = [country, `${country};%`, `%;${country};%`, `%;${country}`];
        }

        // entity_matches is small, so ranking happens in JS after normalizing
        // the mixed date formats collectors emit — SQL string ORDER BY would
        // mis-sort display strings like "17 August 2026".
        const allSignals = db.prepare(query).all(...params);
        const signals = allSignals
            .map((s) => ({ ...s, context: cleanSnippet(s.context), date: normalizeArticleDate(s.date) }))
            .sort((a, b) => {
                const ta = a.date ? Date.parse(a.date) : 0;
                const tb = b.date ? Date.parse(b.date) : 0;
                return tb - ta || b.score - a.score;
            })
            .slice(0, limit);

        // Real 12-month publication histogram, normalized to peak activity.
        // When a country is provided, only articles corroborating entities from
        // that jurisdiction are counted.
        const countryMatchClause = `(LOWER(em.entity_countries) = ? OR LOWER(em.entity_countries) LIKE ? OR LOWER(em.entity_countries) LIKE ? OR LOWER(em.entity_countries) LIKE ?)`;
        const countryMatchParams = (c) => [c, `${c};%`, `%;${c};%`, `%;${c}`];

        let histogramRows;
        if (country) {
            histogramRows = db.prepare(`
                SELECT strftime('%Y-%m', a.publish_date) as ym, COUNT(DISTINCT a.id) as c
                FROM articles a
                JOIN entity_matches em ON em.article_id = a.id
                WHERE a.publish_date IS NOT NULL AND ${countryMatchClause}
                GROUP BY ym
                ORDER BY ym ASC
            `).all(...countryMatchParams(country));
        } else {
            histogramRows = db.prepare(`
                SELECT strftime('%Y-%m', publish_date) as ym, COUNT(*) as c
                FROM articles
                WHERE publish_date IS NOT NULL
                GROUP BY ym
                ORDER BY ym ASC
            `).all();
        }
        const last12Months = histogramRows.slice(-12);
        const peak = Math.max(...last12Months.map((r) => r.c), 1);
        const sparkline = last12Months.map((r) => Math.max(4, Math.round((r.c / peak) * 100)));

        // Adverse velocity: publications in last 30 days vs previous 30 days,
        // scoped the same way as the histogram.
        let recentCount, priorCount;
        if (country) {
            recentCount = db.prepare(`
                SELECT COUNT(DISTINCT a.id) as c
                FROM articles a
                JOIN entity_matches em ON em.article_id = a.id
                WHERE ${countryMatchClause}
                  AND a.publish_date >= datetime('now', '-30 days')
            `).get(...countryMatchParams(country)).c;
            priorCount = db.prepare(`
                SELECT COUNT(DISTINCT a.id) as c
                FROM articles a
                JOIN entity_matches em ON em.article_id = a.id
                WHERE ${countryMatchClause}
                  AND a.publish_date >= datetime('now', '-60 days')
                  AND a.publish_date < datetime('now', '-30 days')
            `).get(...countryMatchParams(country)).c;
        } else {
            recentCount = db.prepare(`SELECT COUNT(*) as c FROM articles WHERE publish_date >= datetime('now', '-30 days')`).get().c;
            priorCount = db.prepare(`SELECT COUNT(*) as c FROM articles WHERE publish_date >= datetime('now', '-60 days') AND publish_date < datetime('now', '-30 days')`).get().c;
        }

        let velocityPct = 0;
        if (priorCount > 0) {
            velocityPct = Math.round(((recentCount - priorCount) / priorCount) * 100);
        } else if (recentCount > 0) {
            velocityPct = 100;
        }
        velocityPct = Math.max(-999, Math.min(999, velocityPct));

        let adverseVelocity;
        if (last12Months.length === 0) {
            adverseVelocity = 'NO SIGNAL DATA';
        } else {
            adverseVelocity = `${velocityPct >= 0 ? '+' : ''}${velocityPct}% ${velocityPct >= 0 ? 'ADVERSE SPIKE' : 'COOLING'}`;
        }

        // Totals and per-source breakdown follow the same country scope as
        // the histogram/velocity above.
        let totalMatches;
        let matchCountsBySource;
        if (country) {
            const scopeParams = countryMatchParams(country);
            totalMatches = db.prepare(`
                SELECT COUNT(*) as c
                FROM entity_matches em
                WHERE ${countryMatchClause}
            `).get(...scopeParams).c;
            matchCountsBySource = db.prepare(`
                SELECT em.article_source as source, COUNT(*) as count
                FROM entity_matches em
                WHERE ${countryMatchClause}
                GROUP BY em.article_source
                ORDER BY count DESC
            `).all(...scopeParams);
        } else {
            totalMatches = db.prepare(`SELECT COUNT(*) as c FROM entity_matches`).get().c;
            matchCountsBySource = db.prepare(`
                SELECT article_source as source, COUNT(*) as count
                FROM entity_matches
                GROUP BY article_source
                ORDER BY count DESC
            `).all();
        }

        res.json({
            country: country || 'GLOBAL',
            adverseVelocity,
            velocityPct,
            recentCount,
            priorCount,
            totalCorroborations: totalMatches,
            sparkline,
            sourceBreakdown: matchCountsBySource,
            signals
        });
    } catch (err) {
        console.error('Media Signals Error:', err);
        res.status(500).json({ error: 'Failed to fetch media signals' });
    }
});

// GET /api/checklists/:country — compliance tasks generated from live database
// state for the selected target jurisdiction, framed for the investigator's
// home regime (?home=XX). Nothing is ever pre-completed.
app.get('/api/checklists/:country', (req, res) => {
    try {
        const country = (req.params.country || 'ru').toLowerCase();
        const home = (req.query.home || 'us').toLowerCase();
        const countryUpper = country.toUpperCase();
        const homeUpper = home.toUpperCase();

        const buildWhere = (column, c) =>
            ['=', 'LIKE', 'LIKE', 'LIKE'].map((op, i) => {
                const pattern = [c, `${c};%`, `%;${c};%`, `%;${c}`][i];
                return op === '=' ? `LOWER(${column}) = ?` : `LOWER(${column}) LIKE ?`;
            }).join(' OR ');

        // entityCount comes from the shared 5-min country-stats snapshot
        // (no per-request scan of sanctioned_entities). Corroboration figures
        // come from entity_matches alone — it stores denormalized
        // entity_countries/entity_name, so no join is needed.
        const { stats: allStats } = getCountryStats();
        const entityCount = allStats[country]?.entityCount || 0;

        const whereMatches = buildWhere('em.entity_countries', country);
        const matchArgs = [country, `${country};%`, `%;${country};%`, `%;${country}`];
        const matches = db.prepare(`
            SELECT em.article_id, em.entity_id, em.entity_name
            FROM entity_matches em
            WHERE ${whereMatches}
        `).all(...matchArgs);

        const articleIds = new Set();
        const perEntity = new Map();
        for (const m of matches) {
            articleIds.add(m.article_id);
            const cur = perEntity.get(m.entity_id);
            if (cur) {
                cur.matchCount += 1;
            } else {
                perEntity.set(m.entity_id, { id: m.entity_id, name: m.entity_name, matchCount: 1 });
            }
        }
        let topCorroborated = null;
        for (const cand of perEntity.values()) {
            if (!topCorroborated || cand.matchCount > topCorroborated.matchCount) {
                topCorroborated = cand;
            }
        }
        const hitStats = { mediaHits: articleIds.size, matchCount: matches.length };

        // Screening regimes that apply to the investigator's home jurisdiction
        const HOME_REGIME_LABELS = {
            us: 'OFAC SDN & BIS',
            gb: 'UK OFSI',
            ca: 'Canadian GAC',
            au: 'Australian ASO',
            ch: 'Swiss SECO',
            jp: 'Japanese METI',
            kr: 'Korean MOEF',
            sg: 'Singapore MAS',
            nz: 'New Zealand MFAT',
        };
        const EU_HOMES = new Set(['at', 'be', 'bg', 'hr', 'cy', 'cz', 'dk', 'ee', 'fi', 'fr', 'de', 'gr', 'hu', 'ie', 'it', 'lv', 'lt', 'lu', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'si', 'es', 'se']);
        const regimeLabel = EU_HOMES.has(home)
            ? 'EU Consolidated'
            : HOME_REGIME_LABELS[home] || 'UN Security Council';

        let checklist = [];

        if (entityCount > 0) {
            checklist.push({
                id: checklist.length + 1,
                text: `Screen ${entityCount.toLocaleString()} listed entities in ${countryUpper} against ${regimeLabel} consolidated denied-party lists`,
                done: false,
                link: `/entity-intelligence?country=${country}`,
            });
        }

        if (hitStats.mediaHits > 0) {
            const topNames = topCorroborated ? ` (top target: ${topCorroborated.name})` : '';
            checklist.push({
                id: checklist.length + 1,
                text: `Review ${hitStats.mediaHits} corroborated adverse-media reports (${hitStats.matchCount} matches) for ${countryUpper} targets${topNames}`,
                done: false,
                link: `/threat-briefing?from=${homeUpper}&to=${countryUpper}`,
            });
        } else {
            checklist.push({
                id: checklist.length + 1,
                text: `Monitor investigative feeds for emerging pre-listing indicators on ${countryUpper}`,
                done: false,
                link: `/threat-briefing?from=${homeUpper}&to=${countryUpper}`,
            });
        }

        if (topCorroborated) {
            checklist.push({
                id: checklist.length + 1,
                text: `Run UBO & 50%-rule ownership audit on ${topCorroborated.name} (${topCorroborated.matchCount} corroborations)`,
                done: false,
                link: `/profile/${encodeURIComponent(topCorroborated.id)}`,
            });
        }

        checklist.push({
            id: checklist.length + 1,
            text: `Assess ${homeUpper} → ${countryUpper} corridor exposure under secondary-sanctions liability rules`,
            done: false,
            link: `/threat-briefing?from=${homeUpper}&to=${countryUpper}`,
        });

        res.json({
            country: countryUpper,
            entityCount,
            checklist
        });
    } catch (err) {
        console.error('Checklist Error:', err);
        res.status(500).json({ error: 'Failed to generate dynamic checklist' });
    }
});

// GET /api/notifications — live alerts derived from database state, scoped to
// the investigator's home jurisdiction and its relevant sanction corridors
app.get('/api/notifications', (req, res) => {
    try {
        const home = (req.query.homeCountry || 'US').toLowerCase();

        // Jurisdictions under active sanctions pressure; corroborations touching
        // these countries are the most actionable for compliance teams.
        const focusCountries = [...new Set(['ru', 'by', 'cn', 'ir', 'kp', 'sy', 'cu', 've', 'mm', 'mx', home])];

        const clauses = [];
        const params = [];
        for (const c of focusCountries) {
            clauses.push(`(LOWER(em.entity_countries) = ? OR LOWER(em.entity_countries) LIKE ? OR LOWER(em.entity_countries) LIKE ? OR LOWER(em.entity_countries) LIKE ?)`);
            params.push(c, `${c};%`, `%;${c};%`, `%;${c}`);
        }

        // 1. Highest-confidence corroborations in focus jurisdictions
        const topMatchRows = db.prepare(`
            SELECT em.id, em.entity_id, em.entity_name, em.entity_countries, em.score,
                   em.article_source, em.article_headline, em.created_at
            FROM entity_matches em
            WHERE ${clauses.join(' OR ')}
            ORDER BY em.score DESC, em.created_at DESC
        `).all(...params);

        const seenEntities = new Set();
        const topMatches = [];
        for (const row of topMatchRows) {
            if (seenEntities.has(row.entity_id)) continue;
            seenEntities.add(row.entity_id);
            topMatches.push(row);
            if (topMatches.length === 2) break;
        }

        // 2. Freshest intelligence ingested by the collectors (one per source)
        const freshRows = db.prepare(`
            SELECT source_name, headline, publish_date, scraped_at
            FROM articles
            ORDER BY scraped_at DESC, id DESC
            LIMIT 12
        `).all();
        const seenFreshSources = new Set();
        const freshArticles = [];
        for (const a of freshRows) {
            if (seenFreshSources.has(a.source_name)) continue;
            seenFreshSources.add(a.source_name);
            freshArticles.push(a);
            if (freshArticles.length === 2) break;
        }

        // 3. Latest pipeline activity per collector
        const recentRuns = db.prepare(`
            SELECT source_name, status, items_scraped, error_message, run_at
            FROM scraper_runs
            ORDER BY run_at DESC
            LIMIT 20
        `).all();
        const seenSources = new Set();
        const pipelineRuns = [];
        for (const run of recentRuns) {
            if (seenSources.has(run.source_name)) continue;
            seenSources.add(run.source_name);
            pipelineRuns.push(run);
            if (pipelineRuns.length === 2) break;
        }

        const relTime = (iso) => {
            const t = Date.parse(iso);
            if (Number.isNaN(t)) return 'recently';
            const mins = Math.max(1, Math.round((Date.now() - t) / 60000));
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.round(mins / 60);
            if (hrs < 24) return `${hrs}h ago`;
            return `${Math.round(hrs / 24)}d ago`;
        };

        const notifications = [];

        topMatches.forEach((m, idx) => {
            notifications.push({
                id: `corr-${m.entity_id}-${m.id}`,
                type: 'CORROBORATION',
                title: `Dual-Layer Hit: ${m.entity_name} Corroborated`,
                message: `"${m.article_headline}" (${m.article_source}) matched a sanctioned record with significance score ${Number(m.score).toFixed(1)}.`,
                time: relTime(m.created_at),
                unread: idx === 0,
                link: `/profile/${encodeURIComponent(m.entity_id)}`
            });
        });

        freshArticles.forEach((a, idx) => {
            notifications.push({
                id: `intel-${idx}-${a.scraped_at}`,
                type: 'WARNING',
                title: `Fresh Intelligence Ingested (${a.source_name})`,
                message: a.headline,
                time: relTime(a.scraped_at),
                unread: idx === 0 && topMatches.length === 0,
                link: '/entity-intelligence'
            });
        });

        pipelineRuns.forEach((r) => {
            const ok = String(r.status).toLowerCase() === 'success';
            notifications.push({
                id: `pipe-${r.source_name}-${r.run_at}`,
                type: 'PIPELINE',
                title: ok ? `Collector Completed: ${r.source_name}` : `Collector Issue: ${r.source_name}`,
                message: ok
                    ? `Ingested ${r.items_scraped} items during the latest sweep.`
                    : `Run reported an issue: ${r.error_message || 'unknown error'}.`,
                time: relTime(r.run_at),
                unread: false,
                link: '/system-status'
            });
        });

        res.json({ homeCountry: home.toUpperCase(), notifications });
    } catch (err) {
        console.error('Notifications Error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET /api/watchlist — monitored entities enriched with live hit detection.
// "Fresh" = matches whose article_date falls within the last 7 days.
app.get('/api/watchlist', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT id, entity_id, entity_name, countries, added_at
            FROM watchlist
            ORDER BY added_at DESC
        `).all();

        const freshStmt = db.prepare(`
            SELECT COUNT(*) as c
            FROM entity_matches
            WHERE entity_id = ? AND article_date >= datetime('now', '-7 days')
        `);
        const latestStmt = db.prepare(`
            SELECT article_headline as headline, article_source as source,
                   article_url as url, article_date as date, score
            FROM entity_matches
            WHERE entity_id = ?
            ORDER BY (article_date IS NULL) ASC, article_date DESC
            LIMIT 1
        `);

        const items = rows.map((w) => ({
            ...w,
            freshHits: freshStmt.get(w.entity_id).c,
            latestMatch: (() => {
                const m = latestStmt.get(w.entity_id);
                return m ? { ...m, date: normalizeArticleDate(m.date) } : null;
            })(),
        }));

        res.json({ items });
    } catch (err) {
        console.error('Watchlist Error:', err);
        res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
});

// POST /api/watchlist — monitor an entity (idempotent)
app.post('/api/watchlist', (req, res) => {
    try {
        const { entityId, entityName, countries } = req.body || {};
        if (!entityId) {
            return res.status(400).json({ error: 'entityId is required' });
        }
        db.prepare(`
            INSERT INTO watchlist (entity_id, entity_name, countries)
            VALUES (?, ?, ?)
            ON CONFLICT(entity_id) DO NOTHING
        `).run(String(entityId), entityName || null, countries || null);
        res.status(201).json({ ok: true });
    } catch (err) {
        console.error('Watchlist Add Error:', err);
        res.status(500).json({ error: 'Failed to add to watchlist' });
    }
});

// DELETE /api/watchlist/:entityId — stop monitoring an entity
app.delete('/api/watchlist/:entityId', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM watchlist WHERE entity_id = ?').run(req.params.entityId);
        res.json({ removed: result.changes });
    } catch (err) {
        console.error('Watchlist Remove Error:', err);
        res.status(500).json({ error: 'Failed to remove from watchlist' });
    }
});

// POST /api/audit-actions — record a compliance decision from an entity profile
app.post('/api/audit-actions', (req, res) => {
    try {
        const { entityId, entityName, action } = req.body || {};
        if (!action || typeof action !== 'string') {
            return res.status(400).json({ error: 'action is required' });
        }
        const result = db.prepare(`
            INSERT INTO audit_actions (entity_id, entity_name, action)
            VALUES (?, ?, ?)
        `).run(entityId || null, entityName || null, action);

        const row = db.prepare(`SELECT id, created_at FROM audit_actions WHERE id = ?`).get(result.lastInsertRowid);
        res.status(201).json({
            ticket: `SV-${1000 + row.id}`,
            loggedAt: row.created_at,
        });
    } catch (err) {
        console.error('Audit Action Error:', err);
        res.status(500).json({ error: 'Failed to record audit action' });
    }
});

// GET /api/audit-actions — recent compliance decisions
app.get('/api/audit-actions', (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const total = db.prepare(`SELECT COUNT(*) as c FROM audit_actions`).get().c;
        const actions = db.prepare(`
            SELECT id, entity_id, entity_name, action, created_at
            FROM audit_actions
            ORDER BY id DESC
            LIMIT ?
        `).all(limit);
        res.json({ total, actions });
    } catch (err) {
        console.error('Audit Actions Error:', err);
        res.status(500).json({ error: 'Failed to fetch audit actions' });
    }
});

// GET /api/system/status & /api/status
function getSystemStatusHandler(req, res) {
    try {
        let totalEntities = 0, totalArticles = 0, totalMatches = 0, totalSanctioned = 46293, scraperRuns = [];
        let lastUpdatedEntity = null, lastUpdatedArticle = null;

        try {
            totalEntities = db.prepare(`SELECT COUNT(*) as count FROM sanctioned_entities`).get().count;
            totalSanctioned = totalEntities;
            lastUpdatedEntity = db.prepare(`SELECT MAX(last_change) as last_updated FROM sanctioned_entities`).get().last_updated;
        } catch (e) {}

        try {
            totalArticles = db.prepare(`SELECT COUNT(*) as count FROM articles`).get().count;
            lastUpdatedArticle = db.prepare(`SELECT MAX(scraped_at) as last_updated FROM articles`).get().last_updated;
        } catch (e) {}

        try {
            totalMatches = db.prepare(`SELECT COUNT(*) as count FROM entity_matches`).get().count;
        } catch (e) {}

        try {
            scraperRuns = db.prepare(`
                SELECT id, source_name, collector_id, status, items_scraped, error_message, run_at
                FROM scraper_runs
                ORDER BY run_at DESC
                LIMIT 10
            `).all();
        } catch (e) {}

        // Composite network health measured from live tables:
        // 40% collector success rate, 35% data freshness, 25% registry completeness
        let health = {
            score: null,
            collectorSuccessRate: null,
            dataFreshnessHours: null,
            registryCompletenessPct: null,
        };
        try {
            const recentRuns = db.prepare(`SELECT status FROM scraper_runs ORDER BY run_at DESC LIMIT 20`).all();
            if (recentRuns.length > 0) {
                const ok = recentRuns.filter((r) => String(r.status).toLowerCase() === 'success').length;
                health.collectorSuccessRate = Math.round((ok / recentRuns.length) * 100);
            }

            if (lastUpdatedArticle) {
                const parsed = Date.parse(lastUpdatedArticle);
                if (!Number.isNaN(parsed)) {
                    health.dataFreshnessHours = Math.max(0, Math.round((Date.now() - parsed) / 3600000));
                }
            }

            if (totalEntities > 0) {
                const geoTagged = db.prepare(`SELECT COUNT(*) as n FROM sanctioned_entities WHERE countries IS NOT NULL AND countries != ''`).get().n;
                health.registryCompletenessPct = Math.round((geoTagged / totalEntities) * 1000) / 10;
            }

            const freshnessScore = health.dataFreshnessHours == null
                ? 70
                : Math.max(20, Math.min(100, 100 - health.dataFreshnessHours * 1.5));
            const collectorScore = health.collectorSuccessRate == null ? 70 : health.collectorSuccessRate;
            const completenessScore = health.registryCompletenessPct == null ? 70 : health.registryCompletenessPct;

            health.score = Math.round(
                collectorScore * 0.4 + freshnessScore * 0.35 + completenessScore * 0.25
            );
        } catch (e) {}

        res.json({
            totalEntities,
            totalSanctioned,
            totalArticles,
            totalMatches,
            scraperRuns,
            lastUpdatedEntity,
            lastUpdatedArticle,
            health
        });
    } catch (err) {
        console.error('System status error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

app.get('/api/system/status', getSystemStatusHandler);
app.get('/api/status', getSystemStatusHandler);

// Serve frontend static assets from build
const distPath = DIST_DIR;
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        } else {
            res.status(404).json({ error: 'Endpoint not found' });
        }
    });
}

// ---- Adverse-media scraping schedule -------------------------------------
// Hybrid cadence owned by the API process: news-heavy sources refresh hourly,
// the full roster sweeps nightly. A single in-flight guard prevents overlap.
const {
    COLLECTORS: ALL_COLLECTORS,
    HOURLY_SOURCES,
    runCollectors,
    collectorsByNames,
} = require('./pipeline');

let scrapeInFlight = false;

async function runScheduledScrape(sourceNames) {
    if (scrapeInFlight) {
        console.log('[scheduler] scrape already in flight - skipping');
        return;
    }
    scrapeInFlight = true;
    try {
        const list = sourceNames ? collectorsByNames(sourceNames) : ALL_COLLECTORS;
        console.log(`[scheduler] starting run for ${list.length} collector(s): ${list.map((c) => c.name).join(', ')}`);
        await runCollectors(list);
    } catch (err) {
        console.error('[scheduler] scrape failed:', err.message);
    } finally {
        scrapeInFlight = false;
    }
}

// Scheduler kill-switch: set SCHEDULER_ENABLED=0 on ephemeral hosts (Render
// free tier) where collector runs and boot backfills are pointless churn.
const SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED !== '0';

if (SCHEDULER_ENABLED) {
    cron.schedule('15 * * * *', () => runScheduledScrape(HOURLY_SOURCES)); // hourly at :15
    cron.schedule('30 3 * * *', () => runScheduledScrape(null));           // nightly full sweep 03:30
}

app.listen(port, () => {
    console.log(`=================================`);
    console.log(`🚀 Sanctions API Server Started`);
    console.log(`=================================`);
    console.log(`Port: ${port}`);
    console.log(`Database: ${DB_PATH}`);
    try {
        const entities = db.prepare('SELECT COUNT(*) as count FROM sanctioned_entities').get().count;
        const articles = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
        console.log(`Stats: ${entities} Entities, ${articles} Articles loaded.`);
    } catch(err) {
        console.log(`Stats: Could not read stats on startup. Check database.`);
    }
    // Warm the country-stats cache immediately after bind so the first
    // request never waits on the full-table aggregation.
    setImmediate(() => {
        const t0 = Date.now();
        const { fromCache } = getCountryStats();
        console.log(`Country stats ready (${fromCache ? 'from cache' : 'computed'} in ${Date.now() - t0}ms)`);
    });
    // Boot backfill: if the last scrape is over an hour old, refresh the
    // hourly news sources right away instead of waiting for the next tick.
    try {
        const lastRunRow = db.prepare(`SELECT MAX(run_at) as t FROM scraper_runs`).get();
        const lastRun = lastRunRow ? lastRunRow.t : null;
        const ageHours = lastRun
            ? (Date.now() - new Date(String(lastRun).replace(' ', 'T') + 'Z').getTime()) / 3600000
            : Infinity;
        if (SCHEDULER_ENABLED && ageHours > 1) {
            console.log(`[scheduler] data stale (${Number.isFinite(ageHours) ? ageHours.toFixed(1) + 'h old' : 'no runs yet'}) - boot backfill starting`);
            setImmediate(() => runScheduledScrape(HOURLY_SOURCES));
        }
    } catch (_) { /* scraper_runs table may not exist in a fresh database */ }
    console.log(`=================================`);
});
