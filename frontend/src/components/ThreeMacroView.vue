<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSystemStore } from '../store/useSystemStore';

const container = ref<HTMLElement | null>(null);
const store = useSystemStore();

let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;

const interactiveObjects: THREE.Mesh[] = [];
let animationFrameId: number;

const halls = [
  { id: 'MainHall', name: '主殿', position: [0, 0, -2], color: 0xffd700 },
  { id: 'EastHall', name: '东殿', position: [4, 0, 0], color: 0xdaa520 },
  { id: 'WestHall', name: '西殿', position: [-4, 0, 0], color: 0xdaa520 },
];

onMounted(() => {
  if (!container.value) return;

  // 1. 初始化场景 (Scene)
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111827); // 深色背景
  scene.fog = new THREE.Fog(0x111827, 10, 30);

  // 2. 初始化相机 (Camera)
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 8, 12);

  // 3. 初始化渲染器 (WebGLRenderer)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.value.appendChild(renderer.domElement);

  // 4. 初始化控制器 (OrbitControls)
  // 适配 Mac 触控板平滑缩放
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; 
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;

  // 5. 添加灯光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 5);
  scene.add(directionalLight);

  // 6. 添加占位符长方体 (金黄色半透明)
  halls.forEach((hall) => {
    const geometry = new THREE.BoxGeometry(2, 2, 3);
    const material = new THREE.MeshStandardMaterial({
      color: hall.color,
      transparent: true,
      opacity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(hall.position[0], hall.position[1], hall.position[2]);
    mesh.userData = { id: hall.id, name: hall.name }; // 存储数据供射线检测读取
    scene.add(mesh);
    interactiveObjects.push(mesh);
  });

  const grid = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
  scene.add(grid);

  // 7. 射线检测 (Raycaster)
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('click', onClick);
  window.addEventListener('resize', onResize);

  animate();
});

const onClick = (event: MouseEvent) => {
  if (store.currentView !== '3D') return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(interactiveObjects);

  if (intersects.length > 0) {
    const selected = intersects[0].object;
    console.log(`进入室内: ${selected.userData.name}`);
    
    // 平滑视角切换动画
    const targetPos = selected.position.clone().add(new THREE.Vector3(0, 0, 2));
    const startPos = camera.position.clone();
    const startTime = performance.now();
    const duration = 800; // 800ms
    
    const animateCamera = (time: number) => {
      let alpha = (time - startTime) / duration;
      if (alpha > 1) alpha = 1;
      
      camera.position.lerpVectors(startPos, targetPos, alpha);
      
      if (alpha < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        // 动画结束，切换视图
        store.setView(selected.userData.id as 'MainHall' | 'EastHall' | 'WestHall');
      }
    };
    requestAnimationFrame(animateCamera);
  }
};

const onResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const animate = () => {
  animationFrameId = requestAnimationFrame(animate);
  if (store.currentView === '3D') {
    controls.update();
    renderer.render(scene, camera);
  }
};

onBeforeUnmount(() => {
  window.removeEventListener('click', onClick);
  window.removeEventListener('resize', onResize);
  cancelAnimationFrame(animationFrameId);
  renderer.dispose();
});
</script>

<template>
  <div ref="container" class="absolute inset-0 w-full h-full cursor-pointer z-0 transition-opacity duration-1000"
       :class="store.currentView === '3D' ? 'opacity-100' : 'opacity-0 pointer-events-none'">
  </div>
</template>
