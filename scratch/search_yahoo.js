const https = require('https');

async function searchYahoo(q) {
  return new Promise((resolve) => {
    https.get('https://search.yahoo.com/search?p=' + encodeURIComponent(q), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const html = await searchYahoo('site:dribbble.com/shots 24003762');
  const matches = html.match(/<h3 class="title"[^>]*>(.*?)<\/h3>/gi) || [];
  console.log('Yahoo matches:', matches.map(m => m.replace(/<[^>]+>/g, '')));
  const comps = html.match(/<div class="compText[^"]*"[^>]*>(.*?)<\/div>/gi) || [];
  console.log('Yahoo snippets:', comps.slice(0, 5).map(c => c.replace(/<[^>]+>/g, '')));
}

run();
