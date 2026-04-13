const STORAGE_KEY = 'pixdrip-config';

export function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) { /* quota exceeded or private mode — silently fail */ }
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* silently fail */ }
}

const CUSTOM_PRESETS_KEY = 'pixdrip-custom-presets';

export function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomPreset(preset) {
  const presets = loadCustomPresets();
  presets.push(preset);
  try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets)); } catch {}
}

export function deleteCustomPreset(id) {
  const presets = loadCustomPresets().filter(p => p.id !== id);
  try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets)); } catch {}
}