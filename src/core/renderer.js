import {
  drawBackground,
  drawShadow,
  drawBorder,
  drawImage,
  drawFrame,
  drawFrameBottom,
  getFrameHeight,
  getFrameBottomHeight,
  drawText,
} from './effects.js';
import { migrateConfig } from './presets.js';

/**
 * Main render function — composites all effects onto the canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement} image
 * @param {Object} config
 * @param {number} [scale=1] - DPI scale (2 for retina export)
 */
export function render(canvas, image, config, scale = 1) {
  const {
    width,
    height,
    padding,
    borderRadius,
    background,
    border,
    shadow,
    imageOffset,
    text,
    tilt,
    filters,
  } = config;

  // Resolve frame style — support legacy browserFrame boolean
  migrateConfig(config);
  const frameStyle = config.frameStyle && config.frameStyle !== 'none'
    ? config.frameStyle
    : 'none';
  const hasFrame = frameStyle !== 'none';

  const targetW = width * scale;
  const targetH = height * scale;
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(scale, scale);

  // 1. Background (with optional noise)
  drawBackground(ctx, width, height, background);

  // 1b. Apply tilt transform if enabled
  const hasTilt = tilt?.enabled && (tilt.x !== 0 || tilt.y !== 0);
  if (hasTilt) {
    const cx = width / 2;
    const cy = height / 2;
    ctx.save();
    ctx.translate(cx, cy);
    const rx = (tilt.x || 0) * Math.PI / 180;
    const ry = (tilt.y || 0) * Math.PI / 180;
    ctx.transform(Math.cos(ry), Math.sin(rx) * 0.5, -Math.sin(ry) * 0.5, Math.cos(rx), 0, 0);
    ctx.translate(-cx, -cy);
  }

  // 2. Calculate image placement
  let imgX = padding;
  let imgY = padding;
  let imgW = width - padding * 2;
  let imgH = height - padding * 2;

  // Account for border (inset)
  const bw = border.enabled ? border.width : 0;
  imgX += bw;
  imgY += bw;
  imgW -= bw * 2;
  imgH -= bw * 2;

  // Account for frame
  let frameHeight = 0;
  let frameBottomHeight = 0;
  if (hasFrame) {
    frameHeight = getFrameHeight(frameStyle);
    frameBottomHeight = getFrameBottomHeight(frameStyle);
    imgH -= frameHeight + frameBottomHeight;
  }

  // Guard against negative dimensions
  imgW = Math.max(imgW, 10);
  imgH = Math.max(imgH, 10);

  // 3. Shadow (behind everything)
  if (shadow.enabled) {
    const shadowY = imgY;
    const shadowH = hasFrame ? imgH + frameHeight + frameBottomHeight : imgH;
    drawShadow(ctx, imgX, shadowY, imgW, shadowH, borderRadius, shadow);
  }

  // 4. Border
  if (border.enabled) {
    const borderX = imgX - bw;
    const borderY = imgY - bw;
    const borderW = imgW + bw * 2;
    const borderH = (hasFrame ? imgH + frameHeight + frameBottomHeight : imgH) + bw * 2;
    drawBorder(ctx, borderX, borderY, borderW, borderH, borderRadius + bw, border);
  }

  // 5. Frame
  if (hasFrame) {
    drawFrame(ctx, imgX, imgY, imgW, borderRadius, frameStyle);
    imgY += frameHeight;
  }

  // 6. Image (clipped to rounded rect, with offset/zoom)
  const imageRadius = hasFrame
    ? {
        tl: 0,
        tr: 0,
        bl: frameBottomHeight > 0 ? 0 : borderRadius,
        br: frameBottomHeight > 0 ? 0 : borderRadius,
      }
    : borderRadius;
  drawImage(ctx, image, imgX, imgY, imgW, imgH, imageRadius, imageOffset, filters);

  // 6b. Bottom frame (chin, home bar, etc.)
  if (hasFrame && frameBottomHeight > 0) {
    drawFrameBottom(ctx, imgX, imgY + imgH, imgW, borderRadius, frameStyle);
  }

  // 7. Text overlay (drawn on top of everything)
  if (text?.enabled) {
    drawText(ctx, width, height, padding, text);
  }

  if (hasTilt) {
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Export the canvas to a Blob at 2× resolution.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement} image
 * @param {Object} config
 * @param {string} format - 'image/png' | 'image/jpeg' | 'image/webp'
 * @param {number} quality - 0–1
 * @returns {Promise<Blob>}
 */
export function exportToBlob(canvas, image, config, format, quality, scale = 2) {
  render(canvas, image, config, scale);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas export failed — toBlob returned null'));
      },
      format,
      quality,
    );
  });
}