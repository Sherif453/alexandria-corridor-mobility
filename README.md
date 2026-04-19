# Alexandria Corridor Mobility Intelligence

A full-stack traffic intelligence product for one fixed Alexandria corridor:

```text
Victoria -> Sidi Gaber -> Raml (Mahattet El Raml) / Abu Qir
```

The system collects live corridor traffic data, stores it in SQLite, builds
time-safe machine learning features, trains a real congestion model, serves
15-minute congestion predictions through the app, and compares baseline plus
four realistic traffic scenarios with SUMO.

This is not a mock dashboard. The production data path is:

```text
TomTom traffic readings
  -> SQLite raw observations
  -> Python feature snapshots
  -> trained ML model artifacts
  -> saved predictions
  -> Next.js API routes
  -> user-facing pages

SUMO scenario runs
  -> scenario artifacts
  -> SQLite scenario summaries
  -> scenario comparison page
```

## Product Scope

The app is intentionally limited to the Victoria to Sidi Gaber to Raml corridor.
All monitored points, APIs, predictions, and simulations stay inside that scope.

User-facing pages:

- Overview
- Live corridor
- History
- Next 15 minutes
- Scenarios
- Guidance

Core questions answered:

- What is happening on the corridor now?
- What congestion level is expected in the next 15 minutes?
- Which monitored areas are improving, stable, worsening, or uncertain?
- How would realistic disruptions or a mitigation plan change congestion if they
  happened now?

## Stack

- Next.js App Router
- React
- Tailwind CSS
- TypeScript
- Zod
- Next.js API routes on Node.js
- SQLite
- Prisma ORM
- node-cron
- Python for feature engineering, model training, prediction generation, and
  simulation
- SUMO for corridor scenario simulation
- Leaflet for mapping

No authentication is included by design. SQLite is the only application
database.

## Architecture

```text
app/
  pages and API routes

components/
  reusable UI components and page surfaces

lib/
  services, repositories, data contracts, corridor and scenario definitions

prisma/
  schema, migrations, SQLite database

scripts/
  ingestion and scheduled job entrypoints

python/
  features, models, simulation

data/
  raw provider payloads, processed model artifacts, scenario exports

tests/
  core flow tests
```

API routes are intentionally thin. They validate inputs, delegate to services,
and return stable JSON. UI components read from internal API routes only.

## Data Model

Main tables:

- `Segment`: fixed monitored corridor areas.
- `TrafficObservation`: raw normalized traffic readings.
- `FeatureSnapshot`: ML-ready feature rows.
- `Prediction`: saved next-15-minute congestion predictions.
- `ModelRun`: model training metadata and artifact paths.
- `ScenarioResult`: SUMO scenario summary metrics.
- `IngestionRun`: ingestion status, quota usage, and failures.

Raw observations, features, predictions, and scenario outputs are separate on
purpose so the system remains explainable and auditable.

## Environment

Create `.env` from `.env.example`.

Local and VPS baseline values:

```env
DATABASE_URL="file:./dev.db"
TOMTOM_API_KEY="your_tomtom_key"
TOMTOM_BASE_URL="https://api.tomtom.com"
TOMTOM_FLOW_VERSION="4"
TOMTOM_FLOW_STYLE="absolute"
TOMTOM_FLOW_ZOOM="12"
TOMTOM_FLOW_UNIT="kmph"
INGEST_TIMEZONE="Africa/Cairo"
INGEST_ACTIVE_START_HOUR_LOCAL="7"
INGEST_ACTIVE_END_HOUR_LOCAL="24"
INGEST_DAILY_REQUEST_CAP="2450"
INGEST_REQUEST_TIMEOUT_MS="10000"
INGEST_MAX_RETRIES="2"
BACKEND_API_BASE_URL=""
BACKEND_API_SECRET=""
BACKEND_API_TIMEOUT_MS="8000"
API_REQUIRE_BACKEND_SECRET="false"
BACKEND_PROXY_ADMIN_REFRESH_ENABLED="false"
ADMIN_REFRESH_ENABLED="false"
ADMIN_REFRESH_MAX_SECONDS="420"
```

Keep `ADMIN_REFRESH_ENABLED=false` in production. Since the app intentionally
has no authentication, manual operational work should be run through SSH.

For the hybrid Vercel frontend plus VPS backend setup:

- On Vercel, set `BACKEND_API_BASE_URL` to the public VPS backend URL, set the
  same `BACKEND_API_SECRET` used by the VPS, keep
  `BACKEND_PROXY_ADMIN_REFRESH_ENABLED=false`, and do not set the TomTom key.
- On the VPS, keep `BACKEND_API_BASE_URL=""`, set the same `BACKEND_API_SECRET`,
  and only set `API_REQUIRE_BACKEND_SECRET=true` after Vercel proxying is
  verified.
- Rotate `BACKEND_API_SECRET` if it is ever exposed.
- Vercel Git auto-deployments are disabled in `vercel.json`. Preview and
  production deployments should come from GitHub Actions only, after the CI
  verification job succeeds.

Future environment changes should be rare:

- Change `BACKEND_API_BASE_URL` only if the VPS backend domain changes.
- Change `BACKEND_API_SECRET` only when rotating the shared Vercel/VPS secret.
- Change `API_REQUIRE_BACKEND_SECRET` to `true` only after Vercel proxying is
  confirmed.
- Change `INGEST_DAILY_REQUEST_CAP` only if TomTom quota or sampling frequency
  changes.
- Do not change `DATABASE_URL`, `INGEST_TIMEZONE`, or the TomTom flow settings
  unless the project architecture or provider requirements change.

## Local Setup

Run from the project root:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

Install Python ML dependencies from the project root:

```bash
npm run python:setup
```

Install SUMO if you want to run scenario simulations locally in WSL:

```bash
sudo apt update
sudo apt install -y sumo sumo-tools
```

Start the local app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production VPS Operation

The real dataset lives on the VPS in:

```text
/opt/alex-mobility
```

SSH into the VPS:

```bash
ssh alex@207.180.201.109
cd /opt/alex-mobility
```

Update code:

```bash
git pull
npm install
npm run prisma:generate
npm run build
```

Run the full data pipeline manually:

```bash
npm run ingest:once
npm run features:build
npm run models:train
npm run predictions:generate
npm run scenarios:run
```

For routine prediction refresh after the model has already been trained:

```bash
npm run features:build
npm run predictions:generate
```

For scenario refresh:

```bash
npm run scenarios:run
```

## VPS Background Jobs

The VPS uses systemd timers for live collection, prediction refresh, scenario
refresh, model retraining, and backup.

Current production timers:

- `alex-ingest.timer`: collects TomTom readings every 15 minutes in the active
  window.
- `alex-predictions.timer`: builds features and generates latest 15-minute
  predictions every 15 minutes, offset after ingestion.
- `alex-scenarios.timer`: refreshes SUMO scenario metrics every 2 hours in the
  active window.
- `alex-model-refresh.timer`: rebuilds features, retrains the model, and
  regenerates predictions daily at 00:30.
- `alex-backup.timer`: writes daily backup archives.

User-facing freshness is tied to the same live window. During the active window,
recent traffic and prediction results can show as up to date. Outside the active
window, the app shows them as latest saved results until live collection resumes
at 07:00 Cairo time.

Check all timers:

```bash
systemctl list-timers --all | grep alex
```

Check service logs:

```bash
journalctl -u alex-ingest.service -n 80 --no-pager
journalctl -u alex-predictions.service -n 80 --no-pager
journalctl -u alex-scenarios.service -n 80 --no-pager
journalctl -u alex-model-refresh.service -n 80 --no-pager
journalctl -u alex-backup.service -n 80 --no-pager
```

Check database counts:

```bash
node -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); Promise.all([p.segment.count(),p.trafficObservation.count(),p.featureSnapshot.count(),p.prediction.count(),p.scenarioResult.count(),p.ingestionRun.count(),p.modelRun.count()]).then(([segments,observations,features,predictions,scenarios,ingestionRuns,modelRuns])=>{console.log(JSON.stringify({segments,observations,features,predictions,scenarios,ingestionRuns,modelRuns},null,2));}).finally(()=>p.$disconnect())'
```

## API Checks

Run on the VPS:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/traffic/latest
curl http://localhost:3000/api/traffic/history
curl http://localhost:3000/api/predictions/latest
curl http://localhost:3000/api/predictions/trend
curl http://localhost:3000/api/insights
curl http://localhost:3000/api/scenarios
curl http://localhost:3000/api/scenarios/baseline
curl http://localhost:3000/api/scenarios/lane-reduction
curl http://localhost:3000/api/scenarios/sidi-gaber-event-surge
curl http://localhost:3000/api/scenarios/shatby-raml-curbside-bottleneck
curl http://localhost:3000/api/scenarios/detour-mitigation
```

## Main Commands

```bash
npm run dev                  # local development server
npm run build                # production build
npm run start                # start production server after build
npm run lint                 # eslint
npm run typecheck            # TypeScript checks
npm test                     # core tests
npm run prisma:generate      # generate Prisma client
npm run prisma:migrate       # local migration workflow
npm run db:seed              # seed fixed corridor areas
npm run ingest:once          # collect one live traffic cycle
npm run ingest:scheduler     # node-cron scheduler
npm run python:setup         # install Python ML dependencies
npm run features:build       # build ML feature snapshots
npm run models:train         # train baseline and main models
npm run predictions:generate # write latest 15-minute predictions
npm run scenarios:run        # run SUMO scenarios and persist metrics
```

## Scenario Simulation

Scenario definitions live in:

```text
lib/scenarios/definitions.json
```

Current required scenarios:

- Current corridor baseline
- Lane reduction near Saba Pasha, Gleem, and Stanley
- Sidi Gaber event traffic surge
- Shatby to Raml curbside bottleneck
- Managed detour and signal support

The SUMO runner writes artifacts to:

```text
data/exports/scenarios/<scenario-version>/
```

The app reads summarized scenario metrics from SQLite through:

```text
GET /api/scenarios
GET /api/scenarios/[id]
```

## Testing And CI

Local verification:

```bash
npm run typecheck
npm run lint
npm test
python3 -m py_compile python/features/build_features.py python/models/train_baseline.py python/models/generate_predictions.py python/simulation/run_sumo_scenarios.py
npm run build
```

GitHub Actions runs:

- dependency install
- Prisma client generation
- migration deploy
- corridor seed
- TypeScript checks
- lint
- tests
- Python syntax checks
- production build

The CI intentionally does not call TomTom and does not run SUMO simulations.
This avoids spending API quota and keeps CI deterministic.

Vercel deploys are gated by the same workflow. Non-`main` pushes create preview
deployments only after verification passes. `main` pushes create production
deployments only after verification passes.

Required GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Demo Flow

Recommended demo walkthrough:

1. Open Overview and explain the fixed Alexandria corridor.
2. Open Live corridor and show real monitored areas.
3. Open History and show that readings are persisted over time.
4. Open Next 15 min and explain current vs expected congestion.
5. Open Guidance and show how a normal user should read and use the app.
6. Open Scenarios and compare baseline with the four traffic situations.
7. Mention the VPS ingestion timer, SQLite persistence, Python ML pipeline, and
   SUMO simulation pipeline.

## Current Limitations

- Prediction quality improves as more days of traffic data are collected.
- The first SUMO network is generated from the fixed monitored corridor points.
  It can later be refined with an OSM-derived SUMO network if time allows.
- Manual refresh exists as an API route but remains disabled by default because
  the app has no authentication.
