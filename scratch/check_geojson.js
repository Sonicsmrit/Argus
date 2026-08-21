const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:/Users/dell/OneDrive/Desktop/Reg/frontend/public/countries.geojson', 'utf8'));
console.log('GeoJSON features count:', data.features.length);
console.log('Sample feature properties:', data.features[0].properties);