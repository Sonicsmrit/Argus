const fs = require('fs');
const html = fs.readFileSync('insight_crime_raw.html', 'utf8');

console.log('=== Checking InSight Crime HTML ===');
console.log('Total characters:', html.length);

// Look for article links
const hrefs = new Set();
const matches = html.matchAll(/href="([^"]+)"/g);
for (const m of matches) {
  const url = m[1];
  if (url.includes('insightcrime.org/news/') && !url.includes('/tag/') && !url.includes('/category/')) {
    hrefs.add(url);
  }
}
console.log('Found news links:', Array.from(hrefs).slice(0, 15));

// Check if page contains cloudflare or captcha
const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
console.log('Page title:', titleMatch ? titleMatch[1].trim() : 'No title');
if (html.includes('Cloudflare') || html.includes('captcha') || html.includes('Access Denied')) {
  console.log('WARNING: Interstitial or block detected!');
}
