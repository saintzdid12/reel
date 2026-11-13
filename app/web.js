// Reel on the web — the glue: your debrid service comes from your account (never the key), the phone/browser Back
// button works like Reel's Back, and computer-only features stay out of the way.
(() => {
  // ---- debrid: only ask WHETHER the account has a key and which service (the key stays on the server) ----
  if (typeof Cloud !== 'undefined') {
    Cloud.syncDebrid = async function () {
      if (!this.sb || !this.user) return;
      try {
        const { data, error } = await this.sb.from('user_keys').select('debrid, updated_at').eq('user_id', this.user.id).maybeSingle();
        if (error) throw error;
        const had = !!(await window.reel.getSecrets()).hasRd;
        if (data) {
          await window.reel.setSecrets({ debrid: data.debrid });
          if (typeof Playback !== 'undefined') Playback.cache.clear();
          document.dispatchEvent(new CustomEvent('reel:debrid', { detail: { fresh: !had, debrid: data.debrid } }));
        }
      } catch (e) { console.error('[web] debrid', e); }
    };
  }

  // ---- no Live TV on the web ----
  if (typeof LiveTV !== 'undefined') { LiveTV.enabled = () => false; LiveTV.addNav = () => {}; try { LiveTV.removeNav(); } catch {} }

  // ---- Back button (phone gesture / browser Back): close the player or a sheet, else go back a screen ----
  // Every screen change adds a history step, so Back never leaves Reel by accident.
  if (typeof go === 'function') {
    const go0 = go;
    window.go = function (name, params, replace, ...rest) {
      const r = go0(name, params, replace, ...rest);
      if (!replace && !window.__webPopping) { try { history.pushState({ reel: Date.now() }, ''); } catch {} }
      return r;
    };
  }
  try { history.replaceState({ reel: 0 }, ''); history.pushState({ reel: 1 }, ''); } catch {}
  window.addEventListener('popstate', () => {
    const keep = () => { try { history.pushState({ reel: Date.now() }, ''); } catch {} };
    if (typeof Player !== 'undefined' && Player.cur) { Player.close(); keep(); return; }
    const sheets = document.querySelectorAll('.modal-back');
    if (sheets.length) { const top = sheets[sheets.length - 1]; top.close ? top.close() : top.remove(); keep(); return; }
    const menu = document.querySelector('.ctx-menu, .rate-pop'); if (menu) { menu.close ? menu.close() : menu.remove(); keep(); return; }
    if (typeof backStack !== 'undefined' && backStack.length && typeof back === 'function') { window.__webPopping = true; back(); window.__webPopping = false; return; }
    if (typeof route !== 'undefined' && route.name !== 'home' && typeof go === 'function') { window.__webPopping = true; go('home'); window.__webPopping = false; keep(); return; }
    keep();
  });

  // ---- phones: a class for layout, and the install banner on iPhone ----
  const phone = window.matchMedia('(max-width: 760px)');
  // On phones the tabs become a bottom bar; they live outside the top bar so they can span the screen.
  const tabs = document.getElementById('tabs'), navEl = document.getElementById('nav'), cluster = navEl && navEl.querySelector('.nav-cluster');
  const paint = () => {
    document.body.classList.toggle('phone', phone.matches);
    if (!tabs || !navEl) return;
    if (phone.matches && tabs.parentElement === navEl) document.body.appendChild(tabs);
    else if (!phone.matches && tabs.parentElement !== navEl) navEl.insertBefore(tabs, cluster);
  };
  paint(); phone.addEventListener ? phone.addEventListener('change', paint) : phone.addListener(paint);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
