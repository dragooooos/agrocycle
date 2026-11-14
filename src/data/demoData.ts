import type { FieldData, Rotation } from "../types";

export const demoField: FieldData = {
  area: 14.8,

  climate: {
    meanTemperature: 14.8,
    temperatureAnomaly: 1.3,
    maxTemperature: 34.7,
    heatStressDays: 18,
    frostDays: 9,
  },

  water: {
    rainfall: 487,
    rainfallAnomaly: -14,
    soilMoisture: 0.19,
    soilMoistureAnomaly: -18,
    evapotranspiration: 612,
    waterStress: 63,
  },

  vegetation: {
    ndvi: 0.61,
    ndviAnomaly: -8,
    vegetationStress: "moderate",
  },

  soil: {
    organicMatter: 2.1,
    ph: 6.4,
    soilType: "Loam",
    slope: 6.8,
    erosionRisk: "moderate",
  },

  resilienceScore: 64,
};

export const rotations: Rotation[] = [
  {
    id: "soy-cover",

    name: "Wheat → Soybean → Cover Crop",

    crops: ["Wheat", "Soybean", "Cover crop"],

    score: 86,
    water: 84,
    soil: 91,
    heat: 78,
    erosion: 88,
    pest: 82,
    market: 73,

    explanation:
      "This rotation combines crop diversification with soil cover. Soybean can contribute nitrogen to the system, while the cover crop helps protect the soil during vulnerable periods.",

    benefits: [
      "Potential nitrogen contribution",
      "Lower water pressure",
      "Better soil coverage",
      "Breaks repeated crop cycles",
    ],

    risks: [
      "Local soybean market should be verified",
      "Actual nitrogen contribution depends on management",
      "Cover crop establishment may require additional planning",
    ],

    confidence: "medium",
    recommended: true,
  },

  {
    id: "sunflower-cover",

    name: "Wheat → Sunflower → Cover Crop",

    crops: ["Wheat", "Sunflower", "Cover crop"],

    score: 78,
    water: 76,
    soil: 79,
    heat: 88,
    erosion: 83,
    pest: 80,
    market: 76,

    explanation:
      "Sunflower adds crop diversity and can perform well under warm conditions. Keeping soil covered after harvest can reduce erosion exposure.",

    benefits: [
      "Strong heat tolerance",
      "Crop diversification",
      "Reduced bare-soil period",
      "Potential additional income",
    ],

    risks: [
      "Water demand still needs monitoring",
      "Local market conditions should be checked",
      "Performance depends on soil and seasonal conditions",
    ],

    confidence: "medium",
    recommended: false,
  },

  {
    id: "current",

    name: "Current Rotation",

    crops: ["Wheat", "Corn", "Wheat"],

    score: 61,
    water: 48,
    soil: 58,
    heat: 55,
    erosion: 52,
    pest: 45,
    market: 87,

    explanation:
      "The current rotation benefits from familiarity and established market channels, but repeated crops can increase water pressure and reduce diversification.",

    benefits: [
      "Existing equipment",
      "Known management practices",
      "Strong market familiarity",
      "Lower transition cost",
    ],

    risks: [
      "Higher potential water pressure",
      "Lower crop diversification",
      "Potential pest-cycle persistence",
      "More exposure to repeated crop stress",
    ],

    confidence: "high",
    recommended: false,
  },
];