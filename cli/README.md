# pixdrip CLI

Command-line interface for the pixdrip image beautifier.

## Prerequisites

The CLI requires the `canvas` (node-canvas) npm package for server-side rendering:

```bash
npm install canvas
```

> **Note:** node-canvas requires native build tools. See [node-canvas installation](https://github.com/Automattic/node-canvas#compiling) for platform-specific instructions.

## Usage

```bash
# Basic usage — applies default styling
npx pixdrip screenshot.png

# Use a platform preset
npx pixdrip hero.jpg --preset twitter-x

# Custom dimensions with gradient background
npx pixdrip photo.png -w 1080 -h 1080 --gradient "#ff6b4a,#fbbf24"

# macOS frame, no shadow, custom padding
npx pixdrip diagram.png --frame macos --no-shadow --padding 80

# JPEG output at high quality
npx pixdrip photo.png --format jpeg --quality 95 -o output.jpg
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-w, --width` | Canvas width (px) | 1200 |
| `-h, --height` | Canvas height (px) | 630 |
| `-p, --preset` | Platform preset name | — |
| `--padding` | Padding (px) | 48 |
| `--radius` | Border radius (px) | 12 |
| `--bg` | Background color | #1a1a2e |
| `-g, --gradient` | Gradient stops (comma-separated) | — |
| `--shadow / --no-shadow` | Toggle drop shadow | on |
| `-f, --frame` | Frame style | none |
| `--format` | Output format (png/jpeg/webp) | png |
| `--quality` | JPEG/WebP quality (0-100) | 92 |
| `-s, --scale` | Export scale (1-3) | 2 |
| `-o, --output` | Output path | `<input>-pixdrip.<ext>` |

## Available Presets

og-facebook, twitter-x, medium, reddit, bluesky, wordpress, ghost, substack, linkedin, instagram-square, instagram-portrait
