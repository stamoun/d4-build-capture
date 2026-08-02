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
  'charm-1',
  'charm-2',
  'charm-3',
  'charm-4',
  'charm-5',
  'charm-6',
  'seal',
  'stats-1',
  'stats-2',
  'stats-3',
  'stats-4'
] as const;

export type ItemSlot = (typeof ITEM_SLOTS)[number];

export type ItemSlotGroup = 'equipment' | 'talisman' | 'stats';

export function getItemSlotGroup(slot: ItemSlot): ItemSlotGroup {
  if (slot.startsWith('stats-')) return 'stats';
  if (slot.startsWith('charm-') || slot === 'seal') return 'talisman';
  return 'equipment';
}

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

const ARMOR_AND_JEWELRY_SLOTS: readonly ItemSlot[] = [
  'helmet',
  'chest',
  'gloves',
  'pants',
  'boots',
  'amulet',
  'ring-1',
  'ring-2',
];

const STATS_SLOTS: readonly ItemSlot[] = [
  'stats-1',
  'stats-2',
  'stats-3',
  'stats-4'
];

const TALISMAN_SLOTS: readonly ItemSlot[] = [
  'charm-1',
  'charm-2',
  'charm-3',
  'charm-4',
  'charm-5',
  'charm-6',
  'seal'
];

const STANDARD_ITEM_SLOTS: readonly ItemSlot[] = [
  ...ARMOR_AND_JEWELRY_SLOTS,
  'weapon-1',
  'weapon-2',
  ...TALISMAN_SLOTS,
  ...STATS_SLOTS
];

export function getItemSlots(characterClass: CharacterClass): readonly ItemSlot[] {
  if (characterClass === 'Barbarian') return ITEM_SLOTS;
  if (characterClass === 'Rogue') {
    return [
      ...ARMOR_AND_JEWELRY_SLOTS,
      'weapon-1',
      'weapon-2',
      'weapon-3',
      ...TALISMAN_SLOTS,
      ...STATS_SLOTS
    ];
  }
  if (characterClass === 'Spiritborn') {
    return [...ARMOR_AND_JEWELRY_SLOTS, 'weapon-1', ...TALISMAN_SLOTS, ...STATS_SLOTS];
  }
  return STANDARD_ITEM_SLOTS;
}

const WEAPON_SLOT_LABELS: Record<CharacterClass, readonly string[]> = {
  Barbarian: ['Main Hand', 'Off Hand', 'Two-Handed Bludgeoning', 'Two-Handed Slashing'],
  Druid: ['Main Hand', 'Totem'],
  Necromancer: ['Main Hand', 'Off Hand'],
  Rogue: ['Main Hand', 'Off Hand', 'Ranged'],
  Sorcerer: ['Main Hand', 'Focus'],
  Spiritborn: ['Weapon'],
  Paladin: ['Main Hand', 'Shield'],
  Warlock: ['Main Hand', 'Focus']
};

export function getItemSlotLabel(slot: ItemSlot, characterClass: CharacterClass): string | undefined {
  if (!slot.startsWith('weapon-')) return undefined;
  const weaponIndex = Number(slot.slice('weapon-'.length)) - 1;
  return WEAPON_SLOT_LABELS[characterClass][weaponIndex];
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

export type BuildDetails = Pick<AppConfig, 'buildName' | 'buildUrl'>;

export interface CaptureRecord {
  slot: ItemSlot;
  filePath: string;
  capturedAt: string;
}

export interface SessionState {
  id: string;
  captures: Partial<Record<ItemSlot, CaptureRecord>>;
}

export interface AppState {
  config: AppConfig;
  session: SessionState;
  version: string;
}
