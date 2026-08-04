import { useEffect, useState } from "react";

/** The pre-projected flat geometry (world + the five manager regions),
 *  loaded ONCE and code-split away from the main chunk — 340 kB of
 *  paths have nothing to do on the home page (the globe already
 *  dynamic-imports its own geometry for the same reason). */

export interface FlatCountry {
  code: string;
  path: string;
  cx: number;
  cy: number;
}

export interface FlatPoint {
  code: string;
  cx: number;
  cy: number;
}

export interface FlatScope {
  countries: FlatCountry[];
  points: FlatPoint[];
}

export interface FlatMapsData {
  width: number;
  height: number;
  scopes: Record<string, FlatScope>;
}

let cache: FlatMapsData | null = null;
let promise: Promise<FlatMapsData> | null = null;

function load(): Promise<FlatMapsData> {
  promise ??= import("@/lib/flat-maps.json").then((module) => {
    cache = module.default as unknown as FlatMapsData;
    return cache;
  });
  return promise;
}

export function useFlatMaps(): FlatMapsData | null {
  const [data, setData] = useState<FlatMapsData | null>(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    void load().then((loaded) => {
      if (alive) setData(loaded);
    });
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
