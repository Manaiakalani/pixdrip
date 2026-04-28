import { initDropzone, resetDropzone } from './ui/dropzone.js';
import { initControls } from './ui/controls.js';
import { initPreview } from './ui/preview.js';
import { exportToBlob } from './core/renderer.js';
import { DEFAULT_CONFIG, PLATFORM_PRESETS } from './core/presets.js';
import { saveConfig, loadConfig, clearConfig } from './utils/storage.js';
import { deepMerge, downloadBlob } from './utils/helpers.js';
import { showToast } from './ui/toast.js';
import { initSocialPreview, updateSocialPreview, resetSocialPreview } from './ui/social-preview.js';

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
    },
    onError(message) {
      showToast(message, 'error');
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

        const ext = config.export.format.split('/')[1];
        const baseName = imageMeta?.name
          ? imageMeta.name.replace(/\.[^.]+$/, '')
          : 'pixdrip';
        const filename = `${baseName}-${config.width}x${config.height}.${ext}`;

        downloadBlob(blob, filename);
        showToast(`Exported ${filename}`, 'success');
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
}

// Boot
document.addEventListener('DOMContentLoaded', init);