/* ===========================================================
   Lifetime Truegreen — client portal
   -----------------------------------------------------------
   Drives login.html and dashboard.html.

   HONEST SECURITY NOTE: this site is static (GitHub Pages),
   so there is no server to authenticate against. The password
   is what decrypts the dashboard URL — it is never sent
   anywhere and never stored. Anyone who already knows the
   Claude share link can still open it directly. This keeps the
   link out of the public repo and out of casual view; it is
   not a substitute for real authentication.
   =========================================================== */

import { decryptText } from './dashboard-crypto.mjs';

// The content file holds the whole dashboard page, encrypted, so nothing is
// served from a third party and there is no link for a viewer to copy. If it
// is absent we fall back to the link file, which holds only a URL.
var CONTENT_URL = 'data/dashboard-content.json';
var LINK_URL = 'data/dashboard.json';
var KEY_PAYLOAD = 'tg.portal.payload';
var KEY_MODE = 'tg.portal.mode';
var KEY_UPDATED = 'tg.portal.updated';

function saveSession(payload, mode, updatedAt) {
  sessionStorage.setItem(KEY_PAYLOAD, payload);
  sessionStorage.setItem(KEY_MODE, mode);
  sessionStorage.setItem(KEY_UPDATED, updatedAt || '');
}

function readSession() {
  return {
    payload: sessionStorage.getItem(KEY_PAYLOAD),
    mode: sessionStorage.getItem(KEY_MODE) || 'url',
    updatedAt: sessionStorage.getItem(KEY_UPDATED)
  };
}

function clearSession() {
  sessionStorage.removeItem(KEY_PAYLOAD);
  sessionStorage.removeItem(KEY_MODE);
  sessionStorage.removeItem(KEY_UPDATED);
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch (e) { return ''; }
}

function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ---------------------------------------------------------
   Login page
   --------------------------------------------------------- */
function initLogin(form) {
  var input = form.querySelector('#portal-password');
  var button = form.querySelector('button[type="submit"]');
  var error = document.querySelector('#portal-error');
  var buttonLabel = button.textContent;
  var config = null;

  // The markup ships the button disabled so the form cannot be submitted
  // before this module is wired up. It is safe to enable now.
  button.disabled = false;

  // Already unlocked in this tab — go straight through.
  if (readSession().payload) {
    location.replace('dashboard.html');
    return;
  }

  function fail(message) {
    error.textContent = message;
    error.hidden = false;
    form.classList.add('has-error');
    button.disabled = false;
    button.textContent = buttonLabel;
    input.focus();
    input.select();
  }

  function busy(on) {
    button.disabled = on;
    button.textContent = on ? 'Unlocking…' : buttonLabel;
    if (on) {
      error.hidden = true;
      form.classList.remove('has-error');
    }
  }

  function loadConfig(url, mode) {
    return fetch(url, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (json) {
        if (!json || json.configured === false) throw new Error('NOT_CONFIGURED');
        json.mode = json.mode || mode;
        return json;
      });
  }

  // Prefer the self-hosted dashboard; fall back to the link-only config.
  var loading = loadConfig(CONTENT_URL, 'content')
    .catch(function () { return loadConfig(LINK_URL, 'url'); })
    .then(function (json) { config = json; return json; });

  loading.catch(function (err) {
    if (err && err.message === 'NOT_CONFIGURED') {
      fail('The investor dashboard has not been published yet. Please check back shortly.');
    } else {
      fail('The portal is unavailable right now. Please try again later, or contact us on +27 11 391 0134.');
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var password = input.value;
    if (!password) { fail('Please enter your portal password.'); return; }

    busy(true);

    // Let the browser paint the "Unlocking…" state before PBKDF2
    // occupies the main thread for a few hundred milliseconds.
    requestAnimationFrame(function () {
      setTimeout(function () {
        loading
          .then(function (cfg) { return decryptText(cfg, password); })
          .then(function (plain) {
            var mode = (config && config.mode) || 'url';
            if (mode === 'url' && !/^https?:\/\//i.test(plain)) throw new Error('BAD_URL');
            saveSession(plain, mode, config && config.updatedAt);
            location.replace('dashboard.html');
          })
          .catch(function (err) {
            if (err && err.message === 'NOT_CONFIGURED') {
              fail('The investor dashboard has not been published yet. Please check back shortly.');
            } else if (err && err.message === 'BAD_URL') {
              fail('The stored dashboard link is invalid. Please contact us so we can republish it.');
            } else {
              fail('That password is not correct. Please check it and try again.');
            }
          });
      }, 0);
    });
  });
}

/* ---------------------------------------------------------
   Dashboard page
   --------------------------------------------------------- */
function initDashboard(shell) {
  var session = readSession();
  if (!session.payload) {
    location.replace('login.html');
    return;
  }

  var frame = shell.querySelector('#portal-frame');
  var fallback = shell.querySelector('#portal-fallback');
  var updated = shell.querySelector('#portal-updated');
  var logout = shell.querySelector('#portal-logout');
  var trouble = shell.querySelector('#portal-trouble');

  if (updated) {
    var pretty = formatDate(session.updatedAt);
    updated.textContent = pretty ? 'Updated ' + pretty : '';
    updated.hidden = !pretty;
  }

  if (logout) {
    logout.addEventListener('click', function (e) {
      e.preventDefault();
      clearSession();
      location.replace('login.html');
    });
  }

  /* --- Self-hosted mode -------------------------------------------------
     The decrypted payload is the whole dashboard page. Render it straight
     into the frame with srcdoc, so it is served from truegreen.co.za: no
     third-party branding, and no address a viewer can copy or forward.
     The sandbox withholds allow-same-origin, so the page runs in an opaque
     origin and cannot reach this page's session. The dashboard only uses
     click and mouse handlers, so nothing it needs is withheld.            */
  if (session.mode === 'content') {
    shell.classList.add('portal-selfhosted');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.removeAttribute('src');
    frame.srcdoc = session.payload;
    shell.classList.add('portal-loaded');

    // Nothing external to open, so hide the escape hatches entirely.
    Array.prototype.forEach.call(shell.querySelectorAll('[data-open-dashboard]'), function (a) {
      a.hidden = true;
    });
    if (trouble) trouble.hidden = true;
    return;
  }

  /* --- Link mode --------------------------------------------------------
     The payload is a URL. claude.ai sends `frame-ancestors 'self'`, so its
     pages can never be embedded here — go straight to the launch card for
     those. Other hosts are embedded, with a watchdog for URLs that hang.  */
  var openLinks = shell.querySelectorAll('[data-open-dashboard]');
  Array.prototype.forEach.call(openLinks, function (a) {
    a.href = session.payload;
    a.hidden = false;
  });

  var settled = false;
  var watchdog = setTimeout(function () {
    if (!settled) showFallback();
  }, 8000);

  function showFallback() {
    settled = true;
    clearTimeout(watchdog);
    shell.classList.add('portal-blocked');
    if (fallback) fallback.hidden = false;
  }

  frame.addEventListener('load', function () {
    settled = true;
    clearTimeout(watchdog);
    shell.classList.add('portal-loaded');
  });
  frame.addEventListener('error', showFallback);

  if (trouble) {
    trouble.addEventListener('click', function (e) {
      e.preventDefault();
      showFallback();
    });
  }

  if (/(^|\.)claude\.(ai|com)$/i.test(hostOf(session.payload))) {
    showFallback();
  } else {
    frame.src = session.payload;
  }
}

/* ---------------------------------------------------------
   Boot
   --------------------------------------------------------- */
var loginForm = document.querySelector('#portal-login');
if (loginForm) initLogin(loginForm);

var dashboard = document.querySelector('#portal-shell');
if (dashboard) initDashboard(dashboard);
