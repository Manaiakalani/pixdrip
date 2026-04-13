/**
 * Deep merge source into target, recursing into plain objects.
 * Arrays and non-plain values are replaced, not merged.
 */
export function deepMerge(target, source) {
  if (!source) return target;
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

/**
 * Clamp a value to an integer within [min, max].
 */
export function clampInt(val, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(val) || min)));
}

/**
 * Trigger a file download from a Blob.
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
