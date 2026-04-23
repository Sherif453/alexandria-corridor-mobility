import { prisma } from "@/lib/db";
import { getCongestionLabel } from "@/lib/services/ingestion-service";

export type BackfillCongestionArgs = {
  apply: boolean;
  batchSize: number;
};

type ObservationLabelRecord = {
  id: string;
  speed: number | null;
  freeFlowSpeed: number | null;
  congestionLabel: string | null;
};

type PlannedCongestionLabelUpdate = {
  id: string;
  previousLabel: string | null;
  nextLabel: string | null;
};

type BackfillSummary = {
  scanned: number;
  unchanged: number;
  updates: number;
  changeCounts: Record<string, number>;
};

const DEFAULT_BATCH_SIZE = 500;

function formatLabel(label: string | null) {
  return label ?? "null";
}

function incrementCount(counts: Record<string, number>, key: string, value = 1) {
  counts[key] = (counts[key] ?? 0) + value;
}

export function parseBackfillCongestionArgs(argv: string[]): BackfillCongestionArgs {
  let apply = false;
  let batchSize = DEFAULT_BATCH_SIZE;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
      continue;
    }

    if (arg.startsWith("--batch-size=")) {
      const rawValue = arg.slice("--batch-size=".length);
      const parsed = Number.parseInt(rawValue, 10);

      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`Invalid --batch-size value: ${rawValue}`);
      }

      batchSize = parsed;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    apply,
    batchSize,
  };
}

export function buildCongestionLabelBackfillPlan(records: ObservationLabelRecord[]): {
  updates: PlannedCongestionLabelUpdate[];
  summary: BackfillSummary;
} {
  const updates: PlannedCongestionLabelUpdate[] = [];
  const summary: BackfillSummary = {
    scanned: records.length,
    unchanged: 0,
    updates: 0,
    changeCounts: {},
  };

  for (const record of records) {
    const nextLabel = getCongestionLabel(record.speed, record.freeFlowSpeed);

    if (record.congestionLabel === nextLabel) {
      summary.unchanged += 1;
      continue;
    }

    updates.push({
      id: record.id,
      previousLabel: record.congestionLabel,
      nextLabel,
    });

    summary.updates += 1;
    incrementCount(
      summary.changeCounts,
      `${formatLabel(record.congestionLabel)}=>${formatLabel(nextLabel)}`,
    );
  }

  return {
    updates,
    summary,
  };
}

function mergeBackfillSummaries(
  left: BackfillSummary,
  right: BackfillSummary,
): BackfillSummary {
  const mergedChangeCounts = { ...left.changeCounts };

  for (const [key, value] of Object.entries(right.changeCounts)) {
    incrementCount(mergedChangeCounts, key, value);
  }

  return {
    scanned: left.scanned + right.scanned,
    unchanged: left.unchanged + right.unchanged,
    updates: left.updates + right.updates,
    changeCounts: mergedChangeCounts,
  };
}

export async function backfillTrafficObservationCongestionLabels(
  params: BackfillCongestionArgs,
) {
  let cursorId: string | undefined;
  let totalSummary: BackfillSummary = {
    scanned: 0,
    unchanged: 0,
    updates: 0,
    changeCounts: {},
  };

  while (true) {
    const rows = await prisma.trafficObservation.findMany({
      select: {
        id: true,
        speed: true,
        freeFlowSpeed: true,
        congestionLabel: true,
      },
      orderBy: {
        id: "asc",
      },
      take: params.batchSize,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
    });

    if (rows.length === 0) {
      break;
    }

    const { updates, summary } = buildCongestionLabelBackfillPlan(rows);
    totalSummary = mergeBackfillSummaries(totalSummary, summary);

    if (params.apply && updates.length > 0) {
      await prisma.$transaction(
        updates.map((update) =>
          prisma.trafficObservation.update({
            where: {
              id: update.id,
            },
            data: {
              congestionLabel: update.nextLabel,
            },
          }),
        ),
      );
    }

    cursorId = rows.at(-1)?.id;
  }

  return {
    status: "ok" as const,
    apply: params.apply,
    batchSize: params.batchSize,
    scanned: totalSummary.scanned,
    unchanged: totalSummary.unchanged,
    updatesNeeded: totalSummary.updates,
    updatesApplied: params.apply ? totalSummary.updates : 0,
    changeCounts: totalSummary.changeCounts,
  };
}
