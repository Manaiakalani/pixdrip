import { initDropzone, resetDropzone } from './ui/dropzone.js';
import { initControls } from './ui/controls.js';
import { initPreview } from './ui/preview.js';
import { exportToBlob } from './core/renderer.js';
import { DEFAULT_CONFIG, PLATFORM_PRESETS } from './core/presets.js';
import { saveConfig, loadConfig, clearConfig } from './utils/storage.js';
import { deepMerge, downloadBlob } from './utils/helpers.js';
import { showToast } from './ui/toast.js';
import { initSocialPreview, updateSocialPreview, resetSocialPreview } from './ui/social-preview.js';
import { extractDominantColors, rgbToHex } from './core/palette.js';
import { initErrorBoundary } from './utils/errors.js';

// Boot the global error boundary as early as possible. Sentry-pluggable hook
// shape — just replace `onError` to forward to a real error tracker.
initErrorBoundary({
  onError(detail) {
    // Discreet user-facing surface; full info is in console.
    if (detail.kind === 'rejection') {
      // Promise rejections are noisy — skip the toast unless it has a message
      if (!detail.message || detail.message === 'undefined') return;
    }
    try { showToast(`Something went wrong: ${detail.message}`, 'error'); } catch { /* */ }
  },
});

// Storage quota → user-visible toast
window.addEventListener('pixdrip:storage-quota-exceeded', () => {
  showToast(
    "Couldn't save settings — storage full. Old presets may have been removed.",
    'error',
  );
});

// Worker for off-main-thread file size estimation (graceful fallback)
let sizeWorker = null;
try {
  if (typeof OffscreenCanvas !== 'undefined') {
    sizeWorker = new Worker(
      new URL('./workers/render-worker.js', import.meta.url),
      { type: 'module' },
    );
  }
} catch {
  // Worker not supported — will use main thread fallback
}

// App state
let currentImage = null;
let imageMeta = null;
let renderRAF = 0;
let renderPending = false;

// requestIdleCallback shim — falls back to setTimeout where unsupported (Safari).
const ric =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1);

// File size estimation
let sizeEstimateTimer = null;
const sizeEstimateCanvas = document.createElement('canvas');

// Debounced save — prevents localStorage thrashing during slider drags
let saveTimer = null;
function debouncedSave(config) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveConfig(config), 300);
}

function updateFileSizeEstimate(config) {
  if (!currentImage) return;
  clearTimeout(sizeEstimateTimer);
  sizeEstimateTimer = setTimeout(async () => {
    const el = document.getElementById('file-size-estimate');
    if (!el) return;

    if (sizeWorker) {
      // Worker path — send image as bitmap
      try {
        const bitmap = await createImageBitmap(currentImage);
        sizeWorker.onmessage = (e) => {
          if (e.data.size) {
            const kb = e.data.size / 1024;
            el.textContent =
              kb >= 1024
                ? `~${(kb / 1024).toFixed(1)} MB`
                : `~${Math.round(kb)} KB`;
          }
        };
        sizeWorker.postMessage(
          {
            config: structuredClone(config),
            imageData: bitmap,
            width: currentImage.naturalWidth,
            height: currentImage.naturalHeight,
          },
          [bitmap],
        );
      } catch {
        // Fall back to main thread
        mainThreadEstimate(config, el);
      }
    } else {
      mainThreadEstimate(config, el);
    }
  }, 500);
}

async function mainThreadEstimate(config, el) {
  try {
    const blob = await exportToBlob(
      sizeEstimateCanvas,
      currentImage,
      config,
      config.export.format,
      config.export.quality,
      config.export.scale ?? 2,
    );
    const kb = blob.size / 1024;
    el.textContent =
      kb >= 1024 ? `~${(kb / 1024).toFixed(1)} MB` : `~${Math.round(kb)} KB`;
  } catch {
    // Silent fail — estimation is non-critical
  }
}

// Undo/redo history
const history = { stack: [], index: -1, maxSize: 50 };
let skipHistoryPush = false;

function pushHistory(config) {
  if (skipHistoryPush) return;
  // Trim redo entries
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(structuredClone(config));
  if (history.stack.length > history.maxSize) history.stack.shift();
  history.index = history.stack.length - 1;
}

function restoreConfig(controls) {
  const saved = loadConfig();
  if (saved) {
    const merged = deepMerge(structuredClone(DEFAULT_CONFIG), saved);
    controls.setConfig(merged);
  }
  pushHistory(controls.getConfig());
}

function setupExportHandlers(controls, preview) {
  const resetCropBtn = document.getElementById('btn-reset-crop');

  // Wire preview offset changes back to controls config
  preview.setOnOffsetChange((offset) => {
    const cfg = controls.getConfig();
    cfg.imageOffset = { ...offset };
    controls.setConfig(cfg, { silent: true });
    debouncedSave(cfg);
    pushHistory(cfg);
    // Show/hide reset crop button
    if (resetCropBtn) {
      const isDefault = offset.x === 0 && offset.y === 0 && (offset.zoom === 1 || offset.zoom === undefined);
      resetCropBtn.classList.toggle('hidden', isDefault);
    }
  });

  // Reset crop/zoom button
  resetCropBtn?.addEventListener('click', () => {
    const cfg = controls.getConfig();
    cfg.imageOffset = { x: 0, y: 0, zoom: 1 };
    controls.setConfig(cfg, { silent: true });
    debouncedSave(cfg);
    pushHistory(cfg);
    if (currentImage) preview.updatePreview(currentImage, cfg);
    resetCropBtn.classList.add('hidden');
  });

  // Wire up dropzone
  initDropzone({
    onImageLoad(image, meta) {
      currentImage = image;
      imageMeta = meta;
      controls.setImageLoaded(true);
      hideFirstRunHint();

      const info = document.getElementById('image-info');
      if (info) {
        const sizeStr = meta.size
          ? `${(meta.size / 1024).toFixed(0)}KB`
          : '';
        info.textContent = `${meta.width} × ${meta.height}${sizeStr ? ' · ' + sizeStr : ''}`;
      }

      preview.updatePreview(image, controls.getConfig());
      updateSocialPreview(image, controls.getConfig());
      updateFileSizeEstimate(controls.getConfig());
      // Extract palette suggestion off the critical path
      ric(() => {
        try {
          const colors = extractDominantColors(image, 2);
          if (colors.length >= 2) {
            controls.setAutoPaletteSuggestion?.([rgbToHex(colors[0]), rgbToHex(colors[1])]);
          } else if (colors.length === 1) {
            // Single-color image — make a self-tonal pair by lightening one stop
            const c = colors[0];
            const lift = (n) => Math.min(255, Math.round(n + (255 - n) * 0.35));
            const lighter = { r: lift(c.r), g: lift(c.g), b: lift(c.b) };
            controls.setAutoPaletteSuggestion?.([rgbToHex(c), rgbToHex(lighter)]);
          }
        } catch { /* swallow — non-critical */ }
      });
    },
    onError(message) {
      showToast(message, 'error');
    },
    onBulkFiles(files) {
      bulkExportFiles(files, controls);
    },
  });

  // Re-fit preview on resize
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentImage) preview.updatePreview(currentImage, controls.getConfig());
    }, 100);
  });
}

function setupKeyboardShortcuts(controls, preview) {
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');

    if (mod && e.key === 'e') {
      e.preventDefault();
      document.getElementById('btn-export')?.click();
    }
    if (mod && e.key === 'n') {
      e.preventDefault();
      document.getElementById('btn-new')?.click();
    }
    if (mod && e.key === 'c' && !isInput && !window.getSelection()?.toString()) {
      // Only intercept Cmd+C when no text is selected and not in an input
      e.preventDefault();
      document.getElementById('btn-copy')?.click();
    }
    // Undo: Cmd+Z
    if (mod && !e.shiftKey && e.key === 'z' && !isInput) {
      e.preventDefault();
      if (history.index > 0) {
        history.index--;
        const prev = history.stack[history.index];
        skipHistoryPush = true;
        controls.setConfig(prev, { silent: true });
        debouncedSave(prev);
        if (currentImage) preview.updatePreview(currentImage, prev);
        skipHistoryPush = false;
        showToast('Undo', 'info');
      }
    }
    // Redo: Cmd+Shift+Z
    if (mod && e.shiftKey && e.key === 'z' && !isInput) {
      e.preventDefault();
      if (history.index < history.stack.length - 1) {
        history.index++;
        const next = history.stack[history.index];
        skipHistoryPush = true;
        controls.setConfig(next, { silent: true });
        debouncedSave(next);
        if (currentImage) preview.updatePreview(currentImage, next);
        skipHistoryPush = false;
        showToast('Redo', 'info');
      }
    }
  });
}

function setupMobileSidebar() {
  document.getElementById('sidebar-handle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('sidebar--expanded');
  });
}

function init() {
  const canvas = document.getElementById('preview-canvas');
  const preview = initPreview(canvas);
  // Social preview isn't visible until the user opens that section, so defer
  // its DOM setup to idle time to keep first paint snappy.
  ric(() => initSocialPreview());

  const controls = initControls({
    onChange(config) {
      debouncedSave(config);
      pushHistory(config);
      // Coalesce repeated change events (e.g., slider drags) into a single
      // render per animation frame. We track a `renderPending` flag rather
      // than always cancelling/re-scheduling, so the rAF runs against the
      // freshest config instead of being thrashed.
      if (!renderPending) {
        renderPending = true;
        renderRAF = requestAnimationFrame(() => {
          renderPending = false;
          const latest = controls.getConfig();
          if (currentImage) preview.updatePreview(currentImage, latest);
          updateSocialPreview(currentImage, latest);
        });
      }
      updateFileSizeEstimate(config);
    },

    async onExport() {
      if (!currentImage) return;
      const config = controls.getConfig();
      const exportCanvas = document.createElement('canvas');

      try {
        const blob = await exportToBlob(
          exportCanvas,
          currentImage,
          config,
          config.export.format,
          config.export.quality,
          config.export.scale ?? 2,
        );

        // Prefer the blob's actual mime — if AVIF wasn't supported we fell
        // back to WebP/PNG and the filename should reflect the real content.
        const actualMime = blob.type || config.export.format;
        const ext = (actualMime.split('/')[1] || 'png').replace('jpeg', 'jpg');
        const baseName = imageMeta?.name
          ? imageMeta.name.replace(/\.[^.]+$/, '')
          : 'pixdrip';
        const filename = `${baseName}-${config.width}x${config.height}.${ext}`;

        downloadBlob(blob, filename);
        if (actualMime !== config.export.format) {
          showToast(
            `Exported ${filename} — ${config.export.format.split('/')[1].toUpperCase()} not supported, used ${ext.toUpperCase()}`,
            'info',
          );
        } else {
          showToast(`Exported ${filename}`, 'success');
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Export failed', 'error');
      }
    },

    async onCopy() {
      if (!currentImage) return;
      const config = controls.getConfig();
      const exportCanvas = document.createElement('canvas');

      try {
        const blob = await exportToBlob(
          exportCanvas,
          currentImage,
          config,
          'image/png',
          1,
          config.export.scale ?? 2,
        );

        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          showToast('Copied to clipboard', 'success');
        } else {
          showToast('Clipboard API not available in this browser', 'error');
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Copy failed', 'error');
      }
    },

    async onBatchExport() {
      if (!currentImage) return;
      const config = controls.getConfig();

      const presets = PLATFORM_PRESETS.filter((p) => p.id !== 'custom');
      const baseName = imageMeta?.name
        ? imageMeta.name.replace(/\.[^.]+$/, '')
        : 'pixdrip';

      showToast(`Exporting ${presets.length} sizes…`, 'info');

      let count = 0;
      const exportCanvas = document.createElement('canvas');
      for (const preset of presets) {
        const batchConfig = structuredClone(config);
        batchConfig.width = preset.width;
        batchConfig.height = preset.height;

        try {
          const blob = await exportToBlob(
            exportCanvas,
            currentImage,
            batchConfig,
            config.export.format,
            config.export.quality,
            config.export.scale ?? 2,
          );

          const ext = config.export.format.split('/')[1];
          const filename = `${baseName}-${preset.id}-${preset.width}x${preset.height}.${ext}`;

          downloadBlob(blob, filename);
          count++;
        } catch (err) {
          console.warn(`Batch export failed for ${preset.name}:`, err);
        }

        // Brief delay between downloads to avoid browser throttling
        await new Promise((r) => setTimeout(r, 200));
      }

      showToast(`Exported ${count} of ${presets.length} sizes`, 'success');
    },

    onNew() {
      clearTimeout(saveTimer);
      clearTimeout(sizeEstimateTimer);
      const sizeEl = document.getElementById('file-size-estimate');
      if (sizeEl) sizeEl.textContent = '—';
      currentImage = null;
      imageMeta = null;
      resetDropzone();
      resetSocialPreview();
      controls.setImageLoaded(false);
      controls.setConfig(structuredClone(DEFAULT_CONFIG));
      clearConfig();
      history.stack = [];
      history.index = -1;
    },
  });

  restoreConfig(controls);
  setupExportHandlers(controls, preview);
  setupKeyboardShortcuts(controls, preview);
  setupMobileSidebar();
  setupThemeToggle();
  setupFirstRunHint();
  setupServiceWorkerUpdates();
}

// ---------------------------------------------------------------------------
// Bulk export — drop multiple files, render each with current config, download
// ---------------------------------------------------------------------------

let _bulkOverlayEl = null;
function showBulkOverlay(text) {
  if (!_bulkOverlayEl) {
    _bulkOverlayEl = document.createElement('div');
    _bulkOverlayEl.id = 'bulk-overlay';
    _bulkOverlayEl.className = 'bulk-overlay';
    _bulkOverlayEl.setAttribute('role', 'status');
    _bulkOverlayEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(_bulkOverlayEl);
  }
  _bulkOverlayEl.textContent = text;
  _bulkOverlayEl.hidden = false;
}
function hideBulkOverlay() {
  if (_bulkOverlayEl) _bulkOverlayEl.hidden = true;
}

function loadFileAsImage(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) {
      reject(new Error(`Not an image: ${file.name || 'file'}`));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

async function bulkExportFiles(files, controls) {
  const list = Array.from(files);
  if (list.length === 0) return;

  showBulkOverlay(`${list.length} images queued — exporting with current settings…`);
  const config = controls.getConfig();
  const exportCanvas = document.createElement('canvas');
  let exported = 0;
  let skipped = 0;

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    showBulkOverlay(`Exporting ${i + 1} of ${list.length}…`);
    try {
      const img = await loadFileAsImage(file);
      const blob = await exportToBlob(
        exportCanvas,
        img,
        config,
        config.export.format,
        config.export.quality,
        config.export.scale ?? 2,
      );
      const actualMime = blob.type || config.export.format;
      const ext = (actualMime.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const baseName = (file.name || `pixdrip-${i + 1}`).replace(/\.[^.]+$/, '');
      const filename = `${baseName}-${config.width}x${config.height}.${ext}`;
      downloadBlob(blob, filename);
      exported++;
    } catch (err) {
      skipped++;
      console.warn('[pixdrip] bulk skip', file?.name, err);
    }
    // Yield to the main thread so the UI doesn't jank
    await new Promise((r) => setTimeout(r, 60));
  }

  hideBulkOverlay();
  if (exported > 0) {
    showToast(`Exported ${exported} image${exported === 1 ? '' : 's'}`, 'success');
  }
  if (skipped > 0) {
    showToast(`Skipped ${skipped} (decode failed)`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Theme toggle (dark/light) — persisted in localStorage. The initial theme is
// applied by an inline script in index.html before paint to avoid FOUC.
// ---------------------------------------------------------------------------

function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const icon = btn.querySelector('.theme-toggle-icon');

  const apply = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
  };

  // Sync icon to whatever the boot script already set
  apply(document.documentElement.getAttribute('data-theme') || 'dark');

  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    apply(next);
    try { localStorage.setItem('pixdrip:theme', next); } catch { /* */ }
  });
}

// ---------------------------------------------------------------------------
// First-run hint — shown once near the dropzone, dismissed on click or first
// image load.
// ---------------------------------------------------------------------------

const HINT_KEY = 'pixdrip:hint-dismissed';

function hideFirstRunHint() {
  const hint = document.getElementById('first-run-hint');
  if (hint) hint.hidden = true;
  try { localStorage.setItem(HINT_KEY, '1'); } catch { /* */ }
}

function setupFirstRunHint() {
  const hint = document.getElementById('first-run-hint');
  if (!hint) return;
  let dismissed = false;
  try { dismissed = localStorage.getItem(HINT_KEY) === '1'; } catch { /* */ }
  if (dismissed) return;
  hint.hidden = false;
  document.getElementById('first-run-hint-dismiss')?.addEventListener('click', () => {
    hideFirstRunHint();
  });
}

// ---------------------------------------------------------------------------
// Service worker — listen for updates, prompt the user to reload when a new SW
// is installed-and-waiting.
// ---------------------------------------------------------------------------

function setupServiceWorkerUpdates() {
  if (!('serviceWorker' in navigator)) return;

  // Track whether the user explicitly asked for an update reload. This
  // prevents reload loops on the very first install where `clients.claim()`
  // also fires `controllerchange`.
  let reloadOnControllerChange = false;

  // Register (or get existing). This is idempotent.
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    if (!registration) return;

    const promptUpdate = (worker) => {
      showToast('New version available — refresh to update', 'info', {
        duration: 0,
        action: {
          label: 'Reload',
          onClick: () => {
            reloadOnControllerChange = true;
            worker.postMessage({ type: 'SKIP_WAITING' });
          },
        },
      });
    };

    const armWorker = (worker) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          promptUpdate(worker);
        }
      });
    };

    if (registration.waiting && navigator.serviceWorker.controller) {
      promptUpdate(registration.waiting);
    }

    registration.addEventListener('updatefound', () => {
      armWorker(registration.installing);
    });
  }).catch(() => { /* best-effort */ });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadOnControllerChange) return;
    reloadOnControllerChange = false;
    window.location.reload();
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);