<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useSystemStore, type ArchiveData, type ViewId } from '../store/useSystemStore';
import ThreeMacroView from './ThreeMacroView.vue';
import LeafletMicroView from './LeafletMicroView.vue';
import CreativeWindow from './CreativeWindow.vue';
import CabinetDetails from './CabinetDetails.vue';
import type { Cabinet } from '../data/types';
import { TIMELINE_MAX_YEAR, TIMELINE_MIN_YEAR } from '../data/archiveTime';

const store = useSystemStore();
const showCreativeWindow = ref(false);
const closedDialog = ref<HTMLDialogElement | null>(null);
const currentYear = TIMELINE_MAX_YEAR;
const hallNames = { MainHall: '主殿', WestHall: '西殿', EastHall: '东殿' };
const currentTitle = computed(() => store.currentView === '3D' ? '殿宇全览' : hallNames[store.currentView] + '图志');
const yearProgress = computed(() => (store.currentTime - 1400) / (currentYear - 1400) * 100 + '%');
const timelineDescription = computed(() => store.timelineActive
  ? `${store.currentTime} 年，共 ${store.highlightedCabinetIds.size} 个金匮有年代匹配档案`
  : '拖动时间轴，高亮所属年代匹配的金匮');
const onTimelineInput = (event: Event) => store.setTime(Number((event.target as HTMLInputElement).value));
const navItems: { id: ViewId; name: string }[] = [
  { id: '3D', name: '殿宇全览' },
  { id: 'MainHall', name: '主殿' },
  { id: 'WestHall', name: '西殿' },
  { id: 'EastHall', name: '东殿' },
];

watch(() => store.closedHallNotice, async (show) => {
  await nextTick();
  if (show && !closedDialog.value?.open) closedDialog.value?.showModal();
  else if (!show && closedDialog.value?.open) closedDialog.value?.close();
});

const onSearchItemClick = (archive: ArchiveData) => {
  store.focusArchive(archive);
  store.setSearchQuery('');
};
const onCabinetSearchClick = (cabinet: Cabinet) => {
  store.navigateToCabinet(cabinet);
  store.setSearchQuery('');
};
</script>

<template>
  <div class="atlas-app">
    <header class="masthead">
      <button class="brand" aria-label="皇史宬，返回殿宇全览" @click="store.setView('3D')">
        <span class="brand-seal" aria-hidden="true">宬</span>
        <span class="brand-copy">
          <span class="brand-title">皇史宬</span>
          <span class="brand-subtitle">石室金匮 · 时空图谱</span>
        </span>
      </button>

      <div class="archive-search" role="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
        <input v-model="store.searchQuery" type="search" aria-label="检索馆藏档案" placeholder="检索档案名称、编号或金匮编号" autocomplete="off" @keydown.esc="store.setSearchQuery('')" />
        <span class="search-caption" aria-hidden="true">馆藏检索</span>
        <Transition name="dropdown">
          <div v-if="store.searchQuery.trim()" class="search-results custom-scrollbar">
            <div class="search-results-heading">馆藏目录 <span>{{ store.filteredArchives.length }} 份档案 · {{ store.filteredCabinets.length }} 个金匮</span></div>
            <button v-for="arch in store.filteredArchives" :key="arch.id" class="search-result" @click="onSearchItemClick(arch)">
              <span class="result-title">{{ arch.name }} <small>{{ arch.id }}</small></span>
              <span class="result-description">{{ arch.content }}</span>
              <span class="result-location">{{ hallNames[arch.hall] }} · {{ arch.cabinetId }} · 寻路阅档 →</span>
            </button>
            <template v-if="store.filteredCabinets.length">
              <div class="search-results-heading">金匮定位 <span>点击寻路</span></div>
              <button v-for="cabinet in store.filteredCabinets" :key="cabinet.id" class="search-result" @click="onCabinetSearchClick(cabinet)">
                <span class="result-title">{{ cabinet.id }}</span>
                <span class="result-location">{{ hallNames[cabinet.hall] }} · {{ store.archives.some(a => a.cabinetId === cabinet.id) ? '已分配档案' : '暂无档案' }} · 定位寻路 →</span>
              </button>
            </template>
            <p v-if="!store.filteredArchives.length && !store.filteredCabinets.length" class="search-empty">未寻得相关档案，请换个词试试。</p>
          </div>
        </Transition>
      </div>

      <button class="creative-entry" @click="showCreativeWindow = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><path d="M5 9h14v12H5zM3 6h18v4H3zM12 6v15M12 6C4 7 5 0 9 2c2 1 3 4 3 4Zm0 0c8 1 7-6 3-4-2 1-3 4-3 4Z" /></svg>
        <span>数字文创</span><span class="entry-arrow" aria-hidden="true">↗</span>
      </button>
    </header>

    <div class="navigation-bar">
      <div class="breadcrumb"><span>皇史宬</span><span class="breadcrumb-divider">/</span><strong>{{ currentTitle }}</strong></div>
      <nav class="hall-navigation" aria-label="殿宇导航">
        <button v-for="item in navItems" :key="item.id" :class="{ active: store.currentView === item.id, 'closed-nav': item.id === 'EastHall' }" :aria-current="store.currentView === item.id ? 'page' : undefined" @click="store.setView(item.id)">
          {{ item.name }}<span v-if="item.id === 'EastHall'" class="closed-tag">禁止入内</span>
        </button>
      </nav>
      <span class="edition-mark">皇史宬 · 数字游览</span>
    </div>

    <main class="view-stage">
      <template v-if="store.currentView === '3D'">
        <div class="scene-introduction">
          <span class="eyebrow"><i></i> 殿 宇 图 志</span>
          <h1>石室藏春秋<br />金匮存文脉<span class="title-seal" aria-hidden="true">典藏</span></h1>
          <p>循殿宇而入，展一卷旧时光。</p>
          <div class="introduction-rule"></div>
          <span class="introduction-hint">点击主殿或西殿，查看殿内平面图</span>
        </div>
        <ThreeMacroView />
        <div class="visit-key"><span><i class="open-dot"></i>主殿、西殿开放参观</span><span><i class="closed-dot"></i>东殿暂不开放</span></div>
        <div class="scene-controls"><span aria-hidden="true">↔</span> 拖动旋转 <i></i><span aria-hidden="true">⊕</span> 滚轮缩放</div>
        <span class="vertical-inscription" aria-hidden="true">守一室典籍 · 续千载文脉</span>
      </template>
      <div v-else class="plan-layout" :class="{ 'with-details': store.selectedCabinet }">
        <LeafletMicroView :hall="store.currentView" />
        <button class="back-to-scene" @click="store.setView('3D')"><span aria-hidden="true">←</span> 返回殿宇全览</button>
      </div>

      <Transition name="panel"><CabinetDetails v-if="store.selectedCabinet" /></Transition>
    </main>

    <footer class="timeline" :class="{ 'has-time-filter': store.timelineActive }">
      <div class="timeline-caption"><span class="eyebrow">岁 月 留 痕</span><span class="timeline-subtitle">{{ store.timelineActive ? '按所属年代匹配' : '拖动时间轴高亮' }}</span></div>
      <div class="year-display"><strong>{{ store.currentTime }}</strong><span>公元纪年</span></div>
      <div class="timeline-track">
        <input :value="store.currentTime" type="range" :min="TIMELINE_MIN_YEAR" :max="currentYear" step="1" aria-label="馆藏年代时间轴" title="拖动后高亮清单所属年代匹配的金匮" :aria-valuetext="timelineDescription" :style="{ '--progress': yearProgress }" @input="onTimelineInput" />
        <div class="timeline-ticks" aria-hidden="true"><span>1400</span><span>1600</span><span>1800</span><span>{{ currentYear }}</span></div>
      </div>
      <div class="timeline-end"><button v-if="store.timelineActive" class="clear-timeline" @click="store.clearTimelineHighlight()">清除高亮</button><span v-else>明 · 清 · 今</span><span class="footer-stamp" aria-hidden="true">史</span></div>
      <span class="timeline-announcement" role="status" aria-label="年代匹配结果">{{ timelineDescription }}</span>
    </footer>

    <dialog ref="closedDialog" class="closed-dialog" aria-labelledby="closed-title" aria-describedby="closed-description" @cancel="store.dismissClosedHallNotice()" @close="store.dismissClosedHallNotice()" @click="($event.target === $event.currentTarget) && store.dismissClosedHallNotice()">
      <div class="closed-dialog-content">
        <span class="notice-seal" aria-hidden="true">止</span>
        <span class="eyebrow">东 殿 · 游 览 须 知</span>
        <h2 id="closed-title">暂不开放</h2>
        <div class="notice-divider" aria-hidden="true"><span></span>◇<span></span></div>
        <p id="closed-description">东殿现为禁止入内区域。<br />请移步主殿或西殿，继续参观。</p>
        <button autofocus class="cinnabar-button" @click="store.dismissClosedHallNotice()">知晓了</button>
      </div>
    </dialog>

    <Transition name="fade"><CreativeWindow v-if="showCreativeWindow" @close="showCreativeWindow = false" /></Transition>
  </div>
</template>

<style scoped>
.atlas-app { height: 100dvh; width: 100%; display: flex; flex-direction: column; overflow: hidden; background: radial-gradient(ellipse at 70% 45%, #fffaf035, transparent 65%), repeating-linear-gradient(0deg, #9b7a4410 0, #9b7a4410 1px, transparent 1px, transparent 4px), #f2eadb; }
.masthead { position: relative; flex: 0 0 100px; display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 0 44px; border-bottom: 1px solid var(--line); z-index: 40; background: #f6efe2e8; }
.brand { display: flex; align-items: center; gap: 16px; flex-shrink: 0; padding: 0; background: none; border: 0; color: var(--ink); text-align: left; }
.brand-seal { display: grid; place-items: center; width: 49px; height: 55px; font-size: 34px; color: #fff0d8; background: var(--cinnabar); outline: 1px solid #f2ddbc; outline-offset: -5px; border-radius: 2px 3px 2px 4px; }
.brand-copy { display: flex; flex-direction: column; gap: 5px; }
.brand-title { font-size: 32px; letter-spacing: .22em; line-height: 1.1; font-weight: 700; }
.brand-subtitle { font-size: 10px; letter-spacing: .22em; color: var(--muted); }
.archive-search { position: relative; width: min(460px, 40%); display: flex; align-items: center; border-bottom: 1px solid #b8a485; }
.archive-search > svg { flex: 0 0 19px; width: 19px; height: 19px; color: var(--cinnabar); }
.archive-search input { width: 100%; border: 0; background: transparent; padding: 13px 12px; font-size: 13px; color: var(--ink); outline: none; min-width: 0; }
.archive-search:focus-within { border-color: var(--cinnabar); }
.archive-search input::placeholder { color: #93846f; letter-spacing: .08em; }
.search-caption { flex-shrink: 0; font-size: 10px; color: #9c8a70; letter-spacing: .12em; padding-left: 10px; border-left: 1px solid var(--line); }
.search-results { position: absolute; top: calc(100% + 14px); left: 0; width: 100%; max-height: 370px; overflow-y: auto; background: var(--paper-light); border: 1px solid #bdab8e; box-shadow: 0 12px 36px #4d392024; }
.search-results-heading { display: flex; justify-content: space-between; padding: 12px 16px; font-size: 11px; color: var(--muted); border-bottom: 1px solid var(--line); }
.search-result { display: block; width: 100%; text-align: left; padding: 15px 16px; border: 0; border-bottom: 1px solid #b9a48130; background: none; }
.search-result:hover, .search-result:focus-visible { background: #e9ddc9; }
.result-title { display: block; color: #71382c; font-size: 14px; font-weight: 700; }.result-title small { margin-left: 5px; font: 10px sans-serif; color: var(--muted); }
.result-description { display: block; font-size: 11px; color: #887860; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 7px; }
.result-location { display: block; font-size: 10px; color: #627064; margin-top: 9px; }.result-location.is-closed { color: var(--cinnabar); }
.search-empty { padding: 25px 16px; font-size: 13px; color: var(--muted); }
.creative-entry { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid #a58a626b; background: transparent; color: #674d35; font-size: 13px; letter-spacing: .12em; flex-shrink: 0; }
.creative-entry:hover { background: #eaddc5; }.creative-entry svg { width: 19px; height: 19px; }.entry-arrow { margin-left: 10px; color: var(--cinnabar); }
.navigation-bar { display: flex; align-items: center; justify-content: space-between; padding: 0 44px; height: 61px; flex-shrink: 0; position: relative; z-index: 20; border-bottom: 1px solid var(--line); }
.breadcrumb { font-size: 11px; color: var(--muted); display: flex; gap: 14px; }.breadcrumb strong { color: #675441; font-weight: 400; }.breadcrumb-divider { color: #c4b397; }
.hall-navigation { position: absolute; left: 50%; top: 0; height: 100%; transform: translateX(-50%); display: flex; align-items: stretch; gap: 35px; }
.hall-navigation button { position: relative; white-space: nowrap; padding: 0 4px; border: 0; background: transparent; color: #7e6c54; font-size: 14px; letter-spacing: .12em; }
.hall-navigation button.active { color: var(--cinnabar); font-weight: 700; }.hall-navigation button.active::after { content: ''; position: absolute; height: 2px; background: var(--cinnabar); left: 4px; right: 6px; bottom: -1px; }
.hall-navigation button:hover { color: var(--cinnabar); }.closed-tag { margin-left: 7px; border: 1px solid #a1866866; color: #93806b; padding: 2px 4px; font-size: 9px; letter-spacing: .03em; vertical-align: 1px; }
.edition-mark { font-size: 10px; color: #a28e70; letter-spacing: .15em; }
.view-stage { z-index: 1; flex: 1; min-height: 0; position: relative; overflow: hidden; }
.scene-introduction { position: absolute; top: 39px; left: 50px; z-index: 2; pointer-events: none; }
.eyebrow { font-size: 10px; letter-spacing: .12em; color: var(--gold); display: flex; align-items: center; gap: 10px; }.eyebrow i { display: inline-block; width: 21px; height: 1px; background: var(--gold); }
.scene-introduction h1 { position: relative; margin: 19px 0 15px; font-size: clamp(28px, 3vw, 43px); font-weight: 500; line-height: 1.55; letter-spacing: .15em; color: #443a2d; }
.title-seal { display: inline-block; margin-left: 10px; font-size: 10px; line-height: 1.2; writing-mode: vertical-rl; border: 1px solid #a3493b; color: #a3493b; padding: 4px 2px; letter-spacing: .2em; vertical-align: 2px; transform: rotate(-4deg); }
.scene-introduction p { font-size: 12px; color: #8d7c65; letter-spacing: .13em; margin: 0; }.introduction-rule { width: 38px; height: 1px; background: #bca584; margin: 20px 0 12px; }.introduction-hint { font-size: 10px; color: #9c8a71; letter-spacing: .04em; }
.visit-key { position: absolute; bottom: 26px; left: 50px; display: flex; flex-direction: column; gap: 9px; font-size: 10px; color: #8b7a63; pointer-events: none; }.visit-key span { display: flex; align-items: center; gap: 8px; }.visit-key i { width: 5px; height: 5px; border-radius: 50%; }.open-dot { background: #963c32; }.closed-dot { background: #9c9688; }
.scene-controls { display: flex; align-items: center; gap: 7px; position: absolute; bottom: 27px; left: 50%; transform: translateX(-50%); font-size: 10px; letter-spacing: .08em; color: #8d7c65; pointer-events: none; white-space: nowrap; }.scene-controls > span { font-size: 16px; }.scene-controls i { width: 1px; height: 10px; background: var(--line); margin: 0 8px; }
.vertical-inscription { position: absolute; top: 45px; right: 44px; writing-mode: vertical-rl; font-size: 11px; color: #ad997c; letter-spacing: .3em; pointer-events: none; }
.plan-layout { position: absolute; inset: 20px 44px 24px; }.back-to-scene { position: absolute; bottom: 25px; right: 26px; z-index: 430; display: flex; align-items: center; gap: 9px; border: 1px solid #a88762; background: #faf0dded; padding: 8px 12px; color: #744b30; font-size: 11px; }.back-to-scene:hover { background: #e8d1ac; }
.timeline { position: relative; z-index: 20; flex: 0 0 100px; display: flex; align-items: center; gap: 33px; padding: 0 50px; background: #f7f0e3e8; border-top: 1px solid var(--line); }.timeline-caption { display: flex; flex-direction: column; gap: 8px; min-width: 139px; padding-right: 32px; border-right: 1px solid var(--line); }.timeline-subtitle { font-size: 11px; color: #8b7a63; letter-spacing: .1em; }.year-display { display: flex; flex-direction: column; min-width: 85px; }.year-display strong { font: 400 35px/1.1 Georgia, serif; color: var(--cinnabar); letter-spacing: .02em; }.year-display > span { font-size: 9px; color: #9f8c70; margin-top: 5px; letter-spacing: .2em; }.timeline-track { flex: 1; position: relative; margin-top: 14px; }.timeline-track input { display: block; appearance: none; -webkit-appearance: none; width: 100%; height: 2px; background: linear-gradient(to right, #963c32 0 var(--progress), #cdbc9e var(--progress) 100%); cursor: pointer; }.timeline-track input::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; background: #963c32; border: 3px solid #f7f0e3; outline: 1px solid #963c32; transform: rotate(45deg); border-radius: 0; }.timeline-track input::-moz-range-thumb { width: 7px; height: 7px; background: #963c32; border: 3px solid #f7f0e3; outline: 1px solid #963c32; transform: rotate(45deg); border-radius: 0; }.timeline-ticks { display: flex; justify-content: space-between; margin-top: 13px; font: 10px Georgia, serif; color: #a28c6c; }.timeline-end { display: flex; align-items: center; gap: 25px; font-size: 10px; color: #9f8c70; letter-spacing: .1em; }.footer-stamp { border: 1px solid #a3824f60; width: 31px; height: 31px; display: grid; place-items: center; font-size: 20px; color: #a3824f80; }
.closed-dialog { padding: 0; border: 1px solid #b29165; background: var(--paper-light); color: var(--ink); width: 380px; max-width: calc(100vw - 40px); margin: auto; box-shadow: 0 20px 90px #34221455; overflow: visible; }.closed-dialog::backdrop { background: #30271e66; backdrop-filter: blur(5px); }.closed-dialog-content { margin: 8px; border: 1px solid #c5ae8c; padding: 34px 25px 28px; text-align: center; }.notice-seal { display: inline-grid; place-items: center; width: 42px; height: 46px; color: var(--cinnabar); font-size: 27px; border: 1px solid var(--cinnabar); outline: 1px solid #963c3270; outline-offset: -4px; margin-bottom: 23px; }.closed-dialog .eyebrow { justify-content: center; font-size: 10px; }.closed-dialog h2 { font-size: 32px; font-weight: 500; letter-spacing: .2em; margin: 12px 0; color: #663a2b; }.notice-divider { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 12px; color: #ad8b5a; }.notice-divider > span { width: 40px; height: 1px; background: #c5ae8c; }.closed-dialog p { margin: 20px 0 25px; font-size: 13px; line-height: 2; color: #8b755a; }.cinnabar-button { background: var(--cinnabar); color: #f8e9d1; border: 1px solid #803027; padding: 11px 40px; font-size: 13px; letter-spacing: .2em; }.cinnabar-button:hover { background: #7d2f28; }
.fade-enter-active, .fade-leave-active, .dropdown-enter-active, .dropdown-leave-active { transition: opacity .2s, transform .2s; }.fade-enter-from, .fade-leave-to, .dropdown-enter-from, .dropdown-leave-to { opacity: 0; }.dropdown-enter-from, .dropdown-leave-to { transform: translateY(-8px); }.panel-enter-active, .panel-leave-active { transition: transform .3s, opacity .3s; }.panel-enter-from, .panel-leave-to { transform: translateX(30px); opacity: 0; }
@media (max-width: 1100px) { .masthead { padding: 0 26px; gap: 20px; }.navigation-bar { padding: 0 26px; }.edition-mark { display: none; }.hall-navigation { position: static; transform: none; gap: 27px; }.scene-introduction { left: 30px; top: 25px; }.scene-introduction h1 { font-size: 31px; }.scene-introduction p { font-size: 10px; }.visit-key { left: 30px; }.vertical-inscription { right: 25px; }.plan-layout { inset-inline: 25px; }.archive-panel { right: 25px; }.timeline { padding: 0 30px; gap: 25px; }.timeline-caption { min-width: 125px; padding-right: 20px; }.timeline-end { gap: 12px; }.search-caption { display: none; } }
@media (max-width: 700px) { .masthead { flex: 0 0 120px; align-items: flex-start; padding: 17px 20px 0; gap: 12px; }.brand { gap: 11px; }.brand-seal { width: 35px; height: 40px; font-size: 25px; }.brand-title { font-size: 24px; }.brand-subtitle { font-size: 8px; letter-spacing: .12em; }.creative-entry { padding: 9px 10px; margin-top: 2px; font-size: 11px; gap: 7px; }.creative-entry svg { width: 16px; height: 16px; }.entry-arrow { display: none; }.archive-search { position: absolute; left: 20px; right: 20px; bottom: 12px; width: auto; }.archive-search input { padding: 8px 10px; font-size: 11px; }.search-results { max-height: 50dvh; }.navigation-bar { height: 52px; padding: 0 20px; justify-content: center; }.breadcrumb { display: none; }.hall-navigation { gap: 22px; width: 100%; justify-content: space-between; }.hall-navigation button { font-size: 12px; letter-spacing: .06em; padding: 0; }.closed-tag { font-size: 8px; margin-left: 4px; padding: 2px 3px; }.scene-introduction { top: 21px; left: 22px; }.scene-introduction h1 { font-size: 25px; line-height: 1.5; margin: 12px 0 8px; }.scene-introduction .eyebrow { font-size: 8px; }.scene-introduction p { font-size: 9px; }.introduction-rule, .introduction-hint { display: none; }.vertical-inscription { top: 24px; right: 20px; font-size: 9px; }.visit-key { left: 22px; bottom: 14px; gap: 7px; font-size: 9px; }.scene-controls { left: auto; right: 20px; bottom: 15px; transform: none; font-size: 8px; gap: 4px; }.scene-controls > span { font-size: 12px; }.scene-controls i { margin: 0 3px; }.timeline { flex-basis: 88px; padding: 0 22px; gap: 18px; }.timeline-caption, .timeline-end { display: none; }.year-display { min-width: 65px; }.year-display strong { font-size: 29px; }.year-display > span { font-size: 8px; }.timeline-ticks { font-size: 9px; }.plan-layout { inset: 12px 12px 14px; }.back-to-scene { bottom: 17px; right: 16px; padding: 7px 9px; font-size: 10px; }.archive-panel { inset: 12px 12px 14px auto; width: 340px; padding: 20px; }.archive-panel h2 { font-size: 23px; margin-bottom: 15px; } }
@media (max-height: 650px) and (min-width: 701px) { .masthead { flex-basis: 80px; }.navigation-bar { height: 48px; }.timeline { flex-basis: 80px; }.scene-introduction { top: 20px; }.scene-introduction h1 { font-size: 28px; margin: 12px 0; }.introduction-rule, .introduction-hint { display: none; } }
.clear-timeline { border: 1px solid #ac8e65; background: #fbf1de; color: #8c3f30; padding: 6px 9px; font-size: 10px; white-space: nowrap; }
.clear-timeline:hover { background: #ead6b4; }
.timeline-announcement { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.plan-layout.with-details { right: 425px; }
@media (max-width: 1100px) { .plan-layout.with-details { right: 406px; } }
@media (max-width: 900px) { .plan-layout.with-details { right: 25px; bottom: calc(44% + 38px); } }
@media (max-width: 700px) { .plan-layout.with-details { right: 12px; bottom: calc(44% + 26px); } }
@media (max-width: 700px) { .timeline.has-time-filter .timeline-end { display: flex; position: absolute; right: 22px; top: 7px; }.timeline.has-time-filter .footer-stamp { display: none; }.clear-timeline { padding: 3px 6px; font-size: 9px; } }
</style>
