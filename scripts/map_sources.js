const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { SOURCE_REPORTS_DIR } = require('../src/lib/paths');

const REPORTS_DIR = SOURCE_REPORTS_DIR;
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// All Layer 2 sources
const SOURCES = [
  // Investigative nonprofits
  { name: "OCCRP", url: "https://www.occrp.org", region: "Global, Eastern Europe/Central Asia", category: "investigative-nonprofit", file: "occrp" },
  { name: "ICIJ", url: "https://www.icij.org", region: "Global", category: "investigative-nonprofit", file: "icij" },
  { name: "InSight Crime", url: "https://insightcrime.org", region: "Latin America", category: "investigative-nonprofit", file: "insightcrime" },
  { name: "Finance Uncovered", url: "https://financeuncovered.org", region: "Global", category: "investigative-nonprofit", file: "financeuncovered" },
  { name: "Global Witness", url: "https://www.globalwitness.org", region: "Global", category: "investigative-nonprofit", file: "globalwitness" },
  { name: "Africa Confidential", url: "https://www.africa-confidential.com", region: "Africa", category: "investigative-nonprofit", file: "africaconfidential" },
  // Trade press
  { name: "TradeWinds", url: "https://www.tradewindsnews.com", region: "Global maritime trade", category: "trade-press", file: "tradewinds" },
  { name: "Lloyd's List", url: "https://www.lloydslist.com", region: "Global maritime trade", category: "trade-press", file: "lloydslist" },
  { name: "Global Trade Review", url: "https://www.gtreview.com", region: "Global trade finance", category: "trade-press", file: "gtreview" },
  { name: "Global Investigations Review", url: "https://globalinvestigationsreview.com", region: "Global compliance/legal", category: "trade-press", file: "gir" },
  { name: "Compliance Week", url: "https://www.complianceweek.com", region: "Global compliance", category: "trade-press", file: "complianceweek" },
  // Africa
  { name: "Daily Maverick", url: "https://www.dailymaverick.co.za", region: "South Africa", category: "national-press", file: "dailymaverick" },
  { name: "Mail & Guardian", url: "https://mg.co.za", region: "South Africa", category: "national-press", file: "mailguardian" },
  { name: "Premium Times", url: "https://www.premiumtimesng.com", region: "Nigeria", category: "national-press", file: "premiumtimes" },
  { name: "The Cable", url: "https://www.thecable.ng", region: "Nigeria", category: "national-press", file: "thecable" },
  { name: "The East African", url: "https://www.theeastafrican.co.ke", region: "East Africa", category: "national-press", file: "eastafrican" },
  { name: "Business Daily Africa", url: "https://www.businessdailyafrica.com", region: "Kenya", category: "national-press", file: "businessdailyafrica" },
  // Asia A
  { name: "Caixin Global", url: "https://www.caixinglobal.com", region: "China", category: "national-press", file: "caixin" },
  { name: "Nikkei Asia", url: "https://asia.nikkei.com", region: "Asia-Pacific", category: "national-press", file: "nikkei" },
  { name: "The Economic Times", url: "https://economictimes.indiatimes.com", region: "India", category: "national-press", file: "economictimes" },
  { name: "Business Standard (India)", url: "https://www.business-standard.com", region: "India", category: "national-press", file: "businessstandard_india" },
  { name: "Tempo", url: "https://en.tempo.co", region: "Indonesia", category: "national-press", file: "tempo" },
  { name: "Rappler", url: "https://www.rappler.com", region: "Philippines", category: "national-press", file: "rappler" },
  { name: "Dawn", url: "https://www.dawn.com", region: "Pakistan", category: "national-press", file: "dawn" },
  // Asia B
  { name: "Daily FT", url: "https://www.ft.lk", region: "Sri Lanka", category: "national-press", file: "dailyft" },
  { name: "The Business Standard (Bangladesh)", url: "https://www.tbsnews.net", region: "Bangladesh", category: "national-press", file: "tbs_bangladesh" },
  { name: "Vietnam Briefing", url: "https://www.vietnam-briefing.com", region: "Vietnam", category: "national-press", file: "vietnambriefing" },
  { name: "VnExpress International", url: "https://e.vnexpress.net", region: "Vietnam", category: "national-press", file: "vnexpress" },
  { name: "The Irrawaddy", url: "https://www.irrawaddy.com", region: "Myanmar", category: "national-press", file: "irrawaddy" },
  { name: "The Star", url: "https://www.thestar.com.my", region: "Malaysia", category: "national-press", file: "thestar_malaysia" },
  // Middle East
  { name: "Gulf News", url: "https://gulfnews.com", region: "UAE/Gulf", category: "national-press", file: "gulfnews" },
  { name: "Middle East Eye", url: "https://www.middleeasteye.net", region: "Middle East", category: "national-press", file: "middleeasteye" },
  { name: "Zawya", url: "https://www.zawya.com", region: "MENA", category: "trade-press", file: "zawya" },
  { name: "Arab News", url: "https://www.arabnews.com", region: "Saudi Arabia", category: "national-press", file: "arabnews" },
  { name: "The National", url: "https://www.thenationalnews.com", region: "UAE", category: "national-press", file: "thenational" },
  { name: "Al-Monitor", url: "https://www.al-monitor.com", region: "Middle East", category: "national-press", file: "almonitor" },
  // Eastern Europe / Russia
  { name: "The Moscow Times", url: "https://www.themoscowtimes.com", region: "Russia", category: "national-press", file: "moscowtimes" },
  { name: "Kyiv Independent", url: "https://kyivindependent.com", region: "Ukraine", category: "national-press", file: "kyivindependent" },
  { name: "Eurasianet", url: "https://eurasianet.org", region: "Central Asia/Caucasus", category: "national-press", file: "eurasianet" },
  { name: "The Times of Central Asia", url: "https://timesca.com", region: "Central Asia", category: "national-press", file: "timesca" },
  { name: "Meduza", url: "https://meduza.io", region: "Russia (exiled)", category: "national-press", file: "meduza" },
  { name: "Balkan Insight", url: "https://balkaninsight.com", region: "Balkans/SE Europe", category: "national-press", file: "balkaninsight" },
  // Latin America
  { name: "Folha de S.Paulo", url: "https://www.folha.uol.com.br", region: "Brazil", category: "national-press", file: "folha" },
  { name: "La Nación", url: "https://www.lanacion.com.ar", region: "Argentina", category: "national-press", file: "lanacion" },
  { name: "El Universal", url: "https://www.eluniversal.com.mx", region: "Mexico", category: "national-press", file: "eluniversal" },
];

const TODAY = new Date().toISOString().split('T')[0];

function run(cmd, timeoutMs = 30000) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 });
  } catch (e) {
    return `ERROR: ${e.message?.substring(0, 500) || 'unknown'}`;
  }
}

function fetchRobotsTxt(baseUrl) {
  const robotsUrl = `${baseUrl}/robots.txt`;
  console.log(`  [robots.txt] ${robotsUrl}`);
  const result = run(`powershell -Command "try { (Invoke-WebRequest -Uri '${robotsUrl}' -UseBasicParsing -TimeoutSec 10).Content } catch { 'ERROR: ' + $_.Exception.Message }"`, 20000);
  
  if (result.startsWith('ERROR')) return { raw: null, notes: 'robots.txt fetch failed: ' + result.trim() };
  
  const lines = result.split('\n');
  const disallows = lines.filter(l => /^Disallow:/i.test(l.trim())).map(l => l.trim().replace(/^Disallow:\s*/i, '')).filter(Boolean);
  const aiClauses = lines.filter(l => /artificial intelligence|machine learning|AI|LLM|data.?mining|scraping|automated|text.?mining/i.test(l)).map(l => l.trim());
  const botBlocks = [];
  let currentAgent = '';
  for (const line of lines) {
    const agentMatch = line.match(/^User-agent:\s*(.+)/i);
    if (agentMatch) currentAgent = agentMatch[1].trim();
    if (/^Disallow:\s*\/\s*$/i.test(line.trim()) && currentAgent && currentAgent !== '*') {
      botBlocks.push(currentAgent);
    }
  }
  
  let notes = '';
  if (disallows.length > 0) notes += `Disallows: ${disallows.slice(0, 10).join(', ')}${disallows.length > 10 ? ` (+${disallows.length-10} more)` : ''}. `;
  if (aiClauses.length > 0) notes += `AI/scraping clauses found (${aiClauses.length} lines). `;
  if (botBlocks.length > 0) notes += `Blocked bots: ${botBlocks.join(', ')}. `;
  if (!notes) notes = 'Standard robots.txt, no AI-specific restrictions.';
  
  return { raw: result, notes: notes.trim() };
}

function scrapeViaBdata(url, outputFile) {
  console.log(`  [bdata scrape] ${url}`);
  const result = run(`npx -p @brightdata/cli bdata scrape "${url}" --format html -o "${outputFile}"`, 45000);
  const success = !result.startsWith('ERROR') && fs.existsSync(outputFile);
  let antibot = 'none';
  if (result.includes('403') || result.includes('Forbidden')) antibot = '403-forbidden';
  if (result.includes('429') || result.includes('rate')) antibot = 'rate-limit';
  if (result.includes('captcha') || result.includes('CAPTCHA')) antibot = 'captcha';
  if (result.includes('cloudflare') || result.includes('Cloudflare')) antibot = 'cloudflare';
  if (result.includes('blocked') || result.includes('policy')) antibot = 'bright-data-policy-block';
  return { success, antibot, error: success ? null : result.substring(0, 300) };
}

function findRSSInHtml(html, baseUrl) {
  // Check for RSS link tag
  const rssLinkMatch = html.match(/<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i);
  if (rssLinkMatch) {
    let feedUrl = rssLinkMatch[1];
    if (feedUrl.startsWith('/')) feedUrl = baseUrl + feedUrl;
    return feedUrl;
  }
  // Check for Atom
  const atomMatch = html.match(/<link[^>]*type=["']application\/atom\+xml["'][^>]*href=["']([^"']+)["']/i);
  if (atomMatch) {
    let feedUrl = atomMatch[1];
    if (feedUrl.startsWith('/')) feedUrl = baseUrl + feedUrl;
    return feedUrl;
  }
  return null;
}

function tryCommonRSSPaths(baseUrl) {
  const paths = ['/rss', '/feed', '/feed.xml', '/rss.xml', '/atom.xml', '/feeds/posts/default', '/rss/news'];
  for (const p of paths) {
    const url = baseUrl + p;
    const result = run(`powershell -Command "try { $r = Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 8 -MaximumRedirection 3; if ($r.Content -match '<rss|<feed|<atom') { 'FOUND' } else { 'NOTFOUND' } } catch { 'ERROR' }"`, 15000);
    if (result.trim() === 'FOUND') return url;
  }
  return null;
}

function extractArticleUrls(html, baseUrl, maxCount = 5) {
  const urls = new Set();
  // Look for article links — common patterns
  const linkMatches = html.matchAll(/href=["']((?:https?:\/\/[^"']*|\/[^"']*?)(?:\/\d{4}\/\d{1,2}\/\d{1,2}\/[^"']+|\/(?:news|article|story|investigation|report|feature|analysis|economy|world|business|politics)\/[^"']+))["']/gi);
  for (const m of linkMatches) {
    let url = m[1];
    if (url.startsWith('/')) url = baseUrl + url;
    // Filter out non-article URLs
    if (url.includes('/tag/') || url.includes('/category/') || url.includes('/author/') || url.includes('/page/')) continue;
    if (url.includes('.css') || url.includes('.js') || url.includes('.png') || url.includes('.jpg')) continue;
    urls.add(url);
    if (urls.size >= maxCount) break;
  }
  // Fallback: any deep link with enough path segments
  if (urls.size < 3) {
    const deepLinks = html.matchAll(/href=["']((?:https?:\/\/[^"']*|\/[^"']*?)\/[^"'\/]+\/[^"'\/]+\/[^"']+)["']/gi);
    for (const m of deepLinks) {
      let url = m[1];
      if (url.startsWith('/')) url = baseUrl + url;
      if (url.includes('.css') || url.includes('.js') || url.includes('.png') || url.includes('.jpg')) continue;
      if (url.includes('/tag/') || url.includes('/category/') || url.includes('/author/')) continue;
      urls.add(url);
      if (urls.size >= maxCount) break;
    }
  }
  return Array.from(urls).slice(0, maxCount);
}

function extractJsonLd(html) {
  const blocks = [];
  const matches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1]);
      blocks.push(parsed);
    } catch {}
  }
  const newsArticle = blocks.find(b => b['@type'] === 'NewsArticle' || b['@type'] === 'Article' || b['@type'] === 'ReportageNewsArticle');
  return { blocks, newsArticle, hasStructured: !!newsArticle };
}

function extractOGTags(html) {
  const tags = {};
  const matches = html.matchAll(/<meta[^>]*property=["'](og:[^"']*|article:[^"']*)["'][^>]*content=["']([^"']*)["']/gi);
  for (const m of matches) tags[m[1]] = m[2];
  return tags;
}

function extractSelectors(html) {
  const selectors = {
    headline: { primary: '', fallback: '' },
    byline: { primary: '', fallback: '' },
    date: { primary: '', fallback: '' },
    body: { primary: '', fallback: '' },
    section_tag: { primary: '', fallback: '' }
  };
  
  // Headline
  if (html.match(/<h1[^>]*class=["']([^"']*article[^"']*)["']/i)) {
    selectors.headline.primary = `h1[class*="article"]`;
  } else if (html.match(/<header[^>]*class=["'][^"']*article-header[^"']*["']/i)) {
    selectors.headline.primary = 'header.article-header h1';
  } else {
    selectors.headline.primary = 'h1';
  }
  selectors.headline.fallback = 'h1, meta[property="og:title"]';
  
  // Byline
  if (html.match(/class=["'][^"']*author[^"']*["']/i)) {
    selectors.byline.primary = '[class*="author"]';
  } else if (html.match(/rel=["']author["']/i)) {
    selectors.byline.primary = 'a[rel="author"]';
  }
  selectors.byline.fallback = 'a[href*="/author/"], [class*="byline"], meta[name="author"]';
  
  // Date
  if (html.match(/<time[^>]/i)) {
    selectors.date.primary = 'time[datetime]';
  } else if (html.match(/class=["'][^"']*date[^"']*["']/i)) {
    selectors.date.primary = '[class*="date"]';
  }
  selectors.date.fallback = 'meta[property="article:published_time"], [class*="publish"], time';
  
  // Body
  if (html.match(/class=["'][^"']*article-body[^"']*["']/i)) {
    selectors.body.primary = '[class*="article-body"]';
  } else if (html.match(/class=["'][^"']*story-body[^"']*["']/i)) {
    selectors.body.primary = '[class*="story-body"]';
  } else if (html.match(/class=["'][^"']*wysiwyg[^"']*["']/i)) {
    selectors.body.primary = '[class*="wysiwyg"]';
  } else if (html.match(/class=["'][^"']*post-content[^"']*["']/i)) {
    selectors.body.primary = '[class*="post-content"]';
  } else if (html.match(/class=["'][^"']*entry-content[^"']*["']/i)) {
    selectors.body.primary = '[class*="entry-content"]';
  } else if (html.match(/<article[^>]/i)) {
    selectors.body.primary = 'article';
  }
  selectors.body.fallback = 'article, [role="article"], main, [class*="content"]';
  
  // Section/Tag
  if (html.match(/class=["'][^"']*breadcrumb[^"']*["']/i)) {
    selectors.section_tag.primary = '[class*="breadcrumb"]';
  } else if (html.match(/class=["'][^"']*article-tag[^"']*["']/i)) {
    selectors.section_tag.primary = '[class*="article-tag"]';
  }
  selectors.section_tag.fallback = 'meta[property="article:section"], [class*="tag"], [class*="category"], nav[aria-label*="bread"]';
  
  return selectors;
}

function structuralFingerprint(html) {
  const landmarks = {};
  const tags = ['header', 'nav', 'main', 'article', 'section', 'aside', 'footer'];
  for (const tag of tags) {
    const count = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
    if (count > 0) landmarks[tag] = count;
  }
  return Object.entries(landmarks).map(([k, v]) => `${k}(${v})`).join(' > ');
}

async function processSource(source) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${source.name} (${source.url})`);
  console.log('='.repeat(60));
  
  const record = {
    name: source.name,
    url: source.url,
    region: source.region,
    category: source.category,
    rss_feed: null,
    sample_article_urls: [],
    structured_data_available: false,
    structured_data_type: 'none',
    selectors: {
      headline: { primary: '', fallback: '' },
      byline: { primary: '', fallback: '' },
      date: { primary: '', fallback: '' },
      body: { primary: '', fallback: '' },
      section_tag: { primary: '', fallback: '' }
    },
    structural_fingerprint: '',
    antibot_observed: 'none',
    robots_txt_notes: '',
    access_status: 'ok',
    last_checked: TODAY
  };
  
  // 1. robots.txt
  const robots = fetchRobotsTxt(source.url);
  record.robots_txt_notes = robots.notes;
  
  // 2. Reachability via Bright Data
  const homeHtmlFile = path.join(REPORTS_DIR, `${source.file}_home.html`);
  const scrapeResult = scrapeViaBdata(source.url, homeHtmlFile);
  record.antibot_observed = scrapeResult.antibot;
  
  if (!scrapeResult.success) {
    console.log(`  [FAILED] Could not reach ${source.url}: ${scrapeResult.error}`);
    record.access_status = scrapeResult.error?.includes('policy') ? 'blocked' : 
                           scrapeResult.error?.includes('403') ? 'blocked' : 'dead';
    writeYaml(source.file, record);
    return record;
  }
  
  const homeHtml = fs.readFileSync(homeHtmlFile, 'utf-8');
  
  // Check if it's a login wall
  if (homeHtml.length < 2000 && /sign.?in|log.?in|subscribe|paywall/i.test(homeHtml)) {
    record.access_status = 'gated';
  }
  
  // 3. RSS Discovery
  let rssFeed = findRSSInHtml(homeHtml, source.url);
  if (!rssFeed) rssFeed = tryCommonRSSPaths(source.url);
  record.rss_feed = rssFeed;
  
  // 4. Sample articles from RSS or homepage
  if (rssFeed) {
    console.log(`  [RSS] Found: ${rssFeed}`);
    const rssContent = run(`powershell -Command "try { (Invoke-WebRequest -Uri '${rssFeed}' -UseBasicParsing -TimeoutSec 10).Content } catch { 'ERROR' }"`, 20000);
    if (!rssContent.startsWith('ERROR')) {
      const rssLinks = rssContent.matchAll(/<link>([^<]+)<\/link>/gi);
      for (const m of rssLinks) {
        if (m[1].includes('http') && !m[1].includes(source.url + '"') && record.sample_article_urls.length < 5) {
          record.sample_article_urls.push(m[1].trim());
        }
      }
    }
  }
  
  if (record.sample_article_urls.length < 3) {
    const extracted = extractArticleUrls(homeHtml, source.url);
    for (const u of extracted) {
      if (!record.sample_article_urls.includes(u)) record.sample_article_urls.push(u);
      if (record.sample_article_urls.length >= 5) break;
    }
  }
  
  // 5 & 6. Structured data + selectors from first article
  if (record.sample_article_urls.length > 0) {
    const articleUrl = record.sample_article_urls[0];
    const articleFile = path.join(REPORTS_DIR, `${source.file}_article.html`);
    console.log(`  [article] Fetching: ${articleUrl}`);
    const artResult = scrapeViaBdata(articleUrl, articleFile);
    
    if (artResult.success) {
      const artHtml = fs.readFileSync(articleFile, 'utf-8');
      
      // JSON-LD
      const jsonLd = extractJsonLd(artHtml);
      const ogTags = extractOGTags(artHtml);
      
      if (jsonLd.hasStructured) {
        record.structured_data_available = true;
        record.structured_data_type = `schema.org/${jsonLd.newsArticle['@type']}`;
        if (Object.keys(ogTags).length > 0) {
          record.structured_data_type += ' + OpenGraph';
        }
      } else if (Object.keys(ogTags).length > 0) {
        record.structured_data_available = true;
        record.structured_data_type = 'OpenGraph';
      }
      
      // Selectors
      record.selectors = extractSelectors(artHtml);
      
      // Structural fingerprint
      record.structural_fingerprint = structuralFingerprint(artHtml);
      
      // Update antibot from article
      if (artResult.antibot !== 'none') record.antibot_observed = artResult.antibot;
      
      // Clean up article HTML
      try { fs.unlinkSync(articleFile); } catch {}
    }
  }
  
  // Clean up homepage HTML
  try { fs.unlinkSync(homeHtmlFile); } catch {}
  
  // Write YAML
  writeYaml(source.file, record);
  return record;
}

function writeYaml(filename, record) {
  const yaml = `name: "${record.name}"
url: "${record.url}"
region: "${record.region}"
category: "${record.category}"
rss_feed: ${record.rss_feed ? `"${record.rss_feed}"` : 'null'}
sample_article_urls:
${record.sample_article_urls.map(u => `  - "${u}"`).join('\n') || '  []'}
structured_data_available: ${record.structured_data_available}
structured_data_type: "${record.structured_data_type}"
selectors:
  headline: { primary: "${record.selectors.headline.primary}", fallback: "${record.selectors.headline.fallback}" }
  byline: { primary: "${record.selectors.byline.primary}", fallback: "${record.selectors.byline.fallback}" }
  date: { primary: "${record.selectors.date.primary}", fallback: "${record.selectors.date.fallback}" }
  body: { primary: "${record.selectors.body.primary}", fallback: "${record.selectors.body.fallback}" }
  section_tag: { primary: "${record.selectors.section_tag.primary}", fallback: "${record.selectors.section_tag.fallback}" }
structural_fingerprint: "${record.structural_fingerprint}"
antibot_observed: "${record.antibot_observed}"
robots_txt_notes: "${record.robots_txt_notes.replace(/"/g, '\\"')}"
access_status: "${record.access_status}"
last_checked: "${record.last_checked}"
`;
  const outPath = path.join(REPORTS_DIR, `${filename}.yaml`);
  fs.writeFileSync(outPath, yaml, 'utf-8');
  console.log(`  [DONE] Written: ${outPath}`);
}

// Main — sequential processing with progress tracking
(async () => {
  console.log(`Starting Layer 2 source mapping — ${SOURCES.length} sources`);
  console.log(`Date: ${TODAY}\n`);
  
  const results = { ok: [], gated: [], blocked: [], dead: [] };
  
  for (let i = 0; i < SOURCES.length; i++) {
    console.log(`\n[${i+1}/${SOURCES.length}]`);
    try {
      const record = await processSource(SOURCES[i]);
      results[record.access_status] = results[record.access_status] || [];
      results[record.access_status].push(record.name);
    } catch (e) {
      console.log(`  [ERROR] ${SOURCES[i].name}: ${e.message}`);
      results.dead.push(SOURCES[i].name);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`OK: ${(results.ok || []).join(', ') || 'none'}`);
  console.log(`Gated: ${(results.gated || []).join(', ') || 'none'}`);
  console.log(`Blocked: ${(results.blocked || []).join(', ') || 'none'}`);
  console.log(`Dead: ${(results.dead || []).join(', ') || 'none'}`);
  console.log(`Total: ${SOURCES.length}`);
})();
