import assert from 'node:assert/strict';
import { load } from '../tests/load-source.mjs';

const { halls } = load('../src/data/collection');
const { buildWalkGrid, isWalkable, routeToCabinet } = load('../src/utils/pathfinding');
const { findNativePath, routeToCabinetNative } = load('../src/utils/nativeNavigation');
const base = process.env.NATIVE_NAVIGATION_TEST_URL ?? 'http://127.0.0.1:18080';
const realFetch = globalThis.fetch;
globalThis.fetch = (url, options) => realFetch(new URL(url, base), options);
const status = await (await fetch('/api/navigation/status')).json();
assert.equal(status.engine, 'native-cpp-astar');
assert.equal(status.available, true);
let count = 0;
for (const hall of halls) {
  const grid = buildWalkGrid(hall);
  for (const cabinet of hall.cabinets) {
    const actual = await routeToCabinetNative(hall, cabinet, hall.entrance, AbortSignal.timeout(10000));
    const reference = routeToCabinet(hall, cabinet);
    assert.equal(actual.length, reference.length, `${cabinet.id}: shortest path length`);
    assert.ok(actual.length > 0, `${cabinet.id}: reachable`);
    for (let i = 0; i < actual.length; i++) {
      assert.ok(isWalkable(grid, actual[i]), `${cabinet.id}: obstacle avoidance`);
      if (i) assert.equal(Math.abs(actual[i][0] - actual[i - 1][0]) + Math.abs(actual[i][1] - actual[i - 1][1]), grid.step);
    }
    count++;
  }
  const custom = hall.id === 'MainHall' ? [724, 832] : [724, 790];
  assert.ok(isWalkable(grid, custom));
  const actual = await routeToCabinetNative(hall, hall.cabinets[0], custom);
  assert.equal(actual.length, routeToCabinet(hall, hall.cabinets[0], custom).length);
  const nextCabinet = hall.cabinets[hall.cabinets.length - 1];
  const nextStart = actual.at(-1);
  const nextLeg = await routeToCabinetNative(hall, nextCabinet, nextStart);
  assert.deepEqual(nextLeg[0], nextStart, 'next visit starts at the previous cabinet');
  assert.equal(nextLeg.length, routeToCabinet(hall, nextCabinet, nextStart).length);
}
const small = { width: 5, height: 5, step: 1, blocked: new Uint8Array(25) };
for (let y = 0; y < 5; y++) small.blocked[y * 5 + 2] = 1;
assert.deepEqual(await findNativePath(small, [0, 0], [[4, 0]]), []);
const invalid = await fetch('/api/navigation/path', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ width: 5, height: 5, blocked: [0], start: [0, 0], destinations: [[4, 0]] }) });
assert.equal(invalid.status, 400);
console.log(`原版 C++ A* → JNI → HTTP → 前端：${count} 个金匮均可达、避障且路径最短；连续金匮寻路、自选起点、无路及错误请求验证通过。`);
