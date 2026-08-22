const path = require('path');

// Root of the repository (src/lib/paths.js -> two levels up)
const ROOT = path.join(__dirname, '..', '..');

// Env overrides let ephemeral hosts (Render etc.) point at a mounted
// volume or a boot-downloaded database without code changes.
module.exports = {
  ROOT,
  DB_PATH: process.env.DB_PATH || path.join(ROOT, 'scrape_verse.db'),
  DATA_DIR: process.env.DATA_DIR || path.join(ROOT, 'data'),
  SCRATCH_DIR: process.env.SCRATCH_DIR || path.join(ROOT, 'scratch'),
  DIST_DIR: path.join(ROOT, 'frontend', 'dist'),
  COLLECTOR_RESULTS_DIR: path.join(ROOT, 'scrapers'),
  SOURCE_REPORTS_DIR: path.join(ROOT, 'docs', 'source-reports')
};
