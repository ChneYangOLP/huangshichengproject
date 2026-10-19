export type OpenHallId = 'MainHall' | 'WestHall';
export type HallId = OpenHallId | 'EastHall';
export type ViewId = '3D' | HallId;
// Coordinates are original-image pixels, with the origin at the top left.
export type Point = [number, number];
export type Rect = [number, number, number, number];
export interface Cabinet {
  id: string;
  sourceId: string;
  bounds: Rect;
  hall: OpenHallId;
}
export interface HallLayout {
  id: OpenHallId;
  name: string;
  prefix: string;
  image: string;
  width: number;
  height: number;
  entrance: Point;
  walkable: Rect[];
  obstacles: Rect[];
  cabinets: Cabinet[];
}
export interface ArchiveData {
  id: string;
  name: string;
  period: string;
  category: string;
  quantity: string;
  content: string;
  currentLocation: string;
  sourceTitle: string;
  sourceUrl: string | null;
  sourceRow: number;
  hall: OpenHallId;
  cabinetId: string;
}
