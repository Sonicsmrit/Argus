const Database = require('better-sqlite3');
const db = new Database('./scrape_verse.db');

// Get country code distribution from sanctioned_entities
const countries = db.prepare(`
  SELECT countries, COUNT(*) as cnt 
  FROM sanctioned_entities 
  WHERE sanctions IS NOT NULL AND sanctions != ''
  GROUP BY countries 
  ORDER BY cnt DESC 
  LIMIT 30
`).all();
console.log('=== TOP COUNTRY CODES IN SANCTIONED ENTITIES ===');
console.table(countries);

// Get unique country codes (split semicolons)
const all = db.prepare('SELECT DISTINCT countries FROM sanctioned_entities WHERE countries IS NOT NULL').all();
const codeSet = new Set();
for (const r of all) {
  for (const c of r.countries.split(';')) {
    if (c.trim()) codeSet.add(c.trim());
  }
}
console.log('\nTotal unique country codes:', codeSet.size);
console.log('Sample codes:', [...codeSet].sort().slice(0, 80).join(', '));

// Get entity_matches country distribution  
const matchCountries = db.prepare(`
  SELECT entity_countries, COUNT(*) as matches, COUNT(DISTINCT entity_id) as entities
  FROM entity_matches
  GROUP BY entity_countries
  ORDER BY matches DESC
  LIMIT 20
`).all();
console.log('\n=== TOP COUNTRIES IN ENTITY MATCHES ===');
console.table(matchCountries);

// Count entities per individual country code (splitting multi-country entries)
const entityRows = db.prepare(`
  SELECT countries FROM sanctioned_entities 
  WHERE sanctions IS NOT NULL AND sanctions != '' AND countries IS NOT NULL
`).all();
const countryEntityCounts = {};
for (const r of entityRows) {
  for (const c of r.countries.split(';')) {
    const cc = c.trim();
    if (cc) countryEntityCounts[cc] = (countryEntityCounts[cc] || 0) + 1;
  }
}
const sorted = Object.entries(countryEntityCounts).sort((a, b) => b[1] - a[1]).slice(0, 40);
console.log('\n=== TOP 40 INDIVIDUAL COUNTRY CODES BY SANCTIONED ENTITY COUNT ===');
console.table(sorted.map(([code, count]) => ({ code, count })));

db.close();
