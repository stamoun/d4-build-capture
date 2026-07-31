export const ITEM_SLOTS = [
  'helmet',
  'chest',
  'gloves',
  'pants',
  'boots',
  'amulet',
  'ring-1',
  'ring-2',
  'weapon-1',
  'weapon-2',
  'weapon-3',
  'weapon-4',
  'stats'
] as const;

export type ItemSlot = (typeof ITEM_SLOTS)[number];

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppConfig {
  vaultPath: string;
  buildFolder: string;
  characterClass: string;
  buildName: string;
  captureRegion: CaptureRegion;
}

export interface CaptureRecord {
  slot: ItemSlot;
  filePath: string;
  capturedAt: string;
}

export interface SessionState {
  id: string;
  captures: Partial<Record<ItemSlot, CaptureRecord>>;
}
