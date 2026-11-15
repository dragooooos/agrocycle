/**
 * Builds the downloadable PDF report for the selected field: every value the
 * analysis page shows (including the folded FAQ sections), in one document.
 */
import { marketScore } from "../data/markets";
import type { FarmerConstraints, FieldAnalysis, FieldSelection, PriorityId, Rotation, RotationYear } from "../types";
import { monthRange, type CropFit, type Scenario } from "./cropSuitability";
import { THRESHOLDS } from "./fieldAnalysis";
import { PdfWriter, textWidth, type Rgb } from "./pdfWriter";
import { yearComparison } from "./yearComparison";

export type ReportTone = "good" | "watch" | "bad";

export interface ReportFinding {
  title: string;
  text: string;
  tone: ReportTone | "loading" | "missing";
}

export interface ReportMeasurement {
  label: string;
  value: string;
  description: string;
  change: string | null;
  tone?: ReportTone;
}

export interface ReportInput {
  field: FieldSelection;
  analysis: FieldAnalysis;
  verdict: string;
  findings: ReportFinding[];
  measurements: ReportMeasurement[];
  /** The rotations shown on the page: current / typical first, then the best alternatives. */
  rotations: Rotation[];
  cropFits: CropFit[];
  priorities: PriorityId[];
  constraints: FarmerConstraints;
  farmerNote: string;
  scenario: Scenario;
}

const GREEN: Rgb = [27, 111, 67];
const INK: Rgb = [33, 37, 41];
const SOFT: Rgb = [96, 104, 112];
const TONE: Record<ReportTone, Rgb> = { good: [46, 157, 79], watch: [184, 134, 11], bad: [212, 71, 44] };
const TONE_WORD: Record<ReportTone, string> = { good: "Fine", watch: "Worth watching", bad: "Concern" };
const PRIORITY_LABEL: Record<PriorityId, string> = {
  water: "Save water",
  soil: "Build soil health",
  heat: "Handle heat",
  erosion: "Reduce erosion",
  pest: "Break pest cycles",
  income: "Protect income",
};

const v = (value: number | null | undefined, unit = "") =>
  value === null || value === undefined ? "-" : `${value}${unit}`;
const pct = (value: number | null) => (value === null ? "-" : `${Math.round(value * 100)}%`);
const signed = (value: number) => `${value > 0 ? "+" : ""}${value}`;
const withUnit = (value: number, unit: string) => (unit === "%" ? `${value}%` : `${value} ${unit}`);
const markTone = (mark: number): ReportTone => (mark >= 75 ? "good" : mark >= 55 ? "watch" : "bad");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Plant and harvest month of each crop in a rotation calendar. */
function cropScheduleOf(years: RotationYear[] = []) {
  const seen = new Set<string>();
  const out: { name: string; plant: string; harvest: string; wholeYear: boolean }[] = [];
  years.forEach((year) =>
    year.segments.forEach((segment) => {
      const key = `${segment.name}-${segment.months[0]}-${segment.months[segment.months.length - 1]}`;
      if (seen.has(key) || segment.months.length === 0) return;
      seen.add(key);
      out.push({
        name: `${segment.name}${segment.role === "cover" ? " (cover crop)" : segment.role === "second" ? " (second crop)" : ""}`,
        plant: MONTHS[segment.months[0]],
        harvest: MONTHS[segment.months[segment.months.length - 1]],
        wholeYear: segment.months.length >= 12,
      });
    }),
  );
  return out;
}

export function reportFileName(field: FieldSelection) {
  const date = new Date().toISOString().slice(0, 10);
  return `agrocycle-report-${field.latitude.toFixed(3)}_${field.longitude.toFixed(3)}-${date}.pdf`;
}

export function buildFieldReport(input: ReportInput): Blob {
  const { field, analysis: a } = input;
  const pdf = new PdfWriter();
  const W = pdf.contentWidth;
  const M = pdf.margin;

  const place = a.country
    ? [a.country.county, a.country.state, a.country.name].filter(Boolean).join(", ")
    : "Location name unavailable";
  const coords = `${field.latitude.toFixed(4)}, ${field.longitude.toFixed(4)}`;
  const created = new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  pdf.onNewPage = () => {
    pdf.text("AgroCycle field report", M, pdf.y, { size: 8, bold: true, color: GREEN });
    pdf.text(coords, M + W - textWidth(coords, 8), pdf.y, { size: 8, color: SOFT });
    pdf.y += 12;
    pdf.line(M, pdf.y, M + W, pdf.y);
    pdf.y += 14;
  };

  const section = (title: string, lead?: string) => {
    pdf.ensure(70);
    pdf.y += 6;
    pdf.rect(M, pdf.y + 1, 3, 15, GREEN);
    pdf.text(title, M + 10, pdf.y, { size: 13.5, bold: true, color: INK });
    pdf.y += 22;
    if (lead) pdf.paragraph(lead, { size: 9, color: SOFT, gap: 6 });
  };

  const subheading = (title: string) => {
    pdf.ensure(40);
    pdf.text(title, M, pdf.y, { size: 10.5, bold: true, color: INK });
    pdf.y += 15;
  };

  const keyValues = (rows: [string, string][]) => {
    const filled = rows.filter(([, value]) => value && value !== "-");
    if (!filled.length) return;
    pdf.table(
      ["Measure", "Value"],
      filled.map(([key, value]) => [{ text: key, color: SOFT }, value]),
      [0.42, 0.58],
    );
  };

  /* ------------------------------ cover ------------------------------ */

  pdf.rect(0, 0, pdf.width, 118, GREEN);
  pdf.text("AGROCYCLE · FIELD REPORT", M, 30, { size: 8.5, bold: true, color: [190, 230, 205] });
  pdf.text(place, M, 46, { size: 21, bold: true, color: [255, 255, 255] });
  pdf.text(
    `${coords} · ${field.selectionType === "point" ? "point analysis" : `field of ${field.area.toLocaleString("en-GB", { maximumFractionDigits: 2 })} m²`}`,
    M,
    76,
    { size: 10, color: [225, 242, 231] },
  );
  pdf.text(`Created ${created} · data ${a.period.start} to ${a.period.end}`, M, 92, {
    size: 8.5,
    color: [190, 230, 205],
  });
  pdf.y = 140;

  /* ---------------------------- resilience ---------------------------- */

  const score = a.resilienceScore ?? 0;
  const tone = markTone(score);
  pdf.circle(M + 34, pdf.y + 34, 34, TONE[tone]);
  const scoreText = String(score);
  pdf.text(scoreText, M + 34 - textWidth(scoreText, 26, true) / 2, pdf.y + 20, { size: 26, bold: true, color: [255, 255, 255] });
  pdf.text("/100", M + 34 - textWidth("/100", 8) / 2, pdf.y + 48, { size: 8, color: [255, 255, 255] });
  pdf.text("FIELD RESILIENCE", M + 86, pdf.y + 6, { size: 8, bold: true, color: SOFT });
  const verdictLines = pdf.wrap(input.verdict, W - 86, { size: 15, bold: true });
  verdictLines.forEach((line, i) => pdf.text(line, M + 86, pdf.y + 20 + i * 19, { size: 15, bold: true }));
  pdf.text(
    `Last 12 months · data confidence ${a.confidence}`,
    M + 86,
    pdf.y + 24 + verdictLines.length * 19,
    { size: 9, color: SOFT },
  );
  pdf.y += 86;

  if (a.resilienceParts.length) {
    subheading("What is behind this score");
    const barX = M + 190;
    const barW = W - 190 - 90;
    a.resilienceParts.forEach((part) => {
      pdf.ensure(18);
      pdf.text(part.label, M, pdf.y, { size: 9 });
      pdf.rect(barX, pdf.y + 1, barW, 8, [236, 239, 237]);
      pdf.rect(barX, pdf.y + 1, (barW * part.mark) / 100, 8, TONE[markTone(part.mark)]);
      pdf.text(String(part.mark), barX + barW + 10, pdf.y, { size: 9, bold: true });
      pdf.text(`weight ${part.weight}%`, barX + barW + 32, pdf.y, { size: 8, color: SOFT });
      pdf.y += 16;
    });
    pdf.paragraph(
      "Weighted average of the marks above (0-100, higher is better). Missing data is left out rather than counted against the field.",
      { size: 8.5, color: SOFT, gap: 10 },
    );
  }

  /* ----------------------------- findings ----------------------------- */

  const findings = input.findings.filter((f) => f.tone !== "loading" && f.tone !== "missing");
  if (findings.length) {
    section("Key findings");
    findings.forEach((finding) => {
      const lines = pdf.wrap(finding.text, W - 16, { size: 9 });
      pdf.ensure(16 + lines.length * 12.5);
      pdf.circle(M + 4, pdf.y + 5, 3.2, TONE[finding.tone as ReportTone]);
      pdf.text(finding.title, M + 14, pdf.y, { size: 10, bold: true });
      pdf.y += 14;
      pdf.paragraph(finding.text, { size: 9, indent: 14, color: SOFT, gap: 6 });
    });
  }

  /* --------------------------- measurements --------------------------- */

  if (input.measurements.length) {
    section("Last 12 months", "Coloured values: green = fine, yellow = worth watching, red = concern, against what is normal for this field.");
    pdf.table(
      ["Measure", "Value", "Detail", "vs normal", "Status"],
      input.measurements.map((m) => [
        m.label,
        { text: m.value, bold: true, color: m.tone ? TONE[m.tone] : INK },
        m.description || "-",
        m.change ?? "-",
        m.tone ? { text: TONE_WORD[m.tone], color: TONE[m.tone] } : "-",
      ]),
      [0.25, 0.17, 0.27, 0.14, 0.17],
    );
  }

  /* ---------------------------- year check ---------------------------- */

  const years = yearComparison(a);
  if (years.length) {
    section("Was this year normal?", "The last 12 months next to the average of earlier years at this field.");
    years.forEach((row) => {
      pdf.ensure(44);
      const max = Math.max(row.normal, row.current, 1);
      const barX = M + 130;
      const barW = W - 130 - 150;
      pdf.text(row.label, M, pdf.y + 5, { size: 9.5, bold: true });
      pdf.rect(barX, pdf.y, (barW * row.normal) / max, 8, [180, 188, 184]);
      pdf.text(`Normal ${withUnit(row.normal, row.unit)}`, barX + barW + 8, pdf.y - 1, { size: 8.5, color: SOFT });
      pdf.rect(barX, pdf.y + 12, (barW * row.current) / max, 8, GREEN);
      pdf.text(`This year ${withUnit(row.current, row.unit)}`, barX + barW + 8, pdf.y + 11, { size: 8.5 });
      const change = row.normal === 0 && row.current === 0 ? "-" : `${signed(row.change)}%`;
      // Less rain or moisture is worse; more hot or frost days is worse.
      const worse = row.id === "rain" || row.id === "moisture" ? row.change <= -5 : row.change >= 5;
      const better = row.id === "rain" || row.id === "moisture" ? row.change >= 5 : row.change <= -5;
      pdf.text(change, M + W - textWidth(change, 10, true), pdf.y + 5, {
        size: 10,
        bold: true,
        color: worse ? TONE.bad : better ? TONE.good : SOFT,
      });
      pdf.y += 32;
    });
    pdf.y += 4;
  }

  /* ---------------------------- rotations ---------------------------- */

  section(
    "Rotation options",
    `Ranked on your priorities${input.priorities.length ? ` (${input.priorities.map((p) => PRIORITY_LABEL[p]).join(", ")})` : ""}. The first is your current or typical local rotation.` +
      (input.scenario.deltaT || input.scenario.rainPct
        ? ` Scores use a climate scenario of ${signed(input.scenario.deltaT)} °C and ${signed(input.scenario.rainPct)}% rain.`
        : ""),
  );
  if (!input.rotations.length)
    pdf.paragraph("No crop in the library has a long or warm enough season here, so no rotation is suggested.", { size: 9.5 });
  input.rotations.forEach((rotation, index) => {
    pdf.ensure(120);
    const head = `${index + 1}. ${rotation.name}`;
    pdf.rect(M, pdf.y, W, 26, rotation.recommended ? [228, 244, 233] : [243, 245, 244]);
    pdf.text(head, M + 8, pdf.y + 5, { size: 11, bold: true });
    pdf.text(`${rotation.score}/100`, M + W - 52, pdf.y + 5, { size: 11, bold: true, color: GREEN });
    pdf.y += 31;
    const meta = [
      rotation.recommended ? "Best match for your priorities" : null,
      rotation.id === "current" ? (rotation.assumed ? "Typical local rotation (assumed)" : "Your current rotation") : null,
      rotation.strategy,
      rotation.fit !== undefined ? `Climate & soil fit ${rotation.fit}/100` : null,
      `confidence ${rotation.confidence}`,
    ].filter(Boolean);
    pdf.paragraph(meta.join(" · "), { size: 8.5, color: SOFT, gap: 3 });
    if (rotation.explanation) pdf.paragraph(rotation.explanation, { size: 9.5, gap: 5 });

    const schedule = cropScheduleOf(rotation.calendar);
    if (schedule.length)
      pdf.table(
        ["Crop", "Plant", "Harvest"],
        schedule.map((c) => [c.name, c.wholeYear ? "All year" : c.plant, c.wholeYear ? "-" : c.harvest]),
        [0.5, 0.25, 0.25],
      );
    pdf.table(
      ["Water", "Soil", "Heat", "Erosion", "Pests", "Market"],
      [[rotation.water, rotation.soil, rotation.heat, rotation.erosion, rotation.pest, rotation.market].map((s) => ({
        text: `${s}/100`,
        color: TONE[markTone(s)],
        bold: true,
      }))],
      [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
      { zebra: false },
    );
    const list = (title: string, items?: string[]) => {
      if (!items?.length) return;
      pdf.ensure(30);
      pdf.text(title, M, pdf.y, { size: 9.5, bold: true });
      pdf.y += 13;
      pdf.bullets(items, { size: 9 });
    };
    list("Benefits", rotation.benefits);
    list("Risks", rotation.risks);
    list("Evidence", rotation.evidence);
    list("Information gaps", rotation.infoGaps);
    pdf.y += 6;
  });

  /* ------------------------------ crops ------------------------------ */

  if (input.cropFits.length) {
    section("Which crops suit this field?", `Fit with this field's climate and soil${input.constraints.irrigation ? ", with irrigation" : ""}.`);
    pdf.table(
      ["Crop", "Season", "Fit", "Notes"],
      input.cropFits.slice(0, 15).map((f) => {
        const notes = [
          marketScore(f.crop.id, a.country?.code ?? null, a.latitude, a.longitude) >= 60 ? "common locally" : null,
          f.crop.nFix ? "fixes nitrogen" : null,
          f.crop.droughtTol >= 0.7 ? "drought-tolerant" : null,
          f.crop.heatTol >= 0.8 ? "heat-tolerant" : null,
        ].filter(Boolean);
        if (f.limiting[0]) notes.push(f.limiting[0]);
        return [
          f.crop.name,
          f.best ? monthRange(f.best.occupied) : "-",
          { text: `${f.score}/100`, bold: true, color: TONE[markTone(f.score)] },
          notes.join("; ") || "-",
        ];
      }),
      [0.22, 0.2, 0.12, 0.46],
    );
    if (a.extras.usdaYields) {
      const y = a.extras.usdaYields;
      pdf.paragraph(
        `Recent yields in ${y.county}, ${y.state}: ` +
          y.crops.map((c) => `${c.commodity} ${c.latest} ${c.unit.toLowerCase()} (${c.latestYear})`).join(" · "),
        { size: 9, color: SOFT, gap: 8 },
      );
    }
  }

  /* --------------------------- soil & terrain --------------------------- */

  section("Soil and terrain");
  const s = a.soil;
  keyValues([
    ["Soil type", s.soilType ?? "-"],
    ["Soil data source", s.soilSource ?? "-"],
    ["Map unit", s.mapUnit ?? "-"],
    ["Clay / sand / silt", s.clay !== null ? `${v(s.clay, "%")} / ${v(s.sand, "%")} / ${v(s.silt, "%")}` : "-"],
    ["Organic matter (0-30 cm)", v(s.organicMatter, "%")],
    ["pH", v(s.ph)],
    ["Bulk density", v(s.bulkDensity, " g/cm³")],
    ["Porosity", s.porosity !== null ? pct(s.porosity) : "-"],
    ["Drainage", s.drainage ?? "-"],
    ["Hydrologic group", s.hydrologicGroup ?? "-"],
    ["Available water capacity", v(s.awc, " cm/cm")],
    ["Elevation", v(s.elevation, " m")],
    ["Slope", v(s.slope, "%")],
    ["Erosion risk", s.erosionRisk],
  ]);

  /* ---------------------------- water & climate ---------------------------- */

  section("Water and climate details", `Last 12 months (${a.period.start} to ${a.period.end}); "normal" is the same window in earlier years since ${a.period.baselineStart}.`);
  const w = a.water;
  const c = a.climate;
  const x = a.extras;
  keyValues([
    ["Rainfall", w.rainfall !== null ? `${w.rainfall} mm${w.rainfallAnomaly !== null ? ` (${signed(w.rainfallAnomaly)}% vs normal)` : ""}` : "-"],
    [`Heavy-rain days (>= ${THRESHOLDS.heavyRainMm} mm)`, v(w.heavyRainDays)],
    ["Surface soil wetness", pct(w.surfaceWetness)],
    ["Root-zone soil moisture", w.rootZoneWetness !== null ? `${pct(w.rootZoneWetness)}${w.rootZoneAnomaly !== null ? ` (${signed(w.rootZoneAnomaly)}% vs normal)` : ""}` : "-"],
    ["Root-zone water content", v(w.rootZoneVolumetric, " m³/m³")],
    ["Crop water demand (ET0)", v(w.evapotranspiration, " mm")],
    ["Water balance (rain - demand)", v(w.waterBalance, " mm")],
    ["Water stress index", `${w.waterStress}/100`],
    ["Mean temperature", c.meanTemperature !== null ? `${c.meanTemperature} °C${c.temperatureAnomaly !== null ? ` (${signed(c.temperatureAnomaly)} °C vs normal)` : ""}` : "-"],
    ["Highest temperature", v(c.maxTemperature, " °C")],
    [`Days above ${THRESHOLDS.heatDayC} °C`, c.heatStressDays !== null ? `${c.heatStressDays} (typically ${v(c.heatStressBaseline)})` : "-"],
    ["Frost days", c.frostDays !== null ? `${c.frostDays} (typically ${v(c.frostBaseline)})` : "-"],
    ["Vegetation greenness (NDVI)", a.vegetation.ndvi !== null ? `${a.vegetation.ndvi}${a.vegetation.ndviAnomaly !== null ? ` (${signed(a.vegetation.ndviAnomaly)}% vs normal)` : ""}${a.vegetation.date ? `, ${a.vegetation.date}` : ""}` : "-"],
    ["Vegetation stress", a.vegetation.vegetationStress ?? "-"],
    ["ERA5-Land root-zone check", x.era5?.rootZone != null ? `${x.era5.rootZone} m³/m³${x.era5.rootZoneAnomaly !== null ? ` (${signed(x.era5.rootZoneAnomaly)}% vs normal)` : ""}` : "-"],
    ["Groundwater (nearest well)", x.groundwater ? `${x.groundwater.latestDepthM} m deep, ${x.groundwater.distanceKm} km away, ${signed(x.groundwater.trendMPerDecade)} m per decade (${x.groundwater.latestDate})` : "-"],
    ["Actual water use (OpenET)", x.openet ? `${x.openet.annualEt} mm in ${x.openet.year}` : "-"],
    ["Latest clear Sentinel-2 image", x.sentinel2 ? `${x.sentinel2.latestDate}, ${x.sentinel2.cloudCover}% cloud, ${x.sentinel2.clearScenes90d} clear passes in 90 days` : "-"],
  ]);

  /* ----------------------------- season ----------------------------- */

  if (a.monthly.length) {
    section("A typical year at this field", "Monthly averages since 2015.");
    pdf.table(
      ["Month", "Soil moisture", "Rain", "Mean", "Max", "Min", "ET0", "Frost d.", "Hot d."],
      a.monthly.map((m) => [
        { text: m.month, bold: true },
        { text: pct(m.rootWetness), color: m.rootWetness !== null && m.rootWetness < 0.45 ? TONE.watch : INK },
        v(m.rainMm, " mm"),
        v(m.tMean, " °C"),
        v(m.tMax, " °C"),
        v(m.tMin, " °C"),
        v(m.et0, " mm"),
        { text: String(m.frostDays), color: m.frostDays >= 5 ? TONE.watch : INK },
        { text: String(m.heatDays), color: m.heatDays >= 2 ? TONE.bad : INK },
      ]),
      [0.09, 0.13, 0.11, 0.1, 0.1, 0.1, 0.11, 0.13, 0.13],
      { size: 8.4 },
    );
  }

  /* ----------------------------- outlook ----------------------------- */

  section("What could the coming years look like?");
  pdf.bullets(
    [
      `${a.odds.dryGrowingSeasons.count} of ${a.odds.dryGrowingSeasons.of} recent growing seasons were dry.`,
      `${a.odds.hotYears.count} of ${a.odds.hotYears.of} recent years had 10 or more days above ${THRESHOLDS.heatDayC} °C.`,
      `${a.odds.lateFrostYears.count} of ${a.odds.lateFrostYears.of} recent years had a late spring frost.`,
    ],
    { size: 9.5 },
  );
  if (a.trends.length) {
    pdf.paragraph("If recent years' pattern continues. Not a weather forecast.", { size: 9, color: SOFT });
    pdf.table(
      ["Measure", "Last full year", `Expected by ${a.trends[0].projectionYear}`, "Likely range", "Direction"],
      a.trends.map((t) => {
        const last = t.values[t.values.length - 1];
        return [
          t.label,
          last ? withUnit(last.value, t.unit) : "-",
          withUnit(t.projection, t.unit),
          `${t.low}-${t.high}`,
          !t.significant ? "No clear change" : t.slopePerDecade > 0 ? "Rising" : "Falling",
        ];
      }),
      [0.3, 0.17, 0.19, 0.16, 0.18],
    );
  }
  const p = x.projection;
  if (p) {
    subheading(`Climate models for ${p.future}`);
    pdf.paragraph(
      `About ${signed(p.deltaT)} °C (range ${p.deltaTRange[0]} to ${p.deltaTRange[1]}) and ${signed(p.rainPct)}% rain ` +
        `(range ${p.rainPctRange[0]} to ${p.rainPctRange[1]}) compared with ${p.baseline}. Days above 32 °C: ` +
        `${p.hotDaysBaseline} -> ${p.hotDaysFuture} a year. Models: ${p.models.join(", ")}.`,
      { size: 9.5, gap: 8 },
    );
  }

  /* ------------------------------ inputs ------------------------------ */

  section("What you told AgroCycle");
  keyValues([
    ["Priorities", input.priorities.length ? input.priorities.map((id) => PRIORITY_LABEL[id]).join(", ") : "None selected (balanced)"],
    ["Current crops", input.constraints.currentCrops.length ? input.constraints.currentCrops.join(", ") : "Not given"],
    ["Irrigation", input.constraints.irrigation ? "Yes" : "No"],
    ["Livestock", input.constraints.livestock ? "Yes" : "No"],
    ["Note", input.farmerNote || "-"],
  ]);

  /* ---------------------------- reliability ---------------------------- */

  section("How reliable is this?");
  pdf.bullets(
    [
      ...a.caveats,
      "Future seasons can behave differently from the 2015-present record.",
      "Soil and moisture vary within a field; satellite data averages them out.",
      "Prices, contracts and demand are not measured here. Check them before you commit.",
      "Varieties, pests, machinery and labour are best judged by you and your agronomist.",
    ],
    { size: 9 },
  );

  /* ------------------------------ sources ------------------------------ */

  section("Where the data comes from", "Fetched live for these coordinates.");
  pdf.table(
    ["Source", "Status", "Details"],
    a.sources.map((src) => {
      const status = src.ok
        ? { text: "Used", color: TONE.good }
        : src.pending
          ? { text: "Still loading", color: SOFT }
          : src.notApplicable
            ? { text: "Not used here", color: SOFT }
            : { text: "Unavailable", color: TONE.bad };
      return [
        { text: `${src.name}\n${src.provider}`, bold: false },
        status,
        `${src.detail}${src.url ? `\n${src.url}` : ""}`,
      ];
    }),
    [0.27, 0.14, 0.59],
    { size: 8 },
  );

  pdf.paragraph("A decision aid, not a replacement for local agronomic advice.", { size: 9, color: SOFT });

  return pdf.toBlob(`AgroCycle · ${place} · ${coords}`);
}

/** Builds the report and starts the download in the browser. */
export function downloadFieldReport(input: ReportInput) {
  const blob = buildFieldReport(input);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reportFileName(input.field);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
