<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useSystemStore, type HallId } from '../store/useSystemStore';

const container = ref<HTMLElement | null>(null);
const store = useSystemStore();
const webglAvailable = ref(true);
const modelLoading = ref(true);
const modelError = ref(false);
const modelReady = ref(false);
const halls: { id: HallId; name: string; position: [number, number, number]; rotation: number }[] = [
  { id: 'MainHall', name: '主殿', position: [0, 0, -3.2], rotation: 0 },
  { id: 'WestHall', name: '西殿', position: [-5, 0, 1], rotation: Math.PI / 2 },
  { id: 'EastHall', name: '东殿', position: [5, 0, 1], rotation: -Math.PI / 2 },
];
const labelPositions = ref(halls.map(() => ({ x: -1000, y: -1000 })));
let scene: THREE.Scene | undefined;
let camera: THREE.PerspectiveCamera | undefined;
let renderer: THREE.WebGLRenderer | undefined;
let controls: OrbitControls | undefined;
let resizeObserver: ResizeObserver | undefined;
let animationFrameId = 0;
let pointerStart: { x: number; y: number; id: number } | null = null;
const interactiveObjects: THREE.Mesh[] = [];
const hallGroups: THREE.Group[] = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredHall: HallId | null = null;
let modelSource: THREE.Group | undefined;
let disposed = false;
const labelAnchors: THREE.Vector3[] = [];

const box = (group: THREE.Group, width: number, height: number, depth: number, x: number, y: number, z: number, color: number) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color, roughness: .9 }));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

// The supplied GLB contains one hall. Reuse its geometry and original materials
// for the three existing entrances, keeping each building's proportions intact.
const createHall = (hall: typeof halls[number], source: THREE.Group) => {
  const group = new THREE.Group();
  const model = source.clone(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = (hall.id === 'MainHall' ? 6.2 : 4.8) / bounds.getSize(new THREE.Vector3()).x;
  model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
  model.scale.setScalar(scale);
  group.add(model);
  group.position.set(...hall.position);
  group.rotation.y = hall.rotation;
  // Hovering a hall must not tint the other instances of the same GLB.
  const materials = new Map<THREE.Material, THREE.Material>();
  const ownMaterial = (material: THREE.Material) => {
    if (!materials.has(material)) materials.set(material, material.clone());
    return materials.get(material)!;
  };
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.material = Array.isArray(object.material) ? object.material.map(ownMaterial) : ownMaterial(object.material);
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.id = hall.id;
    interactiveObjects.push(object);
  });
  scene?.add(group);
  hallGroups.push(group);
  const hallBounds = new THREE.Box3().setFromObject(group);
  const anchor = hallBounds.getCenter(new THREE.Vector3());
  anchor.y = hallBounds.max.y + .3;
  labelAnchors.push(anchor);
};

const disposeResources = (roots: THREE.Object3D[]) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  roots.forEach(root => root.traverse(object => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
    geometries.add(object.geometry);
    const list: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach(material => {
      materials.add(material);
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  }));
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  textures.forEach(texture => texture.dispose());
};

const loadModel = async () => {
  modelLoading.value = true;
  modelError.value = false;
  try {
    const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/huangshicheng.glb');
    if (disposed) { disposeResources([gltf.scene]); return; }
    modelSource = gltf.scene;
    halls.forEach(hall => createHall(hall, gltf.scene));
    modelReady.value = true;
  } catch {
    if (!disposed) modelError.value = true;
  } finally {
    if (!disposed) modelLoading.value = false;
  }
};

const resize = () => {
  if (!container.value || !camera || !renderer) return;
  const { width, height } = container.value.getBoundingClientRect();
  if (!width || !height) return;
  camera.aspect = width / height;
  // Keep all three buildings visible on both a wide desktop and a narrow phone.
  const distance = camera.aspect < 1 ? 27 / camera.aspect : 25;
  if (controls) controls.maxDistance = Math.max(52, distance * 1.2);
  camera.position.set(distance * .23, distance * .6, distance * .8);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  controls?.update();
};

const getHallAt = (event: PointerEvent) => {
  if (!renderer || !camera) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(interactiveObjects)[0]?.object.userData.id as HallId | undefined;
};
const onPointerDown = (event: PointerEvent) => { pointerStart = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null; };
const onPointerUp = (event: PointerEvent) => {
  if (pointerStart?.id === event.pointerId && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 6) {
    const id = getHallAt(event);
    if (id) store.setView(id);
  }
  pointerStart = null;
};
const onPointerCancel = () => { pointerStart = null; };
const onPointerMove = (event: PointerEvent) => {
  if (!renderer) return;
  const id = getHallAt(event) || null;
  if (id === hoveredHall) return;
  hoveredHall = id;
  renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
  hallGroups.forEach((group, index) => {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
        object.material.emissive.setHex(halls[index]?.id === id ? 0x3b210e : 0x000000);
        object.material.emissiveIntensity = .16;
      }
    });
  });
};

const animate = () => {
  if (!renderer || !scene || !camera || !container.value) return;
  animationFrameId = requestAnimationFrame(animate);
  controls?.update();
  renderer.render(scene, camera);
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  const activeCamera = camera;
  labelPositions.value = halls.map((hall, index) => {
    const point = (labelAnchors[index] ?? new THREE.Vector3(hall.position[0], 3.45, hall.position[2])).clone().project(activeCamera);
    return { x: (point.x * .5 + .5) * width, y: (-point.y * .5 + .5) * height };
  });
};

onMounted(() => {
  if (!container.value) return;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch { webglAvailable.value = false; return; }
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, .1, 120);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-label', '皇史宬殿宇三维模型，主殿与西殿可进入，东殿禁止入内');
  container.value.appendChild(renderer.domElement);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, -.3);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.enablePan = false;
  controls.minDistance = 16;
  controls.maxDistance = 52;
  controls.minPolarAngle = .35;
  controls.maxPolarAngle = Math.PI / 2.6;
  scene.add(new THREE.HemisphereLight(0xfff8e7, 0xa89a7d, 1.7));
  const sun = new THREE.DirectionalLight(0xffeed0, 3);
  sun.position.set(-8, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
  sun.shadow.normalBias = .05;
  scene.add(sun);
  const courtyard = new THREE.Group();
  box(courtyard, 15.2, .15, 12.3, 0, -.07, 0, 0xded4bf);
  box(courtyard, 15.6, .1, 12.7, 0, -.18, 0, 0xc0b59e);
  const paving = new THREE.LineBasicMaterial({ color: 0xc7bea9, transparent: true, opacity: .45 });
  const points: THREE.Vector3[] = [];
  for (let x = -7; x <= 7; x += .7) points.push(new THREE.Vector3(x, .013, -6), new THREE.Vector3(x, .013, 6));
  for (let z = -6; z <= 6; z += .7) points.push(new THREE.Vector3(-7.5, .013, z), new THREE.Vector3(7.5, .013, z));
  courtyard.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), paving));
  // Low courtyard walls frame the model without obscuring the halls.
  box(courtyard, 15, .55, .23, 0, .27, -5.8, 0xaa7761);
  box(courtyard, .23, .55, 11.5, -7.35, .27, 0, 0xaa7761);
  box(courtyard, .23, .55, 11.5, 7.35, .27, 0, 0xaa7761);
  box(courtyard, 15.3, .08, .32, 0, .58, -5.8, 0x7e8472);
  [-1, 1].forEach(side => box(courtyard, .32, .08, 11.6, side * 7.35, .58, 0, 0x7e8472));
  scene.add(courtyard);
  loadModel();
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  renderer.domElement.addEventListener('pointercancel', onPointerCancel);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container.value);
  resize();
  animate();
});

onBeforeUnmount(() => {
  disposed = true;
  cancelAnimationFrame(animationFrameId);
  resizeObserver?.disconnect();
  controls?.dispose();
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
    renderer.domElement.removeEventListener('pointermove', onPointerMove);
  }
  disposeResources([scene, modelSource].filter((root): root is THREE.Scene | THREE.Group => !!root));
  renderer?.dispose();
});
</script>

<template>
  <div class="macro-view" :class="{ 'no-webgl': !webglAvailable || modelError }">
    <div ref="container" class="scene-canvas"></div>
    <p v-if="!webglAvailable" class="webgl-message">当前设备无法显示三维模型，请选择殿宇查看平面图。</p>
    <p v-else-if="modelLoading" class="model-message" role="status">正在载入殿宇模型…</p>
    <p v-else-if="modelError" class="model-message" role="alert">殿宇模型未能载入。<button type="button" @click="loadModel">重新载入</button></p>
    <div v-if="modelReady || modelError || !webglAvailable" class="hall-labels" aria-label="选择殿宇">
      <button v-for="(hall, index) in halls" :key="hall.id" class="hall-label" :class="{ 'hall-closed': hall.id === 'EastHall' }" :style="webglAvailable ? { left: labelPositions[index]?.x + 'px', top: labelPositions[index]?.y + 'px' } : undefined" :aria-label="hall.name + (hall.id === 'EastHall' ? '，禁止入内，暂不开放' : '，查看平面图')" @click.stop="store.setView(hall.id)">
        <span class="hall-name">{{ hall.name }}<span class="label-arrow" aria-hidden="true">{{ hall.id === 'EastHall' ? '⊘' : '↗' }}</span></span>
        <span class="hall-status">{{ hall.id === 'EastHall' ? '禁止入内' : '入殿观览' }}</span>
      </button>
    </div>
    <div class="compass" aria-hidden="true"><span>北</span><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-width=".7" /><path d="m20 5 5 27-5-5-5 5Z" fill="currentColor" /><path d="M1 20h6m26 0h6M20 1v4m0 30v4" stroke="currentColor" stroke-width=".7" /></svg></div>
  </div>
</template>

<style scoped>
.macro-view { position: absolute; inset: 0; }.scene-canvas { position: absolute; inset: 0; }.scene-canvas :deep(canvas) { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }.scene-canvas :deep(canvas:active) { cursor: grabbing; }.hall-labels { position: absolute; inset: 0; pointer-events: none; }.hall-label { position: absolute; transform: translate(-50%, -100%); min-width: 91px; border: 1px solid #a78b626b; padding: 9px 13px 8px; background: #faf2e3e8; color: #5f3a29; box-shadow: 0 4px 15px #59401f12; pointer-events: auto; transition: background .2s, border-color .2s; }.hall-label::after { content: ''; position: absolute; width: 1px; height: 16px; background: #a78b6280; top: 100%; left: 50%; }.hall-label:hover { background: #fff9ed; border-color: #963c32; }.hall-name { white-space: nowrap; display: flex; gap: 14px; align-items: center; justify-content: space-between; font-size: 17px; letter-spacing: .15em; }.label-arrow { font: 14px serif; color: #963c32; }.hall-status { display: block; margin-top: 5px; font-size: 8px; letter-spacing: .18em; color: #a18a69; text-align: left; }.hall-closed { color: #8c8170; border-style: dashed; background: #eee8dcd9; }.hall-closed .label-arrow, .hall-closed .hall-status { color: #9d8e7b; }.hall-closed:hover { border-color: #a18464; background: #f3ecdf; }.compass { position: absolute; bottom: 26px; right: 48px; color: #a68d68; display: flex; flex-direction: column; align-items: center; gap: 5px; pointer-events: none; }.compass > span { font-size: 10px; }.compass svg { width: 40px; height: 40px; }.webgl-message { position: absolute; top: 55%; width: 100%; text-align: center; color: #8b755a; font-size: 12px; padding: 0 25px; }.model-message { position: absolute; bottom: 16%; width: 100%; text-align: center; color: #8b755a; font-size: 12px; }.model-message button { margin-left: 10px; padding: 5px 10px; border: 1px solid #a88762; color: #744b30; background: #faf0dd; }.no-webgl .hall-labels { display: flex; justify-content: center; gap: 20px; align-items: center; }.no-webgl .hall-label { position: static; transform: none; }
@media (max-width: 700px) { .hall-label { min-width: 66px; padding: 7px 8px 6px; }.hall-name { font-size: 14px; gap: 8px; }.hall-status { font-size: 7px; letter-spacing: .08em; margin-top: 4px; }.hall-label::after { height: 10px; }.compass { right: 23px; bottom: 56px; }.compass svg { width: 30px; height: 30px; }.compass > span { font-size: 8px; } }
</style>
