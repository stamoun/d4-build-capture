import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createCollage } from '../src/collage';
import { exportSession } from '../src/exporter';
import { findNextUncapturedSlot } from '../src/session';
import { ITEM_SLOTS, type AppConfig, type CaptureRecord, type SessionState } from '../src/types';

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

  return {
    slot,
    filePath,
    capturedAt: '2026-07-31T12:00:00.000Z'
  };
}

test('createCollage rejects an empty capture set', async () => {
  const directory = await createTemporaryDirectory();

  try {
    await assert.rejects(
      createCollage({}, path.join(directory, 'build.png')),
      new Error('No captures are available.')
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

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

test('createCollage generates the expected fixed-grid PNG', async () => {
  const directory = await createTemporaryDirectory();

  try {
    const helmet = await createCapture(directory, 'helmet', '#ff0000');
    const chest = await createCapture(directory, 'chest', '#00ff00');
    const outputPath = path.join(directory, 'build.png');

    await createCollage({ helmet, chest }, outputPath);

    const metadata = await sharp(outputPath).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 1956);
    assert.equal(metadata.height, 1028);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('exportSession writes a complete Obsidian snapshot', async () => {
  const directory = await createTemporaryDirectory();

  try {
    const helmet = await createCapture(directory, 'helmet', '#ff0000');
    const config: AppConfig = {
      vaultPath: path.join(directory, 'vault'),
      buildFolder: 'Diablo 4/Builds',
      characterClass: 'Sorcerer',
      buildName: 'Frozen: Orb',
      captureRegion: { x: 0, y: 0, width: 100, height: 150 }
    };
    const session: SessionState = {
      id: 'test-session',
      captures: { helmet }
    };

    const outputDirectory = await exportSession(config, session);
    const markdown = await fs.readFile(path.join(outputDirectory, 'build.md'), 'utf8');
    const manifest = JSON.parse(
      await fs.readFile(path.join(outputDirectory, 'build.json'), 'utf8')
    ) as { characterClass: string; buildName: string };

    assert.equal(path.basename(path.dirname(outputDirectory)), 'Sorcerer - Frozen- Orb');
    assert.match(markdown, /# Sorcerer · Frozen: Orb/);
    assert.match(markdown, /- helmet: !\[\[items\/helmet\.png\]\]/);
    assert.equal(manifest.characterClass, 'Sorcerer');
    assert.equal(manifest.buildName, 'Frozen: Orb');
    await fs.access(path.join(outputDirectory, 'build.png'));
    await fs.access(path.join(outputDirectory, 'items', 'helmet.png'));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
