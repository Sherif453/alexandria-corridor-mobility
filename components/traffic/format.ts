import type { LiveWindowPayload } from "@/lib/types/traffic";

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No data";
  }

  return value.toFixed(digits);
}

export function formatSpeed(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No data";
  }

  return `${value.toFixed(1)} km/h`;
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No data";
  }

  return `${Math.round(value * 100)}%`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "No time available";
  }

  return new Intl.DateTimeFormat("en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(new Date(value));
}

export function getLiveWindowOrDefault(
  liveWindow: LiveWindowPayload | null | undefined,
): LiveWindowPayload {
  return (
    liveWindow ?? {
      timezone: "Africa/Cairo",
      activeFromLocal: "07:00",
      activeUntilLocal: "00:00",
      isActiveNow: true,
      checkedAtUtc: new Date().toISOString(),
    }
  );
}

export function getCongestionTone(label: string | null | undefined) {
  if (label === "Low") {
    return "green" as const;
  }

  if (label === "Medium") {
    return "amber" as const;
  }

  if (label === "High") {
    return "red" as const;
  }

  return "slate" as const;
}

export function formatCongestionLabel(label: string | null | undefined): string {
  if (label === "Low") {
    return "Low congestion";
  }

  if (label === "Medium") {
    return "Medium congestion";
  }

  if (label === "High") {
    return "High congestion";
  }

  return "No data";
}
