const https = require('https');

https.get('https://dribbble.com/shots/24003762-Portfolio-Animation', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Body length:', body.length);
    console.log('Body head:', body.slice(0, 500));
  });
});
