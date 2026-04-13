// ---------------------------------------------------------------------------
// dropzone.js – Image ingestion: drag-and-drop, file picker, paste, URL
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const SUPPORTED_MIME_RE = /^image\//;
const UNSUPPORTED_MSG = 'Unsupported file format. Please use PNG, JPG, WebP, GIF, SVG, or BMP.';

let _onImageLoad;
let _onError;
let _dropzone;
let _previewArea;

// ── public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the dropzone module.
 * @param {Object}   opts
 * @param {Function} opts.onImageLoad - callback(image: HTMLImageElement, meta)
 * @param {Function} opts.onError     - callback(message: string)
 */
export function initDropzone({ onImageLoad, onError }) {
  _onImageLoad = onImageLoad;
  _onError = onError;

  _dropzone = document.getElementById('dropzone');
  _previewArea = document.getElementById('preview-area');

  const btnBrowse = document.getElementById('btn-browse');
  const fileInput = document.getElementById('file-input');
  const inputUrl = document.getElementById('input-url');
  const btnUrl = document.getElementById('btn-url');

  // 1. Drag & drop on #dropzone
  setupDropTarget(_dropzone);

  // 2. File picker
  btnBrowse.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleFile(fileInput.files[0]);
      fileInput.value = '';
    }
  });

  // 3. Clipboard paste (document-level)
  document.addEventListener('paste', handlePaste);

  // 4. URL input
  inputUrl.addEventListener('input', () => {
    btnUrl.disabled = !inputUrl.value.trim();
  });
  btnUrl.addEventListener('click', () => submitUrl(inputUrl));
  inputUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitUrl(inputUrl);
  });

  // 5. Body-level drop so users can replace an image while preview is showing
  setupBodyDrop();
}

/**
 * Reset – show the dropzone, hide the preview area.
 */
export function resetDropzone() {
  _dropzone.classList.remove('hidden');
  _previewArea.classList.add('hidden');
  const urlInput = document.getElementById('input-url');
  if (urlInput) urlInput.value = '';
  const btnUrl = document.getElementById('btn-url');
  if (btnUrl) btnUrl.disabled = true;
}

// ── drag & drop ─────────────────────────────────────────────────────────────

const preventDefaults = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

/** Extract the first file from a DataTransfer and hand it to handleFile. */
const processDroppedFile = (dataTransfer) => {
  const file = dataTransfer?.files[0];
  if (file) handleFile(file);
};

const setupDropTarget = (el) => {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) =>
    el.addEventListener(evt, preventDefaults),
  );

  el.addEventListener('dragenter', () => el.classList.add('dropzone--active'));
  el.addEventListener('dragover', () => el.classList.add('dropzone--active'));
  el.addEventListener('dragleave', () => el.classList.remove('dropzone--active'));
  el.addEventListener('drop', (e) => {
    el.classList.remove('dropzone--active');
    processDroppedFile(e.dataTransfer);
  });
};

const setupBodyDrop = () => {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) =>
    document.body.addEventListener(evt, preventDefaults),
  );

  document.body.addEventListener('drop', (e) => {
    processDroppedFile(e.dataTransfer);
  });
};

// ── clipboard paste ─────────────────────────────────────────────────────────

const handlePaste = (e) => {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') && active.id !== 'input-url') return;

  const items = e.clipboardData?.items;
  if (!items) return;

  // Look for an image item first
  for (const item of items) {
    if (SUPPORTED_MIME_RE.test(item.type)) {
      e.preventDefault();
      const blob = item.getAsFile();
      if (blob) loadImageFromFile(blob);
      return;
    }
  }

  // Fall back: check for pasted text that looks like a URL
  const text = e.clipboardData?.getData('text/plain')?.trim();
  if (text && /^https?:\/\//i.test(text)) {
    e.preventDefault();
    loadImageFromUrl(text);
  }
};

// ── URL input ───────────────────────────────────────────────────────────────

const submitUrl = (inputEl) => {
  const url = inputEl.value.trim();
  if (!url) return;
  const btnUrl = document.getElementById('btn-url');
  if (btnUrl) { btnUrl.textContent = 'Loading…'; btnUrl.disabled = true; }
  loadImageFromUrl(url).finally(() => {
    if (btnUrl) { btnUrl.textContent = 'Go'; btnUrl.disabled = !inputEl.value.trim(); }
  });
};

// ── image loading helpers ───────────────────────────────────────────────────

const handleFile = (file) => {
  if (!SUPPORTED_MIME_RE.test(file.type)) {
    _onError?.(UNSUPPORTED_MSG);
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    _onError?.('Image is too large. Maximum file size is 50MB.');
    return;
  }
  loadImageFromFile(file);
};

const loadImageFromFile = (file) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const meta = {
      name: file.name || 'pasted-image',
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: file.size,
      type: file.type,
    };
    showPreview();
    _onImageLoad?.(img, meta);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    _onError?.('Failed to load image');
  };
  img.src = url;
};

const loadImageFromUrl = async (url) => {
  // Try direct loading first (works for CORS-enabled images)
  const img = new Image();
  img.crossOrigin = 'anonymous';

  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const meta = {
      name: filenameFromUrl(url),
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: 0,
      type: guessTypeFromUrl(url),
    };
    showPreview();
    _onImageLoad?.(img, meta);
  } catch {
    // Direct load failed — try fetching as blob
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();

      if (!SUPPORTED_MIME_RE.test(blob.type)) {
        _onError?.(UNSUPPORTED_MSG);
        return;
      }

      loadImageFromFile(new File([blob], filenameFromUrl(url), { type: blob.type }));
    } catch {
      _onError?.('Failed to load image from URL. Check the URL and try again.');
    }
  }
};

// ── state helpers ───────────────────────────────────────────────────────────

const showPreview = () => {
  _dropzone.classList.add('hidden');
  _previewArea.classList.remove('hidden');
};

const filenameFromUrl = (url) => {
  try {
    const path = new URL(url).pathname;
    const name = path.split('/').pop();
    return name || 'image';
  } catch {
    return 'image';
  }
};

const guessTypeFromUrl = (url) => {
  const ext = filenameFromUrl(url).split('.').pop()?.toLowerCase();
  const map = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
  };
  return map[ext] || 'image/unknown';
};