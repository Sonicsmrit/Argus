# Argus

Bilateral sanctions & adverse media intelligence platform. Screen trade routes and counterparties by cross-referencing official sanctions lists (Layer 1) with investigative press coverage (Layer 2), then synthesize both layers into AI-powered threat assessments.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React + Vite Frontend                    │
│   3D Globe Route Selector · Risk Engine · Denied-Party Screener │
└──────────────────────────────┬──────────────────────────────────┘
                               │ /api/*
┌──────────────────────────────▼──────────────────────────────────┐
│                     Express API Server (:3001)                  │
└──────┬───────────────────┬─────────────────────┬────────────────┘
       │                   │                     │
┌──────▼──────┐   ┌────────▼────────┐   ┌────────▼────────┐
│   Layer 1   │   │     Layer 2     │   │    Gemini AI    │
│ OpenSanctions│  │ Bright Data AI  │   │  Bilateral risk │
│ bulk import │   │ collectors (9)  │   │  Entity threat  │
│ ~1.17M      │   │ scheduled daily │   │  synthesis      │
│ entities    │   │                 │   │                 │
└──────┬──────┘   └────────┬────────┘   └─────────────────┘
       │                   │
┌──────▼───────────────────▼────────┐
│      SQLite (scrape_verse.db)     │
│  sanctioned_entities · articles · │
│  entity_matches · scraper_runs    │
└───────────────────────────────────┘
              ▲
┌─────────────┴─────────────────────┐
│        Matching Engine            │
│ Scored name matching of sanctioned│
│ targets against article corpus    │
└───────────────────────────────────┘
```

### The two layers

- **Layer 1 — Official lists.** Downloads the full [OpenSanctions](https://www.opensanctions.org) bulk dataset and loads every Person/Organization/LegalEntity/Company into SQLite.
- **Layer 2 — Adverse media.** A node-cron pipeline runs custom [Bright Data Scraper Studio](https://brightdata.com) AI collectors daily across Al Jazeera, Balkan Insight, Daily Maverick, InSight Crime, The Moscow Times, OCCRP, Rappler, Middle East Eye and NYT, with layout-drift detection and run logging.

The **matching engine** cross-references both layers using word-prefiltered exact-substring matching over names/aliases, scoring hits by location (headline > body) and name type, storing context snippets for review.

**Gemini AI** then synthesizes bilateral trade-risk briefings (threat vectors, sectoral restrictions, compliance action plans) and per-entity threat profiles (corroboration status, counterparty risk score, screening recommendations).

## Quick start

```bash
# 1. Install dependencies
npm install && cd frontend && npm install && cd ..

# 2. Configure environment (.env)
GEMINI_API_KEY=<your key>

# 3. Initialize database and ingest data
npm run db:init
npm run ingest:sanctions   # downloads OpenSanctions bulk CSV (~430 MB)
npm run pipeline           # one collector run now
npm run match              # build the entity-match index

# 4. Run
npm start                  # API + built frontend on http://localhost:3001
cd frontend && npm run dev # dev server on http://localhost:5173
```

## npm scripts

| Script | Purpose |
|---|---|
| `start` | Start API server + serve built frontend |
| `scheduler` | Daily midnight collector scheduler daemon |
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
  server.js        Express API + static frontend serving
  pipeline.js      Scheduled Layer 2 collector pipeline
  entity_matcher.js Layer 1 ↔ Layer 2 matching engine
  ai_service.js    Gemini threat-assessment integration
  ingestion/       OpenSanctions bulk importer
scripts/           Maintenance utilities (DB init/query/report, source mapping)
frontend/          React + Vite dashboard
docs/
  source-reports/  YAML access reports for 45 candidate news sources
scrapers/          Collector exports and sample results
```

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/countries/stats` | Per-country sanction/media-hit aggregates |
| `GET /api/countries/:code/entities` | Paginated entity screening (search + list filters) |
| `GET /api/entities/:id/articles` | Matched articles for an entity |
| `POST /api/ai/bilateral-risk` | AI bilateral trade-risk assessment |
| `GET /api/ai/entity-analysis/:id` | AI entity threat profile |
| `GET /api/system/status` | Pipeline health + corpus stats |

## Tech stack

Node.js · Express 5 · better-sqlite3 · node-cron · Bright Data Scraper Studio · Google Gemini · React 19 · Vite · globe.gl · Tailwind CSS
