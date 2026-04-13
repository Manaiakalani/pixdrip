/**
 * Draw a rounded rectangle path supporting uniform radius or per-corner radii.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number|{tl:number,tr:number,bl:number,br:number}} radius
 */
export function roundedRect(ctx, x, y, w, h, radius) {
  const r =
    typeof radius === 'number'
      ? { tl: radius, tr: radius, bl: radius, br: radius }
      : radius;

  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  if (r.tr) ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - r.br);
  if (r.br) ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
  else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + r.bl, y + h);
  if (r.bl) ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
  else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r.tl);
  if (r.tl) ctx.arcTo(x, y, x + r.tl, y, r.tl);
  else ctx.lineTo(x, y);
  ctx.closePath();
}

let _gradientCache = { key: '', gradient: null };

function getCachedGradient(ctx, width, height, stops, angle) {
  const key = `${width}:${height}:${stops.join(',')}:${angle}`;
  if (_gradientCache.key === key && _gradientCache.gradient) return _gradientCache.gradient;

  const rad = (angle * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.abs(Math.cos(rad)) * width / 2 + Math.abs(Math.sin(rad)) * height / 2;
  const dx = Math.cos(rad) * len;
  const dy = Math.sin(rad) * len;
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (let i = 0; i < stops.length; i++) {
    grad.addColorStop(i / (stops.length - 1 || 1), stops[i]);
  }
  _gradientCache = { key, gradient: grad };
  return grad;
}

/**
 * Fill the entire canvas with a solid color or gradient.
 * Optionally overlay a noise texture.
 */
export function drawBackground(ctx, width, height, background) {
  if (background.type === 'transparent') {
    ctx.clearRect(0, 0, width, height);
    if (background.noise) drawNoise(ctx, width, height);
    return;
  }
  if (background.type === 'gradient' && background.gradient) {
    const { stops, angle } = background.gradient;
    ctx.fillStyle = getCachedGradient(ctx, width, height, stops, angle);
  } else {
    ctx.fillStyle = background.color || '#ffffff';
  }
  ctx.fillRect(0, 0, width, height);

  // Noise overlay
  if (background.noise) {
    drawNoise(ctx, width, height);
  }
}

/**
 * Parse a hex color string to { r, g, b }.
 */
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 };
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h, 16);
  if (isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Draw a drop shadow behind the image area.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number|{tl:number,tr:number,bl:number,br:number}} radius
 * @param {Object} shadow - { x, y, blur, color, opacity }
 */
export function drawShadow(ctx, x, y, w, h, radius, shadow) {
  ctx.save();
  const { r, g, b } = hexToRgb(shadow.color || '#000000');
  ctx.shadowColor = `rgba(${r},${g},${b},${shadow.opacity ?? 0.5})`;
  ctx.shadowBlur = shadow.blur || 0;
  ctx.shadowOffsetX = shadow.x || 0;
  ctx.shadowOffsetY = shadow.y || 0;
  // Fill a shape to cast the shadow; image/frame drawn on top will cover it
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.beginPath();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a border around the image area.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number|{tl:number,tr:number,bl:number,br:number}} radius
 * @param {Object} border - { width, color }
 */
export function drawBorder(ctx, x, y, w, h, radius, border) {
  ctx.save();
  ctx.lineWidth = border.width;
  ctx.strokeStyle = border.color || '#000000';
  const half = border.width / 2;
  ctx.beginPath();
  roundedRect(ctx, x + half, y + half, w - border.width, h - border.width, radius);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw a frame bar (top or bottom) with common boilerplate.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} height - frame bar height
 * @param {number} radius - corner radius
 * @param {'top'|'bottom'} position - which corners to round
 * @param {string} bgColor - fill color
 * @param {Function} [drawContent] - callback(ctx, x, y, w, height) for inner content
 * @param {string|null} [edgeColor] - edge line color; null to skip, undefined for default
 */
function drawFrameBar(ctx, x, y, w, height, radius, position, bgColor, drawContent, edgeColor) {
  const corners = position === 'top'
    ? { tl: radius, tr: radius, bl: 0, br: 0 }
    : { tl: 0, tr: 0, bl: radius, br: radius };

  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, x, y, w, height, corners);
  ctx.clip();

  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, w, height);

  if (drawContent) drawContent(ctx, x, y, w, height);

  // Edge line (skip if edgeColor is explicitly null)
  if (edgeColor !== null) {
    const edgeY = position === 'top' ? y + height - 0.5 : y + 0.5;
    ctx.strokeStyle = edgeColor || (position === 'top' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.04)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, edgeY);
    ctx.lineTo(x + w, edgeY);
    ctx.stroke();
  }

  ctx.restore();
  return height;
}

/**
 * Draw a macOS-style browser frame (title bar with traffic lights).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} radius - top corners only
 * @returns {number} frameHeight
 */
export function drawBrowserFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.macos.topHeight, radius, 'top', '#2a2a2e', (ctx, x, y, w, h) => {
    // Traffic lights
    const colors = ['#ff5f57', '#ffbd2e', '#27c93f'];
    const dotRadius = 6;
    const startX = x + 12 + dotRadius;
    const centerY = y + h / 2;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(startX + i * (dotRadius * 2 + 8), centerY, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/**
 * Draw the image clipped to a rounded rectangle with cover-fit.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} image
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number|{tl:number,tr:number,bl:number,br:number}} radius
 */
let _cropCache = { key: '', sx: 0, sy: 0, sw: 0, sh: 0 };

export function drawImage(ctx, image, x, y, w, h, radius, imageOffset, filters) {
  ctx.save();

  // Build clipping path
  ctx.beginPath();
  roundedRect(ctx, x, y, w, h, radius);
  ctx.clip();

  const zoom = imageOffset?.zoom ?? 1;
  const offX = imageOffset?.x ?? 0;
  const offY = imageOffset?.y ?? 0;

  let sx, sy, sw, sh;
  const cropKey = `${image.naturalWidth}:${image.naturalHeight}:${w}:${h}:${zoom}:${offX}:${offY}`;
  if (_cropCache.key === cropKey) {
    sx = _cropCache.sx;
    sy = _cropCache.sy;
    sw = _cropCache.sw;
    sh = _cropCache.sh;
  } else {
    // Cover-fit: crop source to fill target while preserving aspect ratio
    const imgAspect = image.naturalWidth / image.naturalHeight;
    const targetAspect = w / h;
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

    // Apply zoom and offset
    if (zoom !== 1 || offX !== 0 || offY !== 0) {
      const zoomedW = sw / zoom;
      const zoomedH = sh / zoom;
      sx += (sw - zoomedW) / 2 - offX * (sw / w);
      sy += (sh - zoomedH) / 2 - offY * (sh / h);
      sw = zoomedW;
      sh = zoomedH;

      // Clamp to image bounds
      sx = Math.max(0, Math.min(sx, image.naturalWidth - sw));
      sy = Math.max(0, Math.min(sy, image.naturalHeight - sh));
    }

    _cropCache = { key: cropKey, sx, sy, sw, sh };
  }

  // Apply image filters
  if (filters) {
    const parts = [];
    if (filters.brightness != null && filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
    if (filters.contrast != null && filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
    if (filters.saturation != null && filters.saturation !== 100) parts.push(`saturate(${filters.saturation}%)`);
    if (filters.blur != null && filters.blur > 0) parts.push(`blur(${filters.blur}px)`);
    if (parts.length > 0) ctx.filter = parts.join(' ');
  }

  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);

  ctx.restore();
}

// ── Noise overlay ──────────────────────────────────────────────────────────

let _noiseCacheCanvas = null;
let _noiseCacheW = 0;
let _noiseCacheH = 0;
let _noisePattern = null;

function drawNoise(ctx, w, h) {
  // Use a smaller tile (200×200) and repeat for performance
  const tileSize = 200;
  if (!_noiseCacheCanvas || _noiseCacheW !== tileSize || _noiseCacheH !== tileSize) {
    _noiseCacheCanvas = document.createElement('canvas');
    _noiseCacheCanvas.width = tileSize;
    _noiseCacheCanvas.height = tileSize;
    const nCtx = _noiseCacheCanvas.getContext('2d');
    const imgData = nCtx.createImageData(tileSize, tileSize);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 18; // subtle opacity
    }
    nCtx.putImageData(imgData, 0, 0);
    _noiseCacheW = tileSize;
    _noiseCacheH = tileSize;
  }

  if (!_noisePattern) {
    _noisePattern = ctx.createPattern(_noiseCacheCanvas, 'repeat');
  }

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = _noisePattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// ── Frame styles ───────────────────────────────────────────────────────────

export const FRAME_CONFIG = {
  macos:   { topHeight: 36, bottomHeight: 0 },
  minimal: { topHeight: 28, bottomHeight: 0 },
  iphone:  { topHeight: 44, bottomHeight: 0 },
  macbook: { topHeight: 24, bottomHeight: 0 },
  ipad:    { topHeight: 24, bottomHeight: 20 },
  safari:  { topHeight: 52, bottomHeight: 0 },
  imac:    { topHeight: 24, bottomHeight: 48 },
  appletv: { topHeight: 16, bottomHeight: 28 },
};

/**
 * Draw a minimal/clean window frame (just a thin bar with a dot).
 */
export function drawMinimalFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.minimal.topHeight, radius, 'top', '#1e1e22', (ctx, x, y, w, h) => {
    // Single centered dot
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(x + 16, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }, 'rgba(255,255,255,0.06)');
}

/**
 * Draw an iPhone-style device frame (notch + rounded corners).
 */
export function drawIPhoneFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.iphone.topHeight, radius, 'top', '#1a1a1e', (ctx, x, y, w, h) => {
    // Dynamic Island (centered pill)
    const pillW = 96;
    const pillH = 24;
    const pillX = x + (w - pillW) / 2;
    const pillY = y + 10;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    roundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    const statusY = pillY + pillH / 2;

    // Time (left)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '600 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('9:41', x + 20, statusY);

    // Battery/signal icons (right, simplified)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    // Signal bars
    for (let i = 0; i < 4; i++) {
      const barH = 4 + i * 2;
      ctx.fillRect(x + w - 56 + i * 5, statusY - barH / 2, 3, barH);
    }
    // Battery
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w - 32, statusY - 5, 18, 10);
    ctx.fillRect(x + w - 30, statusY - 3, 14, 6);
  }, null);
}

/**
 * Draw a MacBook-style frame (thin bezel + camera notch).
 */
export function drawMacBookFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.macbook.topHeight, radius, 'top', '#0c0c0e', (ctx, x, y, w, h) => {
    // Camera dot (centered)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a3e';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }, 'rgba(255,255,255,0.04)');
}

/**
 * Draw an iPad-style status bar frame.
 */
export function drawIPadFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.ipad.topHeight, radius, 'top', '#1a1a1e', (ctx, x, y, w, h) => {
    const midY = y + h / 2;

    // Time
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('9:41', x + 16, midY);

    // Battery (right)
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + w - 30, midY - 4, 16, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x + w - 28, midY - 2, 12, 4);
    ctx.fillRect(x + w - 14, midY - 1.5, 1.5, 3);
  }, 'rgba(255,255,255,0.04)');
}

/**
 * Draw iPad bottom bar with home indicator.
 */
export function drawIPadFrameBottom(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.ipad.bottomHeight, radius, 'bottom', '#1a1a1e', (ctx, x, y, w, h) => {
    // Home indicator bar
    const barW = Math.min(134, w * 0.35);
    const barH = 5;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    roundedRect(ctx, x + (w - barW) / 2, y + (h - barH) / 2, barW, barH, barH / 2);
    ctx.fill();
  });
}

/**
 * Draw a Safari-style browser frame with URL bar.
 */
export function drawSafariFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.safari.topHeight, radius, 'top', '#28282c', (ctx, x, y, w, h) => {
    const midY = y + h / 2;

    // Back/Forward arrows
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 18, midY - 4);
    ctx.lineTo(x + 14, midY);
    ctx.lineTo(x + 18, midY + 4);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.moveTo(x + 28, midY - 4);
    ctx.lineTo(x + 32, midY);
    ctx.lineTo(x + 28, midY + 4);
    ctx.stroke();

    // URL bar (centered pill)
    const urlBarW = Math.min(w * 0.55, 400);
    const urlBarH = 28;
    const urlBarX = x + (w - urlBarW) / 2;
    const urlBarY = y + (h - urlBarH) / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    roundedRect(ctx, urlBarX, urlBarY, urlBarW, urlBarH, urlBarH / 2);
    ctx.fill();

    // URL text
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '400 12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('example.com', urlBarX + urlBarW / 2, urlBarY + urlBarH / 2);

    // Tabs button (right) — overlapping squares
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.2;
    const tabX = x + w - 22;
    ctx.strokeRect(tabX - 5, midY - 4, 9, 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(tabX - 3, midY - 6);
    ctx.lineTo(tabX + 6, midY - 6);
    ctx.lineTo(tabX + 6, midY + 3);
    ctx.stroke();
  });
}

/**
 * Draw an iMac-style display top bezel with camera.
 */
export function drawIMacFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.imac.topHeight, radius, 'top', '#0c0c0e', (ctx, x, y, w, h) => {
    // Camera dot
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a3e';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }, 'rgba(255,255,255,0.04)');
}

/**
 * Draw iMac bottom chin with subtle logo indicator.
 */
export function drawIMacFrameBottom(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.imac.bottomHeight, radius, 'bottom', '#1c1c20', (ctx, x, y, w, h) => {
    // Subtle center circle (logo area)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

/**
 * Draw Apple TV display top bezel.
 */
export function drawAppleTVFrame(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.appletv.topHeight, radius, 'top', '#0c0c0e', null, 'rgba(255,255,255,0.03)');
}

/**
 * Draw Apple TV bottom bezel with label.
 */
export function drawAppleTVFrameBottom(ctx, x, y, w, radius) {
  return drawFrameBar(ctx, x, y, w, FRAME_CONFIG.appletv.bottomHeight, radius, 'bottom', '#0c0c0e', (ctx, x, y, w, h) => {
    // "tv" label
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = '500 10px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('tv', x + w / 2, y + h / 2);
  }, 'rgba(255,255,255,0.03)');
}

/** Get top frame height for any style. */
export function getFrameHeight(style) {
  return FRAME_CONFIG[style]?.topHeight ?? 0;
}

/** Get bottom frame height for styles with a bottom bezel/chin. */
export function getFrameBottomHeight(style) {
  return FRAME_CONFIG[style]?.bottomHeight ?? 0;
}

/** Draw top frame by style name. Returns frame height. */
export function drawFrame(ctx, x, y, w, radius, style) {
  switch (style) {
    case 'macos': return drawBrowserFrame(ctx, x, y, w, radius);
    case 'minimal': return drawMinimalFrame(ctx, x, y, w, radius);
    case 'iphone': return drawIPhoneFrame(ctx, x, y, w, radius);
    case 'macbook': return drawMacBookFrame(ctx, x, y, w, radius);
    case 'ipad': return drawIPadFrame(ctx, x, y, w, radius);
    case 'safari': return drawSafariFrame(ctx, x, y, w, radius);
    case 'imac': return drawIMacFrame(ctx, x, y, w, radius);
    case 'appletv': return drawAppleTVFrame(ctx, x, y, w, radius);
    default: return 0;
  }
}

/** Draw bottom frame by style name. Returns bottom frame height. */
export function drawFrameBottom(ctx, x, y, w, radius, style) {
  switch (style) {
    case 'ipad': return drawIPadFrameBottom(ctx, x, y, w, radius);
    case 'imac': return drawIMacFrameBottom(ctx, x, y, w, radius);
    case 'appletv': return drawAppleTVFrameBottom(ctx, x, y, w, radius);
    default: return 0;
  }
}

// ── Text overlay ───────────────────────────────────────────────────────────

/**
 * Draw text overlay on the canvas.
 */
export function drawText(ctx, width, height, padding, textConfig) {
  if (!textConfig?.enabled || !textConfig.content?.trim()) return;

  ctx.save();
  const { content, fontSize, fontWeight, color, position, opacity } = textConfig;

  ctx.globalAlpha = opacity ?? 1;
  ctx.fillStyle = color || '#ffffff';
  ctx.font = `${fontWeight || '600'} ${fontSize || 32}px 'Instrument Sans', system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const cx = width / 2;
  let cy;
  const textPad = padding * 0.4;

  switch (position) {
    case 'top':
      cy = textPad + fontSize / 2;
      break;
    case 'bottom':
      cy = height - textPad - fontSize / 2;
      break;
    case 'center':
    default:
      cy = height / 2;
      break;
  }

  // Draw text shadow for legibility
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Word wrap if text is wider than available space
  const maxWidth = width - padding * 2;
  const words = content.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    const test = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = test;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.3;
  const totalHeight = lines.length * lineHeight;
  const startY = cy - totalHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lineHeight);
  }

  ctx.restore();
}