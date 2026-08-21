const fs = require('fs');
const https = require('https');
const path = require('path');

const dest = path.join(__dirname, 'frontend', 'public', 'countries.geojson');
const url = 'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';

if (!fs.existsSync(path.dirname(dest))) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
}

console.log('Downloading countries GeoJSON...');
https.get(url, (res) => {
  if (res.statusCode !== 200) {
    console.error('Failed to download GeoJSON, status:', res.statusCode);
    process.exit(1);
  }
  const file = fs.createWriteStream(dest);
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Saved GeoJSON to', dest, 'Size:', (fs.statSync(dest).size / 1024).toFixed(1), 'KB');
  });
}).on('error', err => {
  console.error('Error downloading:', err.message);
});
