const https = require('https');

const options = {
  hostname: 'dribbble.com',
  path: '/shots/24003762-Portfolio-Animation',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
};

https.get(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    const titleMatch = data.match(/<title>([^<]*)<\/title>/i);
    console.log('TITLE:', titleMatch ? titleMatch[1] : 'No title');
    
    const ogTitle = data.match(/property="og:title"\s+content="([^"]*)"/i) || data.match(/content="([^"]*)"\s+property="og:title"/i);
    console.log('OG TITLE:', ogTitle ? ogTitle[1] : 'None');

    const ogDesc = data.match(/property="og:description"\s+content="([^"]*)"/i) || data.match(/content="([^"]*)"\s+property="og:description"/i);
    console.log('OG DESC:', ogDesc ? ogDesc[1] : 'None');

    const ogImage = data.match(/property="og:image"\s+content="([^"]*)"/i) || data.match(/content="([^"]*)"\s+property="og:image"/i);
    console.log('OG IMAGE:', ogImage ? ogImage[1] : 'None');

    const shotMedia = data.match(/https:\/\/cdn\.dribbble\.com\/userupload\/[^\s"']+/g);
    if (shotMedia) {
      console.log('MEDIA URLS:', [...new Set(shotMedia)].slice(0, 5));
    }
  });
}).on('error', err => {
  console.error(err);
});
