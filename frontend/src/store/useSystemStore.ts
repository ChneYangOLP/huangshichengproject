import { defineStore } from 'pinia';
import axios from 'axios';

export interface ArchiveData {
  id: string;
  name: string;
  content: string;
  hall: 'MainHall' | 'EastHall' | 'WestHall';
  cabinet_coords: [number, number];
  start_year: number;
  end_year: number;
}

export const useSystemStore = defineStore('system', {
  state: () => ({
    currentView: '3D' as '3D' | 'MainHall' | 'EastHall' | 'WestHall',
    currentTime: 1800,
    searchQuery: '',
    selectedArchive: null as ArchiveData | null,
    archives: [] as ArchiveData[],
    mapFocusTrigger: 0,
  }),
  actions: {
    async fetchMockData() {
      try {
        const res = await axios.get('/mockData.json');
        this.archives = res.data;
      } catch (e) {
        console.error("Failed to load mockData.json", e);
      }
    },
    setView(view: '3D' | 'MainHall' | 'EastHall' | 'WestHall') {
      this.currentView = view;
    },
    setTime(time: number) {
      this.currentTime = time;
    },
    setSearchQuery(query: string) {
      this.searchQuery = query;
    },
    selectArchive(archive: ArchiveData | null) {
      this.selectedArchive = archive;
    },
    focusArchive(archive: ArchiveData) {
      this.currentView = archive.hall;
      this.currentTime = archive.start_year;
      this.selectedArchive = archive;
      this.mapFocusTrigger = Date.now();
    }
  },
  getters: {
    filteredArchives: (state) => {
      if (!state.searchQuery) return [];
      const q = state.searchQuery.toLowerCase();
      return state.archives.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.id.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q)
      );
    }
  }
});
