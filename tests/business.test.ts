import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { exportSession } from '../src/exporter';
import { findNextUncapturedSlot } from '../src/session';
import { findDisplaySource } from '../src/capture';
import { buildShortcutLabel, normalizeShortcutLabel, toElectronAccelerator } from '../src/shortcut';
import {
  getItemSlots,
  ITEM_SLOTS,
  type AppConfig,
  type CaptureRecord,
  type SessionState
} from '../src/types';

async function createTemporaryDirectory(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'diablo-build-capture-test-'));
}

async function createCapture(
  directory: string,
  slot: CaptureRecord['slot'],
  color: string
): Promise<CaptureRecord> {
  const filePath = path.join(directory, `${slot}.png`);
  await sharp({
    create: {
      width: 100,
      height: 150,
      channels: 4,
      background: color
    }
  }).png().toFile(filePath);

  return { slot, filePath, capturedAt: '2026-07-31T12:00:00.000Z' };
}

test('findNextUncapturedSlot advances without overwriting captures', () => {
  const helmet: CaptureRecord = {
    slot: 'helmet',
    filePath: 'helmet.png',
    capturedAt: '2026-07-31T12:00:00.000Z'
  };

  assert.equal(findNextUncapturedSlot({}), 'helmet');
  assert.equal(findNextUncapturedSlot({ helmet }), 'chest');

  const allCaptures = Object.fromEntries(
    ITEM_SLOTS.map((slot) => [slot, { ...helmet, slot }])
  ) as SessionState['captures'];
  assert.equal(findNextUncapturedSlot(allCaptures), null);
});

test('findDisplaySource selects the source matching the Electron display id', () => {
  const sources = [
    { display_id: '22', name: 'secondary' },
    { display_id: '11', name: 'primary' }
  ];

  assert.equal(findDisplaySource(sources, 11)?.name, 'primary');
  assert.equal(findDisplaySource(sources, 33), undefined);
});

test('weapon slots depend on the selected class', () => {
  const barbarianSlots = getItemSlots('Barbarian');
  const druidSlots = getItemSlots('Druid');

  assert.equal(barbarianSlots.length, 16);
  assert.equal(druidSlots.length, 14);
  assert.equal(druidSlots.includes('weapon-3'), false);
  assert.equal(druidSlots.includes('weapon-4'), false);

  const captures = Object.fromEntries(
    druidSlots.slice(0, 10).map((slot) => [slot, {
      slot,
      filePath: `${slot}.png`,
      capturedAt: '2026-07-31T12:00:00.000Z'
    }])
  ) as SessionState['captures'];
  assert.equal(findNextUncapturedSlot(captures, druidSlots), 'stats-1');
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
    const weapon3 = await createCapture(directory, 'weapon-3', '#0000ff');
    const config: AppConfig = {
      outputDirectory: path.join(directory, 'builds'),
      characterClass: 'Sorcerer',
      buildName: 'Frozen: Orb',
      buildUrl: 'https://example.com/frozen-orb',
      captureRegion: { x: 0, y: 0, width: 100, height: 150 },
      captureFullScreen: false,
      shortcut: 'ctrl-shift-space'
    };
    const session: SessionState = {
      id: 'test-session',
      captures: { helmet, 'stats-1': stats1, 'weapon-3': weapon3 }
    };

    const outputDirectory = await exportSession(config, session);
    assert.match(path.basename(outputDirectory), /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
    const markdown = await fs.readFile(path.join(outputDirectory, 'build.md'), 'utf8');
    const manifest = JSON.parse(
      await fs.readFile(path.join(outputDirectory, 'build.json'), 'utf8')
    ) as {
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
    assert.doesNotMatch(markdown, /weapon-3/);
    assert.equal(manifest.characterClass, 'Sorcerer');
    assert.equal(manifest.buildName, 'Frozen: Orb');
    assert.equal(manifest.buildUrl, 'https://example.com/frozen-orb');
    assert.equal(manifest.captures['weapon-3'], undefined);
    await assert.rejects(fs.access(path.join(outputDirectory, 'build.png')));
    await fs.access(path.join(outputDirectory, 'items', 'helmet.png'));
    await fs.access(path.join(outputDirectory, 'items', 'stats-1.png'));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
