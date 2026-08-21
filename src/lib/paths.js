const path = require('path');

// Root of the repository (src/lib/paths.js -> two levels up)
const ROOT = path.join(__dirname, '..', '..');

module.exports = {
  ROOT,
  DB_PATH: path.join(ROOT, 'scrape_verse.db'),
  DATA_DIR: path.join(ROOT, 'data'),
  SCRATCH_DIR: path.join(ROOT, 'scratch'),
  DIST_DIR: path.join(ROOT, 'frontend', 'dist'),
  COLLECTOR_RESULTS_DIR: path.join(ROOT, 'scrapers'),
  SOURCE_REPORTS_DIR: path.join(ROOT, 'docs', 'source-reports')
};
