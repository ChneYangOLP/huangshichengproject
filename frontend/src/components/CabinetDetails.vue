<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStore } from '../store/useSystemStore';
import { allocationNote, getHall, sourceSheet, sourceWorkbook } from '../data/collection';
import { chronologySource, formatArchiveTime, getArchiveTime } from '../data/archiveTime';

const store = useSystemStore();
const archiveTime = computed(() => getArchiveTime(store.selectedArchive?.period ?? ''));
const sourceLink = computed(() => {
  try {
    const url = new URL(store.selectedArchive?.sourceUrl ?? '');
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
});
const navigate = () => {
  if (store.selectedCabinet) store.navigateToCabinet(store.selectedCabinet);
};
</script>

<template>
  <aside v-if="store.selectedCabinet" class="cabinet-panel" aria-label="金匮档案信息">
    <div class="panel-topline"><span>金 匮 藏 档</span><button aria-label="关闭金匮档案信息" @click="store.closeCabinet()">×</button></div>
    <div class="cabinet-heading">
      <span>{{ getHall(store.selectedCabinet.hall).name }} · 金匮编号</span>
      <h2>{{ store.selectedCabinet.id }}</h2>
      <button class="navigate-button" @click="navigate">寻路 <span aria-hidden="true">↗</span></button>
    </div>
    <div class="panel-body custom-scrollbar">
      <template v-if="store.selectedArchive">
        <span class="archive-number">档案编号 · {{ store.selectedArchive.id }}</span>
        <h3 class="archive-title">{{ store.selectedArchive.name }}</h3>
        <dl class="archive-facts">
          <div><dt>所属年代</dt><dd>{{ store.selectedArchive.period }}</dd></div>
          <div><dt>时间轴匹配</dt><dd>{{ formatArchiveTime(archiveTime) }}</dd></div>
          <div><dt>档案类别</dt><dd>{{ store.selectedArchive.category }}</dd></div>
          <div><dt>卷数 / 册数</dt><dd>{{ store.selectedArchive.quantity }}</dd></div>
        </dl>
        <p class="time-basis">{{ archiveTime.note }}<a :href="chronologySource" target="_blank" rel="noopener noreferrer">纪年依据 ↗</a></p>
        <h4>卷宗记述</h4><p>{{ store.selectedArchive.content }}</p>
        <h4>现存地点 / 是否散佚</h4><p>{{ store.selectedArchive.currentLocation }}</p>
        <h4>资料来源</h4>
        <p><a v-if="sourceLink" :href="sourceLink" target="_blank" rel="noopener noreferrer">{{ store.selectedArchive.sourceTitle }} ↗</a><span v-else>{{ store.selectedArchive.sourceTitle }}</span></p>
        <p class="source-reference">{{ sourceWorkbook }}<br />{{ sourceSheet }} · 第 {{ store.selectedArchive.sourceRow }} 行</p>
      </template>
      <div v-else class="empty-cabinet"><span aria-hidden="true">匮</span><h3>暂无档案</h3><p>本次整理清单尚未分配档案至此金匮。<br />可查看其他金匮，或检索档案名称。</p></div>
      <p class="allocation-note">{{ allocationNote }}</p>
    </div>
  </aside>
</template>

<style scoped>
.cabinet-panel { min-width: 0; min-height: 0; position: absolute; z-index: 450; top: 20px; right: 44px; bottom: 24px; width: 365px; max-width: calc(100% - 24px); padding: 20px 24px; display: flex; flex-direction: column; background: #faf3e5; border: 1px solid #af9069; border-top: 3px solid var(--cinnabar); box-shadow: -8px 8px 28px #49321e20; }
.panel-topline { display: flex; align-items: center; justify-content: space-between; color: #a17b42; font-size: 10px; letter-spacing: .1em; }.panel-topline button { background: none; border: 0; color: #8e7860; font-size: 25px; padding: 0 5px; }
.cabinet-heading { padding: 10px 0 16px; border-bottom: 1px solid #cbb99a; margin-bottom: 18px; }.cabinet-heading > span, .archive-number { font-size: 10px; color: #947f63; }.cabinet-heading h2 { font: 500 26px/1.3 Georgia, serif; color: #69382a; margin: 7px 0 12px; }
.navigate-button { display: flex; justify-content: space-between; width: 100%; padding: 9px 13px; border: 1px solid #82342a; background: #963c32; color: #fff0d8; font-size: 12px; letter-spacing: .06em; }.navigate-button:hover { background: #7d2f28; }
.panel-body { flex: 1; min-height: 0; overflow-y: auto; padding-right: 5px; }.archive-title { font-size: 21px; font-weight: 500; line-height: 1.6; margin: 7px 0 14px; color: #66392b; }
.archive-facts { border-block: 1px solid #cbb99a; padding: 10px 0; margin: 0; }.archive-facts div { display: grid; grid-template-columns: 72px 1fr; gap: 10px; font-size: 11px; line-height: 1.8; padding: 5px 0; }.archive-facts dt { color: #958167; }.archive-facts dd { margin: 0; color: #68533c; overflow-wrap: anywhere; }
.panel-body h4 { font-size: 11px; font-weight: 500; color: #963c32; margin: 20px 0 8px; letter-spacing: .12em; }.panel-body p { font-size: 12px; line-height: 1.9; color: #75634e; margin: 0 0 12px; overflow-wrap: anywhere; }.panel-body a { color: #963c32; text-underline-offset: 3px; }.panel-body .source-reference { font-size: 9px; color: #9b896f; }.panel-body .allocation-note { margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbb99a; color: #9b8060; font-size: 10px; }
.empty-cabinet { text-align: center; padding: 24px 0; }.empty-cabinet > span { display: inline-grid; place-items: center; width: 45px; height: 48px; border: 1px solid #b69a72; color: #9b7950; font-size: 26px; }.empty-cabinet h3 { font-size: 19px; font-weight: 400; color: #79573a; margin: 18px 0 10px; }.empty-cabinet p { font-size: 11px; }
.panel-body .time-basis { color: #9b8060; font-size: 10px; margin-top: 10px; }.time-basis a { white-space: nowrap; margin-left: 5px; }
@media (max-width: 1100px) { .cabinet-panel { right: 25px; } }
@media (max-width: 900px) { .cabinet-panel { top: auto; height: 44%; width: auto; left: 25px; padding: 12px 18px; }.cabinet-heading { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 5px 0 10px; margin-bottom: 10px; }.cabinet-heading h2 { font-size: 20px; margin: 0; }.navigate-button { width: auto; margin-left: auto; gap: 10px; padding: 6px 9px; font-size: 10px; }.archive-title { font-size: 18px; } }
@media (max-width: 700px) { .cabinet-panel { left: 12px; right: 12px; bottom: 14px; padding: 10px 14px; }.cabinet-heading > span { display: none; }.cabinet-heading h2 { font-size: 18px; }.panel-topline { font-size: 9px; }.panel-body p { font-size: 11px; } }
@media (max-height: 650px) {
  .cabinet-panel { padding: 12px 16px; }
  .panel-topline, .cabinet-heading { flex-shrink: 0; }
  .cabinet-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 5px 0 10px; margin-bottom: 10px; }
  .cabinet-heading > span { display: none; }
  .cabinet-heading h2 { font-size: 20px; margin: 0; }
  .navigate-button { width: auto; margin-left: auto; gap: 10px; padding: 6px 9px; }
}
@media (max-height: 520px) and (min-width: 601px) and (max-width: 900px) {
  .cabinet-panel { top: 10px; bottom: 10px; height: auto; left: auto; width: 280px; }
}
</style>
