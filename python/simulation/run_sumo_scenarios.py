#!/usr/bin/env python3
"""Run SUMO corridor scenarios and persist summarized metrics."""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import sqlite3
import subprocess
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


DEFAULT_DURATION_SECONDS = 900
DEFAULT_VEHICLES_PER_HOUR = 480
DEFAULT_SCENARIO_DEFINITION_PATH = "lib/scenarios/definitions.json"
DEFAULT_EXPORT_ROOT = "data/exports/scenarios"
DEFAULT_FREE_FLOW_KMPH = 30.0
MIN_SUMO_SPEED_MPS = 3.0
URBAN_LANE_CAPACITY_VEHICLES_PER_HOUR = 700.0


@dataclass(frozen=True)
class Segment:
  segment_id: str
  road_name: str
  latitude: float
  longitude: float
  sort_order: int
  latest_speed: float | None
  latest_free_flow_speed: float | None


@dataclass(frozen=True)
class ScenarioDefinition:
  scenario_id: str
  name: str
  scenario_type: str
  summary: str
  assumptions: list[str]
  affected_segment_ids: set[str]
  demand_multiplier: float
  affected_speed_multiplier: float
  affected_lane_count: int | None


@dataclass(frozen=True)
class ScenarioRun:
  definition: ScenarioDefinition
  artifact_dir: Path
  metrics: dict[str, float]


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Generate and run SUMO baseline/disruption/mitigation scenarios.",
  )
  parser.add_argument(
    "--database-url",
    default=os.environ.get("DATABASE_URL"),
    help="SQLite database URL. Defaults to DATABASE_URL from env or .env.",
  )
  parser.add_argument(
    "--duration-seconds",
    type=int,
    default=DEFAULT_DURATION_SECONDS,
    help=f"Simulation length in seconds. Default: {DEFAULT_DURATION_SECONDS}.",
  )
  parser.add_argument(
    "--vehicles-per-hour",
    type=int,
    default=DEFAULT_VEHICLES_PER_HOUR,
    help=f"Baseline demand for the corridor. Default: {DEFAULT_VEHICLES_PER_HOUR}.",
  )
  parser.add_argument(
    "--scenario-version",
    default=None,
    help="Optional scenario version. Defaults to a UTC timestamp version.",
  )
  parser.add_argument(
    "--definition-path",
    default=DEFAULT_SCENARIO_DEFINITION_PATH,
    help=f"Scenario definition JSON path. Default: {DEFAULT_SCENARIO_DEFINITION_PATH}.",
  )
  parser.add_argument(
    "--export-root",
    default=DEFAULT_EXPORT_ROOT,
    help=f"Scenario artifact root. Default: {DEFAULT_EXPORT_ROOT}.",
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Build SUMO artifacts and print metrics without writing ScenarioResult rows.",
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
    raise ValueError("SQLite URI options are not supported by this scenario runner.")

  database_path = Path(raw_path)

  if database_path.is_absolute():
    return database_path

  return (root_dir / "prisma" / database_path).resolve()


def parse_timestamp_version() -> str:
  timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
  return f"sumo-scenarios-{timestamp}"


def require_sumo_binary(name: str) -> str:
  binary_path = shutil.which(name)

  if binary_path:
    return binary_path

  raise SystemExit(
    f"Missing SUMO command `{name}`. Install SUMO before running scenarios. "
    "On Ubuntu/WSL or the VPS, run: sudo apt install -y sumo sumo-tools"
  )


def load_segments(connection: sqlite3.Connection) -> list[Segment]:
  rows = connection.execute(
    """
    SELECT
      s."segmentId",
      s."roadName",
      s."latitude",
      s."longitude",
      s."sortOrder",
      latest."speed",
      latest."freeFlowSpeed"
    FROM "Segment" s
    LEFT JOIN "TrafficObservation" latest
      ON latest."id" = (
        SELECT o."id"
        FROM "TrafficObservation" o
        WHERE o."segmentId" = s."segmentId"
        ORDER BY o."timestampUtc" DESC
        LIMIT 1
      )
    WHERE s."latitude" IS NOT NULL
      AND s."longitude" IS NOT NULL
    ORDER BY s."sortOrder" ASC
    """,
  ).fetchall()

  segments = [
    Segment(
      segment_id=row["segmentId"],
      road_name=row["roadName"],
      latitude=float(row["latitude"]),
      longitude=float(row["longitude"]),
      sort_order=int(row["sortOrder"]),
      latest_speed=row["speed"],
      latest_free_flow_speed=row["freeFlowSpeed"],
    )
    for row in rows
  ]

  if len(segments) < 2:
    raise ValueError("At least two corridor segments with coordinates are required.")

  return segments


def load_scenario_definitions(path: Path) -> list[ScenarioDefinition]:
  raw_definitions = json.loads(path.read_text(encoding="utf-8"))

  definitions: list[ScenarioDefinition] = []

  for item in sorted(raw_definitions, key=lambda value: value["sortOrder"]):
    definitions.append(
      ScenarioDefinition(
        scenario_id=item["id"],
        name=item["name"],
        scenario_type=item["type"],
        summary=item["summary"],
        assumptions=list(item["assumptions"]),
        affected_segment_ids=set(item["affectedSegmentIds"]),
        demand_multiplier=float(item["demandMultiplier"]),
        affected_speed_multiplier=float(item["affectedSpeedMultiplier"]),
        affected_lane_count=item["affectedLaneCount"],
      ),
    )

  if not definitions or definitions[0].scenario_id != "baseline":
    raise ValueError("Scenario definitions must start with a baseline scenario.")

  return definitions


def project_coordinates(segments: list[Segment]) -> list[tuple[float, float]]:
  origin = segments[0]
  meters_per_lat = 111_320.0
  meters_per_lon = 111_320.0 * math.cos(math.radians(origin.latitude))

  return [
    (
      (segment.longitude - origin.longitude) * meters_per_lon,
      (segment.latitude - origin.latitude) * meters_per_lat,
    )
    for segment in segments
  ]


def haversine_meters(left: Segment, right: Segment) -> float:
  radius_meters = 6_371_000.0
  lat1 = math.radians(left.latitude)
  lat2 = math.radians(right.latitude)
  delta_lat = math.radians(right.latitude - left.latitude)
  delta_lon = math.radians(right.longitude - left.longitude)
  a = (
    math.sin(delta_lat / 2) ** 2
    + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
  )

  return max(30.0, radius_meters * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def edge_id(index: int) -> str:
  return f"edge_{index:03d}"


def node_id(index: int) -> str:
  return f"node_{index:03d}"


def get_free_flow_kmph(segment: Segment) -> float:
  if segment.latest_free_flow_speed and segment.latest_free_flow_speed > 0:
    return float(segment.latest_free_flow_speed)

  if segment.latest_speed and segment.latest_speed > 0:
    return max(float(segment.latest_speed), DEFAULT_FREE_FLOW_KMPH)

  return DEFAULT_FREE_FLOW_KMPH


def write_xml(element: ET.Element, path: Path) -> None:
  tree = ET.ElementTree(element)
  ET.indent(tree, space="  ")
  tree.write(path, encoding="utf-8", xml_declaration=True)


def build_sumo_inputs(
  scenario: ScenarioDefinition,
  segments: list[Segment],
  artifact_dir: Path,
  duration_seconds: int,
  vehicles_per_hour: int,
) -> dict[str, Path]:
  artifact_dir.mkdir(parents=True, exist_ok=True)
  coordinates = project_coordinates(segments)

  nodes = ET.Element("nodes")
  for index, (x, y) in enumerate(coordinates, start=1):
    ET.SubElement(
      nodes,
      "node",
      {
        "id": node_id(index),
        "x": f"{x:.2f}",
        "y": f"{y:.2f}",
        "type": "priority",
      },
    )

  edges = ET.Element("edges")
  edge_ids: list[str] = []

  for index in range(len(segments) - 1):
    from_segment = segments[index]
    to_segment = segments[index + 1]
    is_affected = to_segment.segment_id in scenario.affected_segment_ids
    speed_kmph = get_free_flow_kmph(to_segment)

    if is_affected:
      speed_kmph *= scenario.affected_speed_multiplier

    lanes = scenario.affected_lane_count if is_affected and scenario.affected_lane_count else 2
    current_edge_id = edge_id(index + 1)
    edge_ids.append(current_edge_id)

    ET.SubElement(
      edges,
      "edge",
      {
        "id": current_edge_id,
        "from": node_id(index + 1),
        "to": node_id(index + 2),
        "numLanes": str(lanes),
        "speed": f"{max(MIN_SUMO_SPEED_MPS, speed_kmph / 3.6):.2f}",
        "length": f"{haversine_meters(from_segment, to_segment):.2f}",
        "priority": "1",
      },
    )

  routes = ET.Element("routes")
  ET.SubElement(
    routes,
    "vType",
    {
      "id": "passenger",
      "vClass": "passenger",
      "accel": "2.6",
      "decel": "4.5",
      "sigma": "0.5",
      "length": "5.0",
      "minGap": "2.5",
      "maxSpeed": "22.22",
    },
  )
  ET.SubElement(routes, "route", {"id": "corridor_route", "edges": " ".join(edge_ids)})

  vehicle_count = max(
    1,
    round((vehicles_per_hour * duration_seconds / 3600) * scenario.demand_multiplier),
  )
  depart_step = duration_seconds / vehicle_count

  for index in range(vehicle_count):
    ET.SubElement(
      routes,
      "vehicle",
      {
        "id": f"{scenario.scenario_id}_veh_{index:04d}",
        "type": "passenger",
        "route": "corridor_route",
        "depart": f"{index * depart_step:.2f}",
        "departLane": "best",
        "departSpeed": "max",
      },
    )

  additional = ET.Element("additional")
  ET.SubElement(
    additional,
    "edgeData",
    {
      "id": "edge_metrics",
      "file": "edge-data.xml",
      "begin": "0",
      "end": str(duration_seconds),
      "excludeEmpty": "false",
    },
  )

  paths = {
    "nodes": artifact_dir / "network.nod.xml",
    "edges": artifact_dir / "network.edg.xml",
    "routes": artifact_dir / "routes.rou.xml",
    "additional": artifact_dir / "additional.add.xml",
    "network": artifact_dir / "network.net.xml",
    "tripinfo": artifact_dir / "tripinfo.xml",
    "queue": artifact_dir / "queue.xml",
    "summary": artifact_dir / "summary.xml",
  }

  write_xml(nodes, paths["nodes"])
  write_xml(edges, paths["edges"])
  write_xml(routes, paths["routes"])
  write_xml(additional, paths["additional"])

  return paths


def run_command(command: list[str], cwd: Path) -> None:
  completed = subprocess.run(
    command,
    cwd=cwd,
    check=False,
    capture_output=True,
    text=True,
  )

  if completed.returncode != 0:
    raise RuntimeError(
      "Command failed:\n"
      + " ".join(command)
      + "\nSTDOUT:\n"
      + completed.stdout[-4000:]
      + "\nSTDERR:\n"
      + completed.stderr[-4000:]
    )


def run_sumo(
  netconvert_binary: str,
  sumo_binary: str,
  paths: dict[str, Path],
  duration_seconds: int,
) -> None:
  run_command(
    [
      netconvert_binary,
      "--node-files",
      str(paths["nodes"]),
      "--edge-files",
      str(paths["edges"]),
      "--output-file",
      str(paths["network"]),
    ],
    cwd=paths["nodes"].parent,
  )
  run_command(
    [
      sumo_binary,
      "--net-file",
      str(paths["network"]),
      "--route-files",
      str(paths["routes"]),
      "--additional-files",
      str(paths["additional"]),
      "--begin",
      "0",
      "--end",
      str(duration_seconds),
      "--tripinfo-output",
      str(paths["tripinfo"]),
      "--tripinfo-output.write-unfinished",
      "true",
      "--queue-output",
      str(paths["queue"]),
      "--queue-output.period",
      "60",
      "--summary-output",
      str(paths["summary"]),
      "--no-step-log",
      "true",
      "--quit-on-end",
      "true",
    ],
    cwd=paths["nodes"].parent,
  )


def parse_float_attribute(element: ET.Element, attribute: str) -> float | None:
  value = element.attrib.get(attribute)

  if value is None:
    return None

  try:
    return float(value)
  except ValueError:
    return None


def average(values: list[float]) -> float:
  if not values:
    return 0.0

  return sum(values) / len(values)


def get_current_speed_kmph(segment: Segment) -> float:
  if segment.latest_speed and segment.latest_speed > 0:
    return float(segment.latest_speed)

  return get_free_flow_kmph(segment)


def get_scenario_edge_speed_kmph(
  scenario: ScenarioDefinition,
  segment: Segment,
) -> float:
  speed_kmph = get_current_speed_kmph(segment)

  if segment.segment_id in scenario.affected_segment_ids:
    speed_kmph *= scenario.affected_speed_multiplier

  return max(MIN_SUMO_SPEED_MPS * 3.6, speed_kmph)


def get_scenario_lane_count(scenario: ScenarioDefinition, segment: Segment) -> int:
  if segment.segment_id in scenario.affected_segment_ids and scenario.affected_lane_count:
    return max(1, scenario.affected_lane_count)

  return 2


def calculate_modeled_metrics(
  scenario: ScenarioDefinition,
  segments: list[Segment],
  duration_seconds: int,
  vehicles_per_hour: int,
) -> dict[str, float]:
  travel_time_seconds = 0.0
  free_flow_time_seconds = 0.0
  max_pressure = 0.0

  demand_vehicles_per_hour = vehicles_per_hour * scenario.demand_multiplier

  for index in range(len(segments) - 1):
    from_segment = segments[index]
    to_segment = segments[index + 1]
    length_meters = haversine_meters(from_segment, to_segment)
    scenario_speed_mps = get_scenario_edge_speed_kmph(scenario, to_segment) / 3.6
    free_flow_speed_mps = max(MIN_SUMO_SPEED_MPS, get_free_flow_kmph(to_segment) / 3.6)
    lane_count = get_scenario_lane_count(scenario, to_segment)
    edge_capacity = lane_count * URBAN_LANE_CAPACITY_VEHICLES_PER_HOUR

    travel_time_seconds += length_meters / scenario_speed_mps
    free_flow_time_seconds += length_meters / free_flow_speed_mps

    if edge_capacity > 0:
      max_pressure = max(max_pressure, demand_vehicles_per_hour / edge_capacity)

  total_vehicle_count = max(
    1.0,
    round((vehicles_per_hour * duration_seconds / 3600) * scenario.demand_multiplier),
  )
  pressure_delay_seconds = max(0.0, max_pressure - 1.0) * duration_seconds * 0.18
  average_delay_seconds = max(0.0, travel_time_seconds - free_flow_time_seconds) + pressure_delay_seconds
  average_waiting_time_seconds = max(0.0, max_pressure - 1.0) * duration_seconds * 0.08
  max_queue_length_meters = max(0.0, max_pressure - 1.0) * 180.0
  modeled_vehicle_count = total_vehicle_count / max(1.0, max_pressure)

  return {
    "average_travel_time_seconds": travel_time_seconds + pressure_delay_seconds,
    "average_delay_seconds": average_delay_seconds,
    "corridor_pressure_percent": max_pressure * 100.0,
    "average_waiting_time_seconds": average_waiting_time_seconds,
    "max_queue_length_meters": max_queue_length_meters,
    "modeled_vehicle_count": modeled_vehicle_count,
  }


def parse_sumo_metrics(paths: dict[str, Path]) -> dict[str, float]:
  trip_tree = ET.parse(paths["tripinfo"])
  trips = trip_tree.getroot().findall("tripinfo")

  durations: list[float] = []
  delays: list[float] = []
  waiting_times: list[float] = []

  for trip in trips:
    duration = parse_float_attribute(trip, "duration")
    time_loss = parse_float_attribute(trip, "timeLoss")
    waiting_time = parse_float_attribute(trip, "waitingTime")

    if duration is not None:
      durations.append(duration)

    if time_loss is not None:
      delays.append(time_loss)

    if waiting_time is not None:
      waiting_times.append(waiting_time)

  if not durations:
    raise ValueError("SUMO produced no tripinfo rows; scenario metrics cannot be computed.")

  max_queue_length = 0.0

  if paths["queue"].exists():
    queue_tree = ET.parse(paths["queue"])

    for lane in queue_tree.getroot().iter("lane"):
      queue_length = parse_float_attribute(lane, "queueing_length")
      experimental_queue_length = parse_float_attribute(lane, "queueing_length_experimental")
      max_queue_length = max(
        max_queue_length,
        queue_length or 0.0,
        experimental_queue_length or 0.0,
      )

  return {
    "average_travel_time_seconds": average(durations),
    "average_delay_seconds": average(delays),
    "average_waiting_time_seconds": average(waiting_times),
    "max_queue_length_meters": max_queue_length,
    "completed_vehicle_count": float(len(trips)),
  }


def write_summary(run: ScenarioRun, scenario_version: str, duration_seconds: int) -> None:
  payload = {
    "scenarioId": run.definition.scenario_id,
    "scenarioVersion": scenario_version,
    "name": run.definition.name,
    "type": run.definition.scenario_type,
    "summary": run.definition.summary,
    "assumptions": run.definition.assumptions,
    "durationSeconds": duration_seconds,
    "metrics": run.metrics,
  }
  (run.artifact_dir / "summary.json").write_text(
    json.dumps(payload, indent=2, sort_keys=True),
    encoding="utf-8",
  )


def persist_results(
  connection: sqlite3.Connection,
  runs: list[ScenarioRun],
  scenario_version: str,
  root_dir: Path,
  duration_seconds: int,
) -> None:
  now = datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
  rows: list[tuple[str, str, str, float, str, str, str]] = []

  for run in runs:
    notes = json.dumps(
      {
        "name": run.definition.name,
        "type": run.definition.scenario_type,
        "summary": run.definition.summary,
        "assumptions": run.definition.assumptions,
        "artifactPath": str(run.artifact_dir.relative_to(root_dir)),
        "durationSeconds": duration_seconds,
      },
      sort_keys=True,
    )

    for metric_name, metric_value in run.metrics.items():
      rows.append(
        (
          str(uuid.uuid4()),
          run.definition.scenario_id,
          metric_name,
          float(metric_value),
          notes,
          scenario_version,
          now,
        ),
      )

  with connection:
    connection.execute(
      'DELETE FROM "ScenarioResult" WHERE "scenarioVersion" = ?',
      (scenario_version,),
    )
    connection.executemany(
      """
      INSERT INTO "ScenarioResult"
        ("id", "scenarioId", "metricName", "metricValue", "notes", "scenarioVersion", "createdAt")
      VALUES (?, ?, ?, ?, ?, ?, ?)
      """,
      rows,
    )


def main() -> None:
  args = parse_args()
  root_dir = Path(__file__).resolve().parents[2]
  database_path = resolve_database_path(root_dir, args.database_url)
  scenario_version = args.scenario_version or parse_timestamp_version()
  export_root = (root_dir / args.export_root).resolve()
  version_dir = export_root / scenario_version

  netconvert_binary = require_sumo_binary("netconvert")
  sumo_binary = require_sumo_binary("sumo")

  connection = sqlite3.connect(database_path)
  connection.row_factory = sqlite3.Row

  definitions = load_scenario_definitions(root_dir / args.definition_path)
  segments = load_segments(connection)
  runs: list[ScenarioRun] = []

  for definition in definitions:
    artifact_dir = version_dir / definition.scenario_id
    paths = build_sumo_inputs(
      scenario=definition,
      segments=segments,
      artifact_dir=artifact_dir,
      duration_seconds=args.duration_seconds,
      vehicles_per_hour=args.vehicles_per_hour,
    )
    run_sumo(netconvert_binary, sumo_binary, paths, args.duration_seconds)
    sumo_metrics = parse_sumo_metrics(paths)
    metrics = calculate_modeled_metrics(
      scenario=definition,
      segments=segments,
      duration_seconds=args.duration_seconds,
      vehicles_per_hour=args.vehicles_per_hour,
    )
    (artifact_dir / "sumo-raw-metrics.json").write_text(
      json.dumps(sumo_metrics, indent=2, sort_keys=True),
      encoding="utf-8",
    )
    runs.append(ScenarioRun(definition=definition, artifact_dir=artifact_dir, metrics=metrics))

  baseline_travel_time = runs[0].metrics["average_travel_time_seconds"]

  for run in runs:
    travel_time = run.metrics["average_travel_time_seconds"]
    run.metrics["relative_travel_time_change_percent"] = (
      ((travel_time - baseline_travel_time) / baseline_travel_time) * 100
      if baseline_travel_time > 0
      else 0.0
    )
    write_summary(run, scenario_version, args.duration_seconds)

  if not args.dry_run:
    persist_results(connection, runs, scenario_version, root_dir, args.duration_seconds)

  print(
    json.dumps(
      {
        "status": "ok",
        "databasePath": str(database_path),
        "scenarioVersion": scenario_version,
        "dryRun": args.dry_run,
        "durationSeconds": args.duration_seconds,
        "scenarioCount": len(runs),
        "artifactPath": str(version_dir.relative_to(root_dir)),
        "scenarios": [
          {
            "id": run.definition.scenario_id,
            "name": run.definition.name,
            "metrics": run.metrics,
          }
          for run in runs
        ],
      },
      indent=2,
      sort_keys=True,
    )
  )


if __name__ == "__main__":
  main()
