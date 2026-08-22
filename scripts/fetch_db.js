// Boot-time database provisioning for ephemeral hosts (Render free tier).
// If no SQLite database exists, download the gzipped snapshot from
// DB_SNAPSHOT_URL and gunzip it into place. No-ops when a DB is already
// present (e.g. container restart without disk wipe).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DB_PATH } = require('../src/lib/paths');

async function main() {
  if (fs.existsSync(DB_PATH)) {
    console.log(`[fetch_db] Database already present at ${DB_PATH} - skipping download`);
    return;
  }

  const url = process.env.DB_SNAPSHOT_URL;
  if (!url) {
    console.error('[fetch_db] FATAL: no database found and DB_SNAPSHOT_URL is not set.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  console.log(`[fetch_db] Downloading database snapshot from ${url.split('?')[0]} ...`);
  const t0 = Date.now();
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.error(`[fetch_db] FATAL: snapshot download failed with HTTP ${res.status}`);
    process.exit(1);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`[fetch_db] Downloaded ${(buf.length / 1048576).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s - decompressing...`);

  const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
  const out = isGzip ? zlib.gunzipSync(buf) : buf;
  fs.writeFileSync(DB_PATH, out);
  console.log(`[fetch_db] Database ready at ${DB_PATH} (${(out.length / 1048576).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(`[fetch_db] FATAL: ${err.message}`);
  process.exit(1);
});
