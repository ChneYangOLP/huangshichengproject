import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { load } from './load-source.mjs';

const require = createRequire(import.meta.url);
const { halls, archives, cabinets } = load('../src/data/collection');
const { buildWalkGrid, findPath, isWalkable, routeToCabinet, simplifyPath } = load('../src/utils/pathfinding');
const { getArchiveTime, matchesArchiveYear, TIMELINE_MAX_YEAR } = load('../src/data/archiveTime');
const { useSystemStore } = load('../src/store/useSystemStore');
const { createPinia, setActivePinia } = require('pinia');

test('all 31 source archives occur once and belong to uniquely numbered cabinets in both halls', () => {
  assert.equal(archives.length, 31);
  assert.deepEqual(archives.map(a => a.id), Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(3, '0')));
  assert.equal(new Set(archives.map(a => a.cabinetId)).size, 31);
  assert.equal(cabinets.length, 168);
  assert.equal(new Set(cabinets.map(c => c.id)).size, 168);
  assert.deepEqual(new Set(archives.map(a => a.hall)), new Set(['MainHall', 'WestHall']));
  for (const archive of archives) {
    assert.equal(cabinets.find(c => c.id === archive.cabinetId)?.hall, archive.hall);
    for (const field of ['name', 'period', 'category', 'quantity', 'content', 'currentLocation', 'sourceTitle', 'sourceUrl']) {
      assert.ok(archive[field], `${archive.id}: ${field} retained`);
    }
    assert.equal(archive.sourceRow, Number(archive.id) + 2);
  }
  for (const cabinet of cabinets) assert.ok(cabinet.id.startsWith(cabinet.hall === 'MainHall' ? 'N-' : 'W-'));
});

test('every cabinet is reachable from its entrance without crossing a wall, exhibit, or cabinet', () => {
  for (const hall of halls) {
    const grid = buildWalkGrid(hall);
    assert.ok(isWalkable(grid, hall.entrance));
    for (const cabinet of hall.cabinets) {
      const route = routeToCabinet(hall, cabinet);
      assert.ok(route.length, `${cabinet.id} unreachable`);
      const obstacles = [...hall.obstacles, ...hall.cabinets.map(c => c.bounds)];
      for (let i = 0; i < route.length; i++) {
        const [x, y] = route[i];
        assert.ok(isWalkable(grid, route[i]));
        assert.ok(hall.walkable.some(([left, top, w, h]) => x >= left && x <= left + w && y >= top && y <= top + h));
        assert.ok(!obstacles.some(([left, top, w, h]) => x >= left - 3 && x <= left + w + 3 && y >= top - 3 && y <= top + h + 3));
        if (i) assert.equal(Math.abs(x - route[i - 1][0]) + Math.abs(y - route[i - 1][1]), grid.step);
      }
      const [x, y, w, h] = cabinet.bounds;
      const [endX, endY] = route.at(-1);
      assert.ok(endX < x || endX > x + w || endY < y || endY > y + h, 'stop outside the cabinet');
      const simplified = simplifyPath(route);
      assert.deepEqual(simplified[0], route[0]);
      assert.deepEqual(simplified.at(-1), route.at(-1));
      for (let i = 1; i < simplified.length; i++) {
        assert.ok(simplified[i][0] === simplified[i - 1][0] || simplified[i][1] === simplified[i - 1][1], 'no diagonal shortcut');
      }
    }
  }
});

test('A* finds a shortest detour and handles unreachable, blocked, invalid, and identical endpoints', () => {
  const grid = { width: 5, height: 5, step: 1, blocked: new Uint8Array(25) };
  for (let y = 0; y < 4; y++) grid.blocked[y * 5 + 2] = 1;
  assert.equal(findPath(grid, [0, 0], [[4, 0]]).length, 13);
  assert.deepEqual(findPath(grid, [0, 0], [[0, 0]]), [[0, 0]]);
  assert.deepEqual(findPath(grid, [-1, 0], [[4, 0]]), []);
  assert.deepEqual(findPath(grid, [NaN, 0], [[4, 0]]), []);
  assert.deepEqual(findPath(grid, [2, 0], [[4, 0]]), []);
  assert.deepEqual(findPath(grid, [0, 0], []), []);
  grid.blocked[22] = 1;
  assert.deepEqual(findPath(grid, [0, 0], [[4, 0]]), []);
});

test('click, search, navigation, starting point, hall switching, and East Hall guard stay consistent', () => {
  setActivePinia(createPinia());
  const store = useSystemStore();
  for (const archive of archives) {
    store.focusArchive(archive);
    assert.equal(store.currentView, archive.hall);
    assert.equal(store.selectedCabinet.id, archive.cabinetId);
    assert.equal(store.selectedArchive.id, archive.id);
    assert.equal(store.navigationTargetId, archive.cabinetId);
  }
  const empty = cabinets.find(c => !archives.some(a => a.cabinetId === c.id));
  store.selectCabinet(empty);
  assert.equal(store.selectedCabinet.id, empty.id);
  assert.equal(store.selectedArchive, null);
  assert.equal(store.navigationTargetId, null);
  store.setSearchQuery(empty.id.toLowerCase());
  assert.deepEqual(store.filteredCabinets.map(c => c.id), [empty.id]);
  store.setSearchQuery('   ');
  assert.equal(store.filteredArchives.length, 0);
  assert.equal(store.filteredCabinets.length, 0);
  store.setRouteStart(empty.hall, [724, 832]);
  assert.deepEqual(store.routeStarts[empty.hall], [724, 832]);
  store.resetRouteStart(empty.hall);
  assert.equal(store.routeStarts[empty.hall], undefined);
  store.navigateToCabinet(empty);
  store.closeCabinet();
  assert.equal(store.navigationTargetId, empty.id);
  store.clearRoute();
  assert.equal(store.navigationTargetId, null);
  assert.equal(store.setView('EastHall'), false);
  assert.equal(store.closedHallNotice, true);
  assert.notEqual(store.currentView, 'EastHall');
  store.setView('3D');
  assert.equal(store.selectedCabinet, null);
  assert.equal(store.navigationTargetId, null);
});

test('navigation chains cabinet visits from the last successful arrival and freezes each departure point', () => {
  setActivePinia(createPinia());
  const store = useSystemStore();
  const hall = halls.find(h => h.id === 'WestHall');
  const [first, second] = [hall.cabinets[0], hall.cabinets[15]];
  store.selectCabinet(first);
  assert.deepEqual(store.navigationStartFor(hall.id).point, hall.entrance, 'reading a cabinet does not move the visitor');
  store.navigateToCabinet(first);
  assert.equal(store.navigationOrigin.label, '入口');
  const firstPath = routeToCabinet(hall, first, store.navigationOrigin.point);
  const firstArrival = firstPath.at(-1);
  assert.equal(store.completeNavigation(hall.id, first.id, firstArrival, store.mapFocusTrigger), true);
  assert.equal(store.currentCabinetIds[hall.id], first.id);
  assert.deepEqual(store.navigationOrigin.point, hall.entrance, 'arrival must not replan the route being shown');
  store.selectCabinet(second);
  assert.deepEqual(store.navigationStartFor(hall.id).point, firstArrival);
  store.navigateToCabinet(second);
  assert.equal(store.navigationOrigin.label, first.id);
  assert.deepEqual(store.navigationOrigin.point, firstArrival);
  const secondPath = routeToCabinet(hall, second, store.navigationOrigin.point);
  assert.deepEqual(secondPath[0], firstArrival);
  assert.equal(store.completeNavigation(hall.id, second.id, secondPath.at(-1), store.mapFocusTrigger), true);
  store.clearRoute();
  assert.equal(store.currentCabinetIds[hall.id], second.id);
  assert.deepEqual(store.navigationStartFor(hall.id).point, secondPath.at(-1), 'clearing a route retains current location');
  store.setView('MainHall');
  assert.equal(store.navigationStartFor('MainHall').label, '入口');
  store.setView(hall.id);
  assert.equal(store.navigationStartFor(hall.id).label, second.id);
  store.resetRouteStart(hall.id);
  assert.deepEqual(store.navigationStartFor(hall.id).point, hall.entrance);
  assert.equal(store.navigationStartFor(hall.id).label, '入口');
});

test('cancelled or stale routes cannot overwrite current location; manual starts clear the active route', () => {
  setActivePinia(createPinia());
  const store = useSystemStore();
  const hall = halls.find(h => h.id === 'WestHall');
  const [first, second] = hall.cabinets;
  store.navigateToCabinet(first);
  const oldVersion = store.mapFocusTrigger;
  store.navigateToCabinet(second);
  assert.equal(store.completeNavigation(hall.id, first.id, [724, 790], oldVersion), false);
  assert.equal(store.routeStarts[hall.id], undefined);
  store.clearRoute();
  assert.equal(store.completeNavigation(hall.id, second.id, [724, 790], store.mapFocusTrigger), false);
  assert.equal(store.currentCabinetIds[hall.id], undefined);
  store.setRouteStart(hall.id, [724, 790]);
  store.navigateToCabinet(first);
  assert.equal(store.navigationOrigin.label, '自选起点');
  store.setRouteStart(hall.id, [724, 832]);
  assert.equal(store.navigationTargetId, null);
  assert.equal(store.navigationOrigin, null);
  assert.equal(store.navigationStartFor(hall.id).label, '自选起点');
  store.navigateToCabinet(first);
  store.resetRouteStart(hall.id);
  assert.equal(store.navigationTargetId, null);
  assert.equal(store.navigationStartFor(hall.id).label, '入口');
});

test('timeline conversion respects source precision, era years, and inclusive interval boundaries', () => {
  const archive = id => archives.find(a => a.id === id);
  for (const record of archives) {
    const time = getArchiveTime(record.period);
    assert.ok(time.ranges.length, `${record.id} has timeline coverage`);
    for (const [start, end] of time.ranges) {
      assert.ok(Number.isInteger(start) && Number.isInteger(end) && start <= end);
    }
  }
  // A single documented compilation year must not light up adjacent years.
  assert.equal(matchesArchiveYear(archive('008'), 1731), true);
  assert.equal(matchesArchiveYear(archive('008'), 1730), false);
  assert.equal(matchesArchiveYear(archive('008'), 1732), false);
  // Explicit start-to-finish intervals include both endpoints.
  for (const year of [1562, 1564, 1567]) assert.equal(matchesArchiveYear(archive('003'), year), true);
  for (const year of [1561, 1568]) assert.equal(matchesArchiveYear(archive('003'), year), false);
  for (const year of [1850, 1853, 1856]) assert.equal(matchesArchiveYear(archive('012'), year), true);
  for (const year of [1849, 1857]) assert.equal(matchesArchiveYear(archive('012'), year), false);
  assert.equal(matchesArchiveYear(archive('027'), 1807), true);
  assert.equal(matchesArchiveYear(archive('027'), 1808), false);
  // Coarse records remain coarse; unknown or vague dates are not invented.
  for (const year of [1644, 1750, 1912]) assert.equal(matchesArchiveYear(archive('013'), year), true);
  for (const year of [1643, 1913, 2026]) assert.equal(matchesArchiveYear(archive('013'), year), false);
  assert.equal(matchesArchiveYear(archive('005'), 1655), true);
  assert.equal(matchesArchiveYear(archive('005'), 1738), false);
  assert.deepEqual(getArchiveTime('年代待考').ranges, []);
  assert.equal(matchesArchiveYear({ period: '年代待考' }, 1800), false);
  assert.equal(matchesArchiveYear(archive('008'), NaN), false);
});

test('only timeline input highlights matching cabinets; selection, routing, hall changes, and reset preserve the rule', () => {
  setActivePinia(createPinia());
  const store = useSystemStore();
  const empty = cabinets.find(c => !archives.some(a => a.cabinetId === c.id));
  assert.equal(store.timelineActive, false);
  assert.equal(store.highlightedCabinetIds.size, 0);
  store.focusArchive(archives[0]);
  assert.equal(store.highlightedCabinetIds.size, 0);
  store.setTime(1731);
  assert.equal(store.timelineActive, true);
  const expected = archives.filter(a => matchesArchiveYear(a, 1731)).map(a => a.cabinetId);
  assert.deepEqual([...store.highlightedCabinetIds], expected);
  assert.ok(store.highlightedCabinetIds.has(archives.find(a => a.id === '008').cabinetId));
  assert.ok(!store.highlightedCabinetIds.has(archives.find(a => a.id === '009').cabinetId));
  assert.ok(!store.highlightedCabinetIds.has(empty.id));
  store.navigateToCabinet(empty);
  assert.deepEqual([...store.highlightedCabinetIds], expected);
  store.setView('WestHall');
  assert.deepEqual([...store.highlightedCabinetIds], expected);
  store.setTime(1735);
  assert.ok(!store.highlightedCabinetIds.has(archives.find(a => a.id === '008').cabinetId));
  assert.ok(store.highlightedCabinetIds.has(archives.find(a => a.id === '009').cabinetId));
  store.setTime(TIMELINE_MAX_YEAR);
  assert.equal(store.highlightedCabinetIds.size, 0);
  store.setTime(1800);
  assert.ok(store.highlightedCabinetIds.size);
  store.clearTimelineHighlight();
  assert.equal(store.highlightedCabinetIds.size, 0);
  store.selectCabinet(cabinets[0]);
  assert.equal(store.highlightedCabinetIds.size, 0);
  store.setTime(NaN);
  assert.equal(store.timelineActive, false);
});
