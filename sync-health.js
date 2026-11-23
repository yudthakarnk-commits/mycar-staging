/* MYCAR v3.4.3 — read-only Sync Health UI.
 * Uses MYCARCloud public pendingCount/syncNow and the existing sync status.
 * No direct queue writes, no database changes, no secrets.
 */
(() => {
  'use strict';
  let observer;
  let lastSuccess = null;
  let lastError = '';
  let toastTimer = null;
  const byId = id => document.getElementById(id);
  const html = `
    <section id="mycar-sync-health" class="mycar-sync-health" aria-label="Cloud sync health" aria-live="polite">
      <div class="mycar-sync-health__head">
        <strong>Cloud Sync Health</strong>
        <span id="mycar-health-state" class="mycar-sync-health__state">Checking</span>
      </div>
      <div class="mycar-sync-health__metrics">
        <div><span>Pending records</span><strong id="mycar-health-pending">0</strong></div>
        <div><span>Last successful sync</span><strong id="mycar-health-last">Not yet in this session</strong></div>
      </div>
      <p id="mycar-health-message" class="mycar-sync-health__message">Checking synchronization status…</p>
      <button id="mycar-health-retry" type="button" class="mycar-sync-health__retry">Sync now</button>
      <p class="mycar-sync-health__hint">Pending records stay on this device until uploaded. Do not clear browser storage while edits are pending.</p>
    </section>`;

  function showToast(message) {
    const shell = byId('mycar-app-shell');
    if (!shell || shell.hidden) return;
    let toast = byId('mycar-health-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'mycar-health-toast';
      toast.className = 'mycar-health-toast';
      toast.setAttribute('role', 'alert');
      shell.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 6500);
  }

  function render() {
    const dot = byId('mycar-sync-status');
    const detail = byId('mycar-sync-detail');
    if (!dot || !detail || !byId('mycar-sync-health')) return;
    const message = detail.textContent || 'No sync information available';
    const raw = dot.dataset.syncState || 'idle';
    const offline = typeof navigator.onLine === 'boolean' && !navigator.onLine;
    const status = offline ? 'offline' : raw;
    let pending = 0;
    try {
      const count = typeof MYCARCloud !== 'undefined' ? MYCARCloud.pendingCount : null;
      if (Number.isInteger(count) && count >= 0) pending = count;
    } catch (err) { console.warn('Sync health pending count not available', err); }

    const state = byId('mycar-health-state');
    state.dataset.state = status;
    state.textContent = ({ success: 'Synced', error: 'Sync error', pending: 'Pending', offline: 'Offline', working: 'Syncing', idle: 'Waiting' })[status] || 'Waiting';
    byId('mycar-health-pending').textContent = String(pending);
    byId('mycar-health-message').textContent = offline ? `Offline. ${pending} record(s) waiting to upload.` : message;
    const successMarker = message.includes('Last sync ') || message.startsWith('Synced · ');
    if (successMarker && (raw === 'success' || raw === 'pending')) lastSuccess = new Date();
    byId('mycar-health-last').textContent = lastSuccess ? lastSuccess.toLocaleString() : 'Not yet in this session';
    byId('mycar-health-retry').disabled = offline || status === 'working';
    if (status === 'error') {
      if (message !== lastError) showToast('Cloud sync failed. Your pending changes remain on this device.');
      lastError = message;
    } else {
      lastError = '';
    }
  }

  function init() {
    const detail = byId('mycar-sync-detail');
    const dot = byId('mycar-sync-status');
    if (!detail || !dot || byId('mycar-sync-health')) return;
    const row = detail.parentElement;
    if (!row) return;
    row.insertAdjacentHTML('afterend', html);
    byId('mycar-health-retry').addEventListener('click', () => {
      if (navigator.onLine === false) return;
      if (typeof MYCARCloud !== 'undefined' && typeof MYCARCloud.syncNow === 'function') MYCARCloud.syncNow();
    });
    observer = new MutationObserver(render);
    observer.observe(dot, { attributes: true, attributeFilter: ['data-sync-state'] });
    observer.observe(detail, { childList: true, characterData: true, subtree: true });
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    document.addEventListener('visibilitychange', render);
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
