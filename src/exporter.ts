import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig, SessionState } from './types';
import { createCollage } from './collage';

function safeName(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, ' ');
}

function timestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function exportSession(
  config: AppConfig,
  session: SessionState
): Promise<string> {
  if (!config.vaultPath) {
    throw new Error('Configure the Obsidian vault path.');
  }

  const snapshotName = timestamp();
  const buildDirectory = path.join(
    config.vaultPath,
    config.buildFolder,
    `${safeName(config.characterClass)} - ${safeName(config.buildName)}`,
    snapshotName
  );

  const itemsDirectory = path.join(buildDirectory, 'items');
  await fs.mkdir(itemsDirectory, { recursive: true });

  for (const capture of Object.values(session.captures)) {
    if (!capture) continue;
    await fs.copyFile(capture.filePath, path.join(itemsDirectory, path.basename(capture.filePath)));
  }

  const collagePath = path.join(buildDirectory, 'build.png');
  await createCollage(session.captures, collagePath);

  const markdown = `---
game: Diablo IV
class: ${config.characterClass}
build: ${config.buildName}
captured: ${new Date().toISOString()}
---

# ${config.characterClass} · ${config.buildName}

![[build.png]]

## Captures

${Object.values(session.captures)
  .filter(Boolean)
  .map((capture) => `- ${capture!.slot}: ![[items/${path.basename(capture!.filePath)}]]`)
  .join('\n')}

## Session Notes

- Goal:
- Observed issue:
- Tested activity:
- Result:

## Suggested Request for Codex

Analyze the captures for this build. Identify inconsistencies among its affixes,
tempers, aspects, and masterworks. Rank the next three upgrades by expected impact
and indicate where to obtain them.
`;

  await fs.writeFile(path.join(buildDirectory, 'build.md'), markdown, 'utf8');
  await fs.writeFile(
    path.join(buildDirectory, 'build.json'),
    JSON.stringify(
      {
        game: 'Diablo IV',
        characterClass: config.characterClass,
        buildName: config.buildName,
        capturedAt: new Date().toISOString(),
        captures: session.captures
      },
      null,
      2
    ),
    'utf8'
  );

  return buildDirectory;
}
