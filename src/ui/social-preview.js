import { render } from '../core/renderer.js';

const SOCIAL_CARDS = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    width: 1200,
    height: 628,
    cardClass: 'social-card--twitter',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    width: 1200,
    height: 630,
    cardClass: 'social-card--facebook',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    width: 1200,
    height: 627,
    cardClass: 'social-card--linkedin',
  },
];

let _panel = null;
let _currentImage = null;
let _currentConfig = null;
let _isOpen = false;

export function initSocialPreview() {
  // Create toggle button in the preview area
  const previewArea = document.getElementById('preview-area');
  if (!previewArea) return;

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn-social-preview';
  toggleBtn.type = 'button';
  toggleBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> Preview';
  toggleBtn.title = 'Preview how image looks on social platforms';
  toggleBtn.setAttribute('aria-label', 'Preview social media embeds');
  previewArea.appendChild(toggleBtn);

  // Create panel
  _panel = document.createElement('div');
  _panel.className = 'social-preview-panel hidden';
  _panel.innerHTML = `
    <div class="social-preview-header">
      <h4 class="social-preview-title">Social Preview</h4>
      <button type="button" class="social-preview-close" aria-label="Close social preview">&times;</button>
    </div>
    <div class="social-preview-cards"></div>
  `;
  previewArea.appendChild(_panel);

  toggleBtn.addEventListener('click', () => {
    if (!_currentImage) return;
    _isOpen = !_isOpen;
    toggleBtn.classList.toggle('active', _isOpen);
    _panel.classList.toggle('hidden', !_isOpen);
    if (_isOpen) renderPreviews();
  });

  _panel.querySelector('.social-preview-close').addEventListener('click', () => {
    _isOpen = false;
    toggleBtn.classList.remove('active');
    _panel.classList.add('hidden');
  });
}

export function updateSocialPreview(image, config) {
  _currentImage = image;
  _currentConfig = config;
  if (_isOpen) renderPreviews();
}

function renderPreviews() {
  if (!_currentImage || !_currentConfig) return;
  const container = _panel.querySelector('.social-preview-cards');
  container.innerHTML = '';

  for (const card of SOCIAL_CARDS) {
    const cardEl = document.createElement('div');
    cardEl.className = `social-card ${card.cardClass}`;

    const canvas = document.createElement('canvas');
    const previewConfig = { ..._currentConfig, width: card.width, height: card.height };
    render(canvas, _currentImage, previewConfig, 0.5);

    const imgEl = document.createElement('div');
    imgEl.className = 'social-card-image';
    imgEl.appendChild(canvas);

    const meta = document.createElement('div');
    meta.className = 'social-card-meta';
    meta.innerHTML = `
      <span class="social-card-platform">${card.name}</span>
      <span class="social-card-dims">${card.width} × ${card.height}</span>
    `;

    cardEl.appendChild(imgEl);
    cardEl.appendChild(meta);
    container.appendChild(cardEl);
  }
}

export function resetSocialPreview() {
  _currentImage = null;
  _currentConfig = null;
  _isOpen = false;
  if (_panel) {
    _panel.classList.add('hidden');
    const btn = document.querySelector('.btn-social-preview');
    if (btn) btn.classList.remove('active');
  }
}
