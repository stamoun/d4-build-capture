import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { AppConfig } from './types';

const configSchema = z.object({
  vaultPath: z.string(),
  buildFolder: z.string().default('Diablo 4/Builds'),
  characterClass: z.string().default('Barbarian'),
  buildName: z.string().default('Unnamed Build'),
  captureRegion: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })
});

const defaultConfig: AppConfig = {
  vaultPath: '',
  buildFolder: 'Diablo 4/Builds',
  characterClass: 'Barbarian',
  buildName: 'WW Selig',
  captureRegion: {
    x: 1180,
    y: 80,
    width: 700,
    height: 1250
  }
};

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    return configSchema.parse(JSON.parse(raw));
  } catch {
    return defaultConfig;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const parsed = configSchema.parse(config);
  await fs.mkdir(path.dirname(configPath()), { recursive: true });
  await fs.writeFile(configPath(), JSON.stringify(parsed, null, 2), 'utf8');
}
