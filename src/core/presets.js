// ---------------------------------------------------------------------------
// pixdrip – platform, gradient, shadow presets & default config
// Pure data module — no DOM or Canvas dependencies.
// ---------------------------------------------------------------------------

export const PLATFORM_PRESETS = [
  {
    id: 'og-facebook',
    name: 'OG / Facebook',
    icon: '🌐',
    width: 1200,
    height: 630,
    description: 'Open Graph / Facebook share image',
    defaults: {
      padding: 48,
      borderRadius: 12,
      shadow: { enabled: true, x: 0, y: 12, blur: 40, color: '#000000', opacity: 0.25 },
      background: { type: 'gradient', preset: 0 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'twitter-x',
    name: 'Twitter / X',
    icon: '🐦',
    width: 1200,
    height: 628,
    description: 'Twitter / X summary card with large image',
    defaults: {
      padding: 56,
      borderRadius: 16,
      shadow: { enabled: true, x: 0, y: 8, blur: 32, color: '#000000', opacity: 0.2 },
      background: { type: 'gradient', preset: 1 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'medium',
    name: 'Medium',
    icon: '📝',
    width: 1400,
    height: 700,
    description: 'Medium article hero image (2:1)',
    defaults: {
      padding: 64,
      borderRadius: 14,
      shadow: { enabled: true, x: 0, y: 16, blur: 48, color: '#000000', opacity: 0.28 },
      background: { type: 'gradient', preset: 2 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'reddit',
    name: 'Reddit',
    icon: '🤖',
    width: 1200,
    height: 628,
    description: 'Reddit link preview / post image',
    defaults: {
      padding: 44,
      borderRadius: 10,
      shadow: { enabled: true, x: 0, y: 10, blur: 36, color: '#000000', opacity: 0.22 },
      background: { type: 'gradient', preset: 3 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'bluesky',
    name: 'BlueSky',
    icon: '🦋',
    width: 1200,
    height: 628,
    description: 'BlueSky social card image',
    defaults: {
      padding: 48,
      borderRadius: 14,
      shadow: { enabled: true, x: 0, y: 12, blur: 40, color: '#000000', opacity: 0.24 },
      background: { type: 'gradient', preset: 4 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    icon: '📰',
    width: 1200,
    height: 630,
    description: 'WordPress featured image',
    defaults: {
      padding: 52,
      borderRadius: 8,
      shadow: { enabled: true, x: 0, y: 14, blur: 44, color: '#000000', opacity: 0.26 },
      background: { type: 'gradient', preset: 5 },
      border: { enabled: true, width: 1, color: '#ffffff20' },
    },
  },
  {
    id: 'ghost',
    name: 'Ghost',
    icon: '👻',
    width: 1200,
    height: 675,
    description: 'Ghost blog feature image (16:9)',
    defaults: {
      padding: 44,
      borderRadius: 12,
      shadow: { enabled: true, x: 0, y: 12, blur: 40, color: '#000000', opacity: 0.25 },
      background: { type: 'gradient', preset: 6 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'substack',
    name: 'Substack',
    icon: '📮',
    width: 1456,
    height: 816,
    description: 'Substack newsletter hero image (14:10)',
    defaults: {
      padding: 60,
      borderRadius: 18,
      shadow: { enabled: true, x: 0, y: 18, blur: 56, color: '#000000', opacity: 0.3 },
      background: { type: 'gradient', preset: 7 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    width: 1200,
    height: 627,
    description: 'LinkedIn article cover image',
    defaults: {
      padding: 48,
      borderRadius: 10,
      shadow: { enabled: true, x: 0, y: 10, blur: 36, color: '#000000', opacity: 0.2 },
      background: { type: 'gradient', preset: 8 },
      border: { enabled: true, width: 1, color: '#ffffff18' },
    },
  },
  {
    id: 'instagram-square',
    name: 'Instagram Square',
    icon: '📷',
    width: 1080,
    height: 1080,
    description: 'Instagram square post',
    defaults: {
      padding: 56,
      borderRadius: 20,
      shadow: { enabled: true, x: 0, y: 20, blur: 60, color: '#000000', opacity: 0.35 },
      background: { type: 'gradient', preset: 9 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'instagram-portrait',
    name: 'Instagram Portrait',
    icon: '📱',
    width: 1080,
    height: 1350,
    description: 'Instagram portrait post (4:5)',
    defaults: {
      padding: 52,
      borderRadius: 20,
      shadow: { enabled: true, x: 0, y: 24, blur: 64, color: '#000000', opacity: 0.32 },
      background: { type: 'gradient', preset: 10 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '✏️',
    width: 1200,
    height: 630,
    description: 'Custom dimensions — set your own size',
    defaults: {
      padding: 48,
      borderRadius: 12,
      shadow: { enabled: true, x: 0, y: 12, blur: 40, color: '#000000', opacity: 0.25 },
      background: { type: 'gradient', preset: 0 },
      border: { enabled: false, width: 2, color: '#808080' },
    },
  },
];

// ---------------------------------------------------------------------------
// Gradient presets — 12 curated backgrounds
// ---------------------------------------------------------------------------

export const GRADIENT_PRESETS = [
  { id: 'sunset',    name: 'Sunset',    stops: ['#ff6b4a', '#fbbf24'], angle: 135 },
  { id: 'ocean',     name: 'Ocean',     stops: ['#0ea5e9', '#6366f1'], angle: 135 },
  { id: 'lavender',  name: 'Lavender',  stops: ['#a855f7', '#ec4899'], angle: 135 },
  { id: 'forest',    name: 'Forest',    stops: ['#10b981', '#14b8a6'], angle: 135 },
  { id: 'midnight',  name: 'Midnight',  stops: ['#0f172a', '#581c87'], angle: 160 },
  { id: 'rose-gold', name: 'Rose Gold', stops: ['#fb7185', '#f59e0b'], angle: 135 },
  { id: 'arctic',    name: 'Arctic',    stops: ['#7dd3fc', '#f0f9ff'], angle: 180 },
  { id: 'charcoal',  name: 'Charcoal',  stops: ['#1f2937', '#6b7280'], angle: 145 },
  { id: 'neon',      name: 'Neon',      stops: ['#22c55e', '#06b6d4'], angle: 135 },
  { id: 'berry',     name: 'Berry',     stops: ['#d946ef', '#7c3aed'], angle: 150 },
  { id: 'peach',     name: 'Peach',     stops: ['#fb923c', '#f472b6'], angle: 135 },
  { id: 'slate',     name: 'Slate',     stops: ['#475569', '#94a3b8'], angle: 140 },
];

// ---------------------------------------------------------------------------
// Shadow presets
// ---------------------------------------------------------------------------

export const SHADOW_PRESETS = [
  { id: 'none',     name: 'None',     x: 0, y: 0,  blur: 0,  opacity: 0 },
  { id: 'subtle',   name: 'Subtle',   x: 0, y: 4,  blur: 16, opacity: 0.12 },
  { id: 'medium',   name: 'Medium',   x: 0, y: 12, blur: 40, opacity: 0.25 },
  { id: 'heavy',    name: 'Heavy',    x: 0, y: 20, blur: 60, opacity: 0.4 },
  { id: 'floating', name: 'Floating', x: 0, y: 24, blur: 80, opacity: 0.3 },
];

// ---------------------------------------------------------------------------
// Default application config (initial state shape)
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG = {
  width: 1200,
  height: 630,
  padding: 48,
  borderRadius: 12,
  background: {
    type: 'gradient',
    color: '#1a1a2e',
    gradient: { stops: ['#ff6b4a', '#fbbf24'], angle: 135 },
    noise: false,
  },
  border: { enabled: false, width: 2, color: '#808080' },
  shadow: { enabled: true, x: 0, y: 12, blur: 40, color: '#000000', opacity: 0.25 },
  frameStyle: 'none', // 'none' | 'macos' | 'minimal' | 'iphone' | 'macbook'
  imageOffset: { x: 0, y: 0, zoom: 1 },
  text: {
    enabled: false,
    content: '',
    fontSize: 32,
    fontWeight: '600',
    color: '#ffffff',
    position: 'top', // 'top' | 'center' | 'bottom'
    opacity: 1,
  },
  tilt: { enabled: false, x: 0, y: 0 },
  filters: {
    brightness: 100, // percentage (100 = normal)
    contrast: 100,
    saturation: 100,
    blur: 0, // px
  },
  export: { format: 'image/png', quality: 0.92, scale: 2 },
};

/**
 * Migrate legacy config fields to current schema.
 * Handles: browserFrame → frameStyle conversion.
 */
export function migrateConfig(config) {
  if (config.browserFrame && (!config.frameStyle || config.frameStyle === 'none')) {
    config.frameStyle = 'macos';
  }
  delete config.browserFrame;
  return config;
}

