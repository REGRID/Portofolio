const https = require('https');

https.get('https://r.jina.ai/https://dribbble.com/shots/24003762-Portfolio-Animation', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
}, (res) => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    console.log('Jina status:', res.statusCode);
    console.log('Jina length:', b.length);
    console.log('Jina content snippet:\n', b.slice(0, 3000));
  });
}).on('error', console.error);
