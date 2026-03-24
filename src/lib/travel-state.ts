import type { TravelLevel, TravelRecordMap, TravelStats } from "@/types/travel";

const LEVEL_VALUES = new Set<TravelLevel>([0, 1, 2, 3, 4, 5]);

export const STORAGE_KEYS = {
  records: "worldex-records",
  authorName: "worldex-author-name",
} as const;

export function serializeTravelState(records: TravelRecordMap): string {
  return Object.entries(records)
    .filter(([, level]) => level > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, level]) => `${id}-${level}`)
    .join("_");
}

export function deserializeTravelState(value: string | null | undefined): TravelRecordMap {
  if (!value) {
    return {};
  }

  return value.split("_").reduce<TravelRecordMap>((accumulator, item) => {
    const [id, rawLevel] = item.split("-");
    const parsed = Number(rawLevel) as TravelLevel;

    if (!id || !LEVEL_VALUES.has(parsed) || parsed === 0) {
      return accumulator;
    }

    accumulator[id] = parsed;
    return accumulator;
  }, {});
}

export function computeTravelStats(records: TravelRecordMap): TravelStats {
  const countsByLevel: Record<TravelLevel, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  Object.values(records).forEach((level) => {
    countsByLevel[level] += 1;
  });

  return {
    visitedCount: Object.keys(records).length,
    totalMarked: Object.keys(records).length,
    countsByLevel,
  };
}

export function setTravelLevel(
  records: TravelRecordMap,
  regionId: string,
  level: TravelLevel,
): TravelRecordMap {
  if (level === 0) {
    const next = { ...records };
    delete next[regionId];
    return next;
  }

  return {
    ...records,
    [regionId]: level,
  };
}
