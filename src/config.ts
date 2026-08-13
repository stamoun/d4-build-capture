import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { CHARACTER_CLASSES, type AppConfig } from './types';
import { normalizeShortcutLabel } from './shortcut';

const configSchema = z.object({
  outputDirectory: z.string(),
  characterClass: z.enum(CHARACTER_CLASSES).default('Barbarian'),
  buildName: z.string().default('Unnamed Build'),
  buildUrl: z.union([z.literal(''), z.string().url()]).default(''),
  shortcut: z.string().trim().min(1).transform(normalizeShortcutLabel).default('ctrl-shift-space')
});

const legacyConfigSchema = z.object({
  vaultPath: z.string(),
  buildFolder: z.string().default('Diablo 4/Builds'),
  characterClass: z.enum(CHARACTER_CLASSES).default('Barbarian'),
  buildName: z.string().default('Unnamed Build'),
  buildUrl: z.union([z.literal(''), z.string().url()]).optional(),
  shortcut: z.string().trim().min(1).optional()
});

function defaultConfig(): AppConfig {
  return {
    outputDirectory: '',
    characterClass: 'Barbarian',
    buildName: 'Unnamed Build',
    buildUrl: '',
    shortcut: 'ctrl-shift-space'
  };
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    const value: unknown = JSON.parse(raw);
    const current = configSchema.safeParse(value);
    if (current.success) return current.data;

    const legacy = legacyConfigSchema.parse(value);
    return {
      outputDirectory: path.join(legacy.vaultPath, legacy.buildFolder),
      characterClass: legacy.characterClass,
      buildName: legacy.buildName,
      buildUrl: legacy.buildUrl ?? '',
      shortcut: normalizeShortcutLabel(legacy.shortcut ?? 'ctrl-shift-space')
    };
  } catch {
    return defaultConfig();
  }
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const parsed = configSchema.parse(config);
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(parsed, null, 2), 'utf8');
  return parsed;
}
