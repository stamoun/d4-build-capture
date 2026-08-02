import fs from 'node:fs/promises';
import path from 'node:path';
import { desktopCapturer, screen } from 'electron';
import sharp from 'sharp';
import type { CaptureRegion, ItemSlot } from './types';

interface DisplayCaptureSource {
  display_id: string;
}

export function findDisplaySource<T extends DisplayCaptureSource>(
  sources: readonly T[],
  displayId: number
): T | undefined {
  return sources.find(({ display_id: sourceDisplayId }) => sourceDisplayId === String(displayId));
}

async function capturePrimaryDisplay(): Promise<Buffer> {
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

  return source.thumbnail.resize(thumbnailSize).toPNG();
}

export async function captureRegion(
  outputDirectory: string,
  slot: ItemSlot,
  region: CaptureRegion
): Promise<string> {
  await fs.mkdir(outputDirectory, { recursive: true });

  const fullScreen = await capturePrimaryDisplay();
  const outputPath = path.join(outputDirectory, `${slot}.png`);

  await sharp(fullScreen)
    .extract({
      left: region.x,
      top: region.y,
      width: region.width,
      height: region.height
    })
    .png()
    .toFile(outputPath);

  return outputPath;
}
