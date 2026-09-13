const https = require('https');

https.get('https://api.dribbble.com/v1/shots/24003762', (res) => {
  console.log('v1 status:', res.statusCode);
});

https.get('https://dribbble.com/shots/24003762/oembed.json', (res) => {
  console.log('oembed status:', res.statusCode);
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log('oembed body:', b));
});
