const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const data = await fetchUrl('https://www.bing.com/search?q=' + encodeURIComponent('site:dribbble.com "24003762"'));
  const titles = data.match(/<h2><a[^>]*>(.*?)<\/a><\/h2>/gi) || [];
  console.log('Bing titles:', titles.map(t => t.replace(/<[^>]+>/g, '')));
  const snippets = data.match(/<p class="b_lineclamp[^"]*"[^>]*>(.*?)<\/p>/gi) || [];
  console.log('Bing snippets:', snippets.map(s => s.replace(/<[^>]+>/g, '')));
}

run();
