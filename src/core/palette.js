// Dominant-color extraction. Pure function, no DOM globals required —
// safe to invoke from a worker if we ever want to. Downscales to 64×64 and
// buckets pixels into a coarse 32×32×32 RGB grid to find heavy hitters.

const GRID = 32;          // bins per channel — 32 means 8-bit-truncated lookup
const SAMPLE = 64;        // downscaled side length
const MIN_ALPHA = 200;    // skip near-transparent pixels
const LOW_SAT_THRESHOLD = 0.15;

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return { h: h * 60, s, l };
}

export function rgbToHex({ r, g, b }) {
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Extract n dominant colors from an image source.
 * @param {ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
 * @param {number} [n=2]
 * @returns {Array<{r:number,g:number,b:number}>}
 */
export function extractDominantColors(source, n = 2) {
  if (!source) return [];

  let canvas;
  let ctx;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(SAMPLE, SAMPLE);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  } else {
    return [];
  }

  try {
    ctx.drawImage(source, 0, 0, SAMPLE, SAMPLE);
  } catch {
    return [];
  }

  let data;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    // Tainted canvas (cross-origin); bail out gracefully.
    return [];
  }

  const buckets = new Map();
  const lowSatBuckets = new Map();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < MIN_ALPHA) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Bin into a coarse grid so similar shades merge
    const br = Math.min(GRID - 1, (r * GRID) >> 8);
    const bg = Math.min(GRID - 1, (g * GRID) >> 8);
    const bb = Math.min(GRID - 1, (b * GRID) >> 8);
    const key = (br << 10) | (bg << 5) | bb;

    const { s } = rgbToHsl(r, g, b);
    const isLowSat = s < LOW_SAT_THRESHOLD;
    const target = isLowSat ? lowSatBuckets : buckets;

    const existing = target.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count += 1;
    } else {
      target.set(key, { r, g, b, count: 1 });
    }
  }

  const pickFrom = (map) =>
    [...map.values()]
      .sort((a, b) => b.count - a.count)
      .map((v) => ({
        r: Math.round(v.r / v.count),
        g: Math.round(v.g / v.count),
        b: Math.round(v.b / v.count),
        count: v.count,
      }));

  let ranked = pickFrom(buckets);
  if (ranked.length < n) {
    // Fall back to including low-sat colors if there isn't enough chroma
    ranked = ranked.concat(pickFrom(lowSatBuckets));
  }

  // De-duplicate near-identical colors so the suggestion has visual contrast
  const result = [];
  for (const c of ranked) {
    if (result.length >= n) break;
    const tooClose = result.some(
      (p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < 60,
    );
    if (!tooClose) result.push({ r: c.r, g: c.g, b: c.b });
  }

  // Top-up if we filtered too aggressively
  for (const c of ranked) {
    if (result.length >= n) break;
    if (!result.some((p) => p.r === c.r && p.g === c.g && p.b === c.b)) {
      result.push({ r: c.r, g: c.g, b: c.b });
    }
  }

  return result;
}
