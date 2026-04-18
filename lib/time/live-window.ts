import { getEnv } from "@/lib/env";

export type LiveWindowPayload = {
  timezone: string;
  activeFromLocal: string;
  activeUntilLocal: string;
  isActiveNow: boolean;
  checkedAtUtc: string;
};

function formatHour(hour: number): string {
  return `${String(hour % 24).padStart(2, "0")}:00`;
}

function getLocalHour(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;

  return hour ? Number(hour) : date.getUTCHours();
}

function isHourInsideWindow(params: {
  hour: number;
  startHour: number;
  endHour: number;
}) {
  if (params.endHour === 24) {
    return params.hour >= params.startHour;
  }

  if (params.startHour < params.endHour) {
    return params.hour >= params.startHour && params.hour < params.endHour;
  }

  return params.hour >= params.startHour || params.hour < params.endHour;
}

export function getLiveWindowPayload(now = new Date()): LiveWindowPayload {
  const env = getEnv();
  const localHour = getLocalHour(now, env.INGEST_TIMEZONE);

  return {
    timezone: env.INGEST_TIMEZONE,
    activeFromLocal: formatHour(env.INGEST_ACTIVE_START_HOUR_LOCAL),
    activeUntilLocal: formatHour(env.INGEST_ACTIVE_END_HOUR_LOCAL),
    isActiveNow: isHourInsideWindow({
      hour: localHour,
      startHour: env.INGEST_ACTIVE_START_HOUR_LOCAL,
      endHour: env.INGEST_ACTIVE_END_HOUR_LOCAL,
    }),
    checkedAtUtc: now.toISOString(),
  };
}

export type FreshnessStatus = "fresh" | "stale" | "saved" | "empty";

export function getWindowAwareFreshnessStatus(params: {
  latestTimestampUtc: Date | null;
  liveWindow: LiveWindowPayload;
  freshForMinutes: number;
}): FreshnessStatus {
  if (!params.latestTimestampUtc) {
    return "empty";
  }

  if (!params.liveWindow.isActiveNow) {
    return "saved";
  }

  const ageMinutes = (Date.now() - params.latestTimestampUtc.getTime()) / 60_000;

  return ageMinutes <= params.freshForMinutes ? "fresh" : "stale";
}
