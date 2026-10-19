import type { Cabinet, HallLayout, Point, Rect } from '../data/types';

export interface WalkGrid {
  width: number;
  height: number;
  step: number;
  blocked: Uint8Array;
}
const STEP = 4;
const CLEARANCE = 3;
const inside = ([x, y]: Point, [left, top, width, height]: Rect, margin = 0) =>
  x >= left - margin && x <= left + width + margin &&
  y >= top - margin && y <= top + height + margin;
const cache = new WeakMap<HallLayout, WalkGrid>();

export function buildWalkGrid(hall: HallLayout): WalkGrid {
  const cached = cache.get(hall);
  if (cached) return cached;
  const width = Math.ceil(hall.width / STEP) + 1;
  const height = Math.ceil(hall.height / STEP) + 1;
  const blocked = new Uint8Array(width * height).fill(1);
  const obstacles = [...hall.obstacles, ...hall.cabinets.map(c => c.bounds)];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const point: Point = [x * STEP, y * STEP];
      if (hall.walkable.some(rect => inside(point, rect)) &&
          !obstacles.some(rect => inside(point, rect, CLEARANCE))) {
        blocked[y * width + x] = 0;
      }
    }
  }
  const grid = { width, height, step: STEP, blocked };
  cache.set(hall, grid);
  return grid;
}

const snap = (grid: WalkGrid, [x, y]: Point): Point =>
  [Math.round(x / grid.step), Math.round(y / grid.step)];
const free = (grid: WalkGrid, [x, y]: Point) =>
  x >= 0 && y >= 0 && x < grid.width && y < grid.height &&
  grid.blocked[y * grid.width + x] === 0;

export function isWalkable(grid: WalkGrid, point: Point) {
  return point.every(Number.isFinite) && free(grid, snap(grid, point));
}

// Reference solver used for geometry and shortest-path regression tests.
// The live map calls the original C++ engine through wasmNavigation.ts.
export function findPath(grid: WalkGrid, start: Point, destinations: Point[]): Point[] {
  if (!isWalkable(grid, start)) return [];
  const goals = destinations.filter(p => isWalkable(grid, p)).map(p => snap(grid, p));
  if (!goals.length) return [];
  const goalIds = new Set(goals.map(([x, y]) => y * grid.width + x));
  const heuristic = (x: number, y: number) =>
    Math.min(...goals.map(([gx, gy]) => Math.abs(x - gx) + Math.abs(y - gy)));
  const [sx, sy] = snap(grid, start);
  const startId = sy * grid.width + sx;
  const distances = new Float64Array(grid.width * grid.height).fill(Infinity);
  const previous = new Int32Array(distances.length).fill(-1);
  const closed = new Uint8Array(distances.length);
  const heap: { id: number; g: number; f: number }[] = [];
  // Equal-cost paths prefer progress toward the goal, reducing stair-step turns.
  const earlier = (a: typeof heap[number], b: typeof heap[number]) =>
    a.f < b.f || (a.f === b.f && a.g > b.g);
  const push = (node: typeof heap[number]) => {
    heap.push(node);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!earlier(node, heap[parent]!)) break;
      heap[index] = heap[parent]!;
      index = parent;
    }
    heap[index] = node;
  };
  const pop = () => {
    const root = heap[0]!;
    const tail = heap.pop()!;
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let child = index * 2 + 1;
        if (child + 1 < heap.length && earlier(heap[child + 1]!, heap[child]!)) child++;
        if (!earlier(heap[child]!, tail)) break;
        heap[index] = heap[child]!;
        index = child;
      }
      heap[index] = tail;
    }
    return root;
  };
  distances[startId] = 0;
  push({ id: startId, g: 0, f: heuristic(sx, sy) });
  while (heap.length) {
    const node = pop();
    if (closed[node.id]) continue;
    if (goalIds.has(node.id)) {
      const path: Point[] = [];
      for (let id = node.id; id !== -1; id = previous[id]!) {
        path.push([(id % grid.width) * grid.step, Math.floor(id / grid.width) * grid.step]);
      }
      return path.reverse();
    }
    closed[node.id] = 1;
    const x = node.id % grid.width;
    const y = Math.floor(node.id / grid.width);
    for (const point of [[x + 1, y], [x, y - 1], [x - 1, y], [x, y + 1]] as Point[]) {
      if (!free(grid, point)) continue;
      const [nx, ny] = point;
      const next = ny * grid.width + nx;
      const g = node.g + 1;
      if (g >= distances[next]!) continue;
      distances[next] = g;
      previous[next] = node.id;
      push({ id: next, g, f: g + heuristic(nx, ny) });
    }
  }
  return [];
}

export function cabinetApproaches(cabinet: Cabinet): Point[] {
  const [x, y, width, height] = cabinet.bounds;
  const gap = 6;
  return [
    [x + width / 2, y + height + gap], [x + width / 2, y - gap],
    [x - gap, y + height / 2], [x + width + gap, y + height / 2],
  ];
}

export function routeToCabinet(hall: HallLayout, cabinet: Cabinet, start = hall.entrance) {
  if (cabinet.hall !== hall.id) return [];
  return findPath(buildWalkGrid(hall), start, cabinetApproaches(cabinet));
}

// Keep every turn; diagonal smoothing could cross cabinet corners.
export function simplifyPath(path: Point[]): Point[] {
  return path.filter((point, index) => {
    if (!index || index === path.length - 1) return true;
    const before = path[index - 1]!;
    const after = path[index + 1]!;
    return (point[0] - before[0]) * (after[1] - point[1]) !==
      (point[1] - before[1]) * (after[0] - point[0]);
  });
}
