const http = require('http');

http.get('http://127.0.0.1:3001/api/system/status', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS API RESPONSE:', JSON.parse(data));
    process.exit(0);
  });
}).on('error', err => {
  console.error('HTTP GET ERROR:', err.message);
  process.exit(1);
});
