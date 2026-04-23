import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

from prediction_policy import (
  apply_decision_policy,
  build_feature_signals,
  build_priority_metrics,
)


class PredictionPolicyTests(unittest.TestCase):
  def test_non_low_threshold_promotes_medium(self):
    result = apply_decision_policy(
      probabilities={
        "Low": 0.61,
        "Medium": 0.25,
        "High": 0.14,
      },
      signals=build_feature_signals(
        relative_to_free_flow=0.74,
        speed_change_rate=-0.02,
        incident_flag=False,
      ),
      decision_policy={
        "thresholds": {
          "nonLow": 0.35,
          "high": 0.20,
        },
      },
    )

    self.assertEqual(result.label, "Medium")
    self.assertEqual(result.stage, "non-low-threshold")

  def test_worsening_override_promotes_low_to_medium(self):
    result = apply_decision_policy(
      probabilities={
        "Low": 0.72,
        "Medium": 0.21,
        "High": 0.07,
      },
      signals=build_feature_signals(
        relative_to_free_flow=0.66,
        speed_change_rate=-0.16,
        incident_flag=False,
      ),
      decision_policy={
        "thresholds": {
          "nonLow": 0.40,
          "high": 0.20,
        },
      },
    )

    self.assertEqual(result.label, "Medium")
    self.assertEqual(result.stage, "rule-override")
    self.assertEqual(result.override_reason, "low-to-medium-worsening")

  def test_priority_metrics_penalize_false_alarms(self):
    metrics = build_priority_metrics(
      ["Low", "Low", "Medium", "High"],
      ["Medium", "Low", "Medium", "Medium"],
    )

    self.assertAlmostEqual(metrics["mediumRecall"], 1.0)
    self.assertAlmostEqual(metrics["highRecall"], 0.0)
    self.assertAlmostEqual(metrics["mediumHighRecall"], 1.0)
    self.assertAlmostEqual(metrics["lowFalseAlarmRate"], 0.5)
    self.assertLess(metrics["priorityScore"], 4.0)


if __name__ == "__main__":
  unittest.main()
