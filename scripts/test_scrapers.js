const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { COLLECTOR_RESULTS_DIR } = require('../src/lib/paths');

const scrapers = [
  { name: 'Al Jazeera', id: 'c_mt0s3rbf1xzxyyduqz', url: 'https://www.aljazeera.com/news/' },
  { name: 'Balkan Insight', id: 'c_mt0s6sdg7gm0v9y04', url: 'https://balkaninsight.com/' },
  { name: 'Daily Maverick', id: 'c_mt0s530w9ffw3kedm', url: 'https://www.dailymaverick.co.za/section/business/' },
  { name: 'InSight Crime', id: 'c_mt0s5vrz11suwz02n2', url: 'https://insightcrime.org/news/analysis/' },
  { name: 'Moscow Times', id: 'c_mt0s6bveu3sh7c7i8', url: 'https://www.themoscowtimes.com/news' },
  { name: 'OCCRP', id: 'c_mt0s4o1e1met6dsy3z', url: 'https://www.occrp.org/en/investigations' },
  { name: 'Rappler', id: 'c_mt0s760b1colkre4l1', url: 'https://www.rappler.com/business/' }
];

console.log('Testing scrapers...');

for (const s of scrapers) {
  console.log(`\nRunning ${s.name} (ID: ${s.id}) on URL: ${s.url}`);
  const outPath = path.join(COLLECTOR_RESULTS_DIR, `${s.name.toLowerCase().replace(/\s+/g, '_')}_test_results.json`);
  
  try {
    const cmd = `npx -p @brightdata/cli bdata scraper run ${s.id} "${s.url}" --pretty -o "${outPath}"`;
    console.log(`Executing: ${cmd}`);
    const output = execSync(cmd, { encoding: 'utf8', timeout: 300000 });
    console.log(`Finished ${s.name}. Output written to ${outPath}`);
    
    // Read and preview the output
    if (fs.existsSync(outPath)) {
      const content = fs.readFileSync(outPath, 'utf8');
      try {
        const json = JSON.parse(content);
        const count = Array.isArray(json) ? json.length : 1;
        console.log(`Success: Found ${count} items.`);
        if (Array.isArray(json) && json.length > 0) {
          console.log('Sample item fields:', Object.keys(json[0]));
        } else {
          console.log('Sample content preview:', content.substring(0, 500));
        }
      } catch (e) {
        console.log('Warning: output was not valid JSON, raw preview:', content.substring(0, 300));
      }
    } else {
      console.log('Error: output file was not created.');
    }
  } catch (err) {
    console.error(`Failed to run ${s.name}:`, err.message);
  }
}
