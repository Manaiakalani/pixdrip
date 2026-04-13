# pixdrip

**Blog image beautifier** — Drop any image, get a polished, platform-ready graphic with borders, shadows, device frames, and effects. No server, no signup, runs entirely in your browser.

![pixdrip](https://img.shields.io/badge/pixdrip-v1.0.0-ff6b4a?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square) ![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)

---

## ✨ Features

### Image Ingestion
- **Drag & drop** files from your computer
- **Paste** from clipboard (`Cmd+V`)
- **URL import** — paste any image URL
- **File picker** dialog

### Platform Presets
One-click sizing for 12 platforms with optimized defaults:

| Platform | Size | Platform | Size |
|----------|------|----------|------|
| OG / Facebook | 1200×630 | Twitter / X | 1200×628 |
| Medium | 1400×700 | Reddit | 1200×628 |
| BlueSky | 1200×628 | WordPress | 1200×630 |
| Ghost | 1200×675 | Substack | 1456×816 |
| LinkedIn | 1200×627 | Instagram Square | 1080×1080 |
| Instagram Portrait | 1080×1350 | Custom | Any size |

### Effects & Styling
- 🎨 **12 gradient backgrounds** + custom color picker + solid/transparent modes
- 🖼️ **9 device frames** — macOS, Minimal, iPhone, MacBook, iPad, Safari, iMac, Apple TV
- 🌊 **Shadows** — 5 presets (subtle → dramatic) with full control
- 📐 **Padding & border radius** sliders
- 🔲 **Borders** — toggle with color/width
- 🔤 **Text overlay** — custom font size, color, position
- 🎚️ **Image filters** — brightness, contrast, saturation, blur
- 📐 **3D perspective tilt** — X/Y axis rotation
- 🔊 **Noise texture** overlay
- 🖱️ **Drag to reposition** image within frame
- 🔍 **Scroll to zoom** — fine-tune crop

### Export
- **PNG export** at 1×, 2×, or 3× scale
- **Copy to clipboard** (`Cmd+C`)
- **Batch export** all presets at once
- **File size estimation** — live preview of export size
- **Before/after comparison** — draggable slider overlay

### Advanced
- 💾 **Custom presets** — save, recall, and delete your own configurations
- 📱 **Social preview cards** — see how your image looks on Twitter, Facebook, LinkedIn
- ⌨️ **Keyboard shortcuts** — Cmd+E (export), Cmd+N (new), Cmd+Z/Shift+Z (undo/redo)
- 🔄 **Undo/redo** — 50-step history
- 💾 **Auto-save** — settings persist in localStorage
- 📴 **PWA** — installable, works offline
- 🌐 **WebWorker rendering** — background file size estimation
- 🖥️ **CLI companion** — batch process images from terminal

---

## 🚀 Quick Start

### Web App

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Docker

```bash
# Build and run
docker build -t pixdrip .
docker run -p 3010:80 pixdrip

# Or with Docker Compose
docker compose up -d
```

### CLI

```bash
# Process a single image
npx pixdrip input.png -o output.png --preset twitter-x

# Batch process
npx pixdrip input.png --preset og-facebook --preset twitter-x --preset linkedin
```

See [`cli/README.md`](cli/README.md) for full CLI documentation.

---

## 🏗️ Architecture

```
pixdrip/
├── index.html              # App shell (~400 lines)
├── src/
│   ├── main.js             # App orchestrator, undo/redo, shortcuts
│   ├── core/
│   │   ├── presets.js      # 12 platform presets, gradients, shadows
│   │   ├── effects.js      # Canvas drawing: backgrounds, frames, text
│   │   └── renderer.js     # Compositing pipeline & export
│   ├── ui/
│   │   ├── controls.js     # Sidebar state & DOM bindings
│   │   ├── dropzone.js     # Image ingestion (drag/paste/URL)
│   │   ├── preview.js      # Live preview, drag/zoom, comparison
│   │   ├── social-preview.js # Social platform preview cards
│   │   └── toast.js        # Notification system
│   ├── utils/
│   │   ├── helpers.js      # deepMerge, clampInt, downloadBlob
│   │   └── storage.js      # localStorage persistence
│   ├── workers/
│   │   └── render-worker.js # OffscreenCanvas WebWorker
│   └── styles/
│       └── main.css        # Dark theme (~1600 lines)
├── cli/
│   ├── pixdrip-cli.js      # Node.js CLI companion
│   └── README.md           # CLI docs
├── public/
│   ├── favicon.svg
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
└── tests/
    └── pixdrip.spec.js     # 59 Playwright tests (Chromium + Firefox)
```

### Rendering Pipeline

```
Background (+noise) → Tilt transform → Shadow → Border → Frame (top)
  → Image (+offset/zoom/filters) → Frame (bottom) → Text overlay
```

All rendering uses the **Canvas 2D API** — no server, no dependencies, no framework. ~3,200 lines of vanilla ES modules.

---

## 🧪 Testing

```bash
# Run all tests (Chromium + Firefox)
npm test

# 118 tests across 9 suites:
# - App Shell, Sidebar Controls, Platform Presets
# - Canvas Rendering, Export, Fit & Finish
# - Keyboard Shortcuts, V2 Features, V3 Features
```

---

## ⚡ Performance

- **28ms** DOMContentLoaded
- **Canvas size guard** — skips reallocation when dimensions unchanged
- **Cached gradients/patterns** — keyed by size + stops + angle
- **Memoized crop math** — composite key cache
- **RAF render scheduling** — deduplicates drag/wheel events
- **WebWorker** file size estimation via OffscreenCanvas
- **Non-blocking font loading** with preload

---

## 🎨 Design

Dark charcoal UI (`#09090b`) with glass-morphism sidebar (`backdrop-blur`). Warm coral→amber accent gradient. Built with [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) + [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono).

---

## 📄 License

MIT
