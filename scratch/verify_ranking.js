const http = require('http');

function checkEntities(country) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:3001/api/countries/${country}/entities?limit=5`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`\n=== ${country.toUpperCase()} ENTITIES (Top Significance Ordered) ===`);
          json.entities.forEach((e, i) => {
            console.log(`  #${i+1} ${e.name} [MatchCount: ${e.matchCount}, TopScore: ${e.topScore}]`);
            if (e.topMatch) console.log(`     Top Hit: "${e.topMatch.headline}" (${e.topMatch.source})`);
          });
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  await checkEntities('ru');
  await checkEntities('mx');
  await checkEntities('ec');
  await checkEntities('sy');
  process.exit(0);
}

run();
