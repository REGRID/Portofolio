const https = require('https');
const fs = require('fs');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function run() {
  await download('https://cdn.dribbble.com/userupload/14090640/file/original-8b1d2ba161b202191a052cdc3ca10868.jpg', 'scratch/shot_img1.jpg');
  console.log('Downloaded img1');
  await download('https://cdn.dribbble.com/userupload/14090641/file/original-56ebcf48ae9587ada0732ebad6bb844c.jpg', 'scratch/shot_img2.jpg');
  console.log('Downloaded img2');
  await download('https://cdn.dribbble.com/userupload/14090639/file/original-a3414c9eedcf287e013f4f9ff5ac0a23.jpg', 'scratch/shot_img3.jpg');
  console.log('Downloaded img3');
}

run();
