import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import createAStar from '../../frontend/public/wasm/astar.mjs';
import { load } from '../../frontend/tests/load-source.mjs';

const api = await createAStar({
  wasmBinary: await readFile(new URL('../../frontend/public/wasm/astar.wasm', import.meta.url)),
});
function route(blocked, start, end, width = 5, height = 5) {
  const cells = width * height;
  const map = api._malloc(cells * 4);
  const output = api._malloc(cells * 2 * 4);
  try {
    assert.ok(map && output);
    api.HEAP32.set(blocked, map >>> 2);
    const count = api._hsc_find_path(map, width, height, ...start, ...end, output, cells * 2);
    assert.ok(count >= 0 && count <= cells * 2 && count % 2 === 0);
    const result = api.HEAP32.slice(output >>> 2, (output >>> 2) + count);
    const points = [];
    for (let i = 0; i < result.length; i += 2) points.push([result[i], result[i + 1]]);
    for (const [i, [x, y]] of points.entries()) {
      assert.ok(x >= 0 && x < width && y >= 0 && y < height);
      assert.equal(blocked[y * width + x], 0);
      if (i) assert.equal(Math.abs(x - points[i - 1][0]) + Math.abs(y - points[i - 1][1]), 1);
    }
    if (points.length) {
      assert.deepEqual(points[0], start);
      assert.deepEqual(points.at(-1), end);
    }
    return points;
  } finally {
    if (output) api._free(output);
    if (map) api._free(map);
  }
}
const grid = new Int32Array(25);
for (let y = 0; y < 4; y++) grid[y * 5 + 2] = 1;
assert.equal(route(grid, [0, 0], [4, 0]).length, 13, 'must detour through bottom gap');
assert.equal(route(grid, [0, 0], [0, 0]).length, 1, 'same start and end');
grid[22] = 1;
assert.deepEqual(route(grid, [0, 0], [4, 0]), [], 'closed wall is unreachable');
assert.deepEqual(route(grid, [2, 0], [4, 0]), [], 'blocked start is unreachable');
console.log('Original C++ A* WebAssembly smoke tests passed.');

const { halls } = load('../src/data/collection');
const { buildWalkGrid, cabinetApproaches, isWalkable, routeToCabinet } = load('../src/utils/pathfinding');
function cabinetRoute(hall, cabinet, start = hall.entrance) {
  const walkGrid = buildWalkGrid(hall);
  const snap = point => point.map(value => Math.round(value / walkGrid.step));
  let best = [];
  for (const goal of cabinetApproaches(cabinet).filter(point => isWalkable(walkGrid, point))) {
    const path = route(walkGrid.blocked, snap(start), snap(goal), walkGrid.width, walkGrid.height);
    if (path.length && (!best.length || path.length < best.length)) best = path;
  }
  return best.map(point => point.map(value => value * walkGrid.step));
}
let count = 0;
for (const hall of halls) {
  for (const cabinet of hall.cabinets) {
    const actual = cabinetRoute(hall, cabinet);
    assert.ok(actual.length, `${cabinet.id}: reachable`);
    assert.equal(actual.length, routeToCabinet(hall, cabinet).length, `${cabinet.id}: shortest route`);
    count++;
  }
  const first = cabinetRoute(hall, hall.cabinets[0]);
  const start = first.at(-1);
  const target = hall.cabinets.at(-1);
  const next = cabinetRoute(hall, target, start);
  assert.deepEqual(next[0], start, 'continue from the previous cabinet');
  assert.equal(next.length, routeToCabinet(hall, target, start).length);
}
console.log(`WebAssembly: ${count} cabinets reachable with shortest obstacle-free routes; chained visits passed.`);
