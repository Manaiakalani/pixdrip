/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 200ms var(--ease-out) forwards';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3000);
}
