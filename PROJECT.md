# Alexandria Corridor Mobility Intelligence

## Project overview

Alexandria Corridor Mobility Intelligence is a full-stack decision-support web
application focused on a single Alexandria traffic corridor. The system ingests
live corridor traffic observations, stores raw and derived records in SQLite
through Prisma, trains machine learning models for near-future congestion
prediction, and presents current conditions, historical patterns, predictions,
insights, and scenario analysis through a Next.js application.

This document is the living project reference for the repository. It records the
scope, architecture, data model, implementation status, and open design
decisions.

## Final scope

The project scope is limited to the
`Victoria -> Sidi Gaber -> Raml (Mahattet El Raml)` corridor.

The core product questions are:

- What congestion level is likely on the corridor in the next 15-30 minutes?
- How do corridor conditions change over time?
- How do baseline, disruption, and mitigation scenarios compare?

The primary prediction target is a `Low / Medium / High` congestion class for
the next 15 minutes by default, with 30-minute support only if the data quality
supports it.

The product surfaces are:

- Home / overview
- Live corridor map
- Historical analytics
- Prediction page
- Scenario comparison page
- Insights page
- Methodology page

The required backend capabilities are:

- Live corridor ingestion
- SQLite persistence
- Feature engineering
- Model training and evaluation
- Prediction refresh and storage
- Scenario simulation with SUMO
- Read-only APIs for product pages
- Manual refresh trigger

The required outputs are:

- Latest traffic state
- Historical traffic trends
- Saved predictions with confidence
- Trend summary and insight text
- Baseline vs disruption vs mitigation scenario deltas
- Explainable system status, freshness, and quota state

## Non-negotiable constraints

The project remains fixed to the following constraints:

- Corridor scope remains unchanged.
- No authentication is part of the project.
- SQLite remains the only application database.
- PostgreSQL, Supabase, Firebase, and other external databases are outside the
  scope.
- The backend remains Next.js API routes / Node.js based.
- FastAPI, Express, NestJS, or a separate backend server are not part of the
  current architecture.
- The stack remains:

  - Next.js App Router
  - React
  - Tailwind CSS
  - Next.js API routes / Node.js
  - TypeScript
  - Zod
  - SQLite
  - Prisma ORM
  - node-cron
  - Python scripts/modules for ML and simulation
  - SUMO for scenario simulation
- The frontend does not talk directly to the external traffic provider.
- The frontend is not the source of truth.
- Raw observations, processed features, predictions, and scenario outputs remain
  separate.
- Time-based train/validation/test splits are used for ML.
- Streaming infrastructure is not part of the base design.
- Features are only considered complete after working end-to-end.

## Tech stack

The selected stack is:

- Frontend: Next.js App Router, React, Tailwind CSS
- Backend: Next.js API routes, Node.js runtime, TypeScript, Zod
- Database: SQLite with Prisma ORM
- Scheduled jobs: node-cron
- ML and feature engineering: Python modules/scripts
- Simulation: Python + SUMO
- Mapping: Leaflet

## System architecture

The repository is structured as a single Next.js application with supporting
Python and job folders.

### Runtime boundaries

- Next.js app: renders pages and client components, while reading data only
  through internal API routes.
- Next.js API routes: validate inputs with Zod, delegate logic to services and
  repositories, and return stable JSON.
- Node scheduled jobs: manage traffic ingestion, quota tracking, and
  orchestration for refresh and inference.
- Python ML pipeline: prepares data, engineers features, trains models,
  evaluates performance, and writes model metadata and artifacts.
- Python inference pipeline: scores the latest corridor state and writes
  predictions and confidence values to SQLite.
- Python + SUMO simulation pipeline: runs baseline, disruption, and mitigation
  scenarios and writes scenario summaries and exportable artifacts.
- SQLite + Prisma: stores operational records, raw data, derived features,
  predictions, runs, and scenario summaries.

### Target module responsibilities

- `app/`: route segments, layouts, pages, and page-level data fetching from
  internal APIs.
- `app/api/`: typed API endpoints.
- `components/`: reusable UI components such as cards, badges, tables, empty
  states, charts, and map wrappers.
- `lib/`: shared application logic.
- `lib/db.ts`: Prisma client initialization.
- `lib/services/`: use-case orchestration.
- `lib/repositories/`: database read/write logic.
- `lib/analytics/`: shared aggregation and trend helpers.
- `lib/cache/`: cache helpers for hot endpoints.
- `prisma/`: Prisma schema, migrations, and SQLite database file location
  strategy.
- `scripts/`: Node/TypeScript entrypoints for ingestion, inference
  orchestration, exports, and operational tasks.
- `python/features/`: feature engineering pipeline.
- `python/models/`: training, evaluation, artifact serialization, and inference
  helpers.
- `python/simulation/`: SUMO scenario orchestration and metric extraction.
- `data/raw/`: raw dumps and auditable raw artifacts.
- `data/processed/`: feature and intermediate processed outputs.
- `data/exports/`: reports, scenario exports, metrics, and generated artifacts.
- `tests/`: core flow tests.
- `docs/`: architecture, API, schema, and methodology notes.

## Data flow

The application data flow is:

1. Scheduled ingestion polls the approved traffic source for fixed corridor
   sample points during the active daily window.
2. Each ingestion run is recorded in `ingestion_runs`.
3. Raw observations are normalized and stored in `traffic_observations` with UTC
   timestamps and source metadata.
4. Feature generation produces versioned `feature_snapshots` from the historical
   traffic data.
5. Training jobs consume the feature snapshots, run time-based evaluation, save
   artifacts, and write metadata to `model_runs`.
6. Inference jobs score the latest corridor state and store results in
   `predictions`.
7. Scenario jobs run SUMO-based baseline, disruption, and mitigation cases and
   persist summarized metrics in `scenario_results`.
8. Next.js API routes read from repositories and services and return stable JSON
   payloads.
9. Frontend pages poll the API and present status, freshness, confidence, trend
   summaries, and scenario deltas.

## Database schema

SQLite is the application database, and Prisma is the standard access layer for
structured reads and writes.

### Core tables

#### `segments`

The `segments` table represents monitored corridor entities and their ordering.
It includes `segment_id`, `road_name`, geometry references, `road_type`,
`lat/lon`, and `order`.

#### `traffic_observations`

The `traffic_observations` table stores raw traffic samples. It includes `id`,
`segment_id`, `timestamp`, `speed`, `free_flow_speed`, `congestion_label`, and
`source`.

#### `feature_snapshots`

The `feature_snapshots` table stores prepared ML rows. It includes `id`,
`segment_id`, `timestamp`, feature columns, `target`, and `feature_version`.

#### `predictions`

The `predictions` table stores saved model outputs. It includes `id`,
`segment_id`, `timestamp`, `predicted_label`, `confidence`, and `model_version`.

#### `scenario_results`

The `scenario_results` table stores simulation summaries. It includes
`scenario_id`, `metric_name`, `metric_value`, `notes`, and `scenario_version`.

#### `ingestion_runs`

The `ingestion_runs` table stores ingestion operational tracking data. It
includes `run_id`, `started_at`, `ended_at`, `status`, `quota_usage`, and
`error_message`.

#### `model_runs`

The `model_runs` table stores training and scoring metadata. It includes
`run_id`, `model_name`, `version`, `dataset_range`, `metrics_json`, and
`artifact_path`.

### Database rules

- Schema design remains minimal and explicit.
- Timestamps are stored in UTC.
- Raw observations are preserved and never overwritten by derived values.
- Latest prediction serving logic remains separate from historical prediction
  storage.
- Quota state, failures, and data quality are retained so missing data can be
  explained.

## API contract

API routes remain thin, typed, Zod-validated, and stable.

### Required routes

#### `GET /api/health`

Deployment and runtime check endpoint.

#### `GET /api/segments`

Returns corridor segment metadata and geometry references.

#### `GET /api/traffic/latest`

Returns the latest corridor traffic state.

#### `GET /api/traffic/history`

Returns historical observations and summary data.

#### `GET /api/predictions/latest`

Returns the latest congestion forecast and confidence.

#### `GET /api/predictions/trend`

Returns a direction-of-change summary with a short explanation.

#### `GET /api/insights`

Returns rule-based and model-informed decision-support text.

#### `GET /api/scenarios`

Returns the list of available baseline, disruption, and mitigation cases.

#### `GET /api/scenarios/[id]`

Returns scenario metrics, deltas, assumptions, and visualization-ready data.

#### `POST /api/admin/refresh`

Triggers manual ingestion or inference refresh when enabled.

### API implementation rules

- All user input is validated with Zod.
- Route handlers delegate to services and repositories.
- UI components do not access the database directly.
- Response shapes remain predictable and version-stable.
- Shared TypeScript response models are used where practical.
- Hot read endpoints may use caching when underlying data is unchanged.

## Frontend pages

### Home / overview

This page summarizes corridor health and shows the latest status cards, current
congestion summary, update timestamp, and navigation shortcuts.

### Live corridor map

This page shows monitored segments and live state through an interactive map,
segment visualization, color-coded state, and hover/detail surfaces.

### Historical analytics

This page reveals patterns and seasonality using time-of-day charts, day-of-week
patterns, and heatmaps.

### Prediction page

This page shows the next 15-30 minute forecast with the predicted class,
confidence, timestamp, explanation, and trend indicator.

### Scenario page

This page compares baseline versus disruption versus mitigation using metric
tables, deltas, and before/after charts.

### Insights page

This page turns the data into advice by combining auto-generated
recommendations, caveats, and reliability context.

### Methodology page

This page explains the scope, data sources, limitations, and model summary.

### Cross-page UX requirements

The interface includes a last-updated timestamp, a freshness badge, a manual
refresh button, a confidence chip, a recent-change summary, and empty-state
guidance for sparse data.

## ML pipeline

### Prediction target

The primary prediction target is a `Low / Medium / High` next-horizon congestion
class. The default horizon is 15 minutes, with 30-minute support only when the
data supports it.

### Feature set

The model uses `segment_id`, `hour_of_day`, `day_of_week`, `weekend_flag`,
`holiday/custom flag` if available, recent observed speed, rolling mean speed,
rolling standard deviation, speed relative to free-flow speed, change rate over
recent observations, incident flag if available, and road type or segment
category.

### Model strategy

The model strategy uses logistic regression as the baseline, random forest as
the main practical model, and optional XGBoost only if it clearly outperforms
the baseline and remains supportable.

### Evaluation rules

Evaluation relies on time-based train/validation/test splits only. Metrics
include macro F1, accuracy, confusion matrix, and comparison against a naive
last-class baseline.

### ML storage and serving expectations

Feature rows are stored in `feature_snapshots`. Artifacts are stored on disk
with versioning. Metadata remains in `model_runs`. Scored forecasts are stored
in `predictions`. Confidence and uncertainty are surfaced in product responses.

## Simulation pipeline

Simulation remains a required analysis module rather than the core runtime
dependency.

### Required scenarios

- Baseline corridor conditions
- Lane reduction or partial closure
- Temporary detour or mitigation strategy
- Optional replacement-bus or modal-shift assumption when supportable

### Required outputs

- Travel time
- Delay
- Queue length
- Relative performance change

### Storage and exposure

Scenario summaries are stored in `scenario_results`, and scenario data is
exposed through the scenario API routes and the frontend comparison page.

## Quota strategy

TomTom quota control is part of the core design.

### Fixed formula

`sample_points x polls_per_hour x active_hours_per_day <= 2,500`

### Recommended safe configuration

- Sample points: 35
- Poll frequency: every 15 minutes, or 4 times per hour
- Active hours per day: 17
- Total requests per day: 2,380
- Safety buffer: approximately 70 requests below the 2,450 stop-before-cap

### Hard quota protection

The design includes a fixed active window, a stop point around 2,450 requests
per day, SQLite-based request tracking, reset logic at the daily boundary, and
clean stop behavior when the limit is reached.

### Sampling and optimization

The sampling strategy remains fixed at 30-36 corridor points, reuses the same
points every day, avoids dynamic expansion at runtime, prevents duplicate calls
per segment within the same interval, and keeps the frontend isolated from the
external provider.

## Repository structure

### Target repository structure

```text
alex-mobility/
  app/
    api/
    (routes, pages, layouts)
  components/
  lib/
    db.ts
    services/
    repositories/
    analytics/
    cache/
  prisma/
  scripts/
    ingest/
    infer/
    export/
  python/
    features/
    models/
    simulation/
  data/
    raw/
    processed/
    exports/
  public/
  tests/
  docs/
  README.md
  PROJECT.md
```

## Implementation roadmap

### Week 1

The first week centers on scope freeze, repo skeleton, architecture contract,
Next.js initialization, Prisma and SQLite setup, corridor segment strategy, and
initial documentation.

### Week 2

The second week centers on traffic source integration, monitored sample points,
quota-safe scheduled ingestion, raw observation persistence, and the latest
traffic endpoint.

### Week 3

The third week centers on the frontend baseline, live corridor surfaces,
freshness status, data inspection, and historical analytics routes and pages.

### Week 4

The fourth week centers on feature engineering, dataset construction, baseline
model training, time-based evaluation, artifact storage, and the first
prediction-serving path.

### Week 5

The fifth week centers on inference integration, prediction storage, latest
prediction and trend APIs, prediction and insights pages, confidence surfaces,
and caching.

### Week 6

The sixth week centers on SUMO integration, baseline/disruption/mitigation
scenarios, scenario persistence, scenario APIs, and the comparison UI.

### Week 7

The seventh week centers on placeholder removal, real API integration across
pages, refactoring, tests, freshness and quota indicators, and export paths
where helpful.

### Week 8

The eighth week centers on README finalization, screenshots, QA, demo
preparation, and release freeze.

## Milestone checklist

- [x] Read PDF roadmap and extract implementation contract
- [x] Create and populate `PROJECT.md`
- [x] Align repo skeleton
- [x] Initialize Next.js App Router + TypeScript + Tailwind app
- [x] Add Prisma schema and SQLite configuration
- [x] Define corridor segments and sample point plan
- [x] Implement ingestion pipeline with quota protection
- [x] Persist raw observations
- [x] Implement `/api/health`
- [x] Implement `/api/segments`
- [x] Implement `/api/traffic/latest`
- [x] Implement `/api/traffic/history`
- [x] Build home / overview page
- [x] Build live corridor map page
- [x] Build historical analytics page
- [ ] Implement feature engineering pipeline
- [ ] Train baseline models and save metrics/artifacts
- [ ] Implement prediction persistence
- [ ] Implement `/api/predictions/latest`
- [ ] Implement `/api/predictions/trend`
- [ ] Build prediction page
- [ ] Implement `/api/insights`
- [ ] Build insights page
- [ ] Implement scenario pipeline with SUMO
- [ ] Implement `/api/scenarios`
- [ ] Implement `/api/scenarios/[id]`
- [ ] Build scenario comparison page
- [ ] Build methodology page
- [ ] Implement `/api/admin/refresh`
- [ ] Add tests for core flows
- [ ] Finalize docs, screenshots, and run instructions

## Open questions

The following items remain open:

- Exact monitored sample point coordinates
  - A fixed set of 35 monitored points is now defined in
    `lib/corridor/definition.ts`.
  - The current coordinates follow a documented corridor polyline through
    Victoria, Bakos, Saba Pasha, Sidi Gaber, Sporting, Camp Caesar, Shatby, and
    El Raml.
  - The remaining open part is whether they should later be refined to exact
    road-centerline monitoring coordinates after live ingestion is running
    reliably.

- SUMO network import workflow and preprocessing path
  - Use OSM corridor extraction → network cleaning → SUMO export/import →
    scenario setup → metrics extraction.
  - The high-level pipeline is defined, but the exact tooling and scripts for
    converting and preparing the corridor network for SUMO remain to be
    finalized during implementation.

## Decisions made

- `PROJECT.md` is a living project reference and remains aligned with the
  codebase.
- The project remains single-corridor and single-repository.
- The corridor is modeled as an ordered chain of monitored segments spanning,
  Victoria → Sidi Gaber → Raml (Mahattet El Raml).
- No authentication is included.
- SQLite + Prisma remains the only application database path.
- Next.js API routes remain the only backend HTTP interface.
- Python remains the ML and simulation layer.
- SUMO remains the simulation requirement.
- Frontend data comes only from internal API routes.
- Raw observations, features, predictions, and scenario outputs remain separate
  data layers.
- Time-based evaluation is mandatory.
- Leaflet is the selected mapping library.
- TomTom is the external traffic source.
- Prisma is pinned to `6.19.3` for the current implementation baseline because
  it keeps the standard SQLite + `.env` + `schema.prisma` workflow stable and
  avoids Prisma 7 config changes that do not add product value for this MVP.
- The corridor source of truth now lives in `lib/corridor/definition.ts` and is
  seeded into SQLite through `prisma/seed.ts`.
- The current corridor monitoring plan uses 35 fixed points in a strict ordered
  chain across Victoria -> Sidi Gaber -> Raml.
- Each monitored point now has a user-facing locality label instead of the
  generic corridor road name.
- The current corridor geometry no longer uses a straight anchor interpolation.
  It now samples a route polyline built from map-evidenced localities along the
  Alexandria east-west urban axis.
- The ingestion foundation uses TomTom Flow Segment Data v4, a stop-before-cap
  daily quota guard, a rolling 24-hour quota usage check, and a local active
  window of 07:00-24:00 in `Africa/Cairo`.
- The scheduler no longer forces an extra startup ingestion run, and it skips
  new cron ticks if the previous run is still active.
- Raw ingestion payloads are written to `data/raw/tomtom/<YYYY-MM-DD>/` and
  normalized observations are written to SQLite when the TomTom key is present.
- The congestion class thresholds are based on speed ratio to free-flow speed:
  High below 0.4, Medium from 0.4 to 0.7, and Low above 0.7. First working
  thresholds and revisit only if the data suggests better cutoffs.
- Historical analytics uses 15-minute raw windows, hourly aggregation, and daily
  aggregation.
- Traffic read APIs now expose the latest per-segment corridor state plus
  bounded historical raw, hourly, and daily views from SQLite.
- The frontend baseline now contains final-route surfaces for overview, live
  corridor state, and historical analytics, all reading internal API routes.
- The live corridor page uses Leaflet for geographic corridor visualization.

## Risks and mitigations

### Too little traffic data

Weak model quality and weak insights remain the main risk. Early ingestion and
parallel development reduce the impact.

### TomTom quota exhaustion

If the quota is exceeded, data gaps and downtime follow. Fixed sample points,
quota tracking, and stop-before-cap behavior address this risk.

### Scope creep

Scope creep can make the project unfinishable. The corridor and scenario set
remain fixed to control this risk.

### Notebook-only behavior

A notebook-only build would reduce product value. API, database, and frontend
integration keep the project product-oriented.

### Model overfitting

Overfitting would weaken real-world usefulness. Time-based splits and a naive
baseline comparison reduce this risk.

### Unclear user value

A visually polished but shallow dashboard would not be useful. The project
emphasizes predictions, trends, confidence, freshness, and scenario deltas.

## Run instructions

Current working setup commands:

- Install dependencies: `npm install`
- Start the app locally: `npm run dev`
- Lint the repository: `npm run lint`
- Run type checks: `npm run typecheck`
- Generate Prisma client: `npm run prisma:generate`
- Run Prisma migrations locally: `npm run prisma:migrate`
- Seed the corridor segments into SQLite: `npm run db:seed`
- Run one ingestion cycle: `npm run ingest:once`
- Start the ingestion scheduler: `npm run ingest:scheduler`
- Open Prisma Studio: `npx prisma studio`

Still pending:

- Feature generation workflow
- Model training workflow
- Inference workflow
- Scenario generation workflow

## Future notes

- XGBoost remains optional only if it clearly beats the baseline and can be
  supported cleanly.
- A fourth scenario remains optional only if it is relevant and supportable.
- CSV or JSON export paths are useful but secondary to the required core flows.
