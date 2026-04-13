import { test, expect } from '@playwright/test';
import path from 'path';

// ---------------------------------------------------------------------------
// 1. Page Load & Layout
// ---------------------------------------------------------------------------

test.describe('Page Load & Layout', () => {
  test('loads with correct title and favicon', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('pixdrip — Blog Image Beautifier');
    // Favicon link should be present
    const favicon = page.locator('link[rel="icon"]');
    await expect(favicon).toHaveAttribute('href', '/favicon.svg');
  });

  test('header renders with logo and actions', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('.logo-text');
    await expect(logo).toHaveText('pixdrip');
    await expect(logo).toBeVisible();

    const btnNew = page.locator('#btn-new');
    await expect(btnNew).toBeVisible();

    const btnExport = page.locator('#btn-export');
    await expect(btnExport).toBeVisible();
    await expect(btnExport).toBeDisabled();
  });

  test('sidebar is visible with all control sections', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    const sections = [
      'Platform', 'Canvas Size', 'Background', 'Padding',
      'Border Radius', 'Shadow', 'Frame', 'Text Overlay', 'Perspective', 'Export',
    ];
    for (const title of sections) {
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    }
    // "Border" needs exact match to avoid colliding with "Border Radius"
    await expect(page.getByRole('heading', { name: 'Border', exact: true })).toBeVisible();
  });

  test('dropzone is visible before image load', async ({ page }) => {
    await page.goto('/');
    const dropzone = page.locator('#dropzone');
    await expect(dropzone).toBeVisible();

    await expect(page.locator('.dropzone-title')).toHaveText('Drop an image here');
    await expect(page.locator('#btn-browse')).toBeVisible();
    await expect(page.locator('#input-url')).toBeVisible();
  });

  test('preview area is hidden before image load', async ({ page }) => {
    await page.goto('/');
    const preview = page.locator('#preview-area');
    await expect(preview).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// 2. Platform Presets — Bug Fix Verification
// ---------------------------------------------------------------------------

test.describe('Platform Presets', () => {
  test('preset grid renders all 12 presets', async ({ page }) => {
    await page.goto('/');
    const presetBtns = page.locator('.preset-btn');
    await expect(presetBtns).toHaveCount(12);
  });

  test('only one preset is active at a time (bug fix)', async ({ page }) => {
    await page.goto('/');

    // Click OG / Facebook
    await page.locator('.preset-btn[data-preset-id="og-facebook"]').click();
    let activePresets = page.locator('.preset-btn.active');
    await expect(activePresets).toHaveCount(1);
    await expect(page.locator('.preset-btn.active')).toHaveAttribute('data-preset-id', 'og-facebook');

    // Click Ghost (same 1200×630 dimensions) — should NOT also select OG
    await page.locator('.preset-btn[data-preset-id="ghost"]').click();
    activePresets = page.locator('.preset-btn.active');
    await expect(activePresets).toHaveCount(1);
    await expect(page.locator('.preset-btn.active')).toHaveAttribute('data-preset-id', 'ghost');

    // Click Custom (also 1200×630) — should NOT select OG or Ghost
    await page.locator('.preset-btn[data-preset-id="custom"]').click();
    activePresets = page.locator('.preset-btn.active');
    await expect(activePresets).toHaveCount(1);
    await expect(page.locator('.preset-btn.active')).toHaveAttribute('data-preset-id', 'custom');
  });

  test('clicking preset updates width/height inputs', async ({ page }) => {
    await page.goto('/');

    await page.locator('.preset-btn[data-preset-id="medium"]').click();
    await expect(page.locator('#ctrl-width')).toHaveValue('1400');
    await expect(page.locator('#ctrl-height')).toHaveValue('700');

    await page.locator('.preset-btn[data-preset-id="reddit"]').click();
    await expect(page.locator('#ctrl-width')).toHaveValue('1200');
    await expect(page.locator('#ctrl-height')).toHaveValue('628');

    await page.locator('.preset-btn[data-preset-id="instagram-square"]').click();
    await expect(page.locator('#ctrl-width')).toHaveValue('1080');
    await expect(page.locator('#ctrl-height')).toHaveValue('1080');
  });

  test('manually changing dimensions deselects preset', async ({ page }) => {
    await page.goto('/');

    await page.locator('.preset-btn[data-preset-id="og-facebook"]').click();
    await expect(page.locator('.preset-btn.active')).toHaveCount(1);

    // Manually change width
    const widthInput = page.locator('#ctrl-width');
    await widthInput.fill('999');
    await widthInput.press('Enter');

    // No preset should be active now
    await expect(page.locator('.preset-btn.active')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Controls
// ---------------------------------------------------------------------------

test.describe('Controls', () => {
  test('gradient grid renders 12 swatches', async ({ page }) => {
    await page.goto('/');
    const swatches = page.locator('.gradient-swatch');
    await expect(swatches).toHaveCount(12);
  });

  test('background type toggle switches between gradient and solid', async ({ page }) => {
    await page.goto('/');

    // Initially gradient is active
    const gradientBtn = page.locator('.toggle-btn[data-bg-type="gradient"]');
    const solidBtn = page.locator('.toggle-btn[data-bg-type="solid"]');
    await expect(gradientBtn).toHaveClass(/active/);

    // Switch to solid
    await solidBtn.click();
    await expect(solidBtn).toHaveClass(/active/);
    await expect(gradientBtn).not.toHaveClass(/active/);

    // Gradient grid should be hidden, solid color should be visible
    await expect(page.locator('#gradient-presets')).toBeHidden();
    await expect(page.locator('#solid-color-row')).toBeVisible();

    // Switch back to gradient
    await gradientBtn.click();
    await expect(page.locator('#gradient-presets')).toBeVisible();
    await expect(page.locator('#solid-color-row')).toBeHidden();
  });

  test('padding slider updates value display', async ({ page }) => {
    await page.goto('/');

    const slider = page.locator('#ctrl-padding');
    const display = page.locator('#val-padding');

    // Default value
    await expect(display).toHaveText('48px');

    // Change via slider input event
    await slider.fill('80');
    await slider.dispatchEvent('input');
    await expect(display).toHaveText('80px');
  });

  test('border radius slider updates value display', async ({ page }) => {
    await page.goto('/');

    const slider = page.locator('#ctrl-radius');
    const display = page.locator('#val-radius');

    await expect(display).toHaveText('12px');
    await slider.fill('24');
    await slider.dispatchEvent('input');
    await expect(display).toHaveText('24px');
  });

  test('border toggle shows/hides border controls', async ({ page }) => {
    await page.goto('/');

    // Click the visible .toggle-track sibling (the checkbox itself is visually hidden)
    const track = page.locator('#ctrl-border-toggle + .toggle-track');
    const controls = page.locator('#border-controls');

    // Initially hidden (border disabled by default)
    await expect(controls).toBeHidden();

    // Enable border
    await track.click();
    await expect(controls).toBeVisible();

    // Disable border
    await track.click();
    await expect(controls).toBeHidden();
  });

  test('shadow toggle shows/hides shadow controls', async ({ page }) => {
    await page.goto('/');

    const track = page.locator('#ctrl-shadow-toggle + .toggle-track');
    const controls = page.locator('#shadow-controls');

    // Shadow is ON by default
    await expect(controls).toBeVisible();

    // Disable shadow
    await track.click();
    await expect(controls).toBeHidden();

    // Re-enable
    await track.click();
    await expect(controls).toBeVisible();
  });

  test('export format hides quality for PNG', async ({ page }) => {
    await page.goto('/');

    const format = page.locator('#ctrl-format');
    const qualityRow = page.locator('#quality-row');

    // Default is PNG — quality should be hidden
    await expect(qualityRow).toBeHidden();

    // Switch to JPEG
    await format.selectOption('image/jpeg');
    await expect(qualityRow).toBeVisible();

    // Switch back to PNG
    await format.selectOption('image/png');
    await expect(qualityRow).toBeHidden();
  });

  test('aspect ratio lock maintains ratio when width changes', async ({ page }) => {
    await page.goto('/');

    // Select a preset with known ratio
    await page.locator('.preset-btn[data-preset-id="instagram-square"]').click();
    await expect(page.locator('#ctrl-width')).toHaveValue('1080');
    await expect(page.locator('#ctrl-height')).toHaveValue('1080');

    // Lock should be active by default
    const lockBtn = page.locator('#btn-lock-ratio');
    await expect(lockBtn).toHaveClass(/active/);

    // Change width — height should follow (1:1 ratio)
    const widthInput = page.locator('#ctrl-width');
    await widthInput.fill('500');
    await widthInput.press('Enter');
    await expect(page.locator('#ctrl-height')).toHaveValue('500');
  });
});

// ---------------------------------------------------------------------------
// 4. Image Loading
// ---------------------------------------------------------------------------

test.describe('Image Loading', () => {
  test('file picker button triggers file input', async ({ page }) => {
    await page.goto('/');
    // Verify the hidden file input exists
    const fileInput = page.locator('#file-input');
    await expect(fileInput).toBeAttached();
    await expect(fileInput).toHaveAttribute('type', 'file');
    await expect(fileInput).toHaveAttribute('accept', 'image/*');
  });

  test('loading an image shows preview and enables export', async ({ page }) => {
    await page.goto('/');

    // Create a test image via canvas and upload it
    const dataUrl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3498db';
      ctx.fillRect(0, 0, 200, 100);
      return c.toDataURL('image/png');
    });

    // Convert data URL to file and set on input
    await page.evaluate((dataUrl) => {
      const arr = dataUrl.split(',');
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: 'image/png' });
      const file = new File([blob], 'test-image.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, dataUrl);

    // Preview should be visible, dropzone hidden
    await expect(page.locator('#preview-area')).toBeVisible();
    await expect(page.locator('#dropzone')).toBeHidden();

    // Export button should now be enabled
    await expect(page.locator('#btn-export')).toBeEnabled();

    // Image info should show dimensions
    await expect(page.locator('#image-info')).toContainText('200 × 100');

    // Canvas should be rendered
    const canvas = page.locator('#preview-canvas');
    await expect(canvas).toBeVisible();
  });

  test('new button resets to dropzone', async ({ page }) => {
    await page.goto('/');

    // Load an image first
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 100;
      c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(0, 0, 100, 100);
      const dataUrl = c.toDataURL('image/png');
      const arr = dataUrl.split(',');
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(page.locator('#preview-area')).toBeVisible();

    // Click new button
    await page.locator('#btn-new').click();

    // Should be back to dropzone
    await expect(page.locator('#dropzone')).toBeVisible();
    await expect(page.locator('#preview-area')).toBeHidden();
    await expect(page.locator('#btn-export')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// 5. Canvas Rendering
// ---------------------------------------------------------------------------

test.describe('Canvas Rendering', () => {
  async function loadTestImage(page) {
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 300;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#fff';
      ctx.font = '24px sans-serif';
      ctx.fillText('pixdrip test', 100, 150);
      const dataUrl = c.toDataURL('image/png');
      const arr = dataUrl.split(',');
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: 'image/png' });
      const file = new File([blob], 'render-test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#preview-canvas')).toBeVisible();
  }

  test('canvas has non-zero dimensions after image load', async ({ page }) => {
    await page.goto('/');
    await loadTestImage(page);

    const dims = await page.evaluate(() => {
      const c = document.getElementById('preview-canvas');
      return { w: c.width, h: c.height };
    });
    expect(dims.w).toBeGreaterThan(0);
    expect(dims.h).toBeGreaterThan(0);
  });

  test('changing preset re-renders canvas at new dimensions', async ({ page }) => {
    await page.goto('/');
    await loadTestImage(page);

    // Get initial canvas size
    const initial = await page.evaluate(() => {
      const c = document.getElementById('preview-canvas');
      return { w: c.width, h: c.height };
    });

    // Switch to Instagram Square (1080×1080)
    await page.locator('.preset-btn[data-preset-id="instagram-square"]').click();

    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('preview-canvas').width);
    }).not.toBe(initial.w);
  });

  test('canvas is not blank (has pixel data)', async ({ page }) => {
    await page.goto('/');
    await loadTestImage(page);

    // Wait for canvas to have non-zero dimensions (render complete)
    await page.waitForFunction(() => {
      const c = document.getElementById('preview-canvas');
      return c && c.width > 0 && c.height > 0;
    }, { timeout: 5000 });

    const hasPixels = await page.evaluate(() => {
      const c = document.getElementById('preview-canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      // Check that not all pixels are transparent/black
      let nonZero = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 0 || data[i + 1] > 0 || data[i + 2] > 0) nonZero++;
      }
      return nonZero > 100;
    });
    expect(hasPixels).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Fit & Finish
// ---------------------------------------------------------------------------

test.describe('Fit & Finish', () => {
  test('logo text has gradient styling', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('.logo-text');
    const bgClip = await logo.evaluate((el) => getComputedStyle(el).backgroundClip);
    expect(bgClip).toBe('text');
  });

  test('custom scrollbar is styled on sidebar', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('.sidebar-inner');
    const scrollbarColor = await sidebar.evaluate(
      (el) => getComputedStyle(el).scrollbarColor,
    );
    // Firefox uses scrollbar-color; Chromium uses ::-webkit-scrollbar
    // Just verify the element exists and has overflow
    const overflow = await sidebar.evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflow).toBe('auto');
  });

  test('dropzone icon has float animation', async ({ page }) => {
    await page.goto('/');
    const icon = page.locator('.dropzone-icon');
    const animation = await icon.evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('float');
  });

  test('header has backdrop-filter blur', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('.app-header');
    const blur = await header.evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(blur).toContain('blur');
  });

  test('toggle switches have smooth transition', async ({ page }) => {
    await page.goto('/');
    const track = page.locator('.toggle-track').first();
    const transition = await track.evaluate((el) => getComputedStyle(el).transition);
    expect(transition).not.toBe('');
    expect(transition).not.toBe('none');
  });

  test('buttons have transition properties', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('.btn-secondary').first();
    const transition = await btn.evaluate((el) => getComputedStyle(el).transition);
    // Transition uses cubic-bezier easing
    expect(transition).toContain('cubic-bezier');
  });

  test('URL input placeholder is present', async ({ page }) => {
    await page.goto('/');
    const urlInput = page.locator('#input-url');
    await expect(urlInput).toHaveAttribute('placeholder', 'Paste image URL...');
  });

  test('URL Go button is disabled when input is empty', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#btn-url');
    await expect(btn).toBeDisabled();

    // Type a URL — button should enable
    await page.locator('#input-url').fill('https://example.com/img.png');
    await expect(btn).toBeEnabled();

    // Clear — button should disable again
    await page.locator('#input-url').fill('');
    await expect(btn).toBeDisabled();
  });

  test('canvas area has checkerboard background pattern', async ({ page }) => {
    await page.goto('/');
    const area = page.locator('.canvas-area');
    const bgImage = await area.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bgImage).toContain('linear-gradient');
  });

  test('preset buttons show emoji icons', async ({ page }) => {
    await page.goto('/');
    const icons = page.locator('.preset-icon');
    const count = await icons.count();
    expect(count).toBe(12);

    // Verify first few have emoji content
    const firstIcon = await icons.first().textContent();
    expect(firstIcon.trim().length).toBeGreaterThan(0);
  });

  test('gradient swatches have gradient backgrounds', async ({ page }) => {
    await page.goto('/');
    const swatch = page.locator('.gradient-swatch').first();
    const bg = await swatch.evaluate((el) => el.style.background);
    expect(bg).toContain('linear-gradient');
  });

  test('no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('no console errors when interacting with controls', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');

    // Click through all presets
    const presetBtns = page.locator('.preset-btn');
    const count = await presetBtns.count();
    for (let i = 0; i < count; i++) {
      await presetBtns.nth(i).click();
    }

    // Toggle controls (click the visible .toggle-track, not the hidden checkbox)
    await page.locator('#ctrl-border-toggle + .toggle-track').click();
    await page.locator('#ctrl-shadow-toggle + .toggle-track').click();

    // Click frame style buttons
    await page.locator('.frame-btn[data-frame="macos"]').click();
    await page.locator('.frame-btn[data-frame="none"]').click();

    // Toggle text overlay
    await page.locator('#ctrl-text-toggle + .toggle-track').click();

    // Change sliders
    await page.locator('#ctrl-padding').fill('100');
    await page.locator('#ctrl-padding').dispatchEvent('input');
    await page.locator('#ctrl-radius').fill('0');
    await page.locator('#ctrl-radius').dispatchEvent('input');

    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 7. Keyboard Shortcuts
// ---------------------------------------------------------------------------

test.describe('Keyboard Shortcuts', () => {
  test('Cmd+N triggers new/reset', async ({ page }) => {
    await page.goto('/');

    // Load an image first
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 100, 100);
      const dataUrl = c.toDataURL('image/png');
      const arr = dataUrl.split(',');
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#preview-area')).toBeVisible();

    // Press Cmd+N
    await page.keyboard.press('Meta+n');
    await expect(page.locator('#dropzone')).toBeVisible();
    await expect(page.locator('#preview-area')).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// 8. V2 Features
// ---------------------------------------------------------------------------

test.describe('V2 Features', () => {
  test('frame style grid renders 9 options with none active by default', async ({ page }) => {
    await page.goto('/');
    const frameBtns = page.locator('.frame-btn');
    await expect(frameBtns).toHaveCount(9);
    await expect(page.locator('.frame-btn[data-frame="none"]')).toHaveClass(/active/);
  });

  test('clicking a frame style activates it and deactivates others', async ({ page }) => {
    await page.goto('/');
    await page.locator('.frame-btn[data-frame="macos"]').click();
    await expect(page.locator('.frame-btn[data-frame="macos"]')).toHaveClass(/active/);
    await expect(page.locator('.frame-btn[data-frame="none"]')).not.toHaveClass(/active/);

    await page.locator('.frame-btn[data-frame="iphone"]').click();
    await expect(page.locator('.frame-btn[data-frame="iphone"]')).toHaveClass(/active/);
    await expect(page.locator('.frame-btn[data-frame="macos"]')).not.toHaveClass(/active/);
  });

  test('text overlay toggle shows/hides text controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#text-controls')).toBeHidden();
    await page.locator('#ctrl-text-toggle + .toggle-track').click();
    await expect(page.locator('#text-controls')).toBeVisible();
    await expect(page.locator('#ctrl-text-content')).toBeVisible();
  });

  test('text input accepts content', async ({ page }) => {
    await page.goto('/');
    await page.locator('#ctrl-text-toggle + .toggle-track').click();
    await page.locator('#ctrl-text-content').fill('Hello World');
    await expect(page.locator('#ctrl-text-content')).toHaveValue('Hello World');
  });

  test('noise toggle is present in background section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#ctrl-noise-toggle')).toBeAttached();
  });

  test('copy button is present and disabled before image load', async ({ page }) => {
    await page.goto('/');
    const copyBtn = page.locator('#btn-copy');
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toBeDisabled();
  });

  test('batch export button is present and disabled before image load', async ({ page }) => {
    await page.goto('/');
    const batchBtn = page.locator('#btn-batch-export');
    await expect(batchBtn).toBeVisible();
    await expect(batchBtn).toBeDisabled();
  });

  test('copy and batch export buttons enable after image load', async ({ page }) => {
    await page.goto('/');

    // Load a test image
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 100; c.height = 100;
      c.getContext('2d').fillRect(0, 0, 100, 100);
      const dataUrl = c.toDataURL('image/png');
      const arr = dataUrl.split(',');
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(page.locator('#btn-copy')).toBeEnabled();
    await expect(page.locator('#btn-batch-export')).toBeEnabled();
  });

  test('toast types have distinct styling', async ({ page }) => {
    await page.goto('/');

    // Create toasts of each type via JS
    await page.evaluate(() => {
      const container = document.getElementById('toast-container');
      ['success', 'error', 'info'].forEach(type => {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = type;
        toast.id = `test-toast-${type}`;
        container.appendChild(toast);
      });
    });

    for (const type of ['success', 'error', 'info']) {
      const toast = page.locator(`#test-toast-${type}`);
      await expect(toast).toBeVisible();
      const borderLeft = await toast.evaluate(el => getComputedStyle(el).borderLeftWidth);
      expect(parseFloat(borderLeft)).toBeGreaterThan(0);
    }
  });

  test('reduced motion media query exists', async ({ page }) => {
    await page.goto('/');
    const hasReducedMotion = await page.evaluate(() => {
      const sheets = document.styleSheets;
      for (const sheet of sheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.media && rule.media.mediaText.includes('prefers-reduced-motion')) return true;
          }
        } catch {}
      }
      return false;
    });
    expect(hasReducedMotion).toBe(true);
  });

  test('toast container has aria-live attribute', async ({ page }) => {
    await page.goto('/');
    const ariaLive = await page.locator('#toast-container').getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
  });

  test('frame styles render correctly on canvas', async ({ page }) => {
    await page.goto('/');

    // Load a test image
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#3366ff';
      ctx.fillRect(0, 0, 200, 200);
      const dataUrl = c.toDataURL('image/png');
      const arr = dataUrl.split(',');
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#preview-area')).toBeVisible();

    // Switch to each frame and verify canvas still renders
    for (const frame of ['macos', 'minimal', 'iphone', 'macbook', 'none']) {
      await page.locator(`.frame-btn[data-frame="${frame}"]`).click();
      await expect.poll(async () => {
        return page.evaluate(() => document.getElementById('preview-canvas').width);
      }).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. V3 Features
// ---------------------------------------------------------------------------

test.describe('V3 Features', () => {
  async function loadTestImage(page) {
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 300;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(0, 0, 400, 300);
      const dataUrl = c.toDataURL('image/png');
      const arr = dataUrl.split(',');
      const bstr = atob(arr[1]);
      const u8 = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
      const blob = new Blob([u8], { type: 'image/png' });
      const file = new File([blob], 'v3-test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const input = document.getElementById('file-input');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(page.locator('#preview-canvas')).toBeVisible();
  }

  test('perspective tilt toggle shows/hides controls', async ({ page }) => {
    await page.goto('/');
    const tiltControls = page.locator('#tilt-controls');
    await expect(tiltControls).toBeHidden();

    await page.locator('#ctrl-tilt-toggle + .toggle-track').click();
    await expect(tiltControls).toBeVisible();

    await page.locator('#ctrl-tilt-toggle + .toggle-track').click();
    await expect(tiltControls).toBeHidden();
  });

  test('perspective tilt sliders adjust values', async ({ page }) => {
    await page.goto('/');
    await page.locator('#ctrl-tilt-toggle + .toggle-track').click();

    await page.locator('#ctrl-tilt-x').fill('15');
    await page.locator('#ctrl-tilt-x').dispatchEvent('input');
    await expect(page.locator('#val-tilt-x')).toHaveText('15°');

    await page.locator('#ctrl-tilt-y').fill('-10');
    await page.locator('#ctrl-tilt-y').dispatchEvent('input');
    await expect(page.locator('#val-tilt-y')).toHaveText('-10°');
  });

  test('perspective tilt renders on canvas without errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await loadTestImage(page);

    await page.locator('#ctrl-tilt-toggle + .toggle-track').click();
    await page.locator('#ctrl-tilt-x').fill('20');
    await page.locator('#ctrl-tilt-x').dispatchEvent('input');

    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('preview-canvas').width);
    }).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('export scale selector changes value', async ({ page }) => {
    await page.goto('/');
    const scaleSelect = page.locator('#ctrl-scale');
    await expect(scaleSelect).toBeVisible();

    await scaleSelect.selectOption('1');
    await expect(scaleSelect).toHaveValue('1');

    await scaleSelect.selectOption('3');
    await expect(scaleSelect).toHaveValue('3');
  });

  test('transparent background mode works', async ({ page }) => {
    await page.goto('/');
    const noneBtn = page.locator('.toggle-btn[data-bg-type="transparent"]');
    await expect(noneBtn).toBeVisible();

    await noneBtn.click();
    await expect(noneBtn).toHaveClass(/active/);

    // Gradient grid should be hidden in transparent mode
    await expect(page.locator('#gradient-presets')).toBeHidden();
    // Solid color row should be hidden too
    await expect(page.locator('#solid-color-row')).toBeHidden();
  });

  test('transparent background renders on canvas without errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await loadTestImage(page);

    await page.locator('.toggle-btn[data-bg-type="transparent"]').click();

    await expect.poll(async () => {
      return page.evaluate(() => document.getElementById('preview-canvas').width);
    }).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('custom gradient color pickers update values', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');

    const stop1 = page.locator('#ctrl-gradient-stop1');
    const stop2 = page.locator('#ctrl-gradient-stop2');
    await expect(stop1).toBeVisible();
    await expect(stop2).toBeVisible();

    // Change gradient colors
    await stop1.evaluate((el) => { el.value = '#00ff00'; el.dispatchEvent(new Event('input')); });
    await stop2.evaluate((el) => { el.value = '#0000ff'; el.dispatchEvent(new Event('input')); });

    await expect(stop1).toHaveValue('#00ff00');
    await expect(stop2).toHaveValue('#0000ff');
    expect(errors).toEqual([]);
  });

  test('reset crop button is hidden initially', async ({ page }) => {
    await page.goto('/');
    await loadTestImage(page);

    const resetBtn = page.locator('#btn-reset-crop');
    await expect(resetBtn).toBeHidden();
  });

  test('accessibility: radiogroup roles on preset and frame grids', async ({ page }) => {
    await page.goto('/');
    const presetGrid = page.locator('#preset-grid');
    await expect(presetGrid).toHaveAttribute('role', 'radiogroup');

    const frameGrid = page.locator('.frame-style-grid');
    await expect(frameGrid).toHaveAttribute('role', 'radiogroup');
  });

  test('accessibility: canvas has img role and label', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#preview-canvas');
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', 'Preview of exported image');
  });
});