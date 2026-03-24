export type TravelLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type TravelRecordMap = Record<string, TravelLevel>;

export type RegionMeta = {
  id: string;
  name: string;
  nameEn: string;
  alpha2?: string;
  alpha3?: string;
};

export type TravelLevelDefinition = {
  level: TravelLevel;
  key: string;
  label: string;
  labelEn: string;
  color: string;
  description: string;
};

export type TravelStats = {
  visitedCount: number;
  totalMarked: number;
  countsByLevel: Record<TravelLevel, number>;
};

export type HoveredRegion = {
  id: string;
  name: string;
  nameEn: string;
  level: TravelLevel;
  x: number;
  y: number;
};
