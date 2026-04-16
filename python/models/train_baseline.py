#!/usr/bin/env python3
"""Train baseline congestion classifiers from feature snapshots."""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sqlite3
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


MODEL_PIPELINE_VERSION = "model-training.v1"
DEFAULT_FEATURE_VERSION = "features.v1"
DEFAULT_MIN_SAMPLES = 300
DEFAULT_MIN_DAYS_WARNING = 7.0
TARGET_LABELS = ["Low", "Medium", "High"]
NUMERIC_FEATURES = [
  "sort_order",
  "hour_of_day",
  "day_of_week",
  "weekend_flag",
  "holiday_flag",
  "recent_observed_speed",
  "rolling_mean_speed",
  "rolling_std_speed",
  "relative_to_free_flow",
  "speed_change_rate",
  "incident_flag",
]
CATEGORICAL_FEATURES = ["segment_id", "road_category"]
FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES


@dataclass(frozen=True)
class FeatureRecord:
  segment_id: str
  timestamp_utc: datetime
  sort_order: int
  hour_of_day: int | None
  day_of_week: int | None
  weekend_flag: bool | None
  holiday_flag: bool | None
  recent_observed_speed: float | None
  rolling_mean_speed: float | None
  rolling_std_speed: float | None
  relative_to_free_flow: float | None
  speed_change_rate: float | None
  incident_flag: bool | None
  road_category: str | None
  target: str

  def to_feature_row(self) -> list[Any]:
    return [
      self.sort_order,
      self.hour_of_day,
      self.day_of_week,
      bool_to_int(self.weekend_flag),
      bool_to_int(self.holiday_flag),
      self.recent_observed_speed,
      self.rolling_mean_speed,
      self.rolling_std_speed,
      self.relative_to_free_flow,
      self.speed_change_rate,
      bool_to_int(self.incident_flag),
      self.segment_id,
      self.road_category,
    ]


def bool_to_int(value: bool | None) -> int | None:
  if value is None:
    return None

  return 1 if value else 0


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Train time-split congestion classifiers from FeatureSnapshot rows.",
  )
  parser.add_argument(
    "--database-url",
    default=os.environ.get("DATABASE_URL"),
    help="SQLite database URL. Defaults to DATABASE_URL from env or .env.",
  )
  parser.add_argument(
    "--feature-version",
    default=DEFAULT_FEATURE_VERSION,
    help=f"FeatureSnapshot version to train from. Default: {DEFAULT_FEATURE_VERSION}.",
  )
  parser.add_argument(
    "--model-version",
    default=None,
    help="Optional model version. Defaults to a timestamped version.",
  )
  parser.add_argument(
    "--artifact-root",
    default="data/processed/models",
    help="Directory where model artifacts are written.",
  )
  parser.add_argument(
    "--min-samples",
    type=int,
    default=DEFAULT_MIN_SAMPLES,
    help=f"Warn when labeled rows are below this count. Default: {DEFAULT_MIN_SAMPLES}.",
  )
  parser.add_argument(
    "--min-days-warning",
    type=float,
    default=DEFAULT_MIN_DAYS_WARNING,
    help=f"Warn when the training range is shorter than this many days. Default: {DEFAULT_MIN_DAYS_WARNING}.",
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Train and report metrics without writing artifacts or ModelRun metadata.",
  )

  return parser.parse_args()


def import_ml_dependencies() -> dict[str, Any]:
  try:
    joblib = importlib.import_module("joblib")
    sklearn_compose = importlib.import_module("sklearn.compose")
    sklearn_ensemble = importlib.import_module("sklearn.ensemble")
    sklearn_impute = importlib.import_module("sklearn.impute")
    sklearn_linear_model = importlib.import_module("sklearn.linear_model")
    sklearn_metrics = importlib.import_module("sklearn.metrics")
    sklearn_pipeline = importlib.import_module("sklearn.pipeline")
    sklearn_preprocessing = importlib.import_module("sklearn.preprocessing")
  except ImportError as error:
    raise SystemExit(
      "Missing Python ML dependencies. Run `npm run python:setup` first. "
      "On Ubuntu, install `python3.12-venv` if virtualenv creation fails."
    ) from error

  return {
    "joblib": joblib,
    "ColumnTransformer": sklearn_compose.ColumnTransformer,
    "RandomForestClassifier": sklearn_ensemble.RandomForestClassifier,
    "SimpleImputer": sklearn_impute.SimpleImputer,
    "LogisticRegression": sklearn_linear_model.LogisticRegression,
    "accuracy_score": sklearn_metrics.accuracy_score,
    "classification_report": sklearn_metrics.classification_report,
    "confusion_matrix": sklearn_metrics.confusion_matrix,
    "f1_score": sklearn_metrics.f1_score,
    "Pipeline": sklearn_pipeline.Pipeline,
    "OneHotEncoder": sklearn_preprocessing.OneHotEncoder,
    "StandardScaler": sklearn_preprocessing.StandardScaler,
  }


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
    raise ValueError("SQLite URI options are not supported by this trainer.")

  database_path = Path(raw_path)

  if database_path.is_absolute():
    return database_path

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


def load_feature_records(
  connection: sqlite3.Connection,
  feature_version: str,
) -> list[FeatureRecord]:
  rows = connection.execute(
    """
    SELECT
      f."segmentId",
      f."timestampUtc",
      f."hourOfDay",
      f."dayOfWeek",
      f."weekendFlag",
      f."holidayFlag",
      f."recentObservedSpeed",
      f."rollingMeanSpeed",
      f."rollingStdSpeed",
      f."relativeToFreeFlow",
      f."speedChangeRate",
      f."incidentFlag",
      f."roadCategory",
      f."target",
      s."sortOrder"
    FROM "FeatureSnapshot" f
    JOIN "Segment" s ON s."segmentId" = f."segmentId"
    WHERE f."featureVersion" = ?
      AND f."target" IS NOT NULL
    ORDER BY f."timestampUtc" ASC, s."sortOrder" ASC
    """,
    (feature_version,),
  ).fetchall()

  return [
    FeatureRecord(
      segment_id=row["segmentId"],
      timestamp_utc=parse_timestamp(row["timestampUtc"]),
      sort_order=row["sortOrder"],
      hour_of_day=row["hourOfDay"],
      day_of_week=row["dayOfWeek"],
      weekend_flag=to_optional_bool(row["weekendFlag"]),
      holiday_flag=to_optional_bool(row["holidayFlag"]),
      recent_observed_speed=row["recentObservedSpeed"],
      rolling_mean_speed=row["rollingMeanSpeed"],
      rolling_std_speed=row["rollingStdSpeed"],
      relative_to_free_flow=row["relativeToFreeFlow"],
      speed_change_rate=row["speedChangeRate"],
      incident_flag=to_optional_bool(row["incidentFlag"]),
      road_category=row["roadCategory"],
      target=row["target"],
    )
    for row in rows
  ]


def to_optional_bool(value: Any) -> bool | None:
  if value is None:
    return None

  return bool(value)


def split_records(
  records: list[FeatureRecord],
) -> tuple[list[FeatureRecord], list[FeatureRecord], list[FeatureRecord]]:
  total = len(records)
  train_end = max(1, int(total * 0.7))
  validation_end = max(train_end + 1, int(total * 0.85))

  if validation_end >= total:
    validation_end = total - 1

  if train_end <= 0 or validation_end <= train_end or validation_end >= total:
    raise ValueError("Not enough labeled rows for non-empty train/validation/test splits.")

  return records[:train_end], records[train_end:validation_end], records[validation_end:]


def feature_matrix(records: list[FeatureRecord]) -> list[list[Any]]:
  return [record.to_feature_row() for record in records]


def target_vector(records: list[FeatureRecord]) -> list[str]:
  return [record.target for record in records]


def build_preprocessor(ml: dict[str, Any]) -> Any:
  numeric_pipeline = ml["Pipeline"](
    steps=[
      ("imputer", ml["SimpleImputer"](strategy="median")),
      ("scaler", ml["StandardScaler"]()),
    ],
  )
  categorical_pipeline = ml["Pipeline"](
    steps=[
      ("imputer", ml["SimpleImputer"](strategy="constant", fill_value="unknown")),
      ("encoder", ml["OneHotEncoder"](handle_unknown="ignore")),
    ],
  )

  return ml["ColumnTransformer"](
    transformers=[
      ("numeric", numeric_pipeline, list(range(len(NUMERIC_FEATURES)))),
      (
        "categorical",
        categorical_pipeline,
        list(range(len(NUMERIC_FEATURES), len(FEATURE_COLUMNS))),
      ),
    ],
  )


def build_models(ml: dict[str, Any]) -> dict[str, Any]:
  logistic_regression = ml["Pipeline"](
    steps=[
      ("preprocessor", build_preprocessor(ml)),
      (
        "classifier",
        ml["LogisticRegression"](
          class_weight="balanced",
          max_iter=1000,
          random_state=42,
        ),
      ),
    ],
  )
  random_forest = ml["Pipeline"](
    steps=[
      ("preprocessor", build_preprocessor(ml)),
      (
        "classifier",
        ml["RandomForestClassifier"](
          n_estimators=300,
          min_samples_leaf=3,
          class_weight="balanced_subsample",
          random_state=42,
          n_jobs=-1,
        ),
      ),
    ],
  )

  return {
    "logistic_regression": logistic_regression,
    "random_forest": random_forest,
  }


def predict_last_class(
  prior_records: list[FeatureRecord],
  evaluation_records: list[FeatureRecord],
  fallback_label: str,
) -> list[str]:
  last_by_segment: dict[str, str] = {}

  for record in prior_records:
    last_by_segment[record.segment_id] = record.target

  predictions: list[str] = []

  for record in evaluation_records:
    predictions.append(last_by_segment.get(record.segment_id, fallback_label))
    last_by_segment[record.segment_id] = record.target

  return predictions


def evaluate_predictions(
  ml: dict[str, Any],
  y_true: list[str],
  y_pred: list[str],
) -> dict[str, Any]:
  return {
    "accuracy": float(ml["accuracy_score"](y_true, y_pred)),
    "macroF1": float(
      ml["f1_score"](
        y_true,
        y_pred,
        labels=TARGET_LABELS,
        average="macro",
        zero_division=0,
      ),
    ),
    "weightedF1": float(
      ml["f1_score"](
        y_true,
        y_pred,
        labels=TARGET_LABELS,
        average="weighted",
        zero_division=0,
      ),
    ),
    "confusionMatrix": ml["confusion_matrix"](
      y_true,
      y_pred,
      labels=TARGET_LABELS,
    ).tolist(),
    "classificationReport": ml["classification_report"](
      y_true,
      y_pred,
      labels=TARGET_LABELS,
      output_dict=True,
      zero_division=0,
    ),
  }


def evaluate_model(
  ml: dict[str, Any],
  model: Any,
  records: list[FeatureRecord],
) -> dict[str, Any]:
  y_true = target_vector(records)
  y_pred = model.predict(feature_matrix(records)).tolist()
  metrics = evaluate_predictions(ml, y_true, y_pred)

  if hasattr(model, "predict_proba"):
    probabilities = model.predict_proba(feature_matrix(records))
    metrics["averageMaxProbability"] = float(probabilities.max(axis=1).mean())

  return metrics


def majority_label(records: list[FeatureRecord]) -> str:
  counts = Counter(target_vector(records))

  if not counts:
    return "Low"

  return counts.most_common(1)[0][0]


def target_counts(records: list[FeatureRecord]) -> dict[str, int]:
  counts = Counter(target_vector(records))
  return {label: counts.get(label, 0) for label in TARGET_LABELS}


def build_warnings(
  records: list[FeatureRecord],
  train_records: list[FeatureRecord],
  args: argparse.Namespace,
) -> list[str]:
  warnings: list[str] = []
  timestamps = [record.timestamp_utc for record in records]
  duration_days = (
    (max(timestamps) - min(timestamps)).total_seconds() / 86_400
    if timestamps
    else 0
  )
  counts = target_counts(records)

  if len(records) < args.min_samples:
    warnings.append(
      f"Only {len(records)} labeled rows are available; metrics are preliminary.",
    )

  if duration_days < args.min_days_warning:
    warnings.append(
      f"Training range is {duration_days:.2f} days; final model should be retrained with multi-week data.",
    )

  missing_classes = [label for label in TARGET_LABELS if counts[label] == 0]

  if missing_classes:
    warnings.append(
      f"Missing target classes in labeled data: {', '.join(missing_classes)}.",
    )

  rare_classes = [label for label, count in counts.items() if 0 < count < 20]

  if rare_classes:
    warnings.append(
      f"Very low support for target classes: {', '.join(rare_classes)}.",
    )

  train_classes = set(target_vector(train_records))

  if len(train_classes) < 2:
    warnings.append("Training split has fewer than two classes; model fitting is blocked.")

  return warnings


def make_model_version() -> str:
  return f"congestion-baseline-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}"


def save_artifacts(
  ml: dict[str, Any],
  artifact_dir: Path,
  trained_models: dict[str, Any],
  metrics: dict[str, Any],
  metadata: dict[str, Any],
) -> None:
  artifact_dir.mkdir(parents=True, exist_ok=True)

  for model_name, model in trained_models.items():
    ml["joblib"].dump(model, artifact_dir / f"{model_name}.joblib")

  (artifact_dir / "metrics.json").write_text(
    json.dumps(metrics, indent=2),
    encoding="utf-8",
  )
  (artifact_dir / "metadata.json").write_text(
    json.dumps(metadata, indent=2),
    encoding="utf-8",
  )


def insert_model_run(
  connection: sqlite3.Connection,
  run_id: str,
  model_version: str,
  dataset_range: dict[str, Any],
  metrics: dict[str, Any],
  artifact_path: str,
) -> None:
  with connection:
    connection.execute(
      """
      INSERT INTO "ModelRun" (
        "id",
        "runId",
        "modelName",
        "version",
        "datasetRange",
        "metricsJson",
        "artifactPath",
        "createdAt"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      """,
      (
        f"model_{uuid.uuid4().hex}",
        run_id,
        "random_forest_congestion_classifier",
        model_version,
        json.dumps(dataset_range),
        json.dumps(metrics),
        artifact_path,
      ),
    )


def train(args: argparse.Namespace) -> dict[str, Any]:
  ml = import_ml_dependencies()
  root_dir = Path(__file__).resolve().parents[2]
  database_path = resolve_database_path(root_dir, args.database_url)

  if not database_path.exists():
    raise FileNotFoundError(f"SQLite database not found: {database_path}")

  connection = sqlite3.connect(database_path)
  connection.row_factory = sqlite3.Row

  try:
    records = load_feature_records(connection, args.feature_version)

    if len(records) < 3:
      raise ValueError("At least three labeled FeatureSnapshot rows are required.")

    train_records, validation_records, test_records = split_records(records)
    warnings = build_warnings(records, train_records, args)

    if len(set(target_vector(train_records))) < 2:
      raise ValueError("Training split must contain at least two target classes.")

    models = build_models(ml)
    trained_models: dict[str, Any] = {}
    train_x = feature_matrix(train_records)
    train_y = target_vector(train_records)

    for model_name, model in models.items():
      model.fit(train_x, train_y)
      trained_models[model_name] = model

    fallback_label = majority_label(train_records)
    naive_validation_predictions = predict_last_class(
      train_records,
      validation_records,
      fallback_label,
    )
    naive_test_predictions = predict_last_class(
      train_records + validation_records,
      test_records,
      fallback_label,
    )
    timestamps = [record.timestamp_utc for record in records]
    model_version = args.model_version or make_model_version()
    run_id = str(uuid.uuid4())
    dataset_range = {
      "fromUtc": format_timestamp(min(timestamps)),
      "toUtc": format_timestamp(max(timestamps)),
      "featureVersion": args.feature_version,
      "rows": len(records),
      "trainRows": len(train_records),
      "validationRows": len(validation_records),
      "testRows": len(test_records),
    }
    metrics = {
      "pipelineVersion": MODEL_PIPELINE_VERSION,
      "labels": TARGET_LABELS,
      "featureColumns": FEATURE_COLUMNS,
      "targetCounts": {
        "all": target_counts(records),
        "train": target_counts(train_records),
        "validation": target_counts(validation_records),
        "test": target_counts(test_records),
      },
      "split": {
        "strategy": "time_ordered_70_15_15",
        "trainRows": len(train_records),
        "validationRows": len(validation_records),
        "testRows": len(test_records),
      },
      "naiveLastClassBaseline": {
        "validation": evaluate_predictions(
          ml,
          target_vector(validation_records),
          naive_validation_predictions,
        ),
        "test": evaluate_predictions(
          ml,
          target_vector(test_records),
          naive_test_predictions,
        ),
      },
      "models": {
        model_name: {
          "validation": evaluate_model(ml, model, validation_records),
          "test": evaluate_model(ml, model, test_records),
        }
        for model_name, model in trained_models.items()
      },
      "warnings": warnings,
    }
    metadata = {
      "runId": run_id,
      "modelVersion": model_version,
      "createdAtUtc": format_timestamp(datetime.now(UTC)),
      "databasePath": str(database_path),
      "datasetRange": dataset_range,
      "mainModel": "random_forest",
      "baselineModel": "logistic_regression",
      "dryRun": args.dry_run,
      "warnings": warnings,
    }
    artifact_dir = (root_dir / args.artifact_root / model_version).resolve()
    artifact_path = str(artifact_dir.relative_to(root_dir))

    if not args.dry_run:
      save_artifacts(
        ml=ml,
        artifact_dir=artifact_dir,
        trained_models=trained_models,
        metrics=metrics,
        metadata=metadata,
      )
      insert_model_run(
        connection=connection,
        run_id=run_id,
        model_version=model_version,
        dataset_range=dataset_range,
        metrics=metrics,
        artifact_path=artifact_path,
      )

    return {
      "status": "ok",
      "runId": run_id,
      "modelVersion": model_version,
      "dryRun": args.dry_run,
      "artifactPath": None if args.dry_run else artifact_path,
      "datasetRange": dataset_range,
      "targetCounts": metrics["targetCounts"],
      "naiveLastClassBaseline": {
        "validation": {
          "accuracy": metrics["naiveLastClassBaseline"]["validation"]["accuracy"],
          "macroF1": metrics["naiveLastClassBaseline"]["validation"]["macroF1"],
        },
        "test": {
          "accuracy": metrics["naiveLastClassBaseline"]["test"]["accuracy"],
          "macroF1": metrics["naiveLastClassBaseline"]["test"]["macroF1"],
        },
      },
      "models": {
        model_name: {
          "validation": {
            "accuracy": model_metrics["validation"]["accuracy"],
            "macroF1": model_metrics["validation"]["macroF1"],
          },
          "test": {
            "accuracy": model_metrics["test"]["accuracy"],
            "macroF1": model_metrics["test"]["macroF1"],
          },
        }
        for model_name, model_metrics in metrics["models"].items()
      },
      "warnings": warnings,
    }
  finally:
    connection.close()


def main() -> None:
  args = parse_args()
  result = train(args)
  print(json.dumps(result, indent=2))


if __name__ == "__main__":
  main()
