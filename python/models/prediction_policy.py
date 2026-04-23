"""Shared decision policy helpers for congestion prediction serving."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any


TARGET_LABELS = ["Low", "Medium", "High"]
SEVERITY_SCORES = {
  "Low": 0,
  "Medium": 1,
  "High": 2,
}
DEFAULT_DECISION_POLICY = {
  "version": "priority-thresholds.v1",
  "thresholds": {
    "nonLow": 0.32,
    "high": 0.18,
  },
  "rules": {
    "enableWorseningOverride": True,
    "lowToMediumRatioMax": 0.72,
    "lowToMediumSpeedDropPerMinute": -0.12,
    "lowToMediumMinNonLowProbability": 0.28,
    "incidentLowToMediumMinNonLowProbability": 0.24,
    "mediumToHighRatioMax": 0.45,
    "mediumToHighSpeedDropPerMinute": -0.18,
    "mediumToHighMinHighProbability": 0.10,
  },
}


@dataclass(frozen=True)
class FeatureSignals:
  relative_to_free_flow: float | None
  speed_change_rate: float | None
  incident_flag: bool | None


@dataclass(frozen=True)
class DecisionResult:
  label: str
  confidence: float | None
  stage: str
  override_reason: str | None


def normalize_decision_policy(policy: dict[str, Any] | None) -> dict[str, Any]:
  normalized = {
    "version": DEFAULT_DECISION_POLICY["version"],
    "thresholds": dict(DEFAULT_DECISION_POLICY["thresholds"]),
    "rules": dict(DEFAULT_DECISION_POLICY["rules"]),
  }

  if not policy:
    return normalized

  if isinstance(policy.get("version"), str):
    normalized["version"] = policy["version"]

  thresholds = policy.get("thresholds")

  if isinstance(thresholds, dict):
    for key in normalized["thresholds"]:
      value = thresholds.get(key)

      if isinstance(value, (int, float)):
        normalized["thresholds"][key] = min(max(float(value), 0.0), 1.0)

  rules = policy.get("rules")

  if isinstance(rules, dict):
    for key, default_value in normalized["rules"].items():
      value = rules.get(key)

      if isinstance(default_value, bool):
        if isinstance(value, bool):
          normalized["rules"][key] = value
      elif isinstance(value, (int, float)):
        normalized["rules"][key] = float(value)

  return normalized


def probabilities_to_label_map(
  classes: list[str],
  probability_row: list[float] | tuple[float, ...] | Any,
) -> dict[str, float]:
  probabilities = {
    label: 0.0
    for label in TARGET_LABELS
  }

  for index, label in enumerate(classes):
    if label in probabilities:
      probabilities[label] = float(probability_row[index])

  return probabilities


def _pick_highest_probability_label(probabilities: dict[str, float]) -> str:
  return max(
    TARGET_LABELS,
    key=lambda label: (probabilities.get(label, 0.0), SEVERITY_SCORES[label]),
  )


def apply_decision_policy(
  probabilities: dict[str, float],
  signals: FeatureSignals,
  decision_policy: dict[str, Any] | None,
) -> DecisionResult:
  policy = normalize_decision_policy(decision_policy)
  non_low_probability = probabilities.get("Medium", 0.0) + probabilities.get("High", 0.0)
  high_probability = probabilities.get("High", 0.0)

  if high_probability >= policy["thresholds"]["high"]:
    label = "High"
    stage = "high-threshold"
  elif non_low_probability >= policy["thresholds"]["nonLow"]:
    label = "Medium"
    stage = "non-low-threshold"
  else:
    label = _pick_highest_probability_label(probabilities)
    stage = "argmax"

  override_reason = None

  if policy["rules"]["enableWorseningOverride"]:
    ratio = signals.relative_to_free_flow
    speed_change_rate = signals.speed_change_rate
    incident_flag = bool(signals.incident_flag)

    if label == "Low":
      worsening_support = non_low_probability >= max(
        policy["rules"]["lowToMediumMinNonLowProbability"],
        policy["thresholds"]["nonLow"] - 0.12,
      )
      incident_support = incident_flag and non_low_probability >= max(
        policy["rules"]["incidentLowToMediumMinNonLowProbability"],
        policy["thresholds"]["nonLow"] - 0.16,
      )

      if (
        ratio is not None
        and ratio <= policy["rules"]["lowToMediumRatioMax"]
        and (
          (
            speed_change_rate is not None
            and speed_change_rate <= policy["rules"]["lowToMediumSpeedDropPerMinute"]
            and worsening_support
          )
          or incident_support
        )
      ):
        label = "Medium"
        stage = "rule-override"
        override_reason = "low-to-medium-worsening"

    if label != "High":
      if (
        ratio is not None
        and ratio <= policy["rules"]["mediumToHighRatioMax"]
        and speed_change_rate is not None
        and speed_change_rate <= policy["rules"]["mediumToHighSpeedDropPerMinute"]
        and high_probability >= max(
          policy["rules"]["mediumToHighMinHighProbability"],
          policy["thresholds"]["high"] * 0.7,
        )
      ):
        label = "High"
        stage = "rule-override"
        override_reason = "medium-to-high-worsening"

  confidence = probabilities.get(label)

  if confidence is None:
    confidence = max(probabilities.values()) if probabilities else None

  return DecisionResult(
    label=label,
    confidence=confidence,
    stage=stage,
    override_reason=override_reason,
  )


def build_feature_signals(
  relative_to_free_flow: float | None,
  speed_change_rate: float | None,
  incident_flag: bool | None,
) -> FeatureSignals:
  return FeatureSignals(
    relative_to_free_flow=relative_to_free_flow,
    speed_change_rate=speed_change_rate,
    incident_flag=incident_flag,
  )


def build_priority_metrics(y_true: list[str], y_pred: list[str]) -> dict[str, Any]:
  total_rows = len(y_true)
  low_support = sum(1 for label in y_true if label == "Low")
  medium_support = sum(1 for label in y_true if label == "Medium")
  high_support = sum(1 for label in y_true if label == "High")
  event_support = sum(1 for label in y_true if label in {"Medium", "High"})

  medium_hits = sum(
    1
    for truth, predicted in zip(y_true, y_pred, strict=False)
    if truth == "Medium" and predicted == "Medium"
  )
  high_hits = sum(
    1
    for truth, predicted in zip(y_true, y_pred, strict=False)
    if truth == "High" and predicted == "High"
  )
  event_hits = sum(
    1
    for truth, predicted in zip(y_true, y_pred, strict=False)
    if truth in {"Medium", "High"} and predicted in {"Medium", "High"}
  )
  low_false_alarms = sum(
    1
    for truth, predicted in zip(y_true, y_pred, strict=False)
    if truth == "Low" and predicted != "Low"
  )
  overpredictions = sum(
    1
    for truth, predicted in zip(y_true, y_pred, strict=False)
    if SEVERITY_SCORES.get(predicted, 0) > SEVERITY_SCORES.get(truth, 0)
  )
  severity_gap = sum(
    abs(SEVERITY_SCORES.get(predicted, 0) - SEVERITY_SCORES.get(truth, 0))
    for truth, predicted in zip(y_true, y_pred, strict=False)
  )

  medium_recall = medium_hits / medium_support if medium_support else None
  high_recall = high_hits / high_support if high_support else None
  medium_high_recall = event_hits / event_support if event_support else None
  low_false_alarm_rate = low_false_alarms / low_support if low_support else 0.0
  overprediction_rate = overpredictions / total_rows if total_rows else 0.0
  severity_gap_mean = severity_gap / total_rows if total_rows else 0.0

  priority_score = (
    5.0 * (medium_high_recall if medium_high_recall is not None else 0.0)
    + 2.0 * (high_recall if high_recall is not None else 0.0)
    + 1.0 * (medium_recall if medium_recall is not None else 0.0)
    - 4.0 * low_false_alarm_rate
    - 1.5 * overprediction_rate
    - 0.5 * severity_gap_mean
  )

  return {
    "mediumRecall": medium_recall,
    "highRecall": high_recall,
    "mediumHighRecall": medium_high_recall,
    "lowFalseAlarmRate": low_false_alarm_rate,
    "overpredictionRate": overprediction_rate,
    "severityGapMean": severity_gap_mean,
    "priorityScore": priority_score,
  }


def count_decision_results(results: list[DecisionResult]) -> dict[str, dict[str, int]]:
  by_label = Counter(result.label for result in results)
  by_stage = Counter(result.stage for result in results)
  overrides = Counter(
    result.override_reason
    for result in results
    if result.override_reason is not None
  )

  return {
    "labels": dict(sorted(by_label.items())),
    "stages": dict(sorted(by_stage.items())),
    "overrides": dict(sorted(overrides.items())),
  }
