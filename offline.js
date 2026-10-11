/* ==========================================================================
   ONE PIECE | Luffy — the offline handshake.

   Registers the worker beside this file, greets the visitor once the voyage is
   tucked away, and keeps a quiet badge up while the line is cut.
   ========================================================================== */

(() => {
  'use strict';

  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  /* The marketplace preview serves this same page straight from the app's own
     source folder: there the worker stands down, so a preview never looks at a
     stale copy of itself. Opened on its own — published, or through the little
     local server — it takes over. */
  if (location.pathname.includes('/src/')) return;

  const hadController = Boolean(navigator.serviceWorker.controller);

  /* ---------------------------------------------------------------- badge */

  const badge = document.createElement('div');
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  badge.style.cssText = [
    'position:fixed',
    'left:18px',
    'bottom:18px',
    'z-index:9999',
    'display:none',
    'align-items:center',
    'gap:8px',
    'padding:7px 13px',
    'border-radius:999px',
    'background:rgba(14,11,11,0.84)',
    'border:1px solid rgba(244,236,225,0.2)',
    'color:#f4ece1',
    'font:600 11px/1 "Big Shoulders Display", system-ui, sans-serif',
    'letter-spacing:0.14em',
    'text-transform:uppercase',
    'pointer-events:none',
    'opacity:0',
    'transition:opacity 260ms ease',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#5fd08a;flex:0 0 auto';
  const label = document.createElement('span');

  badge.append(dot, label);
  document.body.appendChild(badge);

  let hold = null;

  const hide = () => {
    badge.style.opacity = '0';
    window.clearTimeout(hold);
    hold = window.setTimeout(() => {
      badge.style.display = 'none';
    }, 320);
  };

  const say = (text, colour, linger) => {
    label.textContent = text;
    dot.style.background = colour;
    badge.style.display = 'flex';
    window.requestAnimationFrame(() => {
      badge.style.opacity = '1';
    });
    window.clearTimeout(hold);
    if (linger) hold = window.setTimeout(hide, linger);
  };

  /* --------------------------------------------------------------- the line */

  window.addEventListener('offline', () => say('Offline — cached voyage', '#e0a458', 0));
  window.addEventListener('online', () => say('Back online', '#5fd08a', 2600));

  /* ------------------------------------------------------------- the worker */

  navigator.serviceWorker
    .register('sw.js', { scope: './' })
    .then(() => {
      // a newer worker taking over an older page: one clean reload so the two
      // are never out of step (never on a first visit — nothing to replace yet)
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });

      // the worker announces a finished install; a repeat visit is already warm
      navigator.serviceWorker.addEventListener('message', (event) => {
        if ((event.data || {}).type === 'OFFLINE_READY') say('Ready for offline', '#5fd08a', 3200);
      });

      if (hadController && !window.sessionStorage.getItem('opw-ready')) {
        window.sessionStorage.setItem('opw-ready', '1');
        say('Ready for offline', '#5fd08a', 3200);
      }

      if (window.navigator.onLine === false) say('Offline — cached voyage', '#e0a458', 0);
    })
    .catch(() => {
      /* no worker available: the page simply stays online-only */
    });
})();