const https = require('https');

const options = {
  hostname: 'dribbble.com',
  path: '/shots/24003762-Portfolio-Animation',
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept': 'text/html,application/xhtml+xml',
  }
};

https.get(options, (res) => {
  console.log('Googlebot status:', res.statusCode);
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    console.log('Body length:', b.length);
    if (b.length > 0) {
      console.log('Snippet:', b.slice(0, 1000));
    }
  });
}).on('error', console.error);
