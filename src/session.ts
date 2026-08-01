import { ITEM_SLOTS, type CaptureRecord, type ItemSlot } from './types';

export function findNextUncapturedSlot(
  captures: Partial<Record<ItemSlot, CaptureRecord>>
): ItemSlot | null {
  return ITEM_SLOTS.find((slot) => !captures[slot]) ?? null;
}
