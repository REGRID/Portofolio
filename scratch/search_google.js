const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function run() {
  try {
    // Try querying Google Search
    const res = await fetchUrl('https://www.google.com/search?q=' + encodeURIComponent('dribbble "24003762"'));
    console.log('Google status:', res.status);
    const matches = res.data.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
    console.log('Matches:', matches.map(m => m.replace(/<[^>]+>/g, '')));
    const snippets = res.data.match(/<div class="[^"]*VwiC3b[^"]*"[^>]*>(.*?)<\/div>/gi) || [];
    console.log('Snippets:', snippets.map(s => s.replace(/<[^>]+>/g, '')));
  } catch (e) {
    console.error(e);
  }
}

run();
