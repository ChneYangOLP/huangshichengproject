// Copy to frontend/src/utils/wasmNavigation.ts using prepare.mjs.
import type { Cabinet, HallLayout, Point } from '../data/types';
import { buildWalkGrid, cabinetApproaches, isWalkable } from './pathfinding';
import type { WalkGrid } from './pathfinding';

interface AStarModule {
  HEAP32: Int32Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _hsc_find_path(map: number, width: number, height: number,
    sx: number, sy: number, ex: number, ey: number, output: number, capacity: number): number;
}
type Factory = (options: { locateFile: (file: string) => string }) => Promise<AStarModule>;
let engine: Promise<AStarModule> | undefined;

function loadEngine() {
  if (!engine) {
    // An absolute URL also avoids Vite treating a public file as a source import.
    const base = new URL(import.meta.env.BASE_URL + 'wasm/', window.location.href).href;
    engine = (async () => {
      try {
        const module: { default: Factory } = await import(/* @vite-ignore */ base + 'astar.mjs');
        return await module.default({ locateFile: file => base + file });
      } catch {
        engine = undefined;
        throw new Error('寻路模块未能载入，请刷新页面后重试。');
      }
    })();
  }
  return engine;
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('路线请求已取消', 'AbortError');
}

export async function findWasmPath(grid: WalkGrid, start: Point, destinations: Point[], signal?: AbortSignal): Promise<Point[]> {
  checkAbort(signal);
  if (!isWalkable(grid, start)) return [];
  const snap = ([x, y]: Point): Point => [Math.round(x / grid.step), Math.round(y / grid.step)];
  const goals = destinations.filter(point => isWalkable(grid, point)).map(snap);
  if (!goals.length) return [];
  const cells = grid.width * grid.height;
  if (cells <= 0 || cells > 200000 || grid.blocked.length !== cells) {
    throw new Error('寻路地图尺寸无效。');
  }
  const api = await loadEngine();
  checkAbort(signal);
  const [sx, sy] = snap(start);
  let map = 0;
  let output = 0;
  try {
    map = api._malloc(cells * 4);
    output = api._malloc(cells * 2 * 4);
    if (!map || !output) throw new Error('寻路内存不足，请刷新页面后重试。');
    // Allocations and C++ calls may grow memory: always read the current view.
    api.HEAP32.set(grid.blocked, map >>> 2);
    let best: Int32Array | undefined;
    for (const [ex, ey] of goals) {
      checkAbort(signal);
      const count = api._hsc_find_path(map, grid.width, grid.height, sx, sy, ex, ey, output, cells * 2);
      if (count < 0 || count % 2 !== 0 || count > cells * 2) throw new Error('寻路引擎返回了无效的路线。');
      if (count && (!best || count < best.length)) {
        best = api.HEAP32.slice(output >>> 2, (output >>> 2) + count);
      }
    }
    checkAbort(signal);
    const path: Point[] = [];
    if (best) for (let i = 0; i < best.length; i += 2) {
      path.push([best[i]! * grid.step, best[i + 1]! * grid.step]);
    }
    return path;
  } finally {
    if (output) api._free(output);
    if (map) api._free(map);
  }
}

export function routeToCabinetWasm(hall: HallLayout, cabinet: Cabinet, start = hall.entrance, signal?: AbortSignal) {
  if (cabinet.hall !== hall.id) return Promise.resolve([] as Point[]);
  return findWasmPath(buildWalkGrid(hall), start, cabinetApproaches(cabinet), signal);
}
