import { ITEM_SLOTS, type CaptureRecord, type ItemSlot } from './types';

export function findNextUncapturedSlot(
  captures: Partial<Record<ItemSlot, CaptureRecord>>,
  slots: readonly ItemSlot[] = ITEM_SLOTS
): ItemSlot | null {
  return slots.find((slot) => !captures[slot]) ?? null;
}

export function findCaptureSlot(
  captures: Partial<Record<ItemSlot, CaptureRecord>>,
  slots: readonly ItemSlot[],
  selectedSlot: ItemSlot | null
): ItemSlot | null {
  if (selectedSlot && slots.includes(selectedSlot)) return selectedSlot;
  return findNextUncapturedSlot(captures, slots);
}

export function findFollowingSlot(
  slot: ItemSlot,
  slots: readonly ItemSlot[]
): ItemSlot | null {
  const currentIndex = slots.indexOf(slot);
  if (currentIndex === -1 || slots.length === 0) return null;
  return slots[(currentIndex + 1) % slots.length];
}

export function canStartCapture(
  capturingSlot: ItemSlot | null,
  isExporting: boolean
): boolean {
  return capturingSlot === null && !isExporting;
}

export function canStartExport(
  capturingSlot: ItemSlot | null,
  isExporting: boolean
): boolean {
  return capturingSlot === null && !isExporting;
}

export function isCurrentPreviewRequest(
  requestedSlot: ItemSlot,
  currentSlot: ItemSlot | null,
  requestId: number,
  latestRequestId: number
): boolean {
  return requestedSlot === currentSlot && requestId === latestRequestId;
}
