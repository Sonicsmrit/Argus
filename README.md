# Argus

<p align="center">
  <img src="frontend/public/argus-logo.png" alt="Argus logo" width="96" />
</p>

**Argus** — named for Argus Panoptes, the hundred-eyed giant of Greek myth who never fully sleeps — is a bilateral sanctions & adverse-media intelligence platform. It screens trade corridors and counterparties by cross-referencing official sanctions lists (**Layer 1**) with investigative press coverage (**Layer 2**), then synthesizes both layers into AI-powered threat assessments.

---

## Why it exists

Official sanctions registries are reactive: they list entities after decisions are made. Adverse media — investigative reporting on organized crime, corruption, and sanctions evasion — surfaces risk **earlier**, but lives scattered across dozens of outlets in different jurisdictions and languages.

Argus closes that gap. A compliance officer evaluating a shipment corridor or a counterparty gets one answer built from two independent evidence layers:

- **Layer 1 — Official lists.** The full [OpenSanctions](https://www.opensanctions.org) bulk dataset (~1.17M persons, organizations, and companies) loaded into SQLite.
- **Layer 2 — Adverse media.** Custom [Bright Data Scraper Studio](https://brightdata.com) AI collectors running on a hybrid schedule across nine investigative outlets — Al Jazeera, Balkan Insight, Daily Maverick, InSight Crime, The Moscow Times, OCCRP, Rappler, Middle East Eye, and NYT.

A **matching engine** cross-references both layers using word-prefiltered exact-substring matching over names/aliases, scoring hits by location (headline > body) and name type, and storing verbatim context snippets. **Gemini** then synthesizes corridor-level trade-risk briefings and per-entity threat profiles on top of the corroborated evidence.

## Features

### Screening & intelligence
- **Denied-party screening** (`Entity Intelligence`) — search the full 1.17M-entity registry with tiered match scoring: exact (100) → alias-exact (85) → starts-with (90) → contains (75) → alias-contains (60). Results ranked, sourced, and one click from a full dossier.
- **Bilateral threat briefing** — pick any two of 240+ jurisdictions and get rule-based corridor assessment (embargoes, secondary-sanctions exposure) plus a Gemini executive synthesis with sectoral restrictions and action plans.
- **Investigative dossiers** — per-entity pages combining registry record, matched articles, corroboration rating, counterparty risk score, and AI threat categorization.
- **3D globe corridor selector** — interactive globe for picking origin/destination pairs, fed by live per-country sanction/media aggregates.

### Continuous monitoring
- **Watchlist** — monitor any screened entity; entries appear instantly everywhere via cache invalidation.
- **Fresh-hit detection** — pulsing indicators flag watchlisted entities with new article matches inside a 7-day window, computed server-side per request.
- **Dedicated Watchlist tab** — monitored count, flagged count, and total fresh hits at a glance.

### Compliance workflow
- **Audit ledger** — every screening decision (clear / escalate / freeze) is recorded with ticket IDs and rendered as a live panel; exportable as a branded PDF dossier.
- **Investigator identity & jurisdiction calibration** — your home country calibrates bilateral risk rules app-wide.
- **Live notifications** — jurisdiction-scoped alert feed with unread badges; read-state persists across sessions.
- **PII masking** — aliases and sanctions-program identifiers on dossiers stay blurred until explicitly revealed.

### Operations
- **Hybrid scrape scheduler** — news-heavy sources (OCCRP, Al Jazeera, Middle East Eye, Balkan Insight) refresh hourly at :15; the full nine-outlet sweep runs daily at 03:30; a boot-time backfill catches up if the last run is over an hour old.
- **Layout-drift detection** — collectors whose extraction degrades are flagged in run logs instead of silently corrupting the corpus.
- **System status page** — corpus stats, per-source last-run times, pipeline health.
- **Fast country stats** — disk-persisted aggregation snapshot keeps checklist/globe loads sub-second even after a cold restart.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React + Vite Frontend                    │
│   3D Globe Route Selector · Risk Engine · Denied-Party Screener │
└──────────────────────────────┬──────────────────────────────────┘
                               │ /api/*
┌──────────────────────────────▼──────────────────────────────────┐
│                     Express API Server (:3001)                  │
│        serves REST API + built frontend · embedded cron         │
└──────┬───────────────────┬─────────────────────┬────────────────┘
       │                   │                     │
┌──────▼──────┐   ┌────────▼────────┐   ┌────────▼────────┐
│   Layer 1   │   │     Layer 2     │   │    Gemini AI    │
│ OpenSanctions│  │ Bright Data AI  │   │  Bilateral risk │
│ bulk import │   │ collectors (9)  │   │  Entity threat  │
│ ~1.17M      │   │ hourly/daily    │   │  synthesis      │
│ entities    │   └────────┬────────┘   └─────────────────┘
└──────┬──────┘            │
┌──────▼───────────────────▼────────┐
│      SQLite (scrape_verse.db)     │
│  sanctioned_entities · articles · │
│  entity_matches · scraper_runs ·  │
│  audit_actions · watchlist        │
└───────────────────────────────────┘
              ▲
┌─────────────┴─────────────────────┐
│        Matching Engine            │
│ Scored name matching of sanctioned│
│ targets against article corpus    │
└───────────────────────────────────┘
```

### Data flow

1. `ingest:sanctions` downloads the OpenSanctions bulk CSV (~430 MB) and loads every Person/Organization/LegalEntity into SQLite.
2. The scheduler runs Bright Data collectors on the hybrid cadence; each run is logged to `scraper_runs`, and extracted articles are cleaned (HTML stripped), date-normalized, and stored newest-first.
3. `match` rebuilds the entity↔article index, scoring every occurrence of a sanctioned name/alias in the article corpus.
4. The API serves screening, watchlist, checklist, notification, and audit queries straight off indexed SQLite; Gemini synthesis endpoints memoize their results per entity/corridor.

## Design philosophy

- **Corroborate, don't assume.** A single source never makes a target; findings gain weight when Layer 1 records and Layer 2 reporting agree. Corroboration status is always explicit.
- **Evidence-first.** Every claim links back to its source article with a verbatim context snippet — no black-box scores without receipts.
- **Transparency as default.** Compliance decisions belong in an immutable, exportable trail (the Audit Ledger), not in someone's inbox.
- **Privacy-conscious display.** Sensitive identifiers are masked until an authorized user reveals them — safe for screen-shares and demos.
- **Calm surface, dense substrate.** A Material 3 token-driven UI (every color routes through semantic design tokens) over a brutally simple single-file SQLite substrate: fast to demo, easy to reason about, trivial to deploy.

## Installation

### Prerequisites

- Node.js ≥ 18
- A [Gemini API key](https://ai.google.dev)
- (For Layer 2 collection) Bright Data account with Scraper Studio access

### Setup

```bash
# 1. Install dependencies (root + frontend)
npm install && cd frontend && npm install && cd ..

# 2. Configure environment (.env in repo root)
GEMINI_API_KEY=<your key>

# 3. Initialize the database
npm run db:init

# 4. Ingest Layer 1 (downloads ~430 MB bulk CSV, loads ~1.17M entities)
npm run ingest:sanctions

# 5. Run one Layer 2 collector sweep now (requires Bright Data CLI auth)
npm run pipeline

# 6. Build the entity↔article match index
npm run match
```

### Running

```bash
# Production: API + built frontend on http://localhost:3001
cd frontend && npm run build && cd ..
npm start

# Development: Vite dev server on http://localhost:5173 (proxies /api to :3001)
npm start                 # terminal 1
cd frontend && npm run dev  # terminal 2

# Standalone scheduler daemon (the API server already embeds this cron)
npm run scheduler
```

## npm scripts

| Script | Purpose |
|---|---|
| `start` | Start API server + serve built frontend |
| `scheduler` | Standalone collector scheduler daemon |
| `pipeline` | One-off collector pipeline run |
| `match` | Rebuild entity↔article match index |
| `ingest:sanctions` | Download + load OpenSanctions dataset |
| `db:init` / `db:report` | Create tables / print DB overview |
| `report` | Generate sanctions alert report (JSON) |
| `map-sources` | Probe candidate outlets (robots.txt, RSS, selectors) |
| `test:collectors` | Test all Bright Data collectors |

## Project layout

```
src/               Backend services
  lib/paths.js     Shared path configuration
  server.js        Express API · static frontend serving · embedded cron scheduler
  pipeline.js      Layer 2 collector pipeline (Bright Data CLI wrapper)
  entity_matcher.js Layer 1 ↔ Layer 2 matching engine
  ai_service.js    Gemini threat-assessment integration
  ingestion/       OpenSanctions bulk importer
scripts/           Maintenance utilities (DB init/query/report, source mapping)
frontend/          React + Vite dashboard (Material 3 design system)
  public/          Static assets (logo, favicon, geojson)
docs/
  source-reports/  YAML access reports for 45 candidate news sources
scrapers/          Collector exports and sample results
images/            Brand assets
```

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/screen?q=` | Denied-party screening against the full registry (tiered scoring) |
| `GET /api/watchlist` · `POST` · `DELETE /:entityId` | Continuous-monitoring watchlist with fresh-hit detection |
| `GET /api/checklists/:code?home=` | Jurisdiction checklist ranked by adverse-media volume |
| `GET /api/notifications?homeCountry=` | Jurisdiction-scoped alert feed |
| `POST /api/audit-actions` · `GET ?limit=` | Record/list compliance decisions (ticketed) |
| `GET /api/countries/stats` | Per-country sanction/media-hit aggregates |
| `GET /api/countries/:code/entities` | Paginated entity screening (search + list filters) |
| `GET /api/entities/:id/articles` | Matched articles for an entity |
| `POST /api/ai/bilateral-risk` | AI bilateral trade-risk assessment |
| `GET /api/ai/entity-analysis/:id` | AI entity threat profile |
| `GET /api/system/status` | Pipeline health + corpus stats |

## Deploying to Render

The recommended topology is a **single Render Web Service**: Express serves both the REST API and the built frontend, so no split deployment is needed.

1. **Create the service** from the repo — Render builds with:
   - **Build command:** `npm install && cd frontend && npm install && npm run build`
   - **Start command:** `node src/server.js`
   - **Health check path:** `/api/system/status`
2. **Environment:** set `GEMINI_API_KEY`. If collectors should run from the host, also provide Bright Data CLI credentials.
3. **Database:** `scrape_verse.db` (~508 MB, gitignored) exceeds Render's free ephemeral disk. Either attach a **Persistent Disk** mounted at the repo root's data location, or bootstrap on boot by downloading a DB snapshot from object storage into place before `node src/server.js` starts. Note that free-tier disks are wiped on every deploy.
4. **Scheduler:** the cron runs inside the web service process — no separate worker needed. On Render's free tier, keep the service from spinning down (idle instances don't fire crons).

> Vercel is **not** suitable for the backend here: serverless functions can't host node-cron or a writable SQLite file. It can serve the static frontend only.

## Tech stack

Node.js · Express 5 · better-sqlite3 · node-cron · Bright Data Scraper Studio · Google Gemini · React 19 · Vite · TanStack Query · globe.gl · jsPDF · Tailwind CSS
