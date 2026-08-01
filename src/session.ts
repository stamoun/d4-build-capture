import { ITEM_SLOTS, type CaptureRecord, type ItemSlot } from './types';

export function findNextUncapturedSlot(
  captures: Partial<Record<ItemSlot, CaptureRecord>>,
  slots: readonly ItemSlot[] = ITEM_SLOTS
): ItemSlot | null {
  return slots.find((slot) => !captures[slot]) ?? null;
}
