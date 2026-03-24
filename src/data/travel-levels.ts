import type { TravelLevelDefinition } from "@/types/travel";

export const TRAVEL_LEVELS: TravelLevelDefinition[] = [
  {
    level: 5,
    key: "lived",
    label: "Level 5",
    labelEn: "Lived there",
    color: "#d1495b",
    description: "居住过",
  },
  {
    level: 4,
    key: "stayed",
    label: "Level 4",
    labelEn: "Stayed there",
    color: "#edae49",
    description: "住宿过",
  },
  {
    level: 3,
    key: "visited",
    label: "Level 3",
    labelEn: "Visited there",
    color: "#66a182",
    description: "游玩过",
  },
  {
    level: 2,
    key: "alighted",
    label: "Level 2",
    labelEn: "Alighted there",
    color: "#3d84a8",
    description: "停留过",
  },
  {
    level: 1,
    key: "passed",
    label: "Level 1",
    labelEn: "Passed there",
    color: "#7d5ba6",
    description: "路过过",
  },
  {
    level: 0,
    key: "never",
    label: "Level 0",
    labelEn: "Never been there",
    color: "#eff1f3",
    description: "没去过",
  },
];

export const LEVEL_COLORS = Object.fromEntries(
  TRAVEL_LEVELS.map((item) => [item.level, item.color]),
) as Record<number, string>;
