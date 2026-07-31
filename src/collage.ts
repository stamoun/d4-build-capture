import path from 'node:path';
import sharp from 'sharp';
import type { CaptureRecord, ItemSlot } from './types';

const ORDER: ItemSlot[] = [
  'helmet', 'chest', 'gloves',
  'pants', 'boots', 'amulet',
  'ring-1', 'ring-2', 'weapon-1',
  'weapon-2', 'weapon-3', 'weapon-4',
  'stats'
];

export async function createCollage(
  captures: Partial<Record<ItemSlot, CaptureRecord>>,
  outputPath: string
): Promise<void> {
  const itemWidth = 620;
  const itemHeight = 980;
  const gap = 24;
  const columns = 3;

  const available = ORDER
    .map((slot) => captures[slot])
    .filter((capture): capture is CaptureRecord => Boolean(capture));

  if (available.length === 0) {
    throw new Error('No captures are available.');
  }

  const rows = Math.ceil(available.length / columns);
  const canvasWidth = columns * itemWidth + (columns + 1) * gap;
  const canvasHeight = rows * itemHeight + (rows + 1) * gap;

  const composites = await Promise.all(
    available.map(async (capture, index) => {
      const buffer = await sharp(capture.filePath)
        .resize({
          width: itemWidth,
          height: itemHeight,
          fit: 'contain',
          background: { r: 18, g: 18, b: 18, alpha: 1 }
        })
        .png()
        .toBuffer();

      return {
        input: buffer,
        left: gap + (index % columns) * (itemWidth + gap),
        top: gap + Math.floor(index / columns) * (itemHeight + gap)
      };
    })
  );

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 10, g: 10, b: 10, alpha: 1 }
    }
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}
