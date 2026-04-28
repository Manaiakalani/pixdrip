/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type]
 * @param {Object} [opts]
 * @param {number} [opts.duration] — ms before auto-dismiss; 0 to keep until clicked
 * @param {{label:string,onClick:Function}} [opts.action] — optional action button
 * @returns {{ dismiss: Function }}
 */
export function showToast(message, type = 'info', opts = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return { dismiss: () => {} };

  const { duration, action } = opts || {};
  const ttl = typeof duration === 'number' ? duration : (action ? 8000 : 3000);

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const msg = document.createElement('span');
  msg.className = 'toast-message';
  msg.textContent = message;
  toast.appendChild(msg);

  let timer = null;
  let dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (timer) clearTimeout(timer);
    toast.style.animation = 'toastOut 200ms var(--ease-out) forwards';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  if (action && typeof action.onClick === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label || 'OK';
    btn.addEventListener('click', () => {
      try { action.onClick(); } catch { /* swallow — toast is fire-and-forget */ }
      dismiss();
    });
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  if (ttl > 0) {
    timer = setTimeout(dismiss, ttl);
  }

  return { dismiss };
}

