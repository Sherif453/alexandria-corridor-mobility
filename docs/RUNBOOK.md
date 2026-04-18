# VPS Runbook

This runbook is the operational checklist for running Alexandria Corridor
Mobility Intelligence against the real VPS dataset.

The production data location is:

```text
/opt/alex-mobility
```

The VPS user is:

```text
alex
```

## 1. Connect To The VPS

Run this from Windows PowerShell:

```powershell
ssh alex@207.180.201.109
```

Then run this on the VPS:

```bash
cd /opt/alex-mobility
```

All application, database, ML, prediction, and scenario commands in this
runbook must be run from `/opt/alex-mobility`.

## 2. Check Runtime Health

Check that the server clock is correct:

```bash
timedatectl
```

Expected timezone:

```text
Africa/Cairo
```

Check active project timers:

```bash
systemctl list-timers --all | grep alex
```

Expected timers:

```text
alex-ingest.timer
alex-backup.timer
```

Check recent ingestion logs:

```bash
journalctl -u alex-ingest.service -n 80 --no-pager
```

Healthy active-window runs should show:

```text
"status": "success"
"recordedObservations": 35
"failures": 0
```

Outside the active window, this is expected and safe:

```text
"status": "skipped_outside_active_window"
```

Check recent backup logs:

```bash
journalctl -u alex-backup.service -n 80 --no-pager
```

Check latest backup files:

```bash
ls -lah backups/latest
ls -lah backups/daily | tail
```

## 3. Check Data Counts

Run from `/opt/alex-mobility`:

```bash
node -e 'const {PrismaClient}=require("@prisma/client"); const p=new PrismaClient(); Promise.all([p.segment.count(),p.trafficObservation.count(),p.featureSnapshot.count(),p.prediction.count(),p.scenarioResult.count(),p.ingestionRun.count(),p.modelRun.count()]).then(([segments,observations,features,predictions,scenarios,ingestionRuns,modelRuns])=>{console.log(JSON.stringify({segments,observations,features,predictions,scenarios,ingestionRuns,modelRuns},null,2));}).finally(()=>p.$disconnect())'
```

Expected fixed value:

```text
segments: 35
```

The other counts should increase as ingestion, feature building, prediction
generation, and scenario runs continue.

## 4. Update Code On The VPS

Run from `/opt/alex-mobility`:

```bash
git pull
npm install
npm run prisma:generate
npm run build
```

If migrations changed, run:

```bash
npm run prisma:migrate
```

For the current project stage, the active migration path is still the developer
workflow because the app uses SQLite and Prisma's local migration flow.

## 5. Run The Complete Data Pipeline

Use this when you want to refresh everything end-to-end from the current VPS
database.

Run from `/opt/alex-mobility`:

```bash
npm run db:seed
npm run ingest:once
npm run features:build
npm run models:train
npm run predictions:generate
npm run scenarios:run
```

What each command does:

- `npm run db:seed` makes sure the fixed 35 monitored corridor points exist.
- `npm run ingest:once` collects one current TomTom reading cycle.
- `npm run features:build` rebuilds ML feature rows from SQLite observations.
- `npm run models:train` trains and saves the congestion model artifacts.
- `npm run predictions:generate` writes latest next-15-minute predictions.
- `npm run scenarios:run` runs SUMO scenarios and saves comparison metrics.

## 6. Run A Routine Prediction Refresh

Use this after the model has already been trained and you only need fresh
predictions from the latest observations.

Run from `/opt/alex-mobility`:

```bash
npm run features:build
npm run predictions:generate
```

## 7. Run A Scenario Refresh

Check SUMO first:

```bash
command -v sumo
command -v netconvert
```

If either command is missing on the VPS, install SUMO:

```bash
sudo apt update
sudo apt install -y sumo sumo-tools
```

Then run:

```bash
npm run scenarios:run
```

Artifacts are written to:

```text
data/exports/scenarios/<scenario-version>/
```

Summaries are written to SQLite and exposed by:

```text
GET /api/scenarios
GET /api/scenarios/[id]
```

## 8. Start The App Against VPS Data

Use the VPS app because the real SQLite data is on the VPS.

From Windows PowerShell, create an SSH tunnel. Use local port `3001` to avoid
conflicts with any app already running on your laptop:

```powershell
ssh -L 3001:localhost:3000 alex@207.180.201.109
```

After the SSH session opens, run this on the VPS:

```bash
cd /opt/alex-mobility
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

Then open this on your Windows browser:

```text
http://localhost:3001
```

This keeps the app private to your SSH tunnel instead of exposing port `3000`
publicly.

For development-only inspection, you can use:

```bash
npm run dev -- -H 127.0.0.1 -p 3000
```

Production preview should use `npm run build` followed by `npm run start`.

For a no-monthly-fee public host, use the decision guide in:

```text
docs/FREE_PUBLIC_DEPLOYMENT.md
```

## 9. API Checks While The App Is Running

Run these on the VPS in another SSH session, or through the tunneled local app:

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

If using the SSH tunnel from Windows, replace `3000` with `3001`.

## 10. Admin Refresh Route Policy

Keep this value in `.env`:

```env
ADMIN_REFRESH_ENABLED="false"
```

The project intentionally has no authentication. Because of that, the refresh
API must not be publicly enabled on the VPS. Manual refresh work should be done
through SSH with npm scripts.

## 11. Troubleshooting

If `npm run scenarios:run` says a command is missing, install SUMO:

```bash
sudo apt update
sudo apt install -y sumo sumo-tools
```

If Prisma says `DATABASE_URL` is missing, check `/opt/alex-mobility/.env`:

```bash
grep DATABASE_URL .env
```

Expected:

```env
DATABASE_URL="file:./dev.db"
```

If ingestion records zero observations during the day, check:

```bash
grep TOMTOM_API_KEY .env
grep INGEST_ACTIVE .env
journalctl -u alex-ingest.service -n 120 --no-pager
```

If the app starts but pages show stale predictions, run:

```bash
npm run features:build
npm run predictions:generate
```

If scenario pages have no scenario results, run:

```bash
npm run scenarios:run
```

If port `3000` is already used on your laptop, tunnel to `3001`:

```powershell
ssh -L 3001:localhost:3000 alex@207.180.201.109
```

Then open:

```text
http://localhost:3001
```

## 12. Final Demo Flow

Use this order when presenting the project:

1. Open the overview page and show corridor status.
2. Open the live corridor page and show the fixed monitored locations.
3. Open the history page and show observed patterns.
4. Open the predictions page and explain the next 15-minute congestion levels.
5. Open the guidance page and explain how users should read the app.
6. Open the scenarios page and compare baseline with the four traffic situations.
