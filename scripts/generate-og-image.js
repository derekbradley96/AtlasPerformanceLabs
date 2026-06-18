/**
 * Writes public/og-image.svg and rasterizes to public/og-image.png (1200×630).
 * Brand mark paths match public/favicon.svg (Atlas bar + circle).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const pub = path.join(root, 'public');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0B1220"/>
  <rect width="1200" height="2" y="0" fill="#1E3A5F" opacity="0.6"/>
  <!-- Brand mark (same geometry as public/favicon.svg, scaled) -->
  <g transform="translate(600,118) scale(2.4) translate(-24,-24)">
    <rect x="20" y="8" width="8" height="28" rx="2" fill="#2563EB"/>
    <rect x="16" y="34" width="16" height="4" rx="2" fill="#2563EB"/>
    <circle cx="24" cy="20" r="6" stroke="#2563EB" stroke-width="2.5" fill="none"/>
  </g>
  <text x="600" y="230" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="72" font-weight="700" fill="#FFFFFF"
    text-anchor="middle">Atlas</text>
  <text x="600" y="288" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="24" font-weight="400" fill="#64748B"
    text-anchor="middle">Performance Labs</text>
  <text x="600" y="388" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="36" font-weight="500" fill="#E2E8F0"
    text-anchor="middle">Coaching. Competition Prep. Performance.</text>
  <text x="600" y="448" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="22" font-weight="400" fill="#64748B"
    text-anchor="middle">Built for bodybuilding coaches and athletes.</text>
  <text x="600" y="548" font-family="system-ui, -apple-system, Segoe UI, sans-serif"
    font-size="18" font-weight="400" fill="#3B82F6"
    text-anchor="middle">atlasperformancelabs.co.uk</text>
</svg>`;

const svgPath = path.join(pub, 'og-image.svg');
const pngPath = path.join(pub, 'og-image.png');

fs.writeFileSync(svgPath, svg, 'utf8');
console.log('Wrote', path.relative(root, svgPath));

await sharp(Buffer.from(svg), { density: 144 })
  .resize(1200, 630, { fit: 'fill' })
  .png()
  .toFile(pngPath);

console.log('Wrote', path.relative(root, pngPath), '(1200×630)');
