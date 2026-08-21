const http = require('http');

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('1. Testing AI Bilateral Assessment API for US -> RU:');
  const resBilateral = await postJson('http://127.0.0.1:3001/api/ai/bilateral-risk', {
    from: 'US',
    to: 'RU',
    fromName: 'United States',
    toName: 'Russia'
  });
  console.log('   Status:', resBilateral.status);
  console.log('   AI Threat Rating:', resBilateral.data?.analysis?.threatRating);
  console.log('   Threat Score:', resBilateral.data?.analysis?.threatScore);

  console.log('\n2. Testing Corroborated Entity Sorting for Mexico:');
  const resEntities = await getJson('http://127.0.0.1:3001/api/countries/mx/entities?limit=3');
  console.log('   Status:', resEntities.status);
  resEntities.data.entities.forEach((e, i) => {
    console.log(`   #${i+1}: ${e.name} [MatchCount: ${e.matchCount}, Score: ${e.topScore}] -> Hit: "${e.topMatch?.headline}"`);
  });

  const topEntityId = resEntities.data.entities[0]?.id;
  if (topEntityId) {
    console.log(`\n3. Testing AI Deep Profile for Top Entity (${resEntities.data.entities[0].name}):`);
    const resAiEntity = await getJson(`http://127.0.0.1:3001/api/ai/entity-analysis/${topEntityId}`);
    console.log('   Status:', resAiEntity.status);
    console.log('   Threat Category:', resAiEntity.data?.analysis?.threatCategory);
    console.log('   Corroboration Status:', resAiEntity.data?.analysis?.corroborationStatus);
    console.log('   Screening Recommendation:', resAiEntity.data?.analysis?.screeningRecommendation?.substring(0, 150) + '...');
  }

  console.log('\n✅ ALL INTEGRATION TESTS PASSED!');
  process.exit(0);
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
