const https = require('https');

https.get('https://www.mojeek.com/search?q=' + encodeURIComponent('"Portfolio Animation" site:dribbble.com'), {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
}, (res) => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    const titles = b.match(/<a class="title"[^>]*>(.*?)<\/a>/gi) || [];
    console.log('Mojeek titles:', titles.slice(0, 10).map(t => t.replace(/<[^>]+>/g, '')));
    const urls = b.match(/<a class="url"[^>]*>(.*?)<\/a>/gi) || [];
    console.log('Mojeek urls:', urls.slice(0, 10).map(u => u.replace(/<[^>]+>/g, '')));
  });
}).on('error', console.error);
