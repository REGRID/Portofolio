const { Client } = require('ssh2');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Read .env.local if present
const envPath = path.resolve(__dirname, '../.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      env[match[1]] = val;
    }
  });
}

const host = process.env.VPS_HOST || env.VPS_HOST || '43.134.30.216';
const user = process.env.VPS_USER || env.VPS_USER || 'ubuntu';
const port = parseInt(process.env.VPS_PORT || env.VPS_PORT || '22', 10);
const projectDir = process.env.VPS_PROJECT_DIR || env.VPS_PROJECT_DIR || '/home/ubuntu/Portofolio';

async function getPassword() {
  if (process.env.VPS_PASSWORD) return process.env.VPS_PASSWORD;
  if (process.argv[2]) return process.argv[2];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`Masukkan Password VPS untuk ${user}@${host}: `, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function runDeploy() {
  const password = await getPassword();
  if (!password) {
    console.error('Password tidak boleh kosong.');
    process.exit(1);
  }

  console.log(`\n🚀 Menghubungkan ke VPS ${user}@${host}:${port}...`);
  const conn = new Client();

  conn.on('ready', () => {
    console.log('✅ Berhasil terhubung ke VPS!');
    console.log(`📦 Menjalankan proses update di ${projectDir}...\n`);

    const cmd = `cd ${projectDir} && git pull origin main && npm install && npm run build && (pm2 restart portfolio || pm2 restart all || pm2 start ecosystem.config.js)`;

    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error('❌ Gagal mengeksekusi perintah:', err);
        conn.end();
        process.exit(1);
      }

      stream.on('close', (code) => {
        conn.end();
        if (code === 0) {
          console.log('\n🎉 Deploy ke VPS BERHASIL! Website telah terupdate.');
        } else {
          console.log(`\n⚠️ Perintah selesai dengan exit code ${code}`);
        }
      });

      stream.on('data', (data) => {
        process.stdout.write(data);
      });

      stream.stderr.on('data', (data) => {
        process.stderr.write(data);
      });
    });
  }).on('error', (err) => {
    console.error('❌ Koneksi SSH gagal:', err.message);
  }).connect({
    host,
    port,
    username: user,
    password,
    readyTimeout: 10000,
  });
}

runDeploy();
