import dataset from './collection.json';
import type { ArchiveData, Cabinet, HallLayout, OpenHallId } from './types';

export const halls: HallLayout[] = dataset.halls.map(hall => ({
  ...hall,
  cabinets: hall.cabinets.map(cabinet => ({ ...cabinet, hall: hall.id })),
})) as HallLayout[];
export const cabinets: Cabinet[] = halls.flatMap(hall => hall.cabinets);
export const archives = dataset.archives as ArchiveData[];
export const allocationNote = dataset.allocationNote;
export const sourceWorkbook = dataset.sourceWorkbook;
export const sourceSheet = dataset.sourceSheet;
export const getHall = (id: OpenHallId) => halls.find(hall => hall.id === id)!;
export const getCabinet = (id: string) => cabinets.find(cabinet => cabinet.id === id);

// Fail visibly if an edited import would duplicate or orphan a collection record.
if (new Set(cabinets.map(c => c.id)).size !== cabinets.length ||
    new Set(archives.map(a => a.id)).size !== archives.length ||
    archives.some(a => getCabinet(a.cabinetId)?.hall !== a.hall)) {
  throw new Error('馆藏数据存在重复编号或无效的金匮位置');
}
