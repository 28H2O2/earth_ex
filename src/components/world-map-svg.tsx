"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { memo, useMemo } from "react";

import { LEVEL_COLORS } from "@/data/travel-levels";
import { REGION_COLLECTION, REGION_FEATURES } from "@/lib/world-data";
import type { TravelLevel, TravelRecordMap } from "@/types/travel";

type WorldMapSvgProps = {
  width: number;
  height: number;
  records: TravelRecordMap;
  selectedId?: string;
  interactive?: boolean;
  transform?: {
    x: number;
    y: number;
    scale: number;
  };
  onCountrySelect?: (regionId: string) => void;
  onCountryHover?: (payload: {
    regionId: string;
    level: TravelLevel;
    name: string;
    nameEn: string;
    x: number;
    y: number;
  }) => void;
  onCountryLeave?: () => void;
};

export const WorldMapSvg = memo(function WorldMapSvg({
  width,
  height,
  records,
  selectedId,
  interactive = false,
  transform = { x: 0, y: 0, scale: 1 },
  onCountrySelect,
  onCountryHover,
  onCountryLeave,
}: WorldMapSvgProps) {
  const projection = useMemo(
    () =>
      geoNaturalEarth1().fitExtent(
        [
          [20, 20],
          [width - 20, height - 20],
        ],
        REGION_COLLECTION,
      ),
    [height, width],
  );

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="World travel map"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="worldex-sea" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#dff2ff" />
          <stop offset="100%" stopColor="#c6d9ff" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#worldex-sea)" rx="32" />
      <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
        {REGION_FEATURES.map((item) => {
          const isSelected = item.properties.id === selectedId;
          const level = records[item.properties.id] ?? 0;

          return (
            <path
              key={item.properties.id}
              d={pathGenerator(item) ?? ""}
              data-region-id={item.properties.id}
              fill={LEVEL_COLORS[level]}
              stroke={isSelected ? "#102542" : "#4e5d6c"}
              strokeWidth={isSelected ? 1.6 : 0.7}
              vectorEffect="non-scaling-stroke"
              className={
                interactive
                  ? "cursor-pointer transition-[opacity,stroke-width] duration-150 hover:opacity-80"
                  : ""
              }
              onClick={
                interactive && onCountrySelect
                  ? () => onCountrySelect(item.properties.id)
                  : undefined
              }
              onPointerMove={
                interactive && onCountryHover
                  ? (event) =>
                      onCountryHover({
                        regionId: item.properties.id,
                        level,
                        name: item.properties.name,
                        nameEn: item.properties.nameEn,
                        x: event.clientX,
                        y: event.clientY,
                      })
                  : undefined
              }
              onPointerLeave={interactive ? onCountryLeave : undefined}
            >
              <title>{item.properties.name}</title>
            </path>
          );
        })}
      </g>
    </svg>
  );
});
