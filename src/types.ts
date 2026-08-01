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
  'stats-1',
  'stats-2',
  'stats-3',
  'stats-4'
] as const;

export type ItemSlot = (typeof ITEM_SLOTS)[number];

export const CHARACTER_CLASSES = [
  'Barbarian',
  'Druid',
  'Necromancer',
  'Rogue',
  'Sorcerer',
  'Spiritborn',
  'Paladin',
  'Warlock'
] as const;

export type CharacterClass = (typeof CHARACTER_CLASSES)[number];

const STANDARD_ITEM_SLOTS: readonly ItemSlot[] = [
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
  'stats-1',
  'stats-2',
  'stats-3',
  'stats-4'
];

export function getItemSlots(characterClass: CharacterClass): readonly ItemSlot[] {
  return characterClass === 'Barbarian' ? ITEM_SLOTS : STANDARD_ITEM_SLOTS;
}

export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppConfig {
  outputDirectory: string;
  characterClass: CharacterClass;
  buildName: string;
  buildUrl: string;
  captureRegion: CaptureRegion;
  captureFullScreen: boolean;
  shortcut: string;
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
