const https = require('https');

https.get('https://archive.org/wayback/available?url=https://dribbble.com/shots/24003762-Portfolio-Animation', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
}, (res) => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log('Wayback:', b));
}).on('error', console.error);
