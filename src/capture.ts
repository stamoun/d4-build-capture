import fs from 'node:fs/promises';
import path from 'node:path';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
import type { CaptureRegion, ItemSlot } from './types';

export async function captureRegion(
  outputDirectory: string,
  slot: ItemSlot,
  region: CaptureRegion
): Promise<string> {
  await fs.mkdir(outputDirectory, { recursive: true });

  const fullScreen = await screenshot({ format: 'png' });
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
