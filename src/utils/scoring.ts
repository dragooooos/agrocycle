import type { PriorityId, Rotation } from "../types";

const PRIORITY_METRICS: Record<
  PriorityId,
  keyof Pick<Rotation, "water" | "soil" | "heat" | "erosion" | "pest" | "market">
> = {
  water: "water",
  soil: "soil",
  heat: "heat",
  erosion: "erosion",
  pest: "pest",
  income: "market",
};

const BASE_WEIGHTS: Record<PriorityId, number> = {
  water: 20,
  soil: 20,
  heat: 15,
  erosion: 15,
  pest: 10,
  income: 20,
};

export function calculateRotationScore(
  rotation: Rotation,
  priorities: PriorityId[],
) {
  const weights = { ...BASE_WEIGHTS };

  priorities.forEach((priority) => {
    weights[priority] *= 2;
  });

  const totalWeight = Object.values(weights).reduce(
    (sum, value) => sum + value,
    0,
  );

  const weightedScore = Object.entries(weights).reduce(
    (sum, [priority, weight]) => {
      const metric =
        PRIORITY_METRICS[priority as PriorityId];

      return sum + Number(rotation[metric]) * weight;
    },
    0,
  );

  return Math.round(weightedScore / totalWeight);
}

export function rankRotations(
  rotations: Rotation[],
  priorities: PriorityId[],
) {
  return rotations
    .map((rotation) => ({
      ...rotation,
      score: calculateRotationScore(rotation, priorities),
      recommended: false,
    }))
    .sort((a, b) => b.score - a.score)
    .map((rotation, index) => ({
      ...rotation,
      recommended: index === 0,
    }));
}

export function getScoreTone(score: number) {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}