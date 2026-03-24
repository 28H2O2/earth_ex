import { feature } from "topojson-client";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import zhLocale from "i18n-iso-countries/langs/zh.json";
import worldTopology from "world-atlas/countries-50m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";

import type { RegionMeta } from "@/types/travel";

countries.registerLocale(enLocale);
countries.registerLocale(zhLocale);

type WorldGeometryProperties = {
  name?: string;
};

type RegionFeature = Feature<Geometry, RegionMeta>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

const worldCountries = feature(
  worldTopology as never,
  (worldTopology as typeof worldTopology).objects.countries as never,
) as unknown as FeatureCollection<Geometry, WorldGeometryProperties>;

const regions = worldCountries.features
  .map((item, index) => {
    const numericId = `${item.id ?? ""}`.padStart(3, "0");
    const alpha2 = countries.numericToAlpha2(numericId) ?? undefined;
    const alpha3 = countries.numericToAlpha3(numericId) ?? undefined;
    const nameEn =
      (alpha2 && countries.getName(alpha2, "en")) ||
      item.properties?.name ||
      numericId;
    const name =
      (alpha2 && countries.getName(alpha2, "zh")) ||
      item.properties?.name ||
      nameEn;
    const fallbackNameSlug = slugify(item.properties?.name || nameEn || numericId || `${index}`);
    const primaryId = alpha3 || numericId;
    const uniqueId = `${primaryId}-${fallbackNameSlug || index}`;

    return {
      ...item,
      id: uniqueId,
      properties: {
        id: uniqueId,
        name,
        nameEn,
        alpha2,
        alpha3,
      },
    } satisfies RegionFeature;
  })
  .sort((left, right) => left.properties.name.localeCompare(right.properties.name, "zh-Hans-CN"));

export const REGION_FEATURES = regions;

export const REGION_COLLECTION: FeatureCollection<Geometry, RegionMeta> = {
  type: "FeatureCollection",
  features: REGION_FEATURES,
};

export const REGIONS = REGION_FEATURES.map((item) => item.properties);
