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

  // ---- signing out clears this browser (library, service, sync state), then back to the sign-in screen ----
  if (typeof Cloud !== 'undefined' && Cloud.signOut) {
    const signOut0 = Cloud.signOut.bind(Cloud);
    Cloud.signOut = async function (...a) {
      try { await signOut0(...a); } catch {}
      await window.reel.wipe();
      location.reload();
    };
  }

  // ---- Discord sign-in: off to Discord in this tab, back to this page (bridge finishes it) ----
  if (typeof Cloud !== 'undefined') {
    Cloud.redirect = () => location.origin + location.pathname;
    Cloud.signInDiscord = async function () {
      const { data, error } = await this.sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: this.redirect(), skipBrowserRedirect: true } });
      if (error) throw error;
      location.href = data.url;
    };
  }

  // ---- search: on phones the box sits at the very top (with Cancel), the type chips on one row, and the other
  // filters fold behind one "Filters" button. On a computer everything shows as before. ----
  if (typeof Views !== 'undefined' && Views.search) {
    const search0 = Views.search;
    Views.search = async (root, params) => {
      await search0(root, params);
      const page = root.querySelector('.page') || root;
      const sb = page.querySelector('.search-bar'), input = sb && sb.querySelector('.q'), bar = page.querySelector('.search-filters');
      if (input) { input.placeholder = 'Movies, shows, people'; input.setAttribute('enterkeyhint', 'search'); input.setAttribute('autocomplete', 'off'); }
      if (sb && !sb.querySelector('.sb-cancel')) {
        sb.insertBefore(h(`<span class="sb-ic">${ICON.search}</span>`), input);
        const c = h('<button class="sb-cancel">Cancel</button>');
        c.onclick = () => { if (input) input.blur(); if (typeof backStack !== 'undefined' && backStack.length && typeof back === 'function') back(); else go('home'); };
        sb.appendChild(c);
      }
      if (bar && !bar.querySelector('.ph-filters-btn')) {
        const btn = h(`<button class="ph-filters-btn">${ICON.filter}<span>Filters</span></button>`);
        const active = () => [...bar.querySelectorAll('.gsel b')].filter((b) => b.textContent && !/^Any/.test(b.textContent)).length
          + (/Unseen/.test((bar.querySelector(':scope > .seg:last-of-type .on, :scope > .segm:last-of-type .on') || {}).textContent || '') ? 1 : 0);
        const paint = () => { const n = active(); btn.classList.toggle('on', bar.classList.contains('open') || n > 0); btn.querySelector('span').textContent = n ? `Filters · ${n}` : 'Filters'; };
        btn.onclick = () => { bar.classList.toggle('open'); paint(); };
        bar.addEventListener('click', () => setTimeout(paint, 50));
        const first = bar.firstElementChild;
        if (first) first.after(btn); else bar.appendChild(btn);
        paint();
      }
    };
  }

  // ---- no Live TV on the web ----
  if (typeof LiveTV !== 'undefined') { LiveTV.enabled = () => false; LiveTV.addNav = () => {}; try { LiveTV.removeNav(); } catch {} }

  // ---- Back button (phone gesture / browser Back): close the player or a sheet, else go back a screen ----
  // Every screen change adds a history step, so Back never leaves Reel by accident.
  if (typeof go === 'function') {
    const go0 = go;
    window.go = function (name, params, replace, ...rest) {
      document.body.dataset.route = name;
      const r = go0(name, params, replace, ...rest);
      Promise.resolve(r).then(() => { if (typeof route !== 'undefined') document.body.dataset.route = route.name; }).catch(() => {});
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
  const phone = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 540px)');
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
