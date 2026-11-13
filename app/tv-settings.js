// Reel TV — Settings, made for the remote. Only what matters on a TV: who's signed in, how things play, and the
// app version. Everything else (keys, streaming service, imports, backups, looks) is set up on the computer and syncs.
// Each row is one button: OK steps to the next choice, Left/Right step back and forth.
(() => {
  if (typeof Views === 'undefined') return;
  // Also used by Reel on the web (phones): same screen, different words.
  const WEB = !!window.REEL_WEB, HERE = WEB ? 'this browser' : 'this TV', INFO = window.REEL_TV || window.REEL_WEB || {};
  const langs = () => {
    const L = typeof LANGS !== 'undefined' ? LANGS : { en: 'English' };
    const seen = new Set();
    return Object.entries(L).filter(([, v]) => !seen.has(v) && seen.add(v));
  };
  const ROWS = [
    { h: 'Playback' },
    { k: 'maxQuality', label: 'Best quality', num: true, opts: [[2160, '4K'], [1080, '1080p'], [720, '720p']] },
    { k: 'audioLang', label: 'Audio language', opts: langs },
    { k: 'autoPlay', label: 'Start the best stream automatically', bool: true },
    { k: 'nextEpSeconds', label: 'Next episode countdown', num: true, opts: [[5, '5 seconds'], [10, '10 seconds'], [20, '20 seconds'], [0, 'Off']] },
    { k: 'autoLog', label: 'Log movies to your diary when they finish', bool: true },
    { h: 'Subtitles' },
    { k: 'subsOn', label: 'Turn subtitles on automatically', bool: true },
    { k: 'subLang', label: 'Subtitle language', opts: langs },
  ];
  const optsOf = (r) => (typeof r.opts === 'function' ? r.opts() : r.opts);
  const shown = (r) => {
    const v = Store.settings[r.k];
    if (r.bool) return v ? 'On' : 'Off';
    const o = optsOf(r).find(([x]) => String(x) === String(v));
    return o ? o[1] : String(v ?? '');
  };
  function step(r, d) {
    const s = Store.settings;
    if (r.bool) s[r.k] = !s[r.k];
    else {
      const o = optsOf(r), i = o.findIndex(([x]) => String(x) === String(s[r.k]));
      const n = o[(i + d + o.length) % o.length][0];
      s[r.k] = r.num ? Number(n) : n;
    }
    Store.save(); if (typeof applyPrefs === 'function') applyPrefs();
  }

  Views.settings = async (root) => {
    const sec = await window.reel.getSecrets().catch(() => ({}));
    const p = (typeof Cloud !== 'undefined' && Cloud.profile) || null;
    const who = p ? (p.display_name || p.username) : '';
    const page = h(`<div class="page tvs"><h1 class="page-title">Settings</h1>
      <div class="tvs-list">
        <div class="tvs-h">Account</div>
        <div class="tvs-info"><span>${who ? 'Signed in as' : 'Not signed in'}</span><b>${who ? esc(who) + (p.username ? ` <i>@${esc(p.username)}</i>` : '') : ''}</b></div>
        <div class="tvs-info"><span>Streaming</span><b>${sec.hasRd ? esc(typeof debridName === 'function' ? debridName(sec.debrid) : 'Connected') : 'Not connected'}</b></div>
        <button class="tvs-row tvs-acct"><span>${who ? `Sign out of ${HERE}` : 'Sign in'}</span><b></b></button>
        ${ROWS.map((r, i) => r.h ? `<div class="tvs-h">${r.h}</div>` : `<button class="tvs-row" data-i="${i}"${r.bool ? '' : ' data-tv-lr'}><span>${r.label}</span><b></b></button>`).join('')}
        <div class="tvs-h">About</div>
        <div class="tvs-info"><span>${WEB ? 'Reel on the web' : 'Reel for TV'}</span><b>Version ${esc(INFO.version || '')}</b></div>
        <p class="tvs-note">Your streaming service, keys, Letterboxd import and backups are set up in Reel on your computer. They sync to ${HERE} automatically.${WEB ? '' : ' To get a new version of Reel for TV, install it again with Downloader.'}</p>
      </div></div>`);
    const paint = () => $$('.tvs-row[data-i]', page).forEach((b) => {
      const r = ROWS[b.dataset.i]; $('b', b).textContent = shown(r); b.classList.toggle('off', r.bool && !Store.settings[r.k]);
    });
    $$('.tvs-row[data-i]', page).forEach((b) => {
      const r = ROWS[b.dataset.i];
      b.onclick = () => { step(r, 1); paint(); };
      b.addEventListener('keydown', (e) => {
        if (r.bool || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault(); e.stopImmediatePropagation(); step(r, e.key === 'ArrowRight' ? 1 : -1); paint();
      });
    });
    $('.tvs-acct', page).onclick = async () => {
      if (!who) return AccountUI.signIn();
      const ok = await confirmTv(`Sign out of ${HERE}?`, WEB ? 'Your library stays in your account.' : 'Your library stays in your account. Link the TV again from Reel on your computer.', 'Sign out');
      if (ok) { await Cloud.signOut(false).catch(() => {}); location.reload(); }
    };
    paint();
    root.appendChild(page);
  };

  // A simple yes/no sheet the remote can answer.
  function confirmTv(title, text, yes) {
    return new Promise((res) => {
      const m = openModal(h(`<div class="tv-confirm"><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>
        <div class="btns"><button class="btn primary yes">${esc(yes)}</button><button class="btn cancel">Cancel</button></div></div>`));
      const root = m.el || m;
      const done = (v) => { try { (m.close || (() => root.closest('.modal-back')?.remove()))(); } catch {} res(v); };
      $('.yes', root).onclick = () => done(true);
      $('.cancel', root).onclick = () => done(false);
      setTimeout(() => window.tvFocus && window.tvFocus.focus($('.cancel', root)), 60);
    });
  }
})();
