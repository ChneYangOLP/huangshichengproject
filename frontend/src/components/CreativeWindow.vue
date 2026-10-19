<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';

const emit = defineEmits(['close']);

interface Product {
  id: string;
  name: string;
  desc: string;
  price: number;
  image: string;
  qrInfo: string;
}

const products = ref<Product[]>([
  {
    id: 'c1',
    name: '皇史宬黄釉金龙杯',
    desc: '以皇史宬琉璃瓦为灵感，结合明代黄釉金龙纹饰，采用景德镇高白泥高温烧制，尽显皇家气象。',
    price: 128,
    image: 'https://images.unsplash.com/photo-1577902636270-1793547ec945?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
    qrInfo: '防伪码: AUTH-8291-C1 | 生产批次: 202603A'
  },
  {
    id: 'c2',
    name: '金匮紫檀书签套装',
    desc: '提取皇史宬金匮的铜鎏金錾刻图样，精选小叶紫檀木雕刻而成，配以流苏，是读书伴侣的最佳选择。',
    price: 68,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
    qrInfo: '防伪码: AUTH-4421-C2 | 材质认证: 小叶紫檀'
  },
  {
    id: 'c3',
    name: '石室金匮立体拼图',
    desc: '微缩版皇史宬建筑模型，采用椴木层板激光切割，无需胶水拼插，深度还原石室金匮榫卯结构。',
    price: 199,
    image: 'https://images.unsplash.com/photo-1605372337725-b4ee7f311eb4?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
    qrInfo: '防伪码: AUTH-9923-C3 | 拼装难度: 4星'
  },
  {
    id: 'c4',
    name: '御笔朱批帆布袋',
    desc: '提取馆藏珍贵档案中的御笔朱批字样 "知道了" "览"，采用高克重加厚帆布，环保印刷，百搭实用。',
    price: 45,
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60',
    qrInfo: '防伪码: AUTH-1022-C4 | 材质: 100%纯棉'
  }
]);

const currentView = ref<'list' | 'detail' | 'scan'>('list');
const selectedProduct = ref<Product | null>(null);
const failedImages = ref<string[]>([]);
const onImageError = (id: string) => {
  if (!failedImages.value.includes(id)) failedImages.value.push(id);
};

const scanning = ref(false);

const viewDetail = (product: Product) => {
  selectedProduct.value = product;
  currentView.value = 'detail';
};

let html5QrCode: Html5Qrcode | null = null;

const startScan = async () => {
  currentView.value = 'scan';
  scanning.value = true;
  
  await nextTick();
  
  try {
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    await html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
      (decodedText) => {
        // 扫码成功
        stopScan();
        // 如果二维码内容是文创产品ID，则跳转到该产品，否则随机展示一个
        const product = products.value.find(p => p.id === decodedText) || products.value[Math.floor(Math.random() * products.value.length)];
        viewDetail(product);
      }, 
      () => {
        // 扫码过程中的识别失败（频繁触发，通常忽略）
      }
    );
  } catch (err) {
    console.error("Camera error:", err);
    scanning.value = false;
    alert("无法访问摄像头，请确保已授予权限或在支持的环境下运行 (localhost或https)。");
    // Fallback
    currentView.value = 'list';
  }
};

const stopScan = async () => {
  if (html5QrCode && html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      html5QrCode.clear();
    } catch (err) {
      console.error("Failed to stop scan:", err);
    }
  }
  scanning.value = false;
};

const goBack = async () => {
  if (currentView.value === 'scan') {
    await stopScan();
  }
  currentView.value = 'list';
  selectedProduct.value = null;
};

onBeforeUnmount(() => {
  stopScan();
});

</script>

<template>
  <div role="dialog" aria-modal="true" aria-label="文创空间" class="creative-window fixed inset-0 z-50 flex items-center justify-center bg-[#35291e]/60 backdrop-blur-sm p-3 sm:p-8 animate-fade-in">
    <div class="w-full max-w-4xl h-[85dvh] bg-[#f5ecdc] border border-[#a88b63]/50 rounded-sm shadow-2xl overflow-hidden flex flex-col relative">
      
      <!-- 头部 -->
      <div class="h-20 bg-gradient-to-r from-[#fbf4e7] to-[#ebdcc3] border-b border-[#b59c75]/30 flex items-center justify-between px-4 sm:px-8">
        <div class="flex items-center gap-4">
          <button v-if="currentView !== 'list'" @click="goBack" class="p-2 hover:bg-[#ad8c60]/10 rounded-full transition-colors text-[#8b775d] hover:text-[#4d3828]">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 class="text-2xl font-bold text-[#704330] flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[#963c32]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            文创空间
          </h2>
        </div>
        
        <div class="flex items-center gap-4">
          <button v-if="currentView === 'list'" @click="startScan" class="flex items-center gap-2 px-4 py-2 bg-[#963c32]/5 hover:bg-[#963c32]/10 text-[#963c32] border border-[#a88b63]/70 rounded-sm transition-all hover:scale-105 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            扫一扫
          </button>
          
          <button aria-label="关闭文创空间" @click="emit('close')" class="p-2 text-[#9a8263] hover:text-[#4d3828] hover:bg-[#ad8c60]/10 rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 内容区 -->
      <div class="flex-1 overflow-hidden relative">
        
        <!-- 列表视图 -->
        <div v-if="currentView === 'list'" class="absolute inset-0 p-5 sm:p-8 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 auto-rows-max gap-6 animate-fade-in-up">
          <div v-for="product in products" :key="product.id" 
               @click="viewDetail(product)"
               class="bg-[#ad8c60]/5 border border-[#b59c75]/30 rounded-sm overflow-hidden cursor-pointer group hover:bg-[#ad8c60]/10 hover:border-[#a88b63]/50 transition-all hover:-translate-y-1 hover:shadow-2xl flex flex-col">
            <div class="h-48 shrink-0 overflow-hidden relative">
              <div class="absolute inset-0 bg-gradient-to-t from-[#6b533a]/50 via-transparent to-transparent z-10"></div>
              <img v-if="!failedImages.includes(product.id)" :src="product.image" :alt="product.name" class="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" @error="onImageError(product.id)" />
              <div v-else class="product-placeholder" aria-label="文创展示图"><span>雅物</span><small>皇史宬 · 文创</small></div>
              <div class="absolute bottom-3 right-4 z-20 text-[#963c32] font-bold text-xl bg-[#f8edda]/90 px-3 py-1 rounded-sm backdrop-blur-md">
                ¥{{ product.price }}
              </div>
            </div>
            <div class="p-5 flex-1 flex flex-col">
              <h3 class="text-lg font-bold text-[#4d3828] mb-2 group-hover:text-[#963c32] transition-colors">{{ product.name }}</h3>
              <p class="text-sm text-[#8b775d] line-clamp-2 flex-1">{{ product.desc }}</p>
              <div class="mt-4 pt-4 border-t border-[#b59c75]/30 flex justify-between items-center text-xs text-[#9a8263]">
                <span class="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-[#7c8566]" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                  </svg>
                  正版授权
                </span>
                <span class="group-hover:text-[#963c32] transition-colors">查看详情 &rarr;</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 详情视图 -->
        <div v-else-if="currentView === 'detail' && selectedProduct" class="absolute inset-0 flex flex-col sm:flex-row overflow-y-auto animate-scale-fade-in">
          <div class="w-full sm:w-1/2 sm:h-full bg-[#e5d5b9]/50 p-8 flex items-center justify-center">
            <div class="relative w-full aspect-square rounded-sm overflow-hidden border border-[#b59c75]/30 shadow-2xl">
              <img v-if="!failedImages.includes(selectedProduct.id)" :src="selectedProduct.image" :alt="selectedProduct.name" class="w-full h-full object-cover" @error="onImageError(selectedProduct.id)" />
              <div v-else class="product-placeholder" aria-label="文创展示图"><span>雅物</span><small>皇史宬 · 文创</small></div>
              <div class="absolute top-4 left-4 bg-[#963c32] text-[#fff0d8] text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                博物馆联名款
              </div>
            </div>
          </div>
          <div class="w-full sm:w-1/2 sm:h-full p-6 sm:p-10 overflow-y-auto custom-scrollbar flex flex-col">
            <h1 class="text-2xl sm:text-4xl font-black text-[#4d3828] mb-4 leading-tight">{{ selectedProduct.name }}</h1>
            
            <div class="text-3xl text-[#963c32] font-bold mb-8">
              ¥ {{ selectedProduct.price }}
            </div>
            
            <div class="space-y-6 flex-1">
              <div>
                <h4 class="text-sm text-[#963c32] font-bold mb-2 uppercase tracking-widest border-l-4 border-[#963c32] pl-3">设计理念</h4>
                <p class="text-[#745e47] leading-relaxed text-sm bg-[#ad8c60]/5 p-4 rounded-sm">
                  {{ selectedProduct.desc }}
                </p>
              </div>
              
              <div>
                <h4 class="text-sm text-[#963c32] font-bold mb-2 uppercase tracking-widest border-l-4 border-[#963c32] pl-3">数字资产信息</h4>
                <div class="bg-[#7c8566]/10 border border-[#7c8566]/30 p-4 rounded-sm flex items-start gap-4">
                  <div class="bg-[#7c8566]/20 p-2 rounded-lg text-[#687453]">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h5 class="text-[#687453] font-bold text-sm mb-1">正品区块链溯源认证</h5>
                    <p class="text-[#687453]/70 text-xs font-mono break-all">{{ selectedProduct.qrInfo }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-8 flex gap-4">
              <button class="flex-1 bg-[#963c32] hover:bg-[#81332b] text-[#fff0d8] font-bold py-4 rounded-sm transition-all hover:shadow-lg hover:-translate-y-1">
                立即购买
              </button>
              <button class="w-16 h-14 bg-[#ad8c60]/10 hover:bg-[#ad8c60]/20 border border-[#b59c75]/50 rounded-sm flex items-center justify-center transition-all hover:text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- 扫码视图 -->
        <div v-else-if="currentView === 'scan'" class="absolute inset-0 bg-black flex flex-col items-center justify-center">
          
          <h3 class="absolute top-10 text-xl text-[#4d3828] font-bold tracking-widest z-20">请将二维码放入框内</h3>
          
          <!-- 真实的摄像头容器 -->
          <div class="relative w-[320px] h-[320px] border-2 border-[#b59c75]/50 rounded-sm overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-[#f5ecdc]">
            <div id="reader" class="w-full h-full object-cover"></div>
                 
            <!-- 边角装饰 -->
            <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#963c32] rounded-tl-3xl pointer-events-none z-10"></div>
            <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#963c32] rounded-tr-3xl pointer-events-none z-10"></div>
            <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#963c32] rounded-bl-3xl pointer-events-none z-10"></div>
            <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#963c32] rounded-br-3xl pointer-events-none z-10"></div>
            
            <div v-if="scanning" class="absolute inset-0 pointer-events-none z-20 overflow-hidden">
               <!-- 扫描动画线 -->
               <div class="absolute left-0 right-0 h-1 bg-[#81332b] shadow-[0_0_20px_rgba(234,179,8,1)] animate-scan"></div>
            </div>
          </div>
          
          <p class="absolute bottom-12 text-[#9a8263] text-sm">支持扫描实体文创或防伪标签上的二维码</p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.product-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: radial-gradient(ellipse, #f5e8ce, #deccb0); color: #9e7350; }.product-placeholder > span { font-size: 30px; letter-spacing: .2em; border: 1px solid #af8c6680; padding: 10px 8px 10px 14px; }.product-placeholder > small { font-size: 10px; letter-spacing: .2em; }
.animate-fade-in {
  animation: fade-in 0.3s ease-out forwards;
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in-up {
  animation: fade-in-up 0.4s ease-out forwards;
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-scale-fade-in {
  animation: scale-fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes scale-fade-in {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.animate-scan {
  animation: scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes scan {
  0% { top: -10%; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { top: 110%; opacity: 0; }
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #baa17c; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9e8157; }
</style>
