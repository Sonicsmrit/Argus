const fs = require('fs');
const html = fs.readFileSync('rappler_article_raw.html', 'utf8');

console.log('=== Checking Rappler Article HTML ===');
console.log('Total characters:', html.length);

// Look for publication date in tags
const matches = [];
const patterns = [
  /<meta[^>]*property="article:published_time"[^>]*content="([^"]*)"/i,
  /<meta[^>]*content="([^"]*)"[^>]*property="article:published_time"/i,
  /<meta[^>]*name="publish-date"[^>]*content="([^"]*)"/i,
  /<meta[^>]*name="publication-date"[^>]*content="([^"]*)"/i,
  /<meta[^>]*property="og:pubdate"[^>]*content="([^"]*)"/i,
  /<time[^>]*>([\s\S]*?)<\/time>/i,
  /published_time|pubdate|publishedDate|datePublished/i
];

for (const pattern of patterns) {
  const match = html.match(pattern);
  if (match) {
    console.log(`Matched Pattern ${pattern}:`, match[0]);
  }
}

// Find JSON-LD block
const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
let foundLd = false;
for (const m of jsonLdMatches) {
  foundLd = true;
  console.log('\n--- JSON-LD BLOCK ---');
  const txt = m[1].trim();
  try {
    const json = JSON.parse(txt);
    console.log('Type:', json['@type']);
    if (json.datePublished) console.log('datePublished:', json.datePublished);
    if (json.dateModified) console.log('dateModified:', json.dateModified);
    if (json['@graph']) {
      console.log('Found @graph in JSON-LD. Types:', json['@graph'].map(g => g['@type']));
      const article = json['@graph'].find(g => g['@type'] === 'Article' || g['@type'] === 'NewsArticle' || g['@type'] === 'WebPage');
      if (article) {
        console.log('Article datePublished:', article.datePublished);
        console.log('Article dateModified:', article.dateModified);
      }
    }
  } catch (e) {
    console.log('Failed to parse JSON-LD:', e.message);
    console.log(txt.substring(0, 500));
  }
}

if (!foundLd) {
  console.log('No JSON-LD blocks found.');
}
