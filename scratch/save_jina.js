const https = require('https');
const fs = require('fs');

https.get('https://r.jina.ai/https://dribbble.com/shots/24003762-Portfolio-Animation', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
}, (res) => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    fs.writeFileSync('scratch/dribbble_shot_full.md', b);
    console.log('Saved! Size:', b.length);
  });
});
