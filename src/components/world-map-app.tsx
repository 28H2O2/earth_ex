"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { toPng } from "html-to-image";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { TRAVEL_LEVELS } from "@/data/travel-levels";
import { REGION_COLLECTION, REGION_FEATURES, REGIONS } from "@/lib/world-data";
import {
  computeTravelStats,
  deserializeTravelState,
  serializeTravelState,
  setTravelLevel,
  STORAGE_KEYS,
} from "@/lib/travel-state";
import type { HoveredRegion, RegionMeta, TravelLevel, TravelRecordMap } from "@/types/travel";

import { WorldMapSvg } from "./world-map-svg";

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 720;
const EXPORT_WIDTH = 1600;
const EXPORT_HEIGHT = 980;
const EXPORT_MAP_ONLY_HEIGHT = 900;
const MIN_SCALE = 1;
const MAX_SCALE = 8;

type TransformState = {
  x: number;
  y: number;
  scale: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getInitialTransform(): TransformState {
  return { x: 0, y: 0, scale: 1 };
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function WorldMapApp() {
  const [records, setRecords] = useState<TravelRecordMap>({});
  const [authorName, setAuthorName] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [transform, setTransform] = useState<TransformState>(getInitialTransform);
  const [targetScale, setTargetScale] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState<"" | "poster" | "map">("");
  const [shareMessage, setShareMessage] = useState("");
  const [hoveredRegion, setHoveredRegion] = useState<HoveredRegion | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const mapOnlyRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const projection = useMemo(
    () =>
      geoNaturalEarth1().fitExtent(
        [
          [20, 20],
          [MAP_WIDTH - 20, MAP_HEIGHT - 20],
        ],
        REGION_COLLECTION,
      ),
    [],
  );

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);

  const selectedRegion = useMemo(
    () => REGIONS.find((item) => item.id === selectedId),
    [selectedId],
  );

  const stats = useMemo(() => computeTravelStats(records), [records]);

  const filteredRegions = useMemo(() => {
    if (!deferredSearchTerm.trim()) {
      return REGIONS.slice(0, 12);
    }

    const keyword = deferredSearchTerm.trim().toLowerCase();
    return REGIONS.filter((item) => {
      return (
        item.name.toLowerCase().includes(keyword) ||
        item.nameEn.toLowerCase().includes(keyword) ||
        item.alpha2?.toLowerCase().includes(keyword) ||
        item.alpha3?.toLowerCase().includes(keyword)
      );
    }).slice(0, 12);
  }, [deferredSearchTerm]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedState = deserializeTravelState(params.get("s"));
    const cachedState = deserializeTravelState(localStorage.getItem(STORAGE_KEYS.records));
    const cachedName = localStorage.getItem(STORAGE_KEYS.authorName);

    setRecords(Object.keys(sharedState).length > 0 ? sharedState : cachedState);
    setAuthorName(cachedName ?? "");
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const serialized = serializeTravelState(records);
    const params = new URLSearchParams(window.location.search);

    if (serialized) {
      params.set("s", serialized);
      localStorage.setItem(STORAGE_KEYS.records, serialized);
    } else {
      params.delete("s");
      localStorage.removeItem(STORAGE_KEYS.records);
    }

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [isLoaded, records]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    localStorage.setItem(STORAGE_KEYS.authorName, authorName);
  }, [authorName, isLoaded]);

  useEffect(() => {
    if (Math.abs(transform.scale - targetScale) < 0.01) {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      setTransform((current) => ({
        ...current,
        scale: current.scale + (targetScale - current.scale) * 0.18,
      }));
    });

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetScale, transform.scale]);

  const focusRegion = useCallback((regionId: string) => {
    const target = REGION_FEATURES.find((item) => item.properties.id === regionId);
    if (!target) {
      return;
    }

    const [[minX, minY], [maxX, maxY]] = pathGenerator.bounds(target);
    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;
    const nextScale = clamp(
      Math.min((MAP_WIDTH * 0.7) / regionWidth, (MAP_HEIGHT * 0.7) / regionHeight),
      MIN_SCALE,
      MAX_SCALE,
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setTransform({
      scale: nextScale,
      x: MAP_WIDTH / 2 - centerX * nextScale,
      y: MAP_HEIGHT / 2 - centerY * nextScale,
    });
    setTargetScale(nextScale);
  }, [pathGenerator]);

  const updateZoom = useCallback((nextScale: number, anchor?: { x: number; y: number }) => {
    setTransform((current) => {
      const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const centerX = anchor?.x ?? MAP_WIDTH / 2;
      const centerY = anchor?.y ?? MAP_HEIGHT / 2;
      const ratio = clampedScale / current.scale;

      return {
        scale: clampedScale,
        x: centerX - (centerX - current.x) * ratio,
        y: centerY - (centerY - current.y) * ratio,
      };
    });
    setTargetScale(clamp(nextScale, MIN_SCALE, MAX_SCALE));
  }, []);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const delta = event.deltaY < 0 ? 1.12 : 0.9;
    updateZoom(transform.scale * delta, { x: pointerX, y: pointerY });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (
      target.closest(
        [
          "[data-region-id]",
          "button",
          "input",
          "textarea",
          "select",
          "label",
          "a",
          "[role='button']",
        ].join(","),
      )
    ) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const hasMoved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;

    setTransform((current) => ({
      ...current,
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    }));
    dragState.moved = hasMoved;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function handleExport(mode: "poster" | "map") {
    const node = mode === "poster" ? posterRef.current : mapOnlyRef.current;
    if (!node) {
      return;
    }

    setIsExporting(mode);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
      });
      downloadDataUrl(
        dataUrl,
        mode === "poster" ? "worldex-poster.png" : "worldex-map.png",
      );
    } finally {
      setIsExporting("");
    }
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setShareMessage("分享链接已复制");
    window.setTimeout(() => setShareMessage(""), 1600);
  }

  const handleSelectRegion = useCallback((region: RegionMeta) => {
    setSelectedId(region.id);
    setSearchTerm("");
  }, []);

  const handleSearchSelectRegion = useCallback((region: RegionMeta) => {
    setSelectedId(region.id);
    focusRegion(region.id);
    setSearchTerm("");
  }, [focusRegion]);

  const handleCountrySelect = useCallback((regionId: string) => {
    const region = REGIONS.find((item) => item.id === regionId);
    if (!region) {
      return;
    }

    startTransition(() => {
      handleSelectRegion(region);
    });
  }, [handleSelectRegion]);

  const handleCountryHover = useCallback(
    (payload: {
      regionId: string;
      level: TravelLevel;
      name: string;
      nameEn: string;
      x: number;
      y: number;
    }) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setHoveredRegion({
        id: payload.regionId,
        level: payload.level,
        name: payload.name,
        nameEn: payload.nameEn,
        x: payload.x - rect.left,
        y: payload.y - rect.top,
      });
    },
    [],
  );

  const handleCountryLeave = useCallback(() => {
    setHoveredRegion(null);
  }, []);

  function resetView() {
    setTransform(getInitialTransform());
    setTargetScale(1);
  }

  return (
    <>
      <main className="mx-auto flex min-h-screen w-full max-w-[1700px] flex-col gap-6 px-4 py-5 lg:px-6">
        <section className="grid gap-4 rounded-[36px] border border-white/60 bg-white/75 p-5 shadow-[0_30px_90px_rgba(31,50,81,0.1)] backdrop-blur lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-[30px] bg-[linear-gradient(135deg,#102542,#16324f_30%,#224870_60%,#2f6690)] p-6 text-white shadow-[0_24px_60px_rgba(16,37,66,0.28)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-sm uppercase tracking-[0.28em] text-sky-100/80">WorldEx</p>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">世界旅行地图</h1>
                  <p className="max-w-2xl text-sm leading-6 text-sky-50/84">
                    点击国家设置你的旅行等级。状态会自动保存在本地，并同步到分享链接里。
                  </p>
                </div>
                <div className="grid min-w-[240px] grid-cols-2 gap-3 text-right text-sm">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-sky-100/80">已标记国家</div>
                    <div className="mt-1 text-3xl font-semibold">{stats.visitedCount}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-sky-100/80">导出模式</div>
                    <div className="mt-1 text-lg font-semibold">海报图 / 纯地图</div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px]">
                <label className="space-y-2">
                  <span className="text-sm text-sky-100/80">你的名字</span>
                  <input
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    placeholder="例如：H2O2 的世界地图"
                    className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-500"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm text-sky-100/80">搜索国家 / 地区</span>
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="输入中文、英文或代码"
                    className="w-full rounded-2xl border border-white/10 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-500"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-sky-100/80">
                <span className="rounded-full bg-white/10 px-3 py-1.5">6 级状态分类</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">完整图片导出</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5">分享链接恢复</span>
              </div>
            </div>

            <div
              ref={viewportRef}
              className="relative aspect-[5/3] overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_30px_80px_rgba(31,50,81,0.08)]"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.92),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(47,102,144,0.08),transparent_24%)]" />
              <WorldMapSvg
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                records={records}
                selectedId={selectedId}
                interactive
                transform={transform}
                onCountrySelect={handleCountrySelect}
                onCountryHover={handleCountryHover}
                onCountryLeave={handleCountryLeave}
              />
              {hoveredRegion ? (
                <div
                  className="pointer-events-none absolute z-20 min-w-44 -translate-x-1/2 rounded-2xl border border-slate-200/90 bg-white/96 px-3 py-2 shadow-[0_18px_40px_rgba(16,37,66,0.16)] backdrop-blur"
                  style={{
                    left: clamp(hoveredRegion.x, 84, MAP_WIDTH - 84),
                    top: clamp(hoveredRegion.y - 18, 18, MAP_HEIGHT - 18),
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <div className="text-sm font-semibold text-slate-900">{hoveredRegion.name}</div>
                  <div className="text-xs text-slate-500">{hoveredRegion.nameEn}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-slate-300"
                      style={{
                        backgroundColor:
                          TRAVEL_LEVELS.find((item) => item.level === hoveredRegion.level)?.color ??
                          "#eff1f3",
                      }}
                    />
                    {TRAVEL_LEVELS.find((item) => item.level === hoveredRegion.level)?.labelEn}
                  </div>
                </div>
              ) : null}
              <div className="pointer-events-none absolute bottom-4 left-4 flex gap-2">
                <span className="rounded-full bg-slate-950/85 px-3 py-1 text-xs font-medium text-white">
                  缩放 {transform.scale.toFixed(2)}x
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  滚轮缩放，拖拽平移
                </span>
              </div>
              <div className="absolute right-4 top-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateZoom(transform.scale * 1.2)}
                  className="rounded-full bg-white/92 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => updateZoom(transform.scale / 1.2)}
                  className="rounded-full bg-white/92 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={resetView}
                  className="rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-white"
                >
                  重置视图
                </button>
              </div>
              {filteredRegions.length > 0 && searchTerm.trim() ? (
                <div className="absolute left-4 top-4 z-10 w-[min(360px,calc(100%-2rem))] overflow-hidden rounded-[24px] border border-slate-200/90 bg-white/95 shadow-[0_20px_40px_rgba(16,37,66,0.14)] backdrop-blur">
                  <div className="border-b border-slate-100 px-4 py-3 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                    Search Results
                  </div>
                  <div className="max-h-72 overflow-auto p-2">
                    {filteredRegions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSearchSelectRegion(item)}
                        className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            {item.name}
                          </span>
                          <span className="block text-xs text-slate-500">{item.nameEn}</span>
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                          {item.alpha3 ?? item.id}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-5 lg:self-start">
            <section className="rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#f2f6fb)] p-4 shadow-[0_14px_36px_rgba(31,50,81,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current Region</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {selectedRegion?.name ?? "请选择国家"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedRegion?.nameEn ?? "点击地图或搜索一个国家后设置等级"}
                  </p>
                </div>
                {selectedRegion ? (
                  <button
                    type="button"
                    onClick={() => focusRegion(selectedRegion.id)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    定位
                  </button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2">
                {TRAVEL_LEVELS.map((item) => {
                  const active = selectedRegion && (records[selectedRegion.id] ?? 0) === item.level;

                  return (
                    <button
                      key={item.level}
                      type="button"
                      disabled={!selectedRegion}
                      onClick={() => {
                        if (!selectedRegion) {
                          return;
                        }
                        setRecords((current) =>
                          setTravelLevel(current, selectedRegion.id, item.level as TravelLevel),
                        );
                      }}
                      className="flex items-center justify-between rounded-2xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-45"
                      style={{
                        backgroundColor: active ? `${item.color}18` : "#ffffff",
                        borderColor: active ? item.color : "#d5deea",
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="h-4 w-4 rounded-full border border-slate-300"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>
                          <span className="block text-sm font-semibold text-slate-900">
                            {item.labelEn}
                          </span>
                          <span className="block text-xs text-slate-500">{item.description}</span>
                        </span>
                      </span>
                      <span className="text-xs font-medium text-slate-500">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(31,50,81,0.05)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">图例与统计</h3>
                <span className="text-sm text-slate-500">共 {stats.totalMarked} 个已标记</span>
              </div>
              <div className="mt-4 grid gap-2">
                {TRAVEL_LEVELS.map((item) => (
                  <div
                    key={item.level}
                    className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2"
                  >
                    <span className="flex items-center gap-3 text-sm text-slate-700">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-slate-300"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.labelEn}
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                      {stats.countsByLevel[item.level]}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-[0_14px_36px_rgba(31,50,81,0.05)]">
              <h3 className="text-lg font-semibold text-slate-900">分享与导出</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                分享链接会携带当前状态。导出图片始终生成完整世界地图，不受当前缩放影响。
              </p>
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  复制分享链接
                </button>
                <button
                  type="button"
                  disabled={isExporting !== ""}
                  onClick={() => handleExport("poster")}
                  className="rounded-2xl bg-[#2f6690] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#255474] disabled:opacity-60"
                >
                  {isExporting === "poster" ? "正在导出海报图..." : "导出海报图"}
                </button>
                <button
                  type="button"
                  disabled={isExporting !== ""}
                  onClick={() => handleExport("map")}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {isExporting === "map" ? "正在导出纯地图..." : "导出纯地图"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecords({});
                    setSelectedId(undefined);
                  }}
                  className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  清空全部状态
                </button>
              </div>
              {shareMessage ? (
                <p className="mt-3 text-sm font-medium text-emerald-700">{shareMessage}</p>
              ) : null}
            </section>
          </aside>
        </section>
      </main>

      <div className="worldex-export-sandbox" aria-hidden="true">
        <div
          ref={posterRef}
          className="flex overflow-hidden rounded-[40px] border border-slate-200 bg-[#f4f8ff] text-slate-900"
          style={{ width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
        >
          <div className="flex w-full flex-col bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(230,238,255,0.88)_58%,_rgba(205,221,246,0.94))] p-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.26em] text-slate-500">WorldEx</p>
                <h2 className="mt-3 text-5xl font-semibold tracking-tight">世界旅行地图</h2>
                <p className="mt-3 text-xl text-slate-600">
                  {authorName.trim() ? `${authorName} 的足迹` : "我的足迹"}
                </p>
              </div>
              <div className="rounded-[28px] bg-white/80 px-6 py-5 shadow-sm">
                <div className="text-sm text-slate-500">已标记国家 / 地区</div>
                <div className="mt-2 text-5xl font-semibold">{stats.totalMarked}</div>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-[32px] border border-white/80 bg-white shadow-[0_24px_60px_rgba(31,50,81,0.12)]">
              <WorldMapSvg width={1400} height={620} records={records} />
            </div>

            <div className="mt-8 grid grid-cols-[minmax(0,1fr)_340px] gap-6">
              <div className="grid grid-cols-3 gap-3">
                {TRAVEL_LEVELS.map((item) => (
                  <div
                    key={item.level}
                    className="rounded-[24px] border border-white/70 bg-white/85 px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-4 w-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-semibold">{item.labelEn}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">{item.description}</div>
                    <div className="mt-3 text-3xl font-semibold">{stats.countsByLevel[item.level]}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-[28px] border border-white/70 bg-[#16324f] p-6 text-white shadow-[0_20px_50px_rgba(22,50,79,0.22)]">
                <p className="text-sm uppercase tracking-[0.24em] text-sky-100/70">Legend</p>
                <div className="mt-5 space-y-3">
                  {TRAVEL_LEVELS.map((item) => (
                    <div key={item.level} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-3">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white/30"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.labelEn}
                      </span>
                      <span className="text-sky-100/80">{item.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={mapOnlyRef}
          className="overflow-hidden rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,#eef6ff,#dbe8ff)] p-8"
          style={{ width: EXPORT_WIDTH, height: EXPORT_MAP_ONLY_HEIGHT }}
        >
          <div className="flex h-full flex-col rounded-[28px] border border-white/70 bg-white/60 p-6 backdrop-blur">
            <div className="mb-4 flex items-center justify-between text-slate-600">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">WorldEx</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {authorName.trim() ? `${authorName} 的世界地图` : "我的世界地图"}
                </p>
              </div>
              <div className="text-right text-sm">
                <div>Marked Regions</div>
                <div className="mt-1 text-3xl font-semibold text-slate-900">{stats.totalMarked}</div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_60px_rgba(31,50,81,0.1)]">
              <WorldMapSvg width={1488} height={720} records={records} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
