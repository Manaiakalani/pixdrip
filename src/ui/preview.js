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

  // Drag state (pointer events — works for mouse, pen, and touch)
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;
  let displayScale = 1;
  let activePointerId = null;

  // Multi-touch (pinch) state
  const activePointers = new Map(); // pointerId -> { x, y }
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;
  let isPinching = false;

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

  // Drag to reposition + pinch to zoom (Pointer Events: mouse + touch + pen)
  const clampZoom = (z) => Math.max(0.5, Math.min(3, z));

  function pinchDistance() {
    const pts = [...activePointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.hypot(dx, dy);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!currentImage || !currentConfig) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 1) {
      isDragging = true;
      isPinching = false;
      activePointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startOffsetX = currentConfig.imageOffset?.x ?? 0;
      startOffsetY = currentConfig.imageOffset?.y ?? 0;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (e.pointerType === 'mouse') canvas.style.cursor = 'grabbing';
    } else if (activePointers.size === 2) {
      isDragging = false;
      isPinching = true;
      pinchStartDistance = pinchDistance();
      pinchStartZoom = currentConfig.imageOffset?.zoom ?? 1;
    }
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!currentConfig) return;
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (isPinching && activePointers.size >= 2) {
      const dist = pinchDistance();
      if (pinchStartDistance > 0) {
        const ratio = dist / pinchStartDistance;
        const newZoom = clampZoom(pinchStartZoom * ratio);
        const newOffset = {
          x: currentConfig.imageOffset?.x ?? 0,
          y: currentConfig.imageOffset?.y ?? 0,
          zoom: newZoom,
        };
        currentConfig = { ...currentConfig, imageOffset: newOffset };
        scheduleRender();
        if (onOffsetChange) onOffsetChange(newOffset);
      }
      e.preventDefault();
      return;
    }

    if (isDragging && e.pointerId === activePointerId) {
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
      e.preventDefault();
    }
  });

  function endPointer(e) {
    activePointers.delete(e.pointerId);
    try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    if (e.pointerId === activePointerId) {
      isDragging = false;
      activePointerId = null;
      canvas.style.cursor = 'grab';
    }
    if (activePointers.size < 2) {
      isPinching = false;
    }
    if (activePointers.size === 1 && currentConfig) {
      // Resume drag with the remaining pointer
      const [[id, pt]] = activePointers.entries();
      activePointerId = id;
      isDragging = true;
      dragStartX = pt.x;
      dragStartY = pt.y;
      startOffsetX = currentConfig.imageOffset?.x ?? 0;
      startOffsetY = currentConfig.imageOffset?.y ?? 0;
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.buttons === 0) endPointer(e);
  });

  // Scroll to zoom (mouse wheel + trackpad pinch — dispatches wheel)
  canvas.addEventListener('wheel', (e) => {
    if (!currentImage || !currentConfig) return;
    e.preventDefault();
    const currentZoom = currentConfig.imageOffset?.zoom ?? 1;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = clampZoom(currentZoom + delta);
    const newOffset = {
      x: currentConfig.imageOffset?.x ?? 0,
      y: currentConfig.imageOffset?.y ?? 0,
      zoom: newZoom,
    };
    currentConfig = { ...currentConfig, imageOffset: newOffset };
    scheduleRender();
    if (onOffsetChange) onOffsetChange(newOffset);
  }, { passive: false });

  // Suppress browser pan/zoom while interacting with the canvas
  canvas.style.touchAction = 'none';

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
  let sliderPointerId = null;
  comparisonSlider.addEventListener('pointerdown', (e) => {
    isDraggingSlider = true;
    sliderPointerId = e.pointerId;
    try { comparisonSlider.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  });

  comparisonSlider.addEventListener('pointermove', (e) => {
    if (!isDraggingSlider || e.pointerId !== sliderPointerId) return;
    const rect = comparisonOverlay.getBoundingClientRect();
    comparisonPosition = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    updateSliderPosition();
  });

  const endSlider = (e) => {
    if (e.pointerId === sliderPointerId) {
      isDraggingSlider = false;
      sliderPointerId = null;
      try { comparisonSlider.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    }
  };
  comparisonSlider.addEventListener('pointerup', endSlider);
  comparisonSlider.addEventListener('pointercancel', endSlider);
  comparisonSlider.style.touchAction = 'none';

  return { updatePreview, setOnOffsetChange };
}