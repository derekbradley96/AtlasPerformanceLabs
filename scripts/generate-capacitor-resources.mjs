#!/usr/bin/env node
/**
 * Generates resources/icon.png (1024x1024) and resources/splash.png (2732x2732)
 * from src/assets/branding/atlas-mark.png for @capacitor/assets.
 * Atlas mark only (no text). Splash uses #0F172A background.
 */
import Jimp from 'jimp';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MARK_PATH = join(ROOT, 'src/assets/branding/atlas-mark.png');
const RESOURCES_DIR = join(ROOT, 'resources');
const BG = 0x0f172aff; // #0F172A

async function main() {
  await mkdir(RESOURCES_DIR, { recursive: true });

  const mark = await Jimp.read(MARK_PATH);
  const w = mark.getWidth();
  const h = mark.getHeight();
  const size = Math.min(w, h);

  // Icon: 1024x1024, atlas mark centered, ~80% of canvas, #0F172A background
  const iconSize = 1024;
  const markScaleIcon = (iconSize * 0.8) / size;
  const markW = Math.round(w * markScaleIcon);
  const markH = Math.round(h * markScaleIcon);
  const left = Math.round((iconSize - markW) / 2);
  const top = Math.round((iconSize - markH) / 2);

  const iconBg = new Jimp(iconSize, iconSize, BG);
  const markIcon = mark.clone().resize(markW, markH);
  iconBg.composite(markIcon, left, top);
  const iconPng = await iconBg.getBufferAsync(Jimp.MIME_PNG);
  await writeFile(join(RESOURCES_DIR, 'icon.png'), iconPng);
  await writeFile(join(RESOURCES_DIR, 'icon-only.png'), iconPng);
  console.log('Wrote resources/icon.png and resources/icon-only.png (1024x1024, #0F172A + mark)');

  // Splash: 2732x2732, #0F172A background, atlas mark centered (~25% of canvas)
  const splashSize = 2732;
  const markScaleSplash = (splashSize * 0.25) / size;
  const markWS = Math.round(w * markScaleSplash);
  const markHS = Math.round(h * markScaleSplash);
  const leftS = Math.round((splashSize - markWS) / 2);
  const topS = Math.round((splashSize - markHS) / 2);

  const splashBg = new Jimp(splashSize, splashSize, BG);
  const markSplash = mark.clone().resize(markWS, markHS);
  splashBg.composite(markSplash, leftS, topS);
  const splashPng = await splashBg.getBufferAsync(Jimp.MIME_PNG);
  await writeFile(join(RESOURCES_DIR, 'splash.png'), splashPng);
  console.log('Wrote resources/splash.png (2732x2732, #0F172A + centered mark)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
