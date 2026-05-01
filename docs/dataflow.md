# PulseTrack Dataflow

_Last updated: 2025-11-27_

This document traces every hop from opinion capture to the visualizations shipped from Firebase Hosting. Use it as the single reference when evaluating changes to ingestion, ETL, or reporting layers.

## 1. Data Producers

| Producer | Location | Output |
| --- | --- | --- |
| Public opinion form | `frontend/src/components/SubmitOpinion.tsx` | POST `/api/submit_opinion` → normalized document stored in `raw_inputs` |
| Admin CSV importer | `seed.js` and `admin_upload` HTTPS function | Batch sentiment + approval docs |
| Static demographics assets | `frontend/public/snapstats/derived/*.json` (generated out-of-band) | State-level metadata for Snapstats map |

**Key notes**
- `/api/submit_opinion` now handles validation, rate limiting, and geo enrichment before `raw_inputs` is touched.
- Bulk imports should flow through `admin_upload` whenever possible; the legacy `seed.js` script still writes aggregates directly for historical backfills.

## 2. Ingestion Boundary

| Layer | Responsibility | Files |
| --- | --- | --- |
| Firebase Hosting rewrites | Proxy `/api/*` routes to Cloud Functions | `firebase.json` |
| HTTPS functions | `submit_opinion`, `healthz`, `admin_upload` | `functions/main.py` |
| Firestore security rules | `raw_inputs` locked down (server-only), public read collections remain | `firestore.rules` |

Flow now:
1. Browser fetches `/api/submit_opinion` (or emulator equivalent).
2. Function enforces per-IP rate limits, validates payload, normalizes state/zone metadata, and writes to `raw_inputs` with `processed_at = null`.
3. Admins upload CSV/JSON via `/api/admin_upload` with an API key; the same sanitizer is reused.

Remaining gaps:
- Admin uploads currently only store raw inputs; we still rely on `seed.js` for massive historical loads.
- ETL still pulls documents by timestamp window instead of explicit "unprocessed" marks (addressed in **harden-etl**).

## 3. ETL / Processing

| Step | Details |
| --- | --- |
| Scheduler | `process_etl` (`@scheduler_fn.on_schedule("every 10 minutes")`) |
| Extraction | Pulls up to 500 `raw_inputs` docs where `processed_at == null`, ordered by `timestamp` |
| Transform | Sentiment via `TextBlob` (`functions/etl_processor.py`) |
| Load | Writes deterministic docs (candidate slug + minute bucket) to `sentiment_breakdown` and `approval_ratings`, then sets `processed_at` + `processed_batch_id` on raw docs |

Current limitations motivating the next pass of **harden-etl**:
- Still relies on short minute buckets; daily/monthly aggregates should eventually be materialized for the frontend.
- Retention/backfill strategy for already processed docs (e.g., re-scoring historical inputs) is not defined yet.

## 4. Derived Data & Frontend Consumption

| Hook / Component | Collections | Notes |
| --- | --- | --- |
| `useApprovalData` | `approval_ratings` | Fetches bounded recent snapshots for dashboard cards |
| `useTrendsAllTime` | `approval_trends_monthly` | Reads ETL materialized monthly rollups, with a bounded snapshot fallback |
| `useSentiment` | `sentiment_breakdown` | Loads full history even though UI needs most recent per candidate |
| `useDemographics` | `state_demographics` | Reads entire collection hourly |
| Snapstats map | Static JSON (`/snapstats/state_demographics.json`) + GeoJSON via env URL | Duplicates Firestore demographic data |

Impacts:
- Frontend trend reads should stay on ETL rollups to control latency and cost.
- Lack of shared data services leads to duplicated shaping logic across hooks/components.

## 5. Static Assets & Snapstats

| Asset | Source | Issues |
| --- | --- | --- |
| `nigeria_states.geojson` | `/frontend/public/snapstats/` (manual drop) | Served via Hosting, referenced by env var |
| `derived/demographics.json` et al. | `scripts/convert_demographics_to_json.py` | Script points to `backend/legacy/...` which no longer exists, so regeneration is broken |
| Leaflet overlay demographics | `/snapstats/state_demographics.json` | Diverges from Firestore `state_demographics` |

Plan item **snapstats-pipeline** will unify these by sourcing data from the canonical CSV/Firestore set and automating exports.

## 6. Deploy/Operate

| Area | Current State | Needed Enhancements |
| --- | --- | --- |
| Dev ergonomics | Ad-hoc commands documented in README | Introduce repo-level task runner (`Taskfile.yml`) to standardize workflows |
| CI/CD | Manual `firebase deploy` | Future **ci-observability** task adds GitHub Actions to run frontend build + Python tests |
| Monitoring | Reliant on console logs | Need structured logging + Cloud Monitoring alerts for ETL failures |

## 7. Open Questions / Decisions

1. **Processed marker design** – prefer boolean flag vs. moving docs? Decision pending **harden-etl**.
2. **Data aggregation cadence** – monthly averages now calculated client-side; should ETL emit daily & monthly docs to simplify queries?
3. **Snapstats data source of truth** – confirm whether Firestore or CSV remains canonical; automation will differ accordingly.

Keep this document updated as each plan milestone lands so downstream contributors understand the latest contracts between frontend, backend, and data assets.

