import "dotenv/config";

import { runTrafficIngestion } from "@/lib/services/ingestion-service";

async function main() {
  const summary = await runTrafficIngestion();
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
