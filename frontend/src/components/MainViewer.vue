<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSystemStore } from '../store/useSystemStore';
import ThreeMacroView from './ThreeMacroView.vue';
import LeafletMicroView from './LeafletMicroView.vue';
import CreativeWindow from './CreativeWindow.vue';

const store = useSystemStore();

onMounted(() => {
  store.fetchMockData();
});

const onSearchItemClick = (archive: any) => {
  store.focusArchive(archive);
  store.setSearchQuery('');
};

const showCreativeWindow = ref(false);
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden bg-gray-900 text-white font-sans flex flex-col">
    
    <!-- 顶部：全局搜索栏 -->
    <div class="absolute top-0 left-0 w-full h-24 z-30 pointer-events-none flex items-center justify-center">
      <div class="pointer-events-auto relative w-1/3 min-w-[400px]">
        <input 
          v-model="store.searchQuery"
          type="text" 
          placeholder="搜索档案名称、ID 或关联内容..." 
          class="w-full bg-black/60 backdrop-blur-xl border border-white/20 rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all shadow-[0_10px_30px_rgba(0,0,0,0.5)] placeholder:text-gray-400"
        />
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-4 top-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        
        <!-- 搜索下拉结果面板 -->
        <transition name="dropdown">
          <div v-if="store.searchQuery && store.filteredArchives.length > 0" 
               class="absolute top-16 left-0 w-full bg-gray-900/95 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-72 overflow-y-auto z-40 custom-scrollbar">
            <div v-for="arch in store.filteredArchives" :key="arch.id" 
                 @click="onSearchItemClick(arch)"
                 class="p-4 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-colors group">
              <h4 class="font-bold text-yellow-500 group-hover:text-yellow-400 transition-colors">
                {{ arch.name }} <span class="text-xs text-gray-500 ml-2">[{{ arch.id }}]</span>
              </h4>
              <p class="text-xs text-gray-400 truncate mt-1.5">{{ arch.content }}</p>
            </div>
          </div>
        </transition>
      </div>
      
      <!-- 返回 3D 宏观建筑外景按钮 -->
      <transition name="fade">
        <button v-if="store.currentView !== '3D'"
                @click="store.setView('3D')"
                class="pointer-events-auto absolute left-8 px-5 py-2.5 bg-black/50 hover:bg-black/70 backdrop-blur-xl rounded-xl text-sm font-bold tracking-wider border border-white/10 transition-all hover:-translate-x-1 shadow-lg flex items-center gap-2 text-gray-300 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回宏观全景
        </button>
      </transition>

      <!-- 文创空间入口按钮 -->
      <button @click="showCreativeWindow = true"
              class="pointer-events-auto absolute right-8 px-5 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-sm font-bold tracking-wider transition-all hover:scale-105 shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center gap-2 text-yellow-500 hover:text-yellow-400 backdrop-blur-xl">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
        数字文创
      </button>
    </div>

    <!-- 中央：渲染交互区 -->
    <div class="flex-1 relative z-10 w-full h-full">
      <!-- 宏观 3D 建筑入口 -->
      <ThreeMacroView v-if="store.currentView === '3D'" />
      
      <!-- 微观 2D 殿内平面地图 -->
      <div v-else class="absolute inset-0 p-16 pt-28 pb-36 animate-scale-fade-in">
        <LeafletMicroView :hall="store.currentView" />
      </div>
    </div>

    <!-- 右侧：侧边专家悬浮知识面板 -->
    <div class="absolute right-8 top-28 bottom-36 w-[420px] z-20 transition-all duration-500 ease-out"
         :class="store.selectedArchive ? 'translate-x-0 opacity-100 pointer-events-auto' : 'translate-x-[120%] opacity-0 pointer-events-none'">
      <div class="w-full h-full bg-black/70 backdrop-blur-3xl border border-yellow-500/20 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col relative overflow-hidden group hover:border-yellow-500/40 transition-colors">
        
        <!-- 顶部装饰线 -->
        <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-600 via-yellow-400 to-orange-500"></div>

        <button @click="store.selectArchive(null)" class="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2.5 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>

        <h2 class="text-3xl font-bold mb-8 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent tracking-wide flex items-center gap-3">
          专家释读面板
        </h2>
        
        <div v-if="store.selectedArchive" class="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-8 animate-fade-in-up">
          
          <div>
            <label class="text-xs font-bold text-yellow-600 uppercase tracking-widest flex items-center gap-2 mb-2">
              <span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
              档案基础信息
            </label>
            <div class="bg-white/5 p-4 rounded-xl border border-white/5">
              <div class="flex justify-between items-center mb-3">
                <span class="text-gray-400 text-sm">编号 (ID)</span>
                <span class="text-white font-mono bg-white/10 px-2 py-1 rounded text-xs">{{ store.selectedArchive.id }}</span>
              </div>
              <div class="flex justify-between items-center mb-3">
                <span class="text-gray-400 text-sm">名称 (Name)</span>
                <span class="text-yellow-400 font-bold text-lg">{{ store.selectedArchive.name }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-gray-400 text-sm">存续年份</span>
                <span class="text-gray-200 font-medium tracking-wider">{{ store.selectedArchive.start_year }} - {{ store.selectedArchive.end_year }}</span>
              </div>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-yellow-600 uppercase tracking-widest flex items-center gap-2 mb-2">
              <span class="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              详细卷宗内容
            </label>
            <div class="bg-white/[0.03] p-5 rounded-2xl border border-white/5 shadow-inner relative text-sm text-gray-300 leading-relaxed min-h-[150px]">
              <div class="absolute -left-2 -top-4 text-5xl text-yellow-500/10 font-serif">"</div>
              <p class="relative z-10">{{ store.selectedArchive.content }}</p>
            </div>
          </div>
          
          <div>
            <label class="text-xs font-bold text-yellow-600 uppercase tracking-widest flex items-center gap-2 mb-2">
              <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              关联数字资产
            </label>
            <div class="w-full h-40 bg-white/5 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-gray-500 text-sm hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>暂无高清扫描件</span>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- 底部：全局时间轴 -->
    <div class="absolute bottom-0 left-0 w-full h-28 bg-gradient-to-t from-black via-black/80 to-transparent z-30 flex items-center justify-center px-12 pointer-events-none">
      <div class="pointer-events-auto w-full max-w-5xl bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 px-8 py-5 flex items-center gap-8 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div class="flex flex-col items-end w-24">
          <span class="text-yellow-500 font-black text-3xl tracking-tighter drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">{{ store.currentTime }}</span>
          <span class="text-gray-500 text-xs font-bold tracking-widest uppercase">纪年 (Year)</span>
        </div>
        
        <div class="flex-1 relative flex items-center">
          <input 
            type="range" 
            min="1400" 
            max="2026" 
            v-model.number="store.currentTime"
            class="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer custom-range outline-none"
          />
        </div>

        <div class="w-12 text-center text-gray-500 font-bold text-sm">
          NOW
        </div>
      </div>
    </div>

    <!-- 文创窗口弹层 -->
    <transition name="fade">
      <CreativeWindow v-if="showCreativeWindow" @close="showCreativeWindow = false" />
    </transition>
  </div>
</template>

<style scoped>
.animate-scale-fade-in {
  animation: scale-fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes scale-fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.animate-fade-in-up {
  animation: fade-in-up 0.5s ease-out forwards;
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.dropdown-enter-active, .dropdown-leave-active { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-10px); }

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(234, 179, 8, 0.3); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(234, 179, 8, 0.6); }

/* Custom Range Input */
.custom-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #eab308;
  cursor: pointer;
  box-shadow: 0 0 15px rgba(234, 179, 8, 0.8), inset 0 0 5px rgba(255, 255, 255, 0.5);
  border: 2px solid white;
  transition: transform 0.1s;
}
.custom-range::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}
</style>
