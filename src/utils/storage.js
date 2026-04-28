const STORAGE_KEY = 'pixdrip-config';

function isQuotaError(err) {
  return (
    err &&
    (err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014)
  );
}

export function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    if (isQuotaError(err) && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('pixdrip:storage-quota-exceeded'));
      } catch { /* ignore */ }
    }
    return false;
  }
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