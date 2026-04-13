#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { parseArgs } from 'util';

// ── CLI argument parsing ────────────────────────────────────────────────

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    width:      { type: 'string', short: 'w', default: '1200' },
    height:     { type: 'string', short: 'h', default: '630' },
    preset:     { type: 'string', short: 'p' },
    padding:    { type: 'string', default: '48' },
    radius:     { type: 'string', default: '12' },
    bg:         { type: 'string', default: '#1a1a2e' },
    gradient:   { type: 'string', short: 'g' },
    shadow:     { type: 'boolean', default: true },
    frame:      { type: 'string', short: 'f', default: 'none' },
    format:     { type: 'string', default: 'png' },
    quality:    { type: 'string', default: '92' },
    scale:      { type: 'string', short: 's', default: '2' },
    output:     { type: 'string', short: 'o' },
    help:       { type: 'boolean' },
  },
});

if (values.help || positionals.length === 0) {
  console.log(`
pixdrip — CLI image beautifier

Usage: pixdrip <image> [options]

Options:
  -w, --width <n>       Canvas width (default: 1200)
  -h, --height <n>      Canvas height (default: 630)
  -p, --preset <name>   Platform preset (og-facebook, twitter-x, medium, etc.)
      --padding <n>     Padding in px (default: 48)
      --radius <n>      Border radius in px (default: 12)
      --bg <color>      Background color (default: #1a1a2e)
  -g, --gradient <stops> Gradient stops, comma-separated (e.g., "#ff6b4a,#fbbf24")
      --shadow          Enable shadow (default: true)
      --no-shadow       Disable shadow
  -f, --frame <style>   Frame style: none, macos, minimal, iphone, macbook, safari, ipad, imac, appletv
      --format <fmt>    Export format: png, jpeg, webp (default: png)
      --quality <n>     JPEG/WebP quality 0-100 (default: 92)
  -s, --scale <n>       Export scale 1-3 (default: 2)
  -o, --output <path>   Output file path (default: <input>-pixdrip.<ext>)
      --help            Show this help

Examples:
  pixdrip screenshot.png
  pixdrip hero.jpg --preset twitter-x --frame macos
  pixdrip photo.png -w 1080 -h 1080 --gradient "#ff6b4a,#fbbf24" -o social.png
  pixdrip diagram.png --preset medium --no-shadow --padding 80
`);
  process.exit(0);
}

// ── Check for canvas dependency ─────────────────────────────────────────

let createCanvas, loadImage;
try {
  const canvasModule = await import('canvas');
  createCanvas = canvasModule.createCanvas;
  loadImage = canvasModule.loadImage;
} catch {
  console.error(
    'Error: The "canvas" package is required for CLI usage.\n' +
    'Install it with: npm install canvas\n\n' +
    'Note: This requires native build tools (Python, C++ compiler).\n' +
    'See: https://github.com/Automattic/node-canvas#compiling'
  );
  process.exit(1);
}

// ── Platform presets (subset — avoids importing browser-only modules) ────

const PRESETS = {
  'og-facebook':     { width: 1200, height: 630 },
  'twitter-x':       { width: 1200, height: 628 },
  'medium':          { width: 1400, height: 700 },
  'reddit':          { width: 1200, height: 628 },
  'bluesky':         { width: 1200, height: 628 },
  'wordpress':       { width: 1200, height: 630 },
  'ghost':           { width: 1200, height: 675 },
  'substack':        { width: 1456, height: 816 },
  'linkedin':        { width: 1200, height: 627 },
  'instagram-square':{ width: 1080, height: 1080 },
  'instagram-portrait':{ width: 1080, height: 1350 },
};

// ── Build config ────────────────────────────────────────────────────────

const inputPath = resolve(positionals[0]);
if (!existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

let width = parseInt(values.width);
let height = parseInt(values.height);

if (values.preset) {
  const preset = PRESETS[values.preset];
  if (!preset) {
    console.error(`Unknown preset: ${values.preset}\nAvailable: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }
  width = preset.width;
  height = preset.height;
}

const padding = parseInt(values.padding);
const borderRadius = parseInt(values.radius);
const scale = Math.max(1, Math.min(3, parseInt(values.scale)));
const quality = parseInt(values.quality) / 100;
const format = values.format === 'jpeg' ? 'image/jpeg' : values.format === 'webp' ? 'image/webp' : 'image/png';

let background;
if (values.gradient) {
  const stops = values.gradient.split(',').map(s => s.trim());
  background = { type: 'gradient', gradient: { stops, angle: 135 }, color: values.bg, noise: false };
} else {
  background = { type: 'solid', color: values.bg, gradient: { stops: ['#ff6b4a', '#fbbf24'], angle: 135 }, noise: false };
}

// ── Render ───────────────────────────────────────────────────────────────

try {
  const image = await loadImage(inputPath);
  
  const canvasW = width * scale;
  const canvasH = height * scale;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background
  if (background.type === 'gradient' && background.gradient) {
    const { stops, angle } = background.gradient;
    const rad = (angle * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const len = Math.abs(Math.cos(rad)) * width / 2 + Math.abs(Math.sin(rad)) * height / 2;
    const dx = Math.cos(rad) * len;
    const dy = Math.sin(rad) * len;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1 || 1), s));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = background.color;
  }
  ctx.fillRect(0, 0, width, height);

  // Shadow
  if (values.shadow !== false) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    
    const imgX = padding;
    const imgY = padding;
    const imgW = width - padding * 2;
    const imgH = height - padding * 2;
    
    // Rounded rect for shadow
    roundedRect(ctx, imgX, imgY, imgW, imgH, borderRadius);
    ctx.fill();
    ctx.restore();
  }

  // Image (cover-fit)
  const imgX = padding;
  const imgY = padding;
  const imgW = width - padding * 2;
  const imgH = height - padding * 2;
  
  ctx.save();
  roundedRect(ctx, imgX, imgY, imgW, imgH, borderRadius);
  ctx.clip();
  
  // Cover fit
  const imgAspect = image.naturalWidth / image.naturalHeight;
  const targetAspect = imgW / imgH;
  let sx, sy, sw, sh;
  if (imgAspect > targetAspect) {
    sh = image.naturalHeight;
    sw = sh * targetAspect;
    sx = (image.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = image.naturalWidth;
    sh = sw / targetAspect;
    sx = 0;
    sy = (image.naturalHeight - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, imgX, imgY, imgW, imgH);
  ctx.restore();

  // Output
  const ext = values.format || 'png';
  const outputPath = values.output || 
    resolve(
      basename(inputPath, extname(inputPath)) + `-pixdrip.${ext}`
    );

  let buffer;
  if (format === 'image/jpeg') {
    buffer = canvas.toBuffer('image/jpeg', { quality });
  } else if (format === 'image/webp') {
    // node-canvas may not support webp; fall back to PNG
    try {
      buffer = canvas.toBuffer('image/webp', { quality });
    } catch {
      buffer = canvas.toBuffer('image/png');
      console.warn('WebP not supported by node-canvas, saved as PNG instead.');
    }
  } else {
    buffer = canvas.toBuffer('image/png');
  }

  writeFileSync(outputPath, buffer);
  const sizeKB = (buffer.length / 1024).toFixed(0);
  console.log(`✓ Saved: ${outputPath} (${sizeKB} KB, ${canvasW}×${canvasH})`);

} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
