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
    return "Moderate congestion";
  }

  if (label === "High") {
    return "Heavy congestion";
  }

  return "No data";
}
