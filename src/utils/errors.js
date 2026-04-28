// Tiny pluggable global error boundary. Sentry-shaped onError hook so a future
// integration can replace `onError` without touching call sites.

export function initErrorBoundary({ onError } = {}) {
  const handler = (kind, ev) => {
    const detail = {
      kind,
      message: ev?.message || ev?.reason?.message || String(ev?.reason || ev || 'Unknown error'),
      stack: ev?.error?.stack || ev?.reason?.stack,
      filename: ev?.filename,
      lineno: ev?.lineno,
      colno: ev?.colno,
    };
    try { onError?.(detail); } catch { /* never let the logger throw */ }
    // eslint-disable-next-line no-console
    console.error('[pixdrip]', detail);
  };

  if (typeof window === 'undefined') return;
  window.addEventListener('error', (e) => handler('error', e));
  window.addEventListener('unhandledrejection', (e) => handler('rejection', e));
}
