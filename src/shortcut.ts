const MODIFIER_ORDER = ['ctrl', 'alt', 'shift', 'meta'] as const;

export function normalizeShortcutLabel(value: string): string {
  return value
    .trim()
    .replace(/CommandOrControl/gi, 'ctrl')
    .replace(/Control/gi, 'ctrl')
    .replace(/Command/gi, 'meta')
    .replace(/\+/g, '-')
    .toLowerCase();
}

export function buildShortcutLabel(modifiers: ReadonlySet<string>, key: string): string | null {
  const normalizedKey = key.toLowerCase() === ' ' ? 'space' : key.toLowerCase();
  if (['control', 'shift', 'alt', 'meta'].includes(normalizedKey)) return null;

  const parts = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return [...parts, normalizedKey].join('-');
}

export function toElectronAccelerator(label: string): string {
  const parts = normalizeShortcutLabel(label).split('-').filter(Boolean);
  return parts.map((part) => {
    if (part === 'ctrl') return 'CommandOrControl';
    if (part === 'alt') return 'Alt';
    if (part === 'shift') return 'Shift';
    if (part === 'meta') return 'Super';
    if (part === 'space') return 'Space';
    return part.length === 1 ? part.toUpperCase() : part;
  }).join('+');
}
