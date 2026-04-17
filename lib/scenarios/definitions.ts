import scenarioDefinitions from "@/lib/scenarios/definitions.json";

export type ScenarioType = "baseline" | "disruption" | "mitigation";

export type ScenarioDefinition = {
  id: string;
  name: string;
  type: ScenarioType;
  sortOrder: number;
  summary: string;
  assumptions: string[];
  affectedSegmentIds: string[];
  demandMultiplier: number;
  affectedSpeedMultiplier: number;
  affectedLaneCount: number | null;
};

export const SCENARIO_DEFINITIONS = scenarioDefinitions as ScenarioDefinition[];

export function getScenarioDefinition(scenarioId: string): ScenarioDefinition | null {
  return SCENARIO_DEFINITIONS.find((scenario) => scenario.id === scenarioId) ?? null;
}
