// ---------------------------------------------------------------------------
// pixdrip – sidebar control panel
// Reads/writes config state, renders dynamic content, emits change events.
// ---------------------------------------------------------------------------

import { clampInt } from '../utils/helpers.js';
import {
  PLATFORM_PRESETS,
  GRADIENT_PRESETS,
  DEFAULT_CONFIG,
  migrateConfig,
} from '../core/presets.js';
import { loadCustomPresets, saveCustomPreset, deleteCustomPreset } from '../utils/storage.js';

/**
 * Initialize controls — populate dynamic content, bind event listeners.
 * @param {Object} options
 * @param {Function} options.onChange  - callback(config) on any control change
 * @param {Function} options.onExport - callback() on export button click
 * @param {Function} options.onNew    - callback() on new/reset button click
 * @returns {{ getConfig: Function, setConfig: Function, setImageLoaded: Function }}
 */
export function initControls({ onChange, onExport, onCopy, onBatchExport, onNew }) {
  // ---- verify critical DOM refs ---------------------------------------------
  const requiredIds = ['preset-grid', 'ctrl-width', 'ctrl-height', 'ctrl-padding'];
  for (const id of requiredIds) {
    if (!document.getElementById(id)) {
      console.warn(`[pixdrip] Missing DOM element: #${id}`);
    }
  }

  // ---- internal state -------------------------------------------------------
  let config = structuredClone(DEFAULT_CONFIG);
  let ratioLocked = true;
  let aspectRatio = config.width / config.height;
  let activePresetId = 'og-facebook';

  // ---- cache DOM refs -------------------------------------------------------
  const dom = {
    presetGrid:     document.getElementById('preset-grid'),
    gradientGrid:   document.getElementById('gradient-presets'),
    width:          document.getElementById('ctrl-width'),
    height:         document.getElementById('ctrl-height'),
    lockRatio:      document.getElementById('btn-lock-ratio'),
    bgToggles:      document.querySelectorAll('.toggle-btn[data-bg-type]'),
    gradientAngleRow: document.getElementById('gradient-angle-row'),
    solidColorRow:  document.getElementById('solid-color-row'),
    bgColor:        document.getElementById('ctrl-bg-color'),
    gradientAngle:  document.getElementById('ctrl-gradient-angle'),
    valGradientAngle: document.getElementById('val-gradient-angle'),
    noiseToggle:    document.getElementById('ctrl-noise-toggle'),
    padding:        document.getElementById('ctrl-padding'),
    valPadding:     document.getElementById('val-padding'),
    radius:         document.getElementById('ctrl-radius'),
    valRadius:      document.getElementById('val-radius'),
    borderToggle:   document.getElementById('ctrl-border-toggle'),
    borderControls: document.getElementById('border-controls'),
    borderWidth:    document.getElementById('ctrl-border-width'),
    valBorderWidth: document.getElementById('val-border-width'),
    borderColor:    document.getElementById('ctrl-border-color'),
    shadowToggle:   document.getElementById('ctrl-shadow-toggle'),
    shadowControls: document.getElementById('shadow-controls'),
    shadowBlur:     document.getElementById('ctrl-shadow-blur'),
    valShadowBlur:  document.getElementById('val-shadow-blur'),
    shadowX:        document.getElementById('ctrl-shadow-x'),
    valShadowX:     document.getElementById('val-shadow-x'),
    shadowY:        document.getElementById('ctrl-shadow-y'),
    valShadowY:     document.getElementById('val-shadow-y'),
    shadowColor:    document.getElementById('ctrl-shadow-color'),
    shadowOpacity:  document.getElementById('ctrl-shadow-opacity'),
    valShadowOpacity: document.getElementById('val-shadow-opacity'),
    frameBtns:      document.querySelectorAll('.frame-btn[data-frame]'),
    textToggle:     document.getElementById('ctrl-text-toggle'),
    textControls:   document.getElementById('text-controls'),
    textContent:    document.getElementById('ctrl-text-content'),
    textSize:       document.getElementById('ctrl-text-size'),
    valTextSize:    document.getElementById('val-text-size'),
    textWeight:     document.getElementById('ctrl-text-weight'),
    textPosition:   document.getElementById('ctrl-text-position'),
    textColor:      document.getElementById('ctrl-text-color'),
    textOpacity:    document.getElementById('ctrl-text-opacity'),
    valTextOpacity: document.getElementById('val-text-opacity'),
    format:         document.getElementById('ctrl-format'),
    qualityRow:     document.getElementById('quality-row'),
    quality:        document.getElementById('ctrl-quality'),
    valQuality:     document.getElementById('val-quality'),
    scale:          document.getElementById('ctrl-scale'),
    btnExport:      document.getElementById('btn-export'),
    btnCopy:        document.getElementById('btn-copy'),
    btnBatch:       document.getElementById('btn-batch-export'),
    btnNew:         document.getElementById('btn-new'),
    gradientStop1:  document.getElementById('ctrl-gradient-stop1'),
    gradientStop2:  document.getElementById('ctrl-gradient-stop2'),
    tiltToggle:     document.getElementById('ctrl-tilt-toggle'),
    tiltControls:   document.getElementById('tilt-controls'),
    tiltX:          document.getElementById('ctrl-tilt-x'),
    valTiltX:       document.getElementById('val-tilt-x'),
    tiltY:          document.getElementById('ctrl-tilt-y'),
    valTiltY:       document.getElementById('val-tilt-y'),
    customPresetGrid: document.getElementById('custom-preset-grid'),
    customPresetName: document.getElementById('custom-preset-name'),
    btnSavePreset:  document.getElementById('btn-save-preset'),
    filterBrightness: document.getElementById('ctrl-filter-brightness'),
    valFilterBrightness: document.getElementById('val-filter-brightness'),
    filterContrast: document.getElementById('ctrl-filter-contrast'),
    valFilterContrast: document.getElementById('val-filter-contrast'),
    filterSaturation: document.getElementById('ctrl-filter-saturation'),
    valFilterSaturation: document.getElementById('val-filter-saturation'),
    filterBlur: document.getElementById('ctrl-filter-blur'),
    valFilterBlur: document.getElementById('val-filter-blur'),
  };

  // ---- helpers --------------------------------------------------------------

  function emit() {
    onChange(config); // pass reference directly — onChange should not mutate
  }

  function truncate(str, max = 8) {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  /** Set a range value display span. */
  function showVal(span, value, unit) {
    if (span) span.textContent = `${value}${unit}`;
  }

  /** Sync all value display spans to current config. */
  function syncValueDisplays() {
    showVal(dom.valPadding, config.padding, 'px');
    showVal(dom.valRadius, config.borderRadius, 'px');
    showVal(dom.valBorderWidth, config.border.width, 'px');
    showVal(dom.valShadowBlur, config.shadow.blur, 'px');
    showVal(dom.valShadowX, config.shadow.x, 'px');
    showVal(dom.valShadowY, config.shadow.y, 'px');
    showVal(dom.valShadowOpacity, Math.round(config.shadow.opacity * 100), '%');
    showVal(dom.valQuality, Math.round(config.export.quality * 100), '%');
    showVal(dom.valGradientAngle, config.background.gradient?.angle ?? 135, '°');
    if (config.text) {
      showVal(dom.valTextSize, config.text.fontSize, 'px');
      showVal(dom.valTextOpacity, Math.round((config.text.opacity ?? 1) * 100), '%');
    }
    if (config.tilt) {
      showVal(dom.valTiltX, config.tilt.x ?? 0, '°');
      showVal(dom.valTiltY, config.tilt.y ?? 0, '°');
    }
    if (config.filters) {
      showVal(dom.valFilterBrightness, config.filters.brightness ?? 100, '%');
      showVal(dom.valFilterContrast, config.filters.contrast ?? 100, '%');
      showVal(dom.valFilterSaturation, config.filters.saturation ?? 100, '%');
      showVal(dom.valFilterBlur, config.filters.blur ?? 0, 'px');
    }
  }

  /** Update all input elements to reflect current config (no emit). */
  function syncInputs() {
    dom.width.value = config.width;
    dom.height.value = config.height;

    // Background type toggle
    dom.bgToggles.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.bgType === config.background.type);
    });
    const isGradient = config.background.type === 'gradient';
    const isTransparent = config.background.type === 'transparent';
    dom.gradientGrid.classList.toggle('hidden', !isGradient);
    dom.gradientAngleRow.classList.toggle('hidden', !isGradient);
    dom.solidColorRow.classList.toggle('hidden', isGradient || isTransparent);

    dom.bgColor.value = config.background.color;
    dom.gradientAngle.value = config.background.gradient?.angle ?? 135;

    // Noise
    if (dom.noiseToggle) {
      dom.noiseToggle.checked = config.background.noise || false;
    }

    dom.padding.value = config.padding;
    dom.radius.value = config.borderRadius;

    // Border
    dom.borderToggle.checked = config.border.enabled;
    dom.borderControls.classList.toggle('hidden', !config.border.enabled);
    dom.borderWidth.value = config.border.width;
    dom.borderColor.value = config.border.color;

    // Shadow
    dom.shadowToggle.checked = config.shadow.enabled;
    dom.shadowControls.classList.toggle('hidden', !config.shadow.enabled);
    dom.shadowBlur.value = config.shadow.blur;
    dom.shadowX.value = config.shadow.x;
    dom.shadowY.value = config.shadow.y;
    dom.shadowColor.value = config.shadow.color;
    dom.shadowOpacity.value = Math.round(config.shadow.opacity * 100);

    // Frame style
    const frameStyle = config.frameStyle ?? 'none';
    dom.frameBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.frame === frameStyle);
    });

    // Text overlay
    if (config.text) {
      dom.textToggle.checked = config.text.enabled;
      dom.textControls.classList.toggle('hidden', !config.text.enabled);
      dom.textContent.value = config.text.content || '';
      dom.textSize.value = config.text.fontSize;
      dom.textWeight.value = config.text.fontWeight;
      dom.textPosition.value = config.text.position;
      dom.textColor.value = config.text.color;
      dom.textOpacity.value = Math.round((config.text.opacity ?? 1) * 100);
    }

    // Export
    dom.format.value = config.export.format;
    dom.quality.value = Math.round(config.export.quality * 100);
    dom.qualityRow.classList.toggle('hidden', config.export.format === 'image/png');
    if (dom.scale) dom.scale.value = config.export.scale ?? 2;

    // Gradient custom color pickers
    if (dom.gradientStop1) dom.gradientStop1.value = config.background.gradient?.stops?.[0] ?? '#ff6b4a';
    if (dom.gradientStop2) dom.gradientStop2.value = config.background.gradient?.stops?.[1] ?? '#fbbf24';

    // Tilt
    if (config.tilt) {
      if (dom.tiltToggle) dom.tiltToggle.checked = config.tilt.enabled;
      if (dom.tiltControls) dom.tiltControls.classList.toggle('hidden', !config.tilt.enabled);
      if (dom.tiltX) dom.tiltX.value = config.tilt.x ?? 0;
      if (dom.tiltY) dom.tiltY.value = config.tilt.y ?? 0;
    }

    // Filters
    if (config.filters) {
      if (dom.filterBrightness) dom.filterBrightness.value = config.filters.brightness ?? 100;
      if (dom.filterContrast) dom.filterContrast.value = config.filters.contrast ?? 100;
      if (dom.filterSaturation) dom.filterSaturation.value = config.filters.saturation ?? 100;
      if (dom.filterBlur) dom.filterBlur.value = config.filters.blur ?? 0;
    }

    // Lock ratio visual
    dom.lockRatio.classList.toggle('active', ratioLocked);

    syncValueDisplays();
    syncPresetActive();
    syncGradientActive();
  }

  // ---- preset grid ----------------------------------------------------------

  function syncPresetActive() {
    dom.presetGrid.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.presetId === activePresetId);
    });
  }

  function buildPresetGrid() {
    dom.presetGrid.innerHTML = '';
    PLATFORM_PRESETS.forEach((preset) => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn';
      btn.dataset.presetId = preset.id;
      btn.innerHTML = `<span class="preset-icon">${preset.icon}</span><span class="preset-name">${truncate(preset.name)}</span>`;
      btn.addEventListener('click', () => applyPlatformPreset(preset));
      dom.presetGrid.appendChild(btn);
    });
  }

  function applyPlatformPreset(preset) {
    activePresetId = preset.id;
    config.width = preset.width;
    config.height = preset.height;
    aspectRatio = config.width / config.height;

    const d = preset.defaults;
    config.padding = d.padding;
    config.borderRadius = d.borderRadius;
    config.shadow = { ...d.shadow };
    config.border = { ...d.border };
    config.frameStyle = 'none';
    config.imageOffset = { x: 0, y: 0, zoom: 1 };

    // Apply gradient preset if specified
    if (d.background.type === 'gradient' && d.background.preset != null) {
      const gp = GRADIENT_PRESETS[d.background.preset];
      if (gp) {
        config.background.type = 'gradient';
        config.background.gradient = { stops: [...gp.stops], angle: gp.angle };
      }
    } else if (d.background.type === 'solid') {
      config.background.type = 'solid';
    }

    syncInputs();
    emit();
  }

  // ---- gradient grid --------------------------------------------------------

  function syncGradientActive() {
    dom.gradientGrid.querySelectorAll('.gradient-swatch').forEach((btn) => {
      const idx = Number(btn.dataset.gradientIdx);
      const gp = GRADIENT_PRESETS[idx];
      const active =
        gp &&
        config.background.gradient?.stops?.[0] === gp.stops[0] &&
        config.background.gradient?.stops?.[1] === gp.stops[1];
      btn.classList.toggle('active', active);
    });
  }

  function buildGradientGrid() {
    dom.gradientGrid.innerHTML = '';
    GRADIENT_PRESETS.forEach((gp, idx) => {
      const btn = document.createElement('button');
      btn.className = 'gradient-swatch';
      btn.dataset.gradientIdx = idx;
      btn.style.background = `linear-gradient(135deg, ${gp.stops[0]}, ${gp.stops[1]})`;
      btn.title = gp.name;
      btn.addEventListener('click', () => {
        config.background.gradient.stops = [...gp.stops];
        config.background.gradient.angle = Number(dom.gradientAngle.value);
        syncGradientActive();
        emit();
      });
      dom.gradientGrid.appendChild(btn);
    });
  }

  // ---- bind controls --------------------------------------------------------

  function bindCanvasSize() {
    dom.width.addEventListener('change', () => {
      config.width = clampInt(dom.width.value, 100, 4096);
      dom.width.value = config.width;
      if (ratioLocked) {
        config.height = clampInt(Math.round(config.width / aspectRatio), 100, 4096);
        dom.height.value = config.height;
      }
      activePresetId = null;
      syncPresetActive();
      emit();
    });

    dom.height.addEventListener('change', () => {
      config.height = clampInt(dom.height.value, 100, 4096);
      dom.height.value = config.height;
      if (ratioLocked) {
        config.width = clampInt(Math.round(config.height * aspectRatio), 100, 4096);
        dom.width.value = config.width;
      }
      activePresetId = null;
      syncPresetActive();
      emit();
    });

    dom.lockRatio.addEventListener('click', () => {
      ratioLocked = !ratioLocked;
      dom.lockRatio.classList.toggle('active', ratioLocked);
      if (ratioLocked) {
        aspectRatio = config.width / config.height;
      }
    });
  }

  function bindBackgroundType() {
    dom.bgToggles.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.bgType;
        config.background.type = type;
        dom.bgToggles.forEach((b) => b.classList.toggle('active', b === btn));
        const isGradient = type === 'gradient';
        const isTransparent = type === 'transparent';
        dom.gradientGrid.classList.toggle('hidden', !isGradient);
        dom.gradientAngleRow.classList.toggle('hidden', !isGradient);
        dom.solidColorRow.classList.toggle('hidden', isGradient || isTransparent);
        emit();
      });
    });

    dom.bgColor.addEventListener('change', () => {
      config.background.color = dom.bgColor.value;
      emit();
    });

    dom.gradientAngle.addEventListener('input', () => {
      config.background.gradient.angle = Number(dom.gradientAngle.value);
      showVal(dom.valGradientAngle, dom.gradientAngle.value, '°');
      emit();
    });

    if (dom.gradientStop1) {
      dom.gradientStop1.addEventListener('input', () => {
        config.background.gradient.stops[0] = dom.gradientStop1.value;
        syncGradientActive();
        emit();
      });
    }
    if (dom.gradientStop2) {
      dom.gradientStop2.addEventListener('input', () => {
        config.background.gradient.stops[1] = dom.gradientStop2.value;
        syncGradientActive();
        emit();
      });
    }
  }

  function bindSlider(el, valSpan, unit, setter) {
    el.addEventListener('input', () => {
      const v = Number(el.value);
      setter(v);
      showVal(valSpan, v, unit);
      emit();
    });
  }

  function bindBorder() {
    dom.borderToggle.addEventListener('click', () => {
      config.border.enabled = dom.borderToggle.checked;
      dom.borderControls.classList.toggle('hidden', !config.border.enabled);
      emit();
    });

    bindSlider(dom.borderWidth, dom.valBorderWidth, 'px', (v) => {
      config.border.width = v;
    });

    dom.borderColor.addEventListener('change', () => {
      config.border.color = dom.borderColor.value;
      emit();
    });
  }

  function bindShadow() {
    dom.shadowToggle.addEventListener('click', () => {
      config.shadow.enabled = dom.shadowToggle.checked;
      dom.shadowControls.classList.toggle('hidden', !config.shadow.enabled);
      emit();
    });

    bindSlider(dom.shadowBlur, dom.valShadowBlur, 'px', (v) => {
      config.shadow.blur = v;
    });
    bindSlider(dom.shadowX, dom.valShadowX, 'px', (v) => {
      config.shadow.x = v;
    });
    bindSlider(dom.shadowY, dom.valShadowY, 'px', (v) => {
      config.shadow.y = v;
    });
    bindSlider(dom.shadowOpacity, dom.valShadowOpacity, '%', (v) => {
      config.shadow.opacity = v / 100;
    });

    dom.shadowColor.addEventListener('change', () => {
      config.shadow.color = dom.shadowColor.value;
      emit();
    });
  }

  function bindFrame() {
    dom.frameBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const style = btn.dataset.frame;
        config.frameStyle = style;
        dom.frameBtns.forEach((b) => b.classList.toggle('active', b === btn));
        emit();
      });
    });
  }

  function bindNoise() {
    if (!dom.noiseToggle) return;
    dom.noiseToggle.addEventListener('click', () => {
      config.background.noise = dom.noiseToggle.checked;
      emit();
    });
  }

  function bindText() {
    // Ensure config.text exists
    if (!config.text) {
      config.text = { enabled: false, content: '', fontSize: 32, fontWeight: '600', color: '#ffffff', position: 'top', opacity: 1 };
    }

    dom.textToggle.addEventListener('click', () => {
      config.text.enabled = dom.textToggle.checked;
      dom.textControls.classList.toggle('hidden', !config.text.enabled);
      emit();
    });

    dom.textContent.addEventListener('input', () => {
      config.text.content = dom.textContent.value;
      emit();
    });

    bindSlider(dom.textSize, dom.valTextSize, 'px', (v) => {
      config.text.fontSize = v;
    });

    dom.textWeight.addEventListener('change', () => {
      config.text.fontWeight = dom.textWeight.value;
      emit();
    });

    dom.textPosition.addEventListener('change', () => {
      config.text.position = dom.textPosition.value;
      emit();
    });

    dom.textColor.addEventListener('change', () => {
      config.text.color = dom.textColor.value;
      emit();
    });

    bindSlider(dom.textOpacity, dom.valTextOpacity, '%', (v) => {
      config.text.opacity = v / 100;
    });
  }

  function bindTilt() {
    if (!config.tilt) {
      config.tilt = { enabled: false, x: 0, y: 0 };
    }

    if (dom.tiltToggle) {
      dom.tiltToggle.addEventListener('click', () => {
        config.tilt.enabled = dom.tiltToggle.checked;
        if (dom.tiltControls) dom.tiltControls.classList.toggle('hidden', !config.tilt.enabled);
        emit();
      });
    }

    if (dom.tiltX) {
      bindSlider(dom.tiltX, dom.valTiltX, '°', (v) => {
        config.tilt.x = v;
      });
    }

    if (dom.tiltY) {
      bindSlider(dom.tiltY, dom.valTiltY, '°', (v) => {
        config.tilt.y = v;
      });
    }
  }

  function bindFilters() {
    if (!config.filters) {
      config.filters = { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
    }

    if (dom.filterBrightness) {
      bindSlider(dom.filterBrightness, dom.valFilterBrightness, '%', (v) => {
        config.filters.brightness = v;
      });
    }
    if (dom.filterContrast) {
      bindSlider(dom.filterContrast, dom.valFilterContrast, '%', (v) => {
        config.filters.contrast = v;
      });
    }
    if (dom.filterSaturation) {
      bindSlider(dom.filterSaturation, dom.valFilterSaturation, '%', (v) => {
        config.filters.saturation = v;
      });
    }
    if (dom.filterBlur) {
      dom.filterBlur.addEventListener('input', () => {
        const v = Number(dom.filterBlur.value);
        config.filters.blur = v;
        showVal(dom.valFilterBlur, v, 'px');
        emit();
      });
    }
  }

  function bindExport() {
    dom.format.addEventListener('change', () => {
      config.export.format = dom.format.value;
      dom.qualityRow.classList.toggle('hidden', dom.format.value === 'image/png');
      emit();
    });

    bindSlider(dom.quality, dom.valQuality, '%', (v) => {
      config.export.quality = v / 100;
    });

    if (dom.scale) {
      dom.scale.addEventListener('change', () => {
        config.export.scale = Number(dom.scale.value);
        emit();
      });
    }

    dom.btnExport.addEventListener('click', () => onExport());
    dom.btnNew.addEventListener('click', () => onNew());
    if (dom.btnCopy) dom.btnCopy.addEventListener('click', () => onCopy());
    if (dom.btnBatch) dom.btnBatch.addEventListener('click', () => onBatchExport());
  }

  // ---- utility --------------------------------------------------------------



  // ---- public API -----------------------------------------------------------

  function getConfig() {
    return structuredClone(config);
  }

  function setConfig(newConfig, { silent = false } = {}) {
    config = structuredClone(newConfig);
    migrateConfig(config);
    aspectRatio = config.width / config.height;

    // Try to restore activePresetId from matching preset
    const match = PLATFORM_PRESETS.find(
      (p) => p.width === config.width && p.height === config.height,
    );
    activePresetId = match ? match.id : null;

    syncInputs();
    if (!silent) emit();
  }

  // ---- init -----------------------------------------------------------------

  function buildCustomPresetGrid() {
    if (!dom.customPresetGrid) return;
    dom.customPresetGrid.innerHTML = '';
    const presets = loadCustomPresets();

    if (presets.length === 0) {
      dom.customPresetGrid.innerHTML = '<span class="custom-preset-empty">No saved presets yet</span>';
      return;
    }

    presets.forEach((preset) => {
      const btn = document.createElement('button');
      btn.className = 'preset-btn custom-preset-btn';
      btn.dataset.customPresetId = preset.id;
      btn.innerHTML = `<span class="preset-icon">💾</span><span class="preset-name">${truncate(preset.name)}</span>`;
      btn.title = preset.name;
      btn.addEventListener('click', () => {
        config = structuredClone(preset.config);
        aspectRatio = config.width / config.height;
        activePresetId = null;
        syncInputs();
        emit();
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (confirm(`Delete preset "${preset.name}"?`)) {
          deleteCustomPreset(preset.id);
          buildCustomPresetGrid();
        }
      });

      dom.customPresetGrid.appendChild(btn);
    });
  }

  function bindCustomPresets() {
    if (!dom.btnSavePreset) return;
    dom.btnSavePreset.addEventListener('click', () => {
      const name = dom.customPresetName?.value.trim();
      if (!name) return;

      const preset = {
        id: `custom-${Date.now()}`,
        name,
        config: structuredClone(config),
      };
      saveCustomPreset(preset);
      dom.customPresetName.value = '';
      buildCustomPresetGrid();
    });

    dom.customPresetName?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') dom.btnSavePreset.click();
    });
  }

  buildPresetGrid();
  buildCustomPresetGrid();
  bindCustomPresets();
  buildGradientGrid();
  bindCanvasSize();
  bindBackgroundType();
  bindSlider(dom.padding, dom.valPadding, 'px', (v) => { config.padding = v; });
  bindSlider(dom.radius, dom.valRadius, 'px', (v) => { config.borderRadius = v; });
  bindBorder();
  bindShadow();
  bindFrame();
  bindNoise();
  bindText();
  bindTilt();
  bindFilters();
  bindExport();
  syncInputs();

  function setImageLoaded(loaded) {
    dom.btnExport.disabled = !loaded;
    if (dom.btnCopy) dom.btnCopy.disabled = !loaded;
    if (dom.btnBatch) dom.btnBatch.disabled = !loaded;
  }

  return { getConfig, setConfig, setImageLoaded };
}