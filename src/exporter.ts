import fs from 'node:fs/promises';
import path from 'node:path';
import {
  getItemSlots,
  type AppConfig,
  type CaptureRecord,
  type ItemSlot,
  type SessionState
} from './types';

function safeName(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ');
}

function timestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  ].join('_');
}

function captureImage(capture: CaptureRecord | undefined): string {
  if (!capture) return '_Not captured_';
  return `![${capture.slot}](items/${path.basename(capture.filePath)})`;
}

function yamlValue(value: string): string {
  return JSON.stringify(value);
}

function statsOverview(captures: Partial<Record<ItemSlot, CaptureRecord>>): string {
  return `| Stats 1 | Stats 2 |
|---|---|
| ${captureImage(captures['stats-1'])} | ${captureImage(captures['stats-2'])} |

| Stats 3 | Stats 4 |
|---|---|
| ${captureImage(captures['stats-3'])} | ${captureImage(captures['stats-4'])} |`;
}

function activeCaptures(
  config: AppConfig,
  session: SessionState
): Partial<Record<ItemSlot, CaptureRecord>> {
  return Object.fromEntries(
    getItemSlots(config.characterClass)
      .map((slot) => [slot, session.captures[slot]] as const)
      .filter((entry): entry is readonly [ItemSlot, CaptureRecord] => Boolean(entry[1]))
  ) as Partial<Record<ItemSlot, CaptureRecord>>;
}

export async function exportSession(config: AppConfig, session: SessionState): Promise<string> {
  if (!config.outputDirectory) throw new Error('Configure the output directory.');

  const buildDirectory = path.join(
    config.outputDirectory,
    `${safeName(config.characterClass)} - ${safeName(config.buildName)}`,
    timestamp()
  );
  const itemsDirectory = path.join(buildDirectory, 'items');
  await fs.mkdir(itemsDirectory, { recursive: true });

  const captures = activeCaptures(config, session);
  for (const capture of Object.values(captures)) {
    if (!capture) continue;
    await fs.copyFile(capture.filePath, path.join(itemsDirectory, path.basename(capture.filePath)));
  }

  const equipmentCaptures = Object.values(captures)
    .filter((capture): capture is CaptureRecord => Boolean(capture))
    .filter((capture) => !capture.slot.startsWith('stats-'))
    .map((capture) => `- ${capture.slot}: ${captureImage(capture)}`)
    .join('\n');

  const markdown = `---
game: Diablo IV
class: ${yamlValue(config.characterClass)}
build: ${yamlValue(config.buildName)}
planner: ${yamlValue(config.buildUrl)}
captured: ${new Date().toISOString()}
---

# ${config.characterClass} · ${config.buildName}

${config.buildUrl ? `[Open build planner](<${config.buildUrl}>)` : ''}

## Character Stats Overview

${statsOverview(captures)}

## Equipment Captures

${equipmentCaptures || '_No equipment captured._'}

## Session Notes

- Goal:
- Observed issue:
- Tested activity:
- Result:

## AI Prompt

Analyze the captures for this build. Identify inconsistencies among its affixes,
tempers, aspects, and masterworks. Rank the next three upgrades by expected impact
and indicate where to obtain them.
`;

  await fs.writeFile(path.join(buildDirectory, 'build.md'), markdown, 'utf8');
  await fs.writeFile(
    path.join(buildDirectory, 'build.json'),
    JSON.stringify({
      game: 'Diablo IV',
      characterClass: config.characterClass,
      buildName: config.buildName,
      buildUrl: config.buildUrl,
      capturedAt: new Date().toISOString(),
      captures
    }, null, 2),
    'utf8'
  );

  return buildDirectory;
}
