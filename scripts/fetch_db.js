// Boot-time database provisioning for ephemeral hosts (Render free tier).
// If no SQLite database exists, stream the gzipped snapshot from
// DB_SNAPSHOT_URL through gunzip into place. Streaming keeps memory flat
// (~64KB chunks) so a 500MB database decompresses inside a 512MB container.
// No-ops when a DB is already present (e.g. restart without disk wipe).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
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

  // Write to a temp file and rename on success, so an interrupted download
  // never leaves a corrupt half-database that the exists-check would trust.
  const tmpPath = `${DB_PATH}.tmp`;

  console.log(`[fetch_db] Downloading database snapshot from ${url.split('?')[0]} ...`);
  const t0 = Date.now();
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.error(`[fetch_db] FATAL: snapshot download failed with HTTP ${res.status}`);
    process.exit(1);
  }

  await pipeline(
    Readable.fromWeb(res.body),
    zlib.createGunzip(),
    fs.createWriteStream(tmpPath)
  );

  const sizeMb = (fs.statSync(tmpPath).size / 1048576).toFixed(1);
  fs.renameSync(tmpPath, DB_PATH);
  console.log(`[fetch_db] Database ready at ${DB_PATH} (${sizeMb} MB in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

main().catch((err) => {
  try { fs.rmSync(`${DB_PATH}.tmp`, { force: true }); } catch (_) {}
  console.error(`[fetch_db] FATAL: ${err.message}`);
  process.exit(1);
});
