import { render } from '../core/renderer.js';

/**
 * Initialize the preview system with drag-to-reposition and scroll-to-zoom.
 * @param {HTMLCanvasElement} canvas
 * @returns {{ updatePreview: Function, setOnOffsetChange: Function }}
 */
export function initPreview(canvas) {
  let currentImage = null;
  let currentConfig = null;
  let onOffsetChange = null;

  // Drag state
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;
  let displayScale = 1;

  // Cached DOM refs
  const canvasArea = document.querySelector('.canvas-area');
  let cachedAreaWidth = 0;
  let cachedAreaHeight = 0;

  // Single RAF-batched render scheduler
  let _pendingRender = false;
  function scheduleRender() {
    if (_pendingRender) return;
    _pendingRender = true;
    requestAnimationFrame(() => {
      _pendingRender = false;
      if (currentImage && currentConfig) {
        render(canvas, currentImage, currentConfig, window.devicePixelRatio || 1);
        fitCanvasToViewport(canvas, currentConfig);
        if (comparisonActive) renderOriginal();
      }
    });
  }

  function updatePreview(image, config) {
    currentImage = image;
    currentConfig = config;
    scheduleRender();
  }

  function fitCanvasToViewport(canvas, config) {
    if (!canvasArea) return;

    const areaW = canvasArea.clientWidth;
    const areaH = canvasArea.clientHeight;
    if (areaW !== cachedAreaWidth || areaH !== cachedAreaHeight) {
      cachedAreaWidth = areaW;
      cachedAreaHeight = areaH;
    }

    const maxW = cachedAreaWidth * 0.85;
    const maxH = cachedAreaHeight * 0.85;

    displayScale = Math.min(maxW / config.width, maxH / config.height, 1);
    canvas.style.width = `${config.width * displayScale}px`;
    canvas.style.height = `${config.height * displayScale}px`;
  }

  // Invalidate cached area dimensions on resize
  window.addEventListener('resize', () => {
    cachedAreaWidth = 0;
    cachedAreaHeight = 0;
  });

  // Drag to reposition image within frame
  canvas.addEventListener('mousedown', (e) => {
    if (!currentImage || !currentConfig) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    startOffsetX = currentConfig.imageOffset?.x ?? 0;
    startOffsetY = currentConfig.imageOffset?.y ?? 0;
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentConfig) return;
    const scale = displayScale || 1;
    const dx = (e.clientX - dragStartX) / scale;
    const dy = (e.clientY - dragStartY) / scale;
    const newOffset = {
      x: startOffsetX + dx,
      y: startOffsetY + dy,
      zoom: currentConfig.imageOffset?.zoom ?? 1,
    };
    currentConfig = { ...currentConfig, imageOffset: newOffset };
    scheduleRender();
    if (onOffsetChange) onOffsetChange(newOffset);
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = 'grab';
    }
  });

  // Scroll to zoom
  canvas.addEventListener('wheel', (e) => {
    if (!currentImage || !currentConfig) return;
    e.preventDefault();
    const currentZoom = currentConfig.imageOffset?.zoom ?? 1;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(0.5, Math.min(3, currentZoom + delta));
    const newOffset = {
      x: currentConfig.imageOffset?.x ?? 0,
      y: currentConfig.imageOffset?.y ?? 0,
      zoom: newZoom,
    };
    currentConfig = { ...currentConfig, imageOffset: newOffset };
    scheduleRender();
    if (onOffsetChange) onOffsetChange(newOffset);
  }, { passive: false });

  // Set default cursor on canvas
  canvas.style.cursor = 'grab';

  function setOnOffsetChange(cb) {
    onOffsetChange = cb;
  }

  // ── Before/After comparison ─────────────────────────────────────────
  let comparisonActive = false;
  let comparisonPosition = 50;

  const comparisonOverlay = document.createElement('div');
  comparisonOverlay.className = 'comparison-overlay hidden';

  const comparisonOriginal = document.createElement('canvas');
  comparisonOriginal.className = 'comparison-original';

  const comparisonSlider = document.createElement('div');
  comparisonSlider.className = 'comparison-slider';
  comparisonSlider.innerHTML = '<div class="comparison-handle"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3l-5 9 5 9M16 3l5 9-5 9"/></svg></div>';

  const comparisonLabel = document.createElement('div');
  comparisonLabel.className = 'comparison-labels';
  comparisonLabel.innerHTML = '<span class="comparison-label-before">Original</span><span class="comparison-label-after">Beautified</span>';

  comparisonOverlay.appendChild(comparisonOriginal);
  comparisonOverlay.appendChild(comparisonSlider);
  comparisonOverlay.appendChild(comparisonLabel);

  canvas.parentElement.appendChild(comparisonOverlay);

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn-comparison';
  toggleBtn.type = 'button';
  toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3l-5 9 5 9M16 3l5 9-5 9"/></svg> Compare';
  toggleBtn.title = 'Toggle before/after comparison';
  toggleBtn.setAttribute('aria-label', 'Toggle before/after comparison');
  canvas.parentElement.appendChild(toggleBtn);

  toggleBtn.addEventListener('click', () => {
    if (!currentImage) return;
    comparisonActive = !comparisonActive;
    toggleBtn.classList.toggle('active', comparisonActive);
    comparisonOverlay.classList.toggle('hidden', !comparisonActive);
    if (comparisonActive) renderOriginal();
  });

  function renderOriginal() {
    if (!currentImage) return;
    const displayW = parseFloat(canvas.style.width) || canvas.offsetWidth;
    const displayH = parseFloat(canvas.style.height) || canvas.offsetHeight;
    comparisonOriginal.width = Math.round(displayW);
    comparisonOriginal.height = Math.round(displayH);
    comparisonOriginal.style.width = canvas.style.width;
    comparisonOriginal.style.height = canvas.style.height;
    const ctx = comparisonOriginal.getContext('2d');
    ctx.drawImage(currentImage, 0, 0, comparisonOriginal.width, comparisonOriginal.height);
    updateSliderPosition();
  }

  function updateSliderPosition() {
    const pct = comparisonPosition;
    comparisonOriginal.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    comparisonSlider.style.left = `${pct}%`;
  }

  let isDraggingSlider = false;
  comparisonSlider.addEventListener('mousedown', (e) => {
    isDraggingSlider = true;
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDraggingSlider) return;
    const rect = comparisonOverlay.getBoundingClientRect();
    comparisonPosition = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    updateSliderPosition();
  });

  document.addEventListener('mouseup', () => {
    isDraggingSlider = false;
  });

  return { updatePreview, setOnOffsetChange };
}