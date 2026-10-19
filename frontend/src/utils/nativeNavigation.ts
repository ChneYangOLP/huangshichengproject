import type { Cabinet, HallLayout, Point } from '../data/types';
import { buildWalkGrid, cabinetApproaches, isWalkable } from './pathfinding';
import type { WalkGrid } from './pathfinding';

// Optional server adapter: HTTP → Java/JNI → path_engine/AStar.cpp.
// Do not silently substitute the JavaScript reference solver on service failure.
export async function findNativePath(grid: WalkGrid, start: Point, destinations: Point[], signal?: AbortSignal): Promise<Point[]> {
  if (!isWalkable(grid, start)) return [];
  const snap = ([x, y]: Point): Point => [Math.round(x / grid.step), Math.round(y / grid.step)];
  const goals = destinations.filter(point => isWalkable(grid, point)).map(snap);
  if (!goals.length) return [];
  const origin = snap(start);
  const response = await fetch('/api/navigation/path', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ width: grid.width, height: grid.height, blocked: Array.from(grid.blocked),
      start: origin, destinations: goals }),
  });
  if (!response.ok) {
    throw new Error(response.status === 503
      ? '寻路引擎暂不可用，请启动原版 A* 后端服务后重试。'
      : '路线规划失败，请稍后重试。');
  }
  const result: { engine?: string; path?: unknown } = await response.json();
  if (result.engine !== 'native-cpp-astar' || !Array.isArray(result.path)) {
    throw new Error('寻路服务返回了无效的路线。');
  }
  const points = result.path as Point[];
  for (const [index, point] of points.entries()) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isInteger) ||
        !isWalkable(grid, [point[0] * grid.step, point[1] * grid.step]) ||
        (index > 0 && Math.abs(point[0] - points[index - 1]![0]) + Math.abs(point[1] - points[index - 1]![1]) !== 1)) {
      throw new Error('寻路服务返回了无效的路线。');
    }
  }
  if (points.length && (points[0]![0] !== origin[0] || points[0]![1] !== origin[1] ||
      !goals.some(goal => goal[0] === points[points.length - 1]![0] && goal[1] === points[points.length - 1]![1]))) {
    throw new Error('寻路服务返回了无效的路线。');
  }
  return points.map(([x, y]) => [x * grid.step, y * grid.step]);
}

export function routeToCabinetNative(hall: HallLayout, cabinet: Cabinet, start = hall.entrance, signal?: AbortSignal) {
  if (cabinet.hall !== hall.id) return Promise.resolve([] as Point[]);
  return findNativePath(buildWalkGrid(hall), start, cabinetApproaches(cabinet), signal);
}
