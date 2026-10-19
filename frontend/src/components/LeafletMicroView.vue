<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useSystemStore } from '../store/useSystemStore';
import { getHall } from '../data/collection';
import type { Cabinet, Point } from '../data/types';
import { buildWalkGrid, isWalkable, simplifyPath } from '../utils/pathfinding';
import { routeToCabinetWasm as routeToCabinetNative } from '../utils/wasmNavigation';

const props = defineProps<{ hall: string }>();
const store = useSystemStore();
const container = ref<HTMLElement | null>(null);
const layout = computed(() => getHall(props.hall === 'MainHall' ? 'MainHall' : 'WestHall'));
const hallName = computed(() => layout.value.name);
const imageFailed = ref(false);
const showNumbers = ref(false);
const choosingStart = ref(false);
const choosingTarget = ref(false);
const routeMessage = ref('');
const routeFailed = ref(false);
const occupiedCount = computed(() => store.archives.filter(a => a.hall === layout.value.id).length);
const highlightedCount = computed(() => layout.value.cabinets.filter(c => store.highlightedCabinetIds.has(c.id)).length);
const currentLocation = computed(() => store.navigationStartFor(layout.value.id));
const origin = computed(() => store.navigationOrigin?.hall === layout.value.id
  ? store.navigationOrigin : currentLocation.value);
const start = computed(() => origin.value.point);
const awayFromEntrance = computed(() => !!store.routeStarts[layout.value.id]);
const imageBounds: L.LatLngBoundsExpression = [[0, 0], [1086, 1448]];
// Source images use y downwards; Leaflet CRS.Simple uses latitude upwards.
const latLng = ([x, y]: Point): L.LatLngTuple => [layout.value.height - y, x];
let map: L.Map | null = null;
let resizeObserver: ResizeObserver | null = null;
let routes: L.LayerGroup | null = null;
const cabinetLayers = new Map<string, L.Rectangle>();
const treasureGlows = new Map<string, L.Marker>();
let routeAbort: AbortController | null = null;
let activeRouteKey = '';
let routePoints: Point[] | null = null;

// Keep the cabinet's hit area invisible; light is a separate, non-interactive layer.
const cabinetStyle: L.PathOptions = {
  opacity: 0, weight: 1, fillOpacity: 0, className: 'cabinet-hit',
};
const sizeTreasureGlows = (zoom = map?.getZoom()) => {
  if (!map) return;
  const scale = map.getZoomScale(zoom ?? map.getZoom(), 0);
  for (const cabinet of layout.value.cabinets) {
    const element = treasureGlows.get(cabinet.id)?.getElement();
    if (!element) continue;
    const [, , width, height] = cabinet.bounds;
    const screenWidth = width * scale;
    const screenHeight = height * scale;
    element.style.width = `${screenWidth}px`;
    element.style.height = `${screenHeight}px`;
    element.style.marginLeft = `${-screenWidth / 2}px`;
    element.style.marginTop = `${-screenHeight / 2}px`;
    element.style.setProperty('--spark-size', `${Math.max(5, Math.min(12, screenWidth * .18))}px`);
  }
};
const addTreasureGlow = (cabinet: Cabinet, index: number) => {
  if (!map) return;
  const [x, y, width, height] = cabinet.bounds;
  const light = document.createElement('div');
  light.className = 'treasure-light';
  light.setAttribute('aria-hidden', 'true');
  light.style.setProperty('--glow-delay', `${-(index % 7) * .43}s`);
  for (const className of ['treasure-aura', 'treasure-rays', 'treasure-beam',
    'treasure-shaft shaft-one', 'treasure-shaft shaft-two', 'treasure-shaft shaft-three', 'treasure-core',
    'treasure-spark spark-one', 'treasure-spark spark-two', 'treasure-spark spark-three']) {
    const part = document.createElement('span');
    part.className = className;
    light.appendChild(part);
  }
  const glow = L.marker(latLng([x + width / 2, y + height / 2]), {
    pane: 'treasureGlowPane', interactive: false, keyboard: false,
    icon: L.divIcon({ className: 'treasure-glow-marker', html: light, iconSize: [0, 0], iconAnchor: [0, 0] }),
  }).addTo(map);
  glow.getElement()?.setAttribute('aria-hidden', 'true');
  treasureGlows.set(cabinet.id, glow);
};
const updateCabinets = () => {
  for (const [index, cabinet] of layout.value.cabinets.entries()) {
    const matched = store.highlightedCabinetIds.has(cabinet.id);
    const layer = cabinetLayers.get(cabinet.id);
    layer?.getElement()?.setAttribute('data-time-highlighted', String(matched));
    if (matched && !treasureGlows.has(cabinet.id)) addTreasureGlow(cabinet, index);
    else if (!matched && treasureGlows.has(cabinet.id)) {
      treasureGlows.get(cabinet.id)?.remove();
      treasureGlows.delete(cabinet.id);
    }
  }
  sizeTreasureGlows();
};
const updateNumbers = () => {
  for (const cabinet of layout.value.cabinets) {
    const label = document.createElement('span');
    const archive = store.archives.find(a => a.cabinetId === cabinet.id);
    const permanent = showNumbers.value && (map?.getZoom() ?? 0) >= .75;
    label.textContent = permanent ? cabinet.id : `${cabinet.id} · ${archive?.name ?? '暂无档案'}`;
    cabinetLayers.get(cabinet.id)?.unbindTooltip().bindTooltip(label, {
      permanent, direction: 'top', className: 'cabinet-tooltip', opacity: 1,
    });
  }
};
const markPoint = (point: Point, label: string, color: string) => {
  if (!routes) return;
  const content = document.createElement('span');
  content.textContent = label;
  L.circleMarker(latLng(point), { radius: 5, color, weight: 2, fillColor: '#fff5dc', fillOpacity: 1,
    interactive: false }).bindTooltip(content, { permanent: true, direction: 'bottom', className: 'route-tooltip' }).addTo(routes);
};
const paintRoute = (path: Point[], target: Cabinet) => {
  routes?.clearLayers();
  markPoint(start.value, origin.value.label === '入口' ? '入口' : `起点 · ${origin.value.label}`, '#486c61');
  if (!map || !routes) return;
  if (!path.length) {
    routeMessage.value = '当前起点无法到达此金匮，请重新选择起点。';
    return;
  }
  if (path.length === 1) {
    routes.clearLayers();
    markPoint(path[0]!, `当前位置 · ${target.id}`, '#a23428');
    routeMessage.value = `当前位置已在 ${target.id} 旁`;
    return;
  }
  const points = simplifyPath(path).map(latLng);
  L.polyline(points, { color: '#fff5df', weight: 7, opacity: .9, interactive: false }).addTo(routes);
  L.polyline(points, { color: '#a23428', weight: 3, dashArray: '8 5', interactive: false,
    className: 'navigation-route' }).addTo(routes);
  markPoint(path[path.length - 1]!, `当前位置 · ${target.id}`, '#a23428');
  routeMessage.value = `${origin.value.label} → ${target.id} · 沿朱色路线行进`;
};
const resetRouteRequest = () => {
  routeAbort?.abort(); routeAbort = null; activeRouteKey = ''; routePoints = null;
  routeFailed.value = false;
};
const drawRoute = async () => {
  if (!map || !routes) return;
  const target = layout.value.cabinets.find(c => c.id === store.navigationTargetId);
  if (!target) {
    resetRouteRequest(); routes.clearLayers();
    routeMessage.value = choosingTarget.value ? '请点击金匮选择终点，规划前往柜旁的路线。' : '';
    const location = currentLocation.value;
    markPoint(location.point, location.label === '入口' ? '入口' : `当前位置 · ${location.label}`, '#486c61');
    return;
  }
  const requestVersion = store.mapFocusTrigger;
  const key = `${layout.value.id}:${target.id}:${start.value.join(',')}:${requestVersion}`;
  if (key === activeRouteKey) {
    if (routePoints) {
      paintRoute(routePoints, target);
    }
    return;
  }
  routeAbort?.abort();
  const abort = new AbortController();
  routeAbort = abort; activeRouteKey = key; routePoints = null; routeFailed.value = false;
  routes.clearLayers(); markPoint(start.value, origin.value.label, '#486c61');
  routeMessage.value = '正在规划路线…';
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort.abort(); }, 10000);
  try {
    const path = await routeToCabinetNative(layout.value, target, start.value, abort.signal);
    if (routeAbort !== abort || !map || store.mapFocusTrigger !== requestVersion ||
        store.navigationTargetId !== target.id || store.currentView !== target.hall) return;
    routePoints = path;
    if (path.length) store.completeNavigation(layout.value.id, target.id, path[path.length - 1]!, requestVersion);
    paintRoute(path, target);
  } catch (error) {
    if (routeAbort !== abort || !map) return;
    routeFailed.value = true;
    routeMessage.value = timedOut ? '路线规划超时，请重试。'
      : error instanceof TypeError ? '寻路模块未能载入，请刷新页面后重试。'
      : error instanceof Error ? error.message : '路线规划失败，请重试。';
  } finally { clearTimeout(timeout); }
};
const retryRoute = () => { activeRouteKey = ''; drawRoute(); };
const renderMap = async () => {
  await nextTick();
  resetRouteRequest();
  resizeObserver?.disconnect();
  map?.remove();
  map = null;
  cabinetLayers.clear();
  treasureGlows.clear();
  choosingStart.value = false;
  choosingTarget.value = false;
  if (!container.value || props.hall === 'EastHall') return;
  imageFailed.value = false;
  map = L.map(container.value, {
    crs: L.CRS.Simple, zoomControl: false, attributionControl: false, minZoom: -3,
    maxZoom: 2, zoomSnap: 0, zoomDelta: .25,
    zoomAnimation: true, fadeAnimation: true, markerZoomAnimation: true,
    wheelPxPerZoomLevel: 160, wheelDebounceTime: 20,
    maxBounds: [[-160, -160], [1246, 1608]], maxBoundsViscosity: 0.8,
  });
  map.createPane('floorplanPane').style.zIndex = '200';
  const glowPane = map.createPane('treasureGlowPane');
  glowPane.style.zIndex = '350';
  glowPane.style.pointerEvents = 'none';
  L.imageOverlay(import.meta.env.BASE_URL + layout.value.image, imageBounds, {
    alt: `${hallName.value}平面图`, pane: 'floorplanPane',
  })
    .on('error', () => { imageFailed.value = true; }).addTo(map);
  map.fitBounds(imageBounds, { padding: [18, 18], animate: false });
  for (const cabinet of layout.value.cabinets) {
    const [x, y, width, height] = cabinet.bounds;
    const layer = L.rectangle([latLng([x, y]), latLng([x + width, y + height])], cabinetStyle)
      .on('click', () => {
        if (choosingStart.value) routeMessage.value = '金匮不可通行，请在通道选择起点。';
        else if (choosingTarget.value) {
          choosingTarget.value = false;
          store.navigateToCabinet(cabinet);
        } else store.selectCabinet(cabinet);
      }).addTo(map);
    const element = layer.getElement();
    element?.setAttribute('tabindex', '0');
    element?.setAttribute('role', 'button');
    element?.setAttribute('aria-label', `金匮 ${cabinet.id}`);
    element?.addEventListener('keydown', event => {
      const key = event as KeyboardEvent;
      if (key.key === 'Enter' || key.key === ' ') {
        key.preventDefault();
        key.stopPropagation();
        if (choosingTarget.value) {
          choosingTarget.value = false;
          store.navigateToCabinet(cabinet);
        } else store.selectCabinet(cabinet);
      }
    });
    cabinetLayers.set(cabinet.id, layer);
  }
  map.on('zoomend', updateNumbers);
  map.on('zoom', () => sizeTreasureGlows());
  map.on('zoomanim', (event: L.ZoomAnimEvent) => sizeTreasureGlows(event.zoom));
  updateCabinets();
  updateNumbers();
  routes = L.layerGroup().addTo(map);
  map.on('click', event => {
    if (!choosingStart.value) return;
    const point: Point = [event.latlng.lng, layout.value.height - event.latlng.lat];
    if (!isWalkable(buildWalkGrid(layout.value), point)) {
      routeMessage.value = '请在殿内通道选择起点，墙体与金匮不可通行。';
      return;
    }
    store.setRouteStart(layout.value.id, point);
    choosingStart.value = false;
    if (!store.navigationTargetId) {
      choosingTarget.value = true;
      routeMessage.value = '起点已设置，请点击金匮选择寻路终点。';
    }
  });
  drawRoute();
  resizeObserver = new ResizeObserver(() => {
    // Opening the archive panel changes the available space, never the zoom.
    map?.invalidateSize({ animate: false });
  });
  resizeObserver.observe(container.value);
};
const zoomIn = () => map?.zoomIn();
const zoomOut = () => map?.zoomOut();
const resetView = () => map?.fitBounds(imageBounds, { padding: [18, 18], animate: false });
const chooseStart = () => {
  choosingTarget.value = false;
  choosingStart.value = !choosingStart.value;
  routeMessage.value = choosingStart.value ? '请点击殿内通道设置起点，再选择金匮寻路。' : '';
};
const chooseTarget = () => {
  choosingStart.value = false;
  choosingTarget.value = !choosingTarget.value;
  routeMessage.value = choosingTarget.value ? '请点击金匮选择终点，规划前往柜旁的路线。' : '';
};
watch(showNumbers, () => {
  updateNumbers();
});
watch(() => store.highlightedCabinetIds, updateCabinets);
watch(() => [store.navigationTargetId, store.mapFocusTrigger, ...start.value], () => {
  updateCabinets();
  drawRoute();
});
onMounted(renderMap);
watch(() => props.hall, renderMap);
onBeforeUnmount(() => {
  resetRouteRequest();
  resizeObserver?.disconnect(); map?.remove(); map = null; routes = null; treasureGlows.clear();
});
</script>

<template>
  <section class="plan-shell" :class="{ 'picking-start': choosingStart, 'picking-target': choosingTarget }" :aria-label="`${hallName}平面图`">
    <div ref="container" class="plan-canvas"></div>
    <div v-if="imageFailed" class="plan-error" role="alert">平面图未能载入。<button type="button" @click="renderMap">重新载入</button></div>
    <div class="plan-heading">
      <span class="plan-kicker">皇史宬 · 殿宇图志</span>
      <h2>{{ hallName }}平面图</h2>
      <span class="plan-caption">{{ showNumbers ? '放大查看编号 · 悬停阅档' : '点击金匮阅档 · 拖动缩放' }}</span>
    </div>
    <div class="plan-tools" aria-label="平面图工具">
      <button type="button" aria-label="放大平面图" @click="zoomIn">＋</button>
      <button type="button" aria-label="缩小平面图" @click="zoomOut">－</button>
      <button type="button" class="reset-button" @click="resetView">复位</button>
    </div>
    <div class="wayfinding-tools" aria-label="寻路工具">
      <button type="button" class="route-pick-button" :aria-pressed="choosingTarget" @click="chooseTarget">{{ choosingTarget ? '取消寻路' : '寻路' }}</button>
      <button type="button" :aria-pressed="showNumbers" @click="showNumbers = !showNumbers">{{ showNumbers ? '隐藏编号' : '显示编号' }}</button>
      <button type="button" :aria-pressed="choosingStart" @click="chooseStart">{{ choosingStart ? '取消选点' : '选择起点' }}</button>
      <button v-if="awayFromEntrance" type="button" @click="store.resetRouteStart(layout.id)">回到入口</button>
      <button v-if="store.navigationTargetId" type="button" @click="store.clearRoute()">清除路线</button>
      <button v-if="routeFailed" type="button" @click="retryRoute">重新规划</button>
    </div>
    <p v-if="routeMessage" class="route-status" role="status">{{ routeMessage }}</p>
    <p class="plan-note" aria-live="polite"><template v-if="store.timelineActive"><span class="occupied-key">● {{ store.currentTime }} 年匹配 {{ highlightedCount }} 匮</span> · {{ highlightedCount ? '流光金匮为年代匹配' : '该年无匹配档案' }}</template><template v-else>拖动时间轴高亮 · {{ occupiedCount }} 份 / {{ layout.cabinets.length }} 匮</template></p>
  </section>
</template>

<style scoped>
.plan-shell { position: relative; width: 100%; height: 100%; overflow: hidden; border: 1px solid #b59a75; border-radius: 0; background: #e9d8bb; box-shadow: 0 8px 30px #72542c18, inset 0 0 0 5px #d5ba91; }
.plan-shell::after { content: ''; position: absolute; inset: 8px; border: 1px solid #9e78546b; pointer-events: none; z-index: 410; }
.plan-canvas { width: 100%; height: 100%; background: #e9d8bb; }
.plan-error { position: absolute; inset: 0; z-index: 415; display: flex; gap: 12px; align-items: center; justify-content: center; color: #744b30; background: #f3e7d2; font-size: 12px; }.plan-error button { border: 1px solid #a47e56; padding: 7px 10px; background: #fbefdd; }
.plan-heading { position: absolute; top: 24px; left: 24px; z-index: 420; padding: 15px 22px 13px; color: #49291c; background: #f8edd9ed; border: 1px solid #ad8b63; box-shadow: 0 6px 22px #54341d25; pointer-events: none; }
.plan-kicker { display: block; font-size: 11px; letter-spacing: .28em; color: #98663b; }
.plan-heading h2 { margin: 4px 0 2px; font: 600 27px/1.25 'Songti SC', 'Noto Serif CJK SC', serif; letter-spacing: .12em; }
.plan-caption { font-size: 11px; letter-spacing: .1em; color: #826a54; }
.plan-tools { position: absolute; right: 25px; top: 25px; z-index: 420; display: flex; gap: 6px; }
.plan-tools button { min-width: 36px; height: 36px; padding: 0 8px; border: 1px solid #a47e56; background: #fbefdde8; color: #603820; font-size: 20px; cursor: pointer; }
.plan-tools button:hover { background: #d8ba88; }
.plan-tools .reset-button { font-size: 12px; letter-spacing: .1em; }
.plan-note { position: absolute; left: 24px; bottom: 21px; z-index: 420; margin: 0; padding: 6px 10px; background: #f8edd9e8; color: #765842; font-size: 11px; letter-spacing: .06em; pointer-events: none; }
@media (max-width: 650px) { .plan-heading { top: 15px; left: 15px; padding: 10px 13px; } .plan-kicker { font-size: 8px; letter-spacing: .15em; }.plan-heading h2 { font-size: 19px; }.plan-caption { font-size: 9px; }.plan-tools { right: 15px; top: 15px; gap: 3px; }.plan-tools button { min-width: 30px; height: 31px; font-size: 17px; padding: 0 5px; }.plan-tools .reset-button { font-size: 10px; }.plan-note { left: 15px; bottom: 62px; font-size: 9px; } }
.wayfinding-tools { position: absolute; z-index: 420; left: 24px; top: 136px; display: flex; flex-wrap: wrap; gap: 5px; max-width: calc(100% - 48px); }
.wayfinding-tools button { background: #fbefddef; color: #744b30; border: 1px solid #b79872; padding: 6px 9px; font-size: 11px; cursor: pointer; }
.wayfinding-tools button[aria-pressed=true] { background: #963c32; color: #fff0d8; }
.wayfinding-tools .route-pick-button { border-color: #963c32; color: #963c32; }
.wayfinding-tools .route-pick-button[aria-pressed=true] { color: #fff0d8; }
.route-status { position: absolute; z-index: 421; left: 24px; bottom: 53px; max-width: calc(100% - 48px); padding: 8px 12px; margin: 0; background: #fbefddef; border-left: 3px solid #a23428; color: #713b2c; font-size: 11px; }
.occupied-key { color: #94601e; }
.picking-start :deep(.leaflet-container) { cursor: crosshair; }
:deep(.cabinet-hit) { cursor: pointer; } :deep(.cabinet-hit:focus-visible) { outline: none; stroke: #a23428; stroke-opacity: 1; stroke-width: 4px; }
:deep(.treasure-glow-marker), :deep(.treasure-light), :deep(.treasure-light span) { pointer-events: none !important; }
:deep(.treasure-glow-marker) { border: 0; background: none; }
:deep(.leaflet-zoom-anim .treasure-glow-marker) { transition: transform .25s cubic-bezier(0, 0, .25, 1), width .25s cubic-bezier(0, 0, .25, 1), height .25s cubic-bezier(0, 0, .25, 1), margin .25s cubic-bezier(0, 0, .25, 1); }
:deep(.treasure-light) { position: relative; width: 100%; height: 100%; isolation: isolate; }
:deep(.treasure-light span) { position: absolute; display: block; }
:deep(.treasure-aura) { inset: -55% -75%; border-radius: 50%; background: radial-gradient(ellipse, #fff4bf66 0%, #ffcf58a6 26%, #f2b52d66 43%, #edaa1e24 60%, transparent 74%); filter: blur(2px); animation: treasure-breathe 3.4s ease-in-out infinite; animation-delay: var(--glow-delay); }
:deep(.treasure-rays) { inset: -105% -95% -65%; background: repeating-conic-gradient(from 12deg at 50% 57%, transparent 0deg 17deg, #fff0bccc 23deg, transparent 29deg 45deg); mask-image: radial-gradient(ellipse, #0009 12%, #000 25%, transparent 69%); filter: blur(1px); animation: treasure-rays 8s ease-in-out infinite alternate; animation-delay: var(--glow-delay); }
:deep(.treasure-beam) { left: -25%; top: -175%; width: 150%; height: 235%; background: linear-gradient(0deg, #fff5b9a6 0%, #ffd77780 27%, #ffedb34d 55%, transparent 100%); clip-path: polygon(37% 100%, 63% 100%, 95% 0, 5% 0); filter: blur(2px); animation: treasure-breathe 3.4s ease-in-out infinite; animation-delay: var(--glow-delay); }
:deep(.treasure-shaft) { left: 43%; top: -150%; width: 14%; height: 205%; transform-origin: 50% 100%; background: linear-gradient(0deg, #fff9dfb3, #ffe8a380 28%, #ffe9aa26 70%, transparent); filter: blur(.6px); animation: treasure-shimmer 3.4s ease-in-out infinite; animation-delay: var(--glow-delay); }
:deep(.shaft-one) { transform: rotate(-22deg); }
:deep(.shaft-two) { transform: rotate(4deg); top: -185%; height: 240%; }
:deep(.shaft-three) { transform: rotate(26deg); }
:deep(.treasure-core) { inset: 10% 3% 45%; border-radius: 50%; background: radial-gradient(ellipse, #fff9dbc9, #ffdc7966 42%, transparent 73%); mix-blend-mode: screen; }
:deep(.treasure-spark) { width: var(--spark-size); height: var(--spark-size); background: #fff6ca; clip-path: polygon(50% 0, 60% 38%, 100% 50%, 60% 61%, 50% 100%, 39% 61%, 0 50%, 39% 38%); filter: drop-shadow(0 0 3px #ffc13c); opacity: 0; animation: treasure-spark 3.8s ease-in-out infinite; }
:deep(.spark-one) { left: -30%; top: 20%; animation-delay: var(--glow-delay); }
:deep(.spark-two) { right: -28%; top: 42%; animation-delay: calc(var(--glow-delay) - 1.3s); }
:deep(.spark-three) { left: 57%; top: -25%; animation-delay: calc(var(--glow-delay) - 2.5s); }
@keyframes treasure-breathe { 0%, 100% { opacity: .65; transform: scale(.9); } 50% { opacity: 1; transform: scale(1.09); } }
@keyframes treasure-rays { from { opacity: .48; transform: rotate(-10deg) scale(.93); } to { opacity: .85; transform: rotate(14deg) scale(1.07); } }
@keyframes treasure-shimmer { 0%, 100% { opacity: .45; } 50% { opacity: .95; } }
@keyframes treasure-spark { 0%, 12% { opacity: 0; transform: translateY(5px) scale(.5); } 35% { opacity: 1; transform: translateY(-3px) scale(1); } 65% { opacity: .7; } 90%, 100% { opacity: 0; transform: translateY(-22px) scale(.5); } }
@media (prefers-reduced-motion: reduce) { :deep(.treasure-light span) { animation: none !important; } :deep(.treasure-rays) { opacity: .6; } :deep(.treasure-spark) { opacity: .8; } }
:deep(.cabinet-tooltip), :deep(.route-tooltip) { color: #633d26; background: #fff3dc; border: 1px solid #a8875b; box-shadow: 0 2px 6px #4e331d26; font: 11px/1.4 Georgia, 'Songti SC', serif; }
:deep(.route-tooltip) { color: #963c32; font-size: 10px; }
@media (max-width: 650px) { .wayfinding-tools { top: 104px; left: 15px; max-width: calc(100% - 30px); }.wayfinding-tools button { font-size: 9px; padding: 5px 6px; }.route-status { left: 15px; bottom: 90px; font-size: 9px; max-width: calc(100% - 30px); } }
@media (max-width: 650px) { .plan-heading { padding: 0; border: 0; box-shadow: none; background: #f8edd9e8; }.plan-kicker { display: none; }.plan-heading h2 { font-size: 16px; margin-top: 0; }.wayfinding-tools { top: 65px; } }
</style>
