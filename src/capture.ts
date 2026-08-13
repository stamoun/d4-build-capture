import fs from 'node:fs/promises';
import path from 'node:path';
import { desktopCapturer, screen } from 'electron';
import sharp from 'sharp';
import type { ItemSlot } from './types';

interface DisplayCaptureSource {
  display_id: string;
}

export function findDisplaySource<T extends DisplayCaptureSource>(
  sources: readonly T[],
  displayId: number
): T | undefined {
  return sources.find(({ display_id: sourceDisplayId }) => sourceDisplayId === String(displayId));
}

export async function captureFullScreen(
  outputDirectory: string,
  slot: ItemSlot
): Promise<string> {
  await fs.mkdir(outputDirectory, { recursive: true });

  const display = screen.getPrimaryDisplay();
  const thumbnailSize = {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor)
  };
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize });
  const source = findDisplaySource(sources, display.id);

  if (!source) {
    throw new Error('The primary display could not be identified for capture.');
  }
  if (source.thumbnail.isEmpty()) {
    throw new Error('Windows returned an empty screen capture.');
  }

  const fullScreen = source.thumbnail.resize(thumbnailSize).toPNG();
  const outputPath = path.join(outputDirectory, `${slot}.png`);

  await sharp(await fullScreen)
    .png()
    .toFile(outputPath);

  return outputPath;
}
