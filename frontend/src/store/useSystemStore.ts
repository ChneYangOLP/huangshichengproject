import { defineStore } from 'pinia';
import { archives, cabinets, getCabinet, getHall } from '../data/collection';
import { matchesArchiveYear, TIMELINE_MAX_YEAR, TIMELINE_MIN_YEAR } from '../data/archiveTime';
import type { ArchiveData, Cabinet, OpenHallId, Point, ViewId } from '../data/types';
export type { ArchiveData, HallId, ViewId } from '../data/types';
export interface NavigationOrigin { hall: OpenHallId; point: Point; label: string }

export const useSystemStore = defineStore('system', {
  state: () => ({
    currentView: '3D' as ViewId,
    currentTime: 1800,
    timelineActive: false,
    searchQuery: '',
    selectedCabinet: null as Cabinet | null,
    selectedArchive: null as ArchiveData | null,
    archives,
    cabinets,
    navigationTargetId: null as string | null,
    navigationOrigin: null as NavigationOrigin | null,
    routeStarts: {} as Partial<Record<OpenHallId, Point>>,
    currentCabinetIds: {} as Partial<Record<OpenHallId, string>>,
    mapFocusTrigger: 0,
    closedHallNotice: false,
  }),
  actions: {
    setView(view: ViewId) {
      if (view === 'EastHall') {
        this.closedHallNotice = true;
        return false;
      }
      if (this.currentView !== view) {
        this.closeCabinet();
        this.clearRoute();
      }
      this.currentView = view;
      return true;
    },
    dismissClosedHallNotice() { this.closedHallNotice = false; },
    setTime(time: number) {
      if (!Number.isFinite(time)) return;
      this.currentTime = Math.min(TIMELINE_MAX_YEAR, Math.max(TIMELINE_MIN_YEAR, Math.round(time)));
      this.timelineActive = true;
    },
    clearTimelineHighlight() { this.timelineActive = false; },
    setSearchQuery(query: string) { this.searchQuery = query; },
    closeCabinet() {
      this.selectedCabinet = null;
      this.selectedArchive = null;
    },
    selectCabinet(cabinet: Cabinet) {
      if (!this.setView(cabinet.hall)) return;
      if (this.navigationTargetId !== cabinet.id) this.clearRoute();
      this.selectedCabinet = cabinet;
      this.selectedArchive = this.archives.find(a => a.cabinetId === cabinet.id) ?? null;
    },
    focusArchive(archive: ArchiveData) {
      const cabinet = getCabinet(archive.cabinetId);
      if (cabinet) this.navigateToCabinet(cabinet);
    },
    navigateToCabinet(cabinet: Cabinet) {
      this.selectCabinet(cabinet);
      // Freeze the departure point for this request. Arrival updates the current
      // location, without changing the origin of the route still on screen.
      this.navigationOrigin = this.navigationStartFor(cabinet.hall);
      this.navigationTargetId = cabinet.id;
      this.mapFocusTrigger++;
    },
    navigationStartFor(hall: OpenHallId): NavigationOrigin {
      const point = this.routeStarts[hall] ?? getHall(hall).entrance;
      return { hall, point: [...point], label: this.currentCabinetIds[hall] ?? (this.routeStarts[hall] ? '自选起点' : '入口') };
    },
    completeNavigation(hall: OpenHallId, cabinetId: string, point: Point, requestVersion: number) {
      // Cancelled, failed and stale responses must never move the visitor.
      if (this.currentView !== hall || this.navigationTargetId !== cabinetId ||
          this.mapFocusTrigger !== requestVersion || getCabinet(cabinetId)?.hall !== hall ||
          point.length !== 2 || !point.every(Number.isFinite)) return false;
      this.routeStarts[hall] = [...point];
      this.currentCabinetIds[hall] = cabinetId;
      return true;
    },
    setRouteStart(hall: OpenHallId, point: Point) {
      this.routeStarts[hall] = [...point];
      delete this.currentCabinetIds[hall];
      if (this.currentView === hall) this.clearRoute();
    },
    resetRouteStart(hall: OpenHallId) {
      delete this.routeStarts[hall];
      delete this.currentCabinetIds[hall];
      if (this.currentView === hall) this.clearRoute();
    },
    clearRoute() { this.navigationTargetId = null; this.navigationOrigin = null; },
  },
  getters: {
    timelineArchives: state => state.timelineActive
      ? state.archives.filter(archive => matchesArchiveYear(archive, state.currentTime)) : [],
    highlightedCabinetIds(): Set<string> {
      return new Set(this.timelineArchives.map(archive => archive.cabinetId));
    },
    filteredArchives: state => {
      const query = state.searchQuery.trim().toLowerCase();
      return query ? state.archives.filter(a =>
        [a.name, a.id, a.content, a.period, a.category, a.quantity, a.currentLocation, a.sourceTitle, a.cabinetId, getHall(a.hall).name].some(value => value.toLowerCase().includes(query))) : [];
    },
    filteredCabinets: state => {
      const query = state.searchQuery.trim().toUpperCase();
      return query ? state.cabinets.filter(c => c.id.includes(query) || getHall(c.hall).name.includes(query)) : [];
    },
  },
});
