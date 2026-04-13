// Minimal render pipeline for file-size estimation in a Web Worker.
// Uses OffscreenCanvas to avoid blocking the main thread.

self.addEventListener('message', async (e) => {
  const { config, imageData, width, height } = e.data;

  try {
    const canvas = new OffscreenCanvas(
      config.width * (config.export?.scale ?? 2),
      config.height * (config.export?.scale ?? 2),
    );
    const ctx = canvas.getContext('2d');
    const scale = config.export?.scale ?? 2;
    ctx.scale(scale, scale);

    // Simple background fill
    if (config.background?.type === 'gradient' && config.background.gradient) {
      const { stops, angle } = config.background.gradient;
      const rad = (angle * Math.PI) / 180;
      const cx = config.width / 2;
      const cy = config.height / 2;
      const len =
        (Math.abs(Math.cos(rad)) * config.width) / 2 +
        (Math.abs(Math.sin(rad)) * config.height) / 2;
      const dx = Math.cos(rad) * len;
      const dy = Math.sin(rad) * len;
      const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      stops.forEach((s, i) =>
        grad.addColorStop(i / (stops.length - 1 || 1), s),
      );
      ctx.fillStyle = grad;
    } else if (config.background?.type !== 'transparent') {
      ctx.fillStyle = config.background?.color || '#1a1a2e';
    }
    if (config.background?.type !== 'transparent') {
      ctx.fillRect(0, 0, config.width, config.height);
    }

    // Draw the image if we have image data
    if (imageData) {
      const bitmap = await createImageBitmap(imageData);
      const padding = config.padding || 0;
      const bw = config.border?.enabled ? config.border.width : 0;
      const imgX = padding + bw;
      const imgY = padding + bw;
      const imgW = config.width - (padding + bw) * 2;
      const imgH = config.height - (padding + bw) * 2;
      ctx.drawImage(bitmap, imgX, imgY, Math.max(imgW, 1), Math.max(imgH, 1));
      bitmap.close();
    }

    const format = config.export?.format || 'image/png';
    const quality = config.export?.quality || 0.92;
    const blob = await canvas.convertToBlob({ type: format, quality });

    self.postMessage({ size: blob.size });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
});
