import "dotenv/config";

import {
  backfillTrafficObservationCongestionLabels,
  parseBackfillCongestionArgs,
} from "@/lib/services/congestion-label-backfill-service";

async function main() {
  const args = parseBackfillCongestionArgs(process.argv.slice(2));
  const summary = await backfillTrafficObservationCongestionLabels(args);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
