const fs = require('fs');
const html = fs.readFileSync('insight_crime_news_raw.html', 'utf8');

console.log('=== Checking InSight Crime News HTML ===');
console.log('Total characters:', html.length);

const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
console.log('Page title:', titleMatch ? titleMatch[1].trim() : 'No title');

// Look for article links
const hrefs = new Set();
const matches = html.matchAll(/href="([^"]+)"/g);
for (const m of matches) {
  const url = m[1];
  if (url.includes('insightcrime.org/news/') && !url.includes('/tag/') && !url.includes('/category/')) {
    hrefs.add(url);
  }
}
const links = Array.from(hrefs);
console.log('Found news links:', links.slice(0, 15));

// Check if any links contain dates or look like articles
// E.g., print the text surrounding some links
links.slice(0, 5).forEach(l => {
  const esc = l.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const contextMatch = html.match(new RegExp(`([\\s\\S]{0,100})${esc}([\\s\\S]{0,100})`, 'i'));
  if (contextMatch) {
    console.log(`\nLink: ${l}`);
    console.log(`Context: ...${contextMatch[0].replace(/\s+/g, ' ').substring(0, 150)}...`);
  }
});
