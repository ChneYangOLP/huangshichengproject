import { defineStore } from 'pinia';

export interface CabinetData {
  id: string;
  name: string;
  [key: string]: any;
}

export const useStore = defineStore('main', {
  state: () => ({
    currentView: '3D' as '3D' | '2D',
    selectedCabinet: null as CabinetData | null,
  }),
  actions: {
    setView(view: '3D' | '2D') {
      this.currentView = view;
    },
    setSelectedCabinet(cabinet: CabinetData | null) {
      this.selectedCabinet = cabinet;
    }
  }
});
