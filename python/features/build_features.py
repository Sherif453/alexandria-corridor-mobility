#!/usr/bin/env python3
"""Build time-safe feature snapshots from stored traffic observations."""

from __future__ import annotations

import argparse
import json
import math
import os
import sqlite3
import statistics
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


DEFAULT_FEATURE_VERSION = "features.v1"
DEFAULT_ROLLING_WINDOW = 4
DEFAULT_TARGET_HORIZON_MINUTES = 15
DEFAULT_MIN_TARGET_GAP_MINUTES = 10
DEFAULT_MAX_TARGET_GAP_MINUTES = 35


@dataclass(frozen=True)
class Segment:
  segment_id: str
  road_type: str | None


@dataclass(frozen=True)
class Observation:
  segment_id: str
  timestamp_utc: datetime
  speed: float | None
  free_flow_speed: float | None
  congestion_label: str | None
  quality_status: str | None


@dataclass(frozen=True)
class FeatureRow:
  segment_id: str
  timestamp_utc: datetime
  hour_of_day: int
  day_of_week: int
  weekend_flag: bool
  holiday_flag: bool
  recent_observed_speed: float
  rolling_mean_speed: float
  rolling_std_speed: float | None
  relative_to_free_flow: float
  speed_change_rate: float | None
  incident_flag: bool
  road_category: str | None
  target: str | None
  feature_version: str


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Generate FeatureSnapshot rows from TrafficObservation rows.",
  )
  parser.add_argument(
    "--database-url",
    default=os.environ.get("DATABASE_URL"),
    help="SQLite database URL. Defaults to DATABASE_URL from env or .env.",
  )
  parser.add_argument(
    "--feature-version",
    default=DEFAULT_FEATURE_VERSION,
    help=f"Feature version written to FeatureSnapshot. Default: {DEFAULT_FEATURE_VERSION}.",
  )
  parser.add_argument(
    "--rolling-window",
    type=int,
    default=DEFAULT_ROLLING_WINDOW,
    help=f"Number of current/past observations used for rolling stats. Default: {DEFAULT_ROLLING_WINDOW}.",
  )
  parser.add_argument(
    "--target-horizon-minutes",
    type=int,
    default=DEFAULT_TARGET_HORIZON_MINUTES,
    help=f"Nominal prediction horizon in minutes. Default: {DEFAULT_TARGET_HORIZON_MINUTES}.",
  )
  parser.add_argument(
    "--min-target-gap-minutes",
    type=int,
    default=DEFAULT_MIN_TARGET_GAP_MINUTES,
    help=f"Minimum future gap accepted as a target. Default: {DEFAULT_MIN_TARGET_GAP_MINUTES}.",
  )
  parser.add_argument(
    "--max-target-gap-minutes",
    type=int,
    default=DEFAULT_MAX_TARGET_GAP_MINUTES,
    help=f"Maximum future gap accepted as a target. Default: {DEFAULT_MAX_TARGET_GAP_MINUTES}.",
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Build and report features without writing FeatureSnapshot rows.",
  )

  return parser.parse_args()


def read_dotenv(root_dir: Path) -> dict[str, str]:
  env_path = root_dir / ".env"

  if not env_path.exists():
    return {}

  values: dict[str, str] = {}

  for line in env_path.read_text(encoding="utf-8").splitlines():
    stripped = line.strip()

    if not stripped or stripped.startswith("#") or "=" not in stripped:
      continue

    key, value = stripped.split("=", 1)
    values[key.strip()] = value.strip().strip("\"'")

  return values


def resolve_database_path(root_dir: Path, database_url: str | None) -> Path:
  resolved_url = database_url or read_dotenv(root_dir).get("DATABASE_URL")

  if not resolved_url:
    raise ValueError("DATABASE_URL is required. Set it in .env or pass --database-url.")

  if not resolved_url.startswith("file:"):
    raise ValueError("Only SQLite file: DATABASE_URL values are supported.")

  raw_path = resolved_url.removeprefix("file:")

  if raw_path.startswith("//"):
    raise ValueError("SQLite URI options are not supported by this feature builder.")

  database_path = Path(raw_path)

  if database_path.is_absolute():
    return database_path

  # Prisma resolves file:./dev.db relative to the prisma schema directory.
  return (root_dir / "prisma" / database_path).resolve()


def parse_timestamp(value: Any) -> datetime:
  if isinstance(value, datetime):
    timestamp = value
  elif isinstance(value, (int, float)):
    numeric = float(value)
    timestamp = datetime.fromtimestamp(
      numeric / 1000 if numeric > 10_000_000_000 else numeric,
      tz=UTC,
    )
  elif isinstance(value, str):
    normalized = value.strip()

    if normalized.endswith("Z"):
      normalized = f"{normalized[:-1]}+00:00"

    if normalized.endswith(" UTC"):
      normalized = normalized[:-4]

    timestamp = datetime.fromisoformat(normalized)
  else:
    raise TypeError(f"Unsupported timestamp value: {value!r}")

  if timestamp.tzinfo is None:
    return timestamp.replace(tzinfo=UTC)

  return timestamp.astimezone(UTC)


def format_timestamp(timestamp: datetime) -> str:
  return timestamp.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def load_segments(connection: sqlite3.Connection) -> list[Segment]:
  rows = connection.execute(
    """
    SELECT "segmentId", "roadType"
    FROM "Segment"
    ORDER BY "sortOrder" ASC
    """,
  ).fetchall()

  return [
    Segment(
      segment_id=row["segmentId"],
      road_type=row["roadType"],
    )
    for row in rows
  ]


def load_observations(
  connection: sqlite3.Connection,
  segment_ids: list[str],
) -> dict[str, list[Observation]]:
  if not segment_ids:
    return {}

  placeholders = ",".join("?" for _ in segment_ids)
  rows = connection.execute(
    f"""
    SELECT "segmentId", "timestampUtc", "speed", "freeFlowSpeed",
           "congestionLabel", "qualityStatus"
    FROM "TrafficObservation"
    WHERE "segmentId" IN ({placeholders})
    ORDER BY "segmentId" ASC, "timestampUtc" ASC
    """,
    segment_ids,
  ).fetchall()

  observations_by_segment = {segment_id: [] for segment_id in segment_ids}

  for row in rows:
    observations_by_segment[row["segmentId"]].append(
      Observation(
        segment_id=row["segmentId"],
        timestamp_utc=parse_timestamp(row["timestampUtc"]),
        speed=row["speed"],
        free_flow_speed=row["freeFlowSpeed"],
        congestion_label=row["congestionLabel"],
        quality_status=row["qualityStatus"],
      ),
    )

  return observations_by_segment


def find_target_label(
  observations: list[Observation],
  current_index: int,
  target_horizon_minutes: int,
  min_gap_minutes: int,
  max_gap_minutes: int,
) -> str | None:
  current_timestamp = observations[current_index].timestamp_utc
  best_label: str | None = None
  best_gap_delta: float | None = None
  best_gap_minutes = -1.0

  for future in observations[current_index + 1:]:
    gap_minutes = (future.timestamp_utc - current_timestamp).total_seconds() / 60

    if gap_minutes < min_gap_minutes:
      continue

    if gap_minutes > max_gap_minutes:
      break

    if future.congestion_label is None:
      continue

    gap_delta = abs(gap_minutes - target_horizon_minutes)

    if (
      best_gap_delta is None
      or gap_delta < best_gap_delta
      or (gap_delta == best_gap_delta and gap_minutes > best_gap_minutes)
    ):
      best_label = future.congestion_label
      best_gap_delta = gap_delta
      best_gap_minutes = gap_minutes

  return best_label


def build_segment_features(
  segment: Segment,
  observations: list[Observation],
  feature_version: str,
  rolling_window: int,
  target_horizon_minutes: int,
  min_target_gap_minutes: int,
  max_target_gap_minutes: int,
) -> tuple[list[FeatureRow], int]:
  features: list[FeatureRow] = []
  skipped = 0
  valid_history: list[Observation] = []

  for index, observation in enumerate(observations):
    if (
      observation.speed is None
      or observation.free_flow_speed is None
      or observation.free_flow_speed <= 0
      or observation.congestion_label is None
    ):
      skipped += 1
      continue

    valid_history.append(observation)
    rolling_observations = valid_history[-rolling_window:]
    rolling_speeds = [item.speed for item in rolling_observations if item.speed is not None]
    previous = valid_history[-2] if len(valid_history) >= 2 else None

    rolling_mean = statistics.fmean(rolling_speeds)
    rolling_std = (
      statistics.pstdev(rolling_speeds)
      if len(rolling_speeds) >= 2
      else None
    )

    speed_change_rate = None

    if previous and previous.speed is not None:
      elapsed_minutes = (
        observation.timestamp_utc - previous.timestamp_utc
      ).total_seconds() / 60

      if elapsed_minutes > 0:
        speed_change_rate = (observation.speed - previous.speed) / elapsed_minutes

    target = find_target_label(
      observations,
      index,
      target_horizon_minutes,
      min_target_gap_minutes,
      max_target_gap_minutes,
    )

    features.append(
      FeatureRow(
        segment_id=observation.segment_id,
        timestamp_utc=observation.timestamp_utc,
        hour_of_day=observation.timestamp_utc.hour,
        day_of_week=observation.timestamp_utc.weekday(),
        weekend_flag=observation.timestamp_utc.weekday() in {4, 5},
        holiday_flag=False,
        recent_observed_speed=observation.speed,
        rolling_mean_speed=rolling_mean,
        rolling_std_speed=rolling_std,
        relative_to_free_flow=observation.speed / observation.free_flow_speed,
        speed_change_rate=speed_change_rate,
        incident_flag=observation.quality_status == "road_closure",
        road_category=segment.road_type,
        target=target,
        feature_version=feature_version,
      ),
    )

  return features, skipped


def build_features(
  segments: list[Segment],
  observations_by_segment: dict[str, list[Observation]],
  feature_version: str,
  rolling_window: int,
  target_horizon_minutes: int,
  min_target_gap_minutes: int,
  max_target_gap_minutes: int,
) -> tuple[list[FeatureRow], int]:
  features: list[FeatureRow] = []
  skipped = 0

  for segment in segments:
    segment_features, segment_skipped = build_segment_features(
      segment=segment,
      observations=observations_by_segment.get(segment.segment_id, []),
      feature_version=feature_version,
      rolling_window=rolling_window,
      target_horizon_minutes=target_horizon_minutes,
      min_target_gap_minutes=min_target_gap_minutes,
      max_target_gap_minutes=max_target_gap_minutes,
    )
    features.extend(segment_features)
    skipped += segment_skipped

  return features, skipped


def write_features(
  connection: sqlite3.Connection,
  features: list[FeatureRow],
  feature_version: str,
) -> None:
  with connection:
    connection.execute(
      """
      DELETE FROM "FeatureSnapshot"
      WHERE "featureVersion" = ?
      """,
      (feature_version,),
    )

    connection.executemany(
      """
      INSERT INTO "FeatureSnapshot" (
        "id",
        "segmentId",
        "timestampUtc",
        "hourOfDay",
        "dayOfWeek",
        "weekendFlag",
        "holidayFlag",
        "recentObservedSpeed",
        "rollingMeanSpeed",
        "rollingStdSpeed",
        "relativeToFreeFlow",
        "speedChangeRate",
        "incidentFlag",
        "roadCategory",
        "target",
        "featureVersion",
        "createdAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      """,
      [
        (
          f"feature_{uuid.uuid4().hex}",
          feature.segment_id,
          format_timestamp(feature.timestamp_utc),
          feature.hour_of_day,
          feature.day_of_week,
          int(feature.weekend_flag),
          int(feature.holiday_flag),
          feature.recent_observed_speed,
          feature.rolling_mean_speed,
          feature.rolling_std_speed,
          feature.relative_to_free_flow,
          feature.speed_change_rate,
          int(feature.incident_flag),
          feature.road_category,
          feature.target,
          feature.feature_version,
        )
        for feature in features
      ],
    )


def summarize(
  database_path: Path,
  segments: list[Segment],
  observations_by_segment: dict[str, list[Observation]],
  features: list[FeatureRow],
  skipped_observations: int,
  args: argparse.Namespace,
) -> dict[str, Any]:
  observations = [
    observation
    for segment_observations in observations_by_segment.values()
    for observation in segment_observations
  ]
  timestamps = [observation.timestamp_utc for observation in observations]
  target_counts: dict[str, int] = {}

  for feature in features:
    label = feature.target or "Unlabeled"
    target_counts[label] = target_counts.get(label, 0) + 1

  target_ready_count = sum(1 for feature in features if feature.target)

  return {
    "status": "ok",
    "databasePath": str(database_path),
    "featureVersion": args.feature_version,
    "dryRun": args.dry_run,
    "configuration": {
      "rollingWindow": args.rolling_window,
      "targetHorizonMinutes": args.target_horizon_minutes,
      "minTargetGapMinutes": args.min_target_gap_minutes,
      "maxTargetGapMinutes": args.max_target_gap_minutes,
    },
    "segments": len(segments),
    "observations": len(observations),
    "featuresBuilt": len(features),
    "featuresWithTarget": target_ready_count,
    "featuresWithoutTarget": len(features) - target_ready_count,
    "skippedObservations": skipped_observations,
    "targetCounts": dict(sorted(target_counts.items())),
    "range": {
      "fromUtc": format_timestamp(min(timestamps)) if timestamps else None,
      "toUtc": format_timestamp(max(timestamps)) if timestamps else None,
    },
  }


def main() -> None:
  args = parse_args()

  if args.rolling_window < 1:
    raise ValueError("--rolling-window must be at least 1.")

  if args.min_target_gap_minutes < 1:
    raise ValueError("--min-target-gap-minutes must be at least 1.")

  if args.max_target_gap_minutes < args.min_target_gap_minutes:
    raise ValueError("--max-target-gap-minutes must be >= --min-target-gap-minutes.")

  root_dir = Path(__file__).resolve().parents[2]
  database_path = resolve_database_path(root_dir, args.database_url)

  if not database_path.exists():
    raise FileNotFoundError(f"SQLite database not found: {database_path}")

  connection = sqlite3.connect(database_path)
  connection.row_factory = sqlite3.Row

  try:
    segments = load_segments(connection)
    observations_by_segment = load_observations(
      connection,
      [segment.segment_id for segment in segments],
    )
    features, skipped_observations = build_features(
      segments=segments,
      observations_by_segment=observations_by_segment,
      feature_version=args.feature_version,
      rolling_window=args.rolling_window,
      target_horizon_minutes=args.target_horizon_minutes,
      min_target_gap_minutes=args.min_target_gap_minutes,
      max_target_gap_minutes=args.max_target_gap_minutes,
    )

    if not args.dry_run:
      write_features(connection, features, args.feature_version)

    print(
      json.dumps(
        summarize(
          database_path=database_path,
          segments=segments,
          observations_by_segment=observations_by_segment,
          features=features,
          skipped_observations=skipped_observations,
          args=args,
        ),
        indent=2,
      ),
    )
  finally:
    connection.close()


if __name__ == "__main__":
  main()
