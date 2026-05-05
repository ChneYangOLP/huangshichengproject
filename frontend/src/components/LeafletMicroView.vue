<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useSystemStore } from '../store/useSystemStore';

const props = defineProps<{ hall: string }>();
const container = ref<HTMLElement | null>(null);
const store = useSystemStore();
let map: L.Map | null = null;
let markersLayer = L.layerGroup();

const renderMap = () => {
  if (!container.value) return;
  if (map) {
    map.remove();
  }

  // 1. 初始化 CRS.Simple 坐标系地图
  map = L.map(container.value, {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    zoomControl: false,
    attributionControl: false,
  });

  // 2. 加载占位平面图底图（可以从 public/maps/ 加载，目前用纯色或渐变底图代替）
  const bounds: L.LatLngBoundsExpression = [[0, 0], [1000, 1000]];
  // 这里使用一个 1x1 像素的灰色 base64 图像来代表平面图
  L.imageOverlay('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', bounds).addTo(map);
  
  map.fitBounds(bounds);
  markersLayer.addTo(map);

  drawCabinets();
};

const drawCabinets = () => {
  markersLayer.clearLayers();
  const archivesInHall = store.archives.filter(a => a.hall === props.hall);

  archivesInHall.forEach(archive => {
    // 根据当前时间轴判断该档案金匮是否发光
    const isActive = store.currentTime >= archive.start_year && store.currentTime <= archive.end_year;
    
    // 自定义 HTML 图标展现金匮
    const html = `
      <div class="relative w-8 h-8 flex items-center justify-center transition-all duration-300 transform hover:scale-110">
        <div class="w-6 h-6 rounded-sm border-2 ${isActive ? 'border-yellow-400 bg-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'border-gray-500 bg-gray-500/40'}"></div>
      </div>
    `;

    const icon = L.divIcon({
      html,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker(archive.cabinet_coords, { icon });
    marker.on('click', () => {
      if (isActive) {
        store.selectArchive(archive);
      }
    });

    marker.addTo(markersLayer);
  });
};

onMounted(() => {
  if (props.hall) renderMap();
});

watch(() => props.hall, () => {
  if (props.hall) renderMap();
});

// 监听时间轴改变，动态更新所有金匮的视觉状态
watch(() => store.currentTime, () => {
  if (map) drawCabinets();
});

// 监听搜索联动触发的地图平移高亮
watch(() => store.mapFocusTrigger, () => {
  if (map && store.selectedArchive && store.selectedArchive.hall === props.hall) {
    map.flyTo(store.selectedArchive.cabinet_coords, 1, { duration: 1.5 });
  }
});

onBeforeUnmount(() => {
  if (map) map.remove();
});
</script>

<template>
  <div ref="container" class="w-full h-full bg-gray-800 rounded-3xl overflow-hidden shadow-2xl border border-white/10 relative">
    <div class="absolute top-4 left-4 z-[400] text-xl font-bold text-white drop-shadow-md">
      {{ props.hall === 'MainHall' ? '主殿平面图' : props.hall === 'EastHall' ? '东殿平面图' : '西殿平面图' }}
    </div>
  </div>
</template>

<style>
/* 去除 leaflet 默认背景 */
.leaflet-container {
  background: transparent;
}
</style>
