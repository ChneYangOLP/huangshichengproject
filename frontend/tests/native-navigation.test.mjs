import assert from 'node:assert/strict';
import test from 'node:test';
import { load } from './load-source.mjs';

const { findNativePath, routeToCabinetNative } = load('../src/utils/nativeNavigation');
const { halls } = load('../src/data/collection');
const grid = () => ({ width: 5, height: 5, step: 4, blocked: new Uint8Array(25) });
const response = path => new Response(JSON.stringify({ engine: 'native-cpp-astar', path }));

test('native adapter sends grid indices and converts actual engine points back to plan pixels', async t => {
  const abort = new AbortController();
  const request = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/navigation/path');
    assert.equal(options.signal, abort.signal);
    const body = JSON.parse(options.body);
    assert.deepEqual(body.start, [0, 0]);
    assert.deepEqual(body.destinations, [[2, 0], [3, 0]]);
    assert.equal(body.blocked.length, 25);
    return response([[0, 0], [1, 0], [2, 0]]);
  });
  assert.deepEqual(await findNativePath(grid(), [0, 0], [[8, 0], [12, 0]], abort.signal), [[0, 0], [4, 0], [8, 0]]);
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(await routeToCabinetNative(halls[0], halls[1].cabinets[0]), []);
  assert.equal(request.mock.callCount(), 1);
});

test('service failures and invalid engine paths never fall back to the JS reference solver', async t => {
  const request = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(findNativePath(grid(), [0, 0], [[8, 0]]), /引擎暂不可用/);
  request.mock.mockImplementation(async () => response([[0, 0], [2, 0]]));
  await assert.rejects(findNativePath(grid(), [0, 0], [[8, 0]]), /无效的路线/);
  const blocked = grid(); blocked.blocked[1] = 1;
  request.mock.mockImplementation(async () => response([[0, 0], [1, 0], [2, 0]]));
  await assert.rejects(findNativePath(blocked, [0, 0], [[8, 0]]), /无效的路线/);
  request.mock.mockImplementation(async () => { throw new TypeError('network unavailable'); });
  await assert.rejects(findNativePath(grid(), [0, 0], [[8, 0]]), /network unavailable/);
  assert.equal(request.mock.callCount(), 4);
});
