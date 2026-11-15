import type { FieldAnalysis } from "../types";
import { THRESHOLDS } from "./fieldAnalysis";

export interface YearComparisonRow {
  id: "rain" | "moisture" | "heat" | "frost";
  label: string;
  unit: string;
  normal: number;
  current: number;
  /** % change from normal, rounded. */
  change: number;
}

const withChange = (row: Omit<YearComparisonRow, "change">): YearComparisonRow => ({
  ...row,
  change: row.normal ? Math.round(((row.current - row.normal) / row.normal) * 100) : 0,
});

/**
 * The last 12 months next to the average of the same 12-month window in
 * earlier years (2015 onwards) at this field. "Normal" is rebuilt from the
 * current value and its anomaly, so it matches the numbers used elsewhere.
 */
export function yearComparison(a: FieldAnalysis): YearComparisonRow[] {
  const rows: YearComparisonRow[] = [];
  const { water, climate } = a;

  if (water.rainfall !== null && water.rainfallAnomaly !== null) {
    rows.push(
      withChange({
        id: "rain",
        label: "Rain",
        unit: "mm",
        current: Math.round(water.rainfall),
        normal: Math.round(water.rainfall / (1 + water.rainfallAnomaly / 100)),
      }),
    );
  }

  if (water.rootZoneWetness !== null && water.rootZoneAnomaly !== null) {
    const current = Math.round(water.rootZoneWetness * 100);
    rows.push(
      withChange({
        id: "moisture",
        label: "Soil moisture",
        unit: "%",
        current,
        normal: Math.round(current / (1 + water.rootZoneAnomaly / 100)),
      }),
    );
  }

  if (climate.heatStressDays !== null && climate.heatStressBaseline !== null) {
    rows.push(
      withChange({
        id: "heat",
        label: `Days above ${THRESHOLDS.heatDayC} °C`,
        unit: "days",
        current: climate.heatStressDays,
        normal: climate.heatStressBaseline,
      }),
    );
  }

  if (climate.frostDays !== null && climate.frostBaseline !== null) {
    rows.push(
      withChange({
        id: "frost",
        label: "Frost days",
        unit: "days",
        current: climate.frostDays,
        normal: climate.frostBaseline,
      }),
    );
  }

  // A row where both values are zero (e.g. frost in the tropics) says nothing: leave it out.
  return rows.filter((row) => row.normal > 0 || row.current > 0);
}
