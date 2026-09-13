const https = require('https');

const query = encodeURIComponent('"24003762"');
const url = `https://html.duckduckgo.com/html/?q=${query}`;

https.get(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const titles = body.match(/<a class="result__snippet"[^>]*>(.*?)<\/a>/gi) || [];
    const links = body.match(/<a class="result__url"[^>]*>(.*?)<\/a>/gi) || [];
    console.log('Results count:', titles.length);
    titles.slice(0, 5).forEach((t, i) => console.log('T:', t.replace(/<[^>]+>/g, '')));
    links.slice(0, 5).forEach((l, i) => console.log('L:', l.replace(/<[^>]+>/g, '').trim()));
  });
});
