import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { findDisplaySource } from '../src/capture';
import { exportSession } from '../src/exporter';
import { isPathInside } from '../src/paths';
import {
  canStartCapture,
  canStartExport,
  findCaptureSlot,
  findFollowingSlot,
  findNextUncapturedSlot,
  isCurrentPreviewRequest,
} from '../src/session';
import { buildShortcutLabel, normalizeShortcutLabel, toElectronAccelerator } from '../src/shortcut';
import {
  CHARACTER_CLASSES,
  getItemSlotGroup,
  getItemSlotLabel,
  getItemSlots,
  ITEM_SLOTS,
  type AppConfig,
  type CaptureRecord,
  type SessionState,
} from '../src/types';

async function createTemporaryDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'diablo-build-capture-test-'));
}

async function createCapture(directory: string, slot: CaptureRecord['slot'], color: string): Promise<CaptureRecord> {
  const filePath = path.join(directory, `${slot}.png`);
  await sharp({
    create: {
      width: 100,
      height: 150,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toFile(filePath);

  return { slot, filePath, capturedAt: '2026-07-31T12:00:00.000Z' };
}

test('findNextUncapturedSlot advances without overwriting captures', () => {
  const helmet: CaptureRecord = {
    slot: 'helmet',
    filePath: 'helmet.png',
    capturedAt: '2026-07-31T12:00:00.000Z',
  };

  assert.equal(findNextUncapturedSlot({}), 'helmet');
  assert.equal(findNextUncapturedSlot({ helmet }), 'chest');

  const allCaptures = Object.fromEntries(
    ITEM_SLOTS.map((slot) => [slot, { ...helmet, slot }]),
  ) as SessionState['captures'];
  assert.equal(findNextUncapturedSlot(allCaptures), null);
});

test('findCaptureSlot prioritizes a selected slot so an existing capture can be overwritten', () => {
  const helmet: CaptureRecord = {
    slot: 'helmet',
    filePath: 'helmet.png',
    capturedAt: '2026-07-31T12:00:00.000Z',
  };

  assert.equal(findCaptureSlot({ helmet }, ['helmet', 'chest'], 'helmet'), 'helmet');
  assert.equal(findCaptureSlot({ helmet }, ['helmet', 'chest'], null), 'chest');
  assert.equal(findCaptureSlot({ helmet }, ['helmet', 'chest'], 'weapon-1'), 'chest');
});

test('findFollowingSlot advances selected retakes and wraps after the last slot', () => {
  const slots = ['helmet', 'chest', 'gloves'] as const;

  assert.equal(findFollowingSlot('chest', slots), 'gloves');
  assert.equal(findFollowingSlot('gloves', slots), 'helmet');
  assert.equal(findFollowingSlot('weapon-1', slots), null);
});

test('capture and export operations are mutually exclusive', () => {
  assert.equal(canStartCapture(null, false), true);
  assert.equal(canStartCapture('helmet', false), false);
  assert.equal(canStartCapture(null, true), false);
  assert.equal(canStartExport(null, false), true);
  assert.equal(canStartExport('helmet', false), false);
  assert.equal(canStartExport(null, true), false);
});

test('preview responses apply only to the latest selected slot request', () => {
  assert.equal(isCurrentPreviewRequest('helmet', 'helmet', 2, 2), true);
  assert.equal(isCurrentPreviewRequest('helmet', 'chest', 2, 2), false);
  assert.equal(isCurrentPreviewRequest('helmet', 'helmet', 1, 2), false);
});

test('output directories cannot use the temporary capture tree', () => {
  const driveRoot = path.parse(process.cwd()).root;
  const temporaryRoot = path.join(driveRoot, 'temp', 'diablo-build-capture');

  assert.equal(isPathInside(temporaryRoot, temporaryRoot), true);
  assert.equal(isPathInside(temporaryRoot, path.join(temporaryRoot, 'exports')), true);
  assert.equal(isPathInside(temporaryRoot, path.join(driveRoot, 'temp', 'diablo-build-capture-export')), false);
  assert.equal(isPathInside(temporaryRoot, path.join(driveRoot, 'builds')), false);
});

test('findDisplaySource selects the source matching the Electron display id', () => {
  const sources = [
    { display_id: '22', name: 'secondary' },
    { display_id: '11', name: 'primary' },
  ];

  assert.equal(findDisplaySource(sources, 11)?.name, 'primary');
  assert.equal(findDisplaySource(sources, 33), undefined);
});

test('weapon slots and labels match each class equipment layout', () => {
  const expectedWeapons = {
    Barbarian: ['Main Hand', 'Off Hand', '2h Bludgeoning', '2h Slashing'],
    Druid: ['Main Hand', 'Totem'],
    Necromancer: ['Main Hand', 'Off Hand'],
    Rogue: ['Main Hand', 'Off Hand', 'Ranged'],
    Sorcerer: ['Main Hand', 'Focus'],
    Spiritborn: ['Weapon'],
    Paladin: ['Main Hand', 'Shield'],
    Warlock: ['Main Hand', 'Focus'],
  } as const;

  for (const characterClass of CHARACTER_CLASSES) {
    const weaponSlots = getItemSlots(characterClass).filter((slot) => slot.startsWith('weapon-'));
    assert.deepEqual(
      weaponSlots.map((slot) => getItemSlotLabel(slot, characterClass)),
      expectedWeapons[characterClass],
    );
  }

  const druidSlots = getItemSlots('Druid');
  const firstStatsIndex = druidSlots.indexOf('stats-1');

  const captures = Object.fromEntries(
    druidSlots.slice(0, firstStatsIndex).map((slot) => [
      slot,
      {
        slot,
        filePath: `${slot}.png`,
        capturedAt: '2026-07-31T12:00:00.000Z',
      },
    ]),
  ) as SessionState['captures'];
  assert.equal(findNextUncapturedSlot(captures, druidSlots), 'stats-1');
});

test('every class includes six charm slots and one seal after equipment and before stats', () => {
  const expectedTalismans = ['charm-1', 'charm-2', 'charm-3', 'charm-4', 'charm-5', 'charm-6', 'seal'];

  for (const characterClass of CHARACTER_CLASSES) {
    const slots = getItemSlots(characterClass);
    const firstCharmIndex = slots.indexOf('charm-1');
    const lastWeaponIndex = Math.max(
      ...slots.filter((slot) => slot.startsWith('weapon-')).map((slot) => slots.indexOf(slot)),
    );
    const firstStatsIndex = slots.indexOf('stats-1');

    assert.deepEqual(slots.slice(firstCharmIndex, firstCharmIndex + 7), expectedTalismans);
    assert.equal(firstCharmIndex, lastWeaponIndex + 1);
    assert.equal(firstStatsIndex, firstCharmIndex + expectedTalismans.length);
  }
});

test('item slots are partitioned into equipment, talisman, and stats groups', () => {
  for (const characterClass of CHARACTER_CLASSES) {
    const groups = getItemSlots(characterClass).map(getItemSlotGroup);
    const firstTalismanIndex = groups.indexOf('talisman');
    const firstStatsIndex = groups.indexOf('stats');

    assert.ok(groups.slice(0, firstTalismanIndex).every((group) => group === 'equipment'));
    assert.ok(groups.slice(firstTalismanIndex, firstStatsIndex).every((group) => group === 'talisman'));
    assert.ok(groups.slice(firstStatsIndex).every((group) => group === 'stats'));
  }
});

test('shortcut labels stay compact and convert to Electron accelerators', () => {
  assert.equal(normalizeShortcutLabel('CommandOrControl+Shift+Space'), 'ctrl-shift-space');
  assert.equal(buildShortcutLabel(new Set(['ctrl', 'shift']), ' '), 'ctrl-shift-space');
  assert.equal(toElectronAccelerator('ctrl-alt-k'), 'CommandOrControl+Alt+K');
  assert.equal(buildShortcutLabel(new Set(['ctrl']), 'Control'), null);
});

test('exportSession writes stats overview and filters inactive class slots', async () => {
  const directory = await createTemporaryDirectory();

  try {
    const helmet = await createCapture(directory, 'helmet', '#ff0000');
    const stats1 = await createCapture(directory, 'stats-1', '#00ff00');
    const charm1 = await createCapture(directory, 'charm-1', '#ffff00');
    const seal = await createCapture(directory, 'seal', '#00ffff');
    const weapon3 = await createCapture(directory, 'weapon-3', '#0000ff');
    const config: AppConfig = {
      outputDirectory: path.join(directory, 'builds'),
      characterClass: 'Sorcerer',
      buildName: 'Frozen: Orb',
      buildUrl: 'https://example.com/frozen-orb',
      shortcut: 'ctrl-shift-space',
    };
    const session: SessionState = {
      id: 'test-session',
      captures: { helmet, 'stats-1': stats1, 'charm-1': charm1, seal, 'weapon-3': weapon3 },
    };

    const outputDirectory = await exportSession(config, session);
    assert.match(path.basename(outputDirectory), /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
    const markdown = await fs.readFile(path.join(outputDirectory, 'build.md'), 'utf8');
    const manifest = JSON.parse(await fs.readFile(path.join(outputDirectory, 'build.json'), 'utf8')) as {
      characterClass: string;
      buildName: string;
      buildUrl: string;
      captures: SessionState['captures'];
    };

    assert.equal(path.basename(path.dirname(outputDirectory)), 'Sorcerer - Frozen- Orb');
    assert.match(markdown, /# Sorcerer · Frozen: Orb/);
    assert.match(markdown, /planner: "https:\/\/example\.com\/frozen-orb"/);
    assert.match(markdown, /## Character Stats Overview/);
    assert.match(markdown, /!\[stats-1\]\(items\/stats-1\.png\)/);
    assert.match(markdown, /- helmet: !\[helmet\]\(items\/helmet\.png\)/);
    assert.match(markdown, /- charm-1: !\[charm-1\]\(items\/charm-1\.png\)/);
    assert.match(markdown, /- seal: !\[seal\]\(items\/seal\.png\)/);
    assert.doesNotMatch(markdown, /weapon-3/);
    assert.equal(manifest.characterClass, 'Sorcerer');
    assert.equal(manifest.buildName, 'Frozen: Orb');
    assert.equal(manifest.buildUrl, 'https://example.com/frozen-orb');
    assert.equal(manifest.captures['weapon-3'], undefined);
    await assert.rejects(fs.access(path.join(outputDirectory, 'build.png')));
    await fs.access(path.join(outputDirectory, 'items', 'helmet.png'));
    await fs.access(path.join(outputDirectory, 'items', 'charm-1.png'));
    await fs.access(path.join(outputDirectory, 'items', 'seal.png'));
    await fs.access(path.join(outputDirectory, 'items', 'stats-1.png'));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
