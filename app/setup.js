// Reel — first-run setup and Settings.

const langOptions = () => Object.entries(LANGS).filter(([k], i, a) => a.findIndex(x => x[1] === LANGS[k]) === i).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

// Streaming form shared by setup and Settings: your debrid service + its API key.
// Reel plays only from your own debrid account — it never downloads or shares torrents.
const DEBRID_SERVICES = [
  { id: 'realdebrid', name: 'Real-Debrid', key: 'https://real-debrid.com/apitoken' },
  { id: 'torbox', name: 'TorBox', key: 'https://torbox.app/settings' },
  { id: 'alldebrid', name: 'AllDebrid', key: 'https://alldebrid.com/apikeys/' },
  { id: 'premiumize', name: 'Premiumize', key: 'https://www.premiumize.me/account' },
  { id: 'debridlink', name: 'Debrid-Link', key: 'https://debrid-link.com/webapp/apikey' },
  { id: 'easydebrid', name: 'EasyDebrid', key: 'https://easydebrid.com' },
  { id: 'offcloud', name: 'Offcloud', key: 'https://offcloud.com/#/account' },
];
const debridName = (id) => (DEBRID_SERVICES.find(d => d.id === id) || DEBRID_SERVICES[0]).name;
function streamingForm(saved) {
  const el = h(`<div class="stream-form">
    <div class="field"><label>Debrid service</label>
      <select class="input sf-svc">${DEBRID_SERVICES.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}</select>
    </div>
    <div class="field"><label class="sf-keylabel">API key</label>
      <input class="input rd" type="password" autocomplete="off" placeholder="${saved.hasRd ? '•••••••• saved — paste to replace' : 'Paste your API key'}">
      <div class="hint"><a class="sf-keylink" href="#">Find your API key</a> <span class="sf-keynote"></span></div>
    </div>
    <div class="hint sf-about">${ICON.check} Reel plays only from your own debrid account. It never downloads or shares torrents on your computer.</div>
  </div>`);
  const sel = $('.sf-svc', el);
  sel.value = DEBRID_SERVICES.some(d => d.id === saved.debrid) ? saved.debrid : 'realdebrid';
  const paint = () => {
    const d = DEBRID_SERVICES.find(x => x.id === sel.value) || DEBRID_SERVICES[0];
    $('.sf-keylabel', el).textContent = `${d.name} API key`;
    $('.sf-keynote', el).textContent = `(sign in to ${d.name} first)`;
  };
  sel.onchange = () => { paint(); $('.rd', el).focus(); };
  $('.sf-keylink', el).onclick = (e) => { e.preventDefault(); window.reel.openExternal((DEBRID_SERVICES.find(x => x.id === sel.value) || DEBRID_SERVICES[0]).key); };
  paint();
  el.value = () => ({ rdKey: $('.rd', el).value.trim(), debrid: sel.value });
  el.serviceName = () => debridName(sel.value);
  return el;
}

// ---------- First-run setup ----------
Views.setup = async (root) => {
  const saved = await window.reel.getSecrets();
  let step = Setup.tmdb ? (Setup.streaming ? 3 : 2) : 1;
  // A Reel account comes first (your debrid key, library and friends come with it).
  const signedIn = () => typeof Cloud !== 'undefined' && Cloud.on;
  if (step === 2 && !signedIn()) step = 'acct';
  const page = h(`<div class="setup"><div class="setup-card"></div></div>`);
  root.appendChild(page);
  const card = $('.setup-card', page);

  const dotN = () => (step === 'acct' ? 1 : step === 1 ? 1 : step);
  const dots = () => `<div class="steps">${[1, 2, 3].map(n => `<i class="${n === dotN() ? 'on' : n < dotN() ? 'done' : ''}"></i>`).join('')}</div>`;
  const busy = (btn, on, label) => { btn.disabled = on; btn.innerHTML = on ? `<span class="spinner sm"></span> ${label}` : label; };

  const render = () => {
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    if (step === 1) {
      card.innerHTML = `${dots()}
        <h1>Welcome to Reel</h1>
        <p class="lead">Your movies, your ratings, and everything you watch — in one place. Two quick connections and you’re in.</p>
        <div class="field"><label>TMDB API key or Read Access Token</label><input class="input tmdb" autocomplete="off" placeholder="Paste your TMDB key" value="${esc(saved.tmdbKey || '')}">
        <div class="hint">TMDB provides posters, details and search. It’s free: <a href="https://www.themoviedb.org/settings/api" target="_blank">create a key</a>.</div></div>
        <div class="err"></div>
        <div class="btns end"><button class="btn primary next">Continue</button></div>`;
      const input = $('.tmdb', card), btn = $('.next', card);
      setTimeout(() => input.focus(), 60);
      const go1 = async () => {
        const key = input.value.trim();
        if (!key) return ($('.err', card).textContent = 'Paste your TMDB key to continue.');
        busy(btn, true, 'Checking');
        TMDB.key = key; TMDB.cache.clear();
        try {
          await TMDB.get('/configuration');
          await window.reel.setSecrets({ tmdbKey: key });
          await TMDB.loadGenres();
          Setup.tmdb = true; step = 2; render();
        } catch (e) { TMDB.key = ''; busy(btn, false, 'Continue'); $('.err', card).textContent = 'That key didn’t work. Double-check it and try again.'; }
      };
      btn.onclick = go1;
      input.onkeydown = (e) => e.key === 'Enter' && go1();
    }
    if (step === 'acct') {
      card.innerHTML = `${dots()}
        <h1>Welcome to Reel</h1>
        <p class="lead">Start with your Reel account. It keeps your library, friends, watch parties and streaming setup with you on every computer.</p>
        <div class="acct-choices"><button class="btn primary si">Sign in</button><button class="btn ghost su">Create an account</button></div>
        <div class="dim acct-why">Use Discord, or a Reel username and password. No email needed.</div>
        <div class="err"></div>`;
      const open = (mode) => {
        if (typeof AccountUI === 'undefined' || typeof Cloud === 'undefined' || !Cloud.sb) { $('.err', card).textContent = 'Can’t reach Reel’s servers right now. Check your internet and try again.'; return; }
        AccountUI.signIn(mode === 'up' ? 'Create your Reel account to get started.' : 'Sign in with your Reel account.', mode);
      };
      $('.su', card).onclick = () => open('up');
      $('.si', card).onclick = () => open('in');
      const off = Cloud.watch(() => { if (signedIn() && step === 'acct') { off(); step = 2; if (route.name === 'setup') render(); } });
    }
    if (step === 2) {
      card.innerHTML = `${dots()}
        <h1>${saved.tmdbBuiltIn ? 'Welcome to Reel' : 'Connect streaming'}</h1>
        <p class="lead">${saved.tmdbBuiltIn ? 'One step and you’re in: connect' : 'Connect'} your debrid service — Reel plays movies and shows from your own account.</p>
        <div class="form-slot"></div>
        <div class="q-choice"><span>Picture quality</span><div class="acct-seg"><button type="button" data-q="1080" class="on">HD · 1080p</button><button type="button" data-q="2160">4K</button></div><em>HD works on any connection. 4K needs a fast connection and a 4K screen — change it any time in Settings.</em></div>
        <div class="err"></div>
        <div class="btns end">${saved.tmdbBuiltIn ? '' : '<button class="btn ghost back">Back</button>'}<button class="btn primary next">Connect</button></div>`;
      const form = streamingForm(saved);
      $('.form-slot', card).appendChild(form);
      let q = Store.settings.maxQuality === 2160 ? 2160 : 1080;
      const paintQ = () => $$('.q-choice button', card).forEach(b => b.classList.toggle('on', +b.dataset.q === q));
      $$('.q-choice button', card).forEach(b => (b.onclick = () => { q = +b.dataset.q; paintQ(); }));
      paintQ();
      const si = $('.setup-signin a', card);
      if (si) si.onclick = (e) => { e.preventDefault(); if (typeof AccountUI !== 'undefined') AccountUI.signIn('Sign in with the account you use on your other computer — your library and debrid key come with it.'); };
      const btn = $('.next', card);
      const bk = $('.back', card); if (bk) bk.onclick = () => { step = 1; render(); };
      btn.onclick = async () => {
        const v = form.value();
        if (!v.rdKey) return ($('.err', card).textContent = `Paste your ${form.serviceName()} API key.`);
        busy(btn, true, 'Testing');
        $('.err', card).textContent = '';
        try {
          const r = await window.reel.testStreaming(v);
          if (!r.total) throw new Error('Connected, but no streams came back. Check the API key and that the right service is picked.');
          await window.reel.setSecrets({ rdKey: v.rdKey, debrid: v.debrid, torrentioUrl: null });
          if (typeof Cloud !== 'undefined' && Cloud.user) Cloud.syncDebrid();
          Store.settings.maxQuality = q; Store.save();
          Setup.streaming = true; step = 3; render();
        } catch (e) { busy(btn, false, 'Connect'); $('.err', card).textContent = cleanErr(e); }
      };
    }
    if (step === 3) {
      card.innerHTML = `${dots()}
        <div class="done-ico">${ICON.check}</div>
        <h1>You’re all set</h1>
        <p class="lead">Teach Reel your taste: tap the movies and shows you’ve seen (takes a minute), or bring your Letterboxd history.</p>
        <button class="seen-cta"><span class="sc-ico">${ICON.eye}</span><span><b>Tap what you’ve seen</b><small>A wall of famous films and shows — one tap each. The fastest way to great recommendations.</small></span>${ICON.back.replace('<svg', '<svg style="transform:rotate(180deg)"')}</button>
        <div class="import-slot"></div>
        <div class="btns end"><button class="btn finish">Skip for now</button></div>`;
      $('.import-slot', card).appendChild(importBlock());
      $('.seen-cta', card).onclick = () => { Ambient.pool = []; packState.open = 'biggest'; packState.view = 'swipe'; go('discover', { mode: 'seen' }, true); };
      $('.finish', card).onclick = () => { Ambient.pool = []; go('home', {}, true); };
    }
  };
  render();
};

// Letterboxd import: pick the export folder or the .zip; everything inside is found automatically.
function importBlock() {
  const el = h(`<div class="import-block">
    <div class="btns"><button class="btn primary pick-zip">${Object.values(Store.data.items).some(i => i.lbImported) ? 'Re-sync from Letterboxd' : 'Choose your Letterboxd export'}</button><button class="btn ghost pick-folder">${ICON.folder} or an unzipped folder</button></div>
    <div class="dim lb-how">Get your export on Letterboxd (<a href="#" class="lb-get">Settings → Data → Export</a>), then pick the .zip it downloads. Importing again only adds what’s new, and fixes any title an earlier import got wrong.</div>
    <div class="progress-line" style="display:none"><i></i></div>
    <div class="status muted"></div>
  </div>`);
  const KINDS = [['watched', 'Watched films'], ['rating', 'Ratings'], ['diary', 'Diary entries'], ['review', 'Reviews'], ['like', 'Likes'], ['favorite', 'Favorite films'], ['watchlist', 'Watchlist'], ['list', 'Lists']];
  const run = async (kind) => {
    const status = $('.status', el), bar = $('.progress-line', el);
    $$('.import-pick, .import-done', el).forEach(x => x.remove());
    let exp;
    try { exp = await window.reel.lbPick(kind); } catch (e) { status.textContent = cleanErr(e); return; }
    if (!exp) return;
    const sum = letterboxdSummary(exp);
    if (!Object.values(sum).some(Boolean)) { status.textContent = 'No Letterboxd data found there. Choose the folder (or .zip) you downloaded from letterboxd.com → Settings → Data → Export.'; return; }
    status.textContent = '';
    // Step 1: choose what to bring in.
    const pick = h(`<div class="import-pick"><div class="dim" style="font-size:13px;margin-bottom:6px">Found in “${esc(exp.folder)}” — choose what to import</div>
      ${KINDS.map(([k, label]) => `<label class="check"><input type="checkbox" data-k="${k}" ${sum[k] ? 'checked' : 'disabled'}> ${label}<small>${sum[k].toLocaleString()}</small></label>`).join('')}
      <div class="dim" style="font-size:12px;margin:6px 0 14px">Favorites can’t be read from the export — add your four in Library.</div>
      <div class="btns"><button class="btn primary go-import">Import</button><button class="btn ghost cancel">Cancel</button></div></div>`);
    el.appendChild(pick);
    if (kind === 'zip') pick.hidden = true;   // re-sync: everything in the export, no checklist
    $('.cancel', pick).onclick = () => pick.remove();
    $('.go-import', pick).onclick = async () => {
      const kinds = new Set($$('input:checked', pick).map(c => c.dataset.k));
      if (!kinds.size) return;
      pick.remove();
      bar.style.display = '';
      $('i', bar).style.width = '0';
      try {
        const before = Store.values().filter(i => i.watched).length;
        const res = await importLetterboxd(exp, (d, t) => { status.textContent = `Importing ${d.toLocaleString()} of ${t.toLocaleString()}…`; $('i', bar).style.width = `${(d / t) * 100}%`; }, kinds);
        bar.style.display = 'none';
        status.textContent = '';
        const added = Store.values().filter(i => i.watched).length - before;
        const done = h(`<div class="import-done">${ICON.checkCircleFill}<div><b>Imported</b><div class="dim" style="font-size:13px">${added.toLocaleString()} new film${added === 1 ? '' : 's'}${res.fixed ? ` · fixed ${res.fixed} wrong match${res.fixed === 1 ? '' : 'es'}` : ''}${failed.length ? ` · ${failed.length} couldn’t be matched` : ''}</div></div></div>`);
        el.appendChild(done);
        Ambient.pool = []; Recs.cache = null;
        toast('Imported from Letterboxd');
      } catch (e) { status.textContent = cleanErr(e); bar.style.display = 'none'; }
    };
    if (kind === 'zip') $('.go-import', pick).click();
  };
  $('.pick-folder', el).onclick = () => run('folder');
  $('.lb-get', el).onclick = (e) => { e.preventDefault(); window.reel.openExternal('https://letterboxd.com/settings/data/'); };
  $('.pick-zip', el).onclick = () => run('zip');
  return el;
}

// ---------- Settings ----------
// Settings is split into a few sections (Account · Playback · Library · Appearance); the last one you used is remembered.
const SET_TABS = [['account', 'Account'], ['playback', 'Playback'], ['library', 'Library'], ['look', 'Appearance']];
const SET_PANEL_TAB = { Connections: 'account', Playback: 'playback', Subtitles: 'playback', 'Import from Letterboxd': 'library', 'Your data': 'library', 'Reset history': 'library', Appearance: 'look', 'Live TV': 'playback' };
let settingsTab = 'account';
Views.settings = async (root, params = {}) => {
  if (params.tab && SET_TABS.some(t => t[0] === params.tab)) settingsTab = params.tab;
  const sec = await window.reel.getSecrets();
  const s = Store.settings;
  const page = h(`<div class="page"><div class="settings-wrap">
    <h1 class="page-title">Settings</h1>
    <div class="set-tabs">${SET_TABS.map(([k, l]) => `<button data-t="${k}">${l}</button>`).join('')}</div>
    <div class="nudge-slot settings-nudge"></div>
    <div class="account-slot" data-tab="account"></div>

    <div class="panel"><h3>Connections</h3>
      <div class="conn"><div><b>Movie database</b><div class="dim">${sec.tmdbBuiltIn ? 'TMDB · built into Reel' : 'TMDB · your own key'}</div></div><span class="ok-dot"></span><button class="btn small ghost edit-tmdb">Change</button></div>
      <div class="tmdb-edit" style="display:none"><div class="field"><input class="input tmdb" type="password" autocomplete="off" placeholder="New TMDB key"></div><button class="btn small primary save-tmdb">Save</button></div>
      <div class="conn"><div><b>Streaming</b><div class="dim">${sec.hasRd ? debridName(sec.debrid) : 'Not connected'}</div></div><span class="ok-dot"></span><button class="btn small ghost edit-stream">Change</button></div>
      <div class="stream-edit" style="display:none"><div class="form-slot"></div><div class="err"></div><button class="btn small primary save-stream">Test & save</button></div>
    </div>

    <div class="panel"><h3>Playback</h3>
      <div class="grid2">
        <div class="field"><label>Max quality</label><select class="input" data-k="maxQuality" data-num><option value="2160">4K</option><option value="1080">1080p</option><option value="720">720p</option></select></div>
        <div class="field"><label>Audio language</label><select class="input" data-k="audioLang">${langOptions()}</select></div>
        <div class="field"><label>Next episode countdown</label><select class="input" data-k="nextEpSeconds" data-num><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="20">20 seconds</option><option value="0">Off</option></select></div>
      </div>
      <label class="check"><input type="checkbox" data-k="autoPlay"> Start the best stream automatically</label>
      <label class="check"><input type="checkbox" data-k="avoidDV"> Avoid Dolby Vision–only files (wrong colors on most PCs)</label>
      <label class="check"><input type="checkbox" data-k="autoLog"> Auto-log movies to your diary when they finish (you just add stars)</label>
      <label class="check"><input type="checkbox" data-k="discordStatus"> Show what I’m watching on my Discord profile</label>
    </div>

    <div class="panel"><h3>Subtitles</h3>
      <div class="grid2">
        <div class="field"><label>Language</label><select class="input" data-k="subLang">${langOptions()}</select></div>
        <div class="field"><label>Size</label><select class="input" data-k="subSize"><option value="s">Small</option><option value="m">Medium</option><option value="l">Large</option><option value="xl">Extra large</option></select></div>
      </div>
      <label class="check"><input type="checkbox" data-k="subsOn"> Turn subtitles on automatically</label>
      <label class="check"><input type="checkbox" data-k="subBg"> Background behind subtitles</label>
    </div>

    <div class="panel"><h3>Appearance</h3>
      <div class="grid2">
        <div class="field"><label>Card size</label><select class="input" data-k="cardSize"><option value="compact">Compact</option><option value="regular">Regular</option><option value="large">Large</option></select></div>
        <div class="field"><label>Accent</label><select class="input" data-k="accent"><option value="mono">Monochrome</option><option value="ice">Ice blue</option><option value="mint">Mint</option><option value="lavender">Lavender</option><option value="sunset">Sunset</option><option value="rose">Rose</option><option value="gold">Gold</option></select></div>
      </div>
      <div class="accent-preview"><span>Progress</span><div class="bar"><i></i></div><span class="stars-prev">★★★★☆</span><span class="tick">${ICON.checkCircleFill}</span></div>
      <label class="check"><input type="checkbox" data-k="ambient"> Artwork backgrounds on Library, Search and Settings</label>
      <label class="check"><input type="checkbox" data-k="heroRotate"> Rotate the featured banner</label>
      <label class="check"><input type="checkbox" data-k="showRatings"> Show your ratings under posters</label>
      <label class="check"><input type="checkbox" data-k="reduceMotion"> Reduce motion</label>
    </div>

    <div class="panel"><h3>Live TV</h3>
      <p>Watch live sports from your own IPTV subscription (an Xtream login or M3U playlist). Reel shows what’s on right now with live scores and picks the right channel. Reel doesn’t provide any channels itself.</p>
      <label class="check"><input type="checkbox" class="tv-toggle"> Show the Live TV tab</label>
    </div>

    <div class="panel"><h3>Import from Letterboxd</h3>
      <p>Export your data on letterboxd.com (Settings → Data → Export), then choose the downloaded folder or .zip. Watched films, ratings, diary, reviews, likes, watchlist and lists are all brought in.</p>
      <div class="import-slot"></div>
    </div>

    <div class="panel"><h3>Your data</h3>
      <p>Ratings, diary and lists are stored on this PC.</p>
      <div class="btns"><button class="btn exp">Export backup</button><button class="btn imp">Restore backup</button><input type="file" class="impf" accept=".json" style="display:none"></div>
    </div>

    <div class="panel"><h3 class="danger">Reset history</h3>
      <p>Erase your watched films, ratings, diary, reviews, likes, watchlist, lists, favorites and watch progress. Your keys and settings stay. Export a backup first if you might want it back.</p>
      <button class="btn danger reset">Reset history…</button>
    </div>
    <div class="dim" style="font-size:12.5px;margin:8px 4px">This product uses the TMDB API but is not endorsed or certified by TMDB.<br>Shortcuts: 1–5 switch tabs · / or Ctrl+K search · Backspace goes back · right-click any poster for quick actions.</div>
  </div></div>`);
  root.appendChild(page);
  profileNudge($('.settings-nudge', page));
  // Sections: tag each panel, then show one section at a time.
  $$('.panel', page).forEach(p => { const t = SET_PANEL_TAB[($('h3', p) || {}).textContent]; if (t) p.dataset.tab = t; });
  const showTab = (t) => {
    settingsTab = t;
    $$('.set-tabs button', page).forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $$('[data-tab]', page).forEach(p => p.classList.toggle('tab-off', p.dataset.tab !== t));
  };
  $$('.set-tabs button', page).forEach(b => (b.onclick = () => showTab(b.dataset.t)));
  showTab(settingsTab);
  page._showTab = showTab;
  if (typeof AccountUI !== 'undefined') AccountUI.panel($('.account-slot', page));
  personalOptions(page);

  // Bind every preference control.
  $$('[data-k]', page).forEach(c => {
    const k = c.dataset.k;
    if (c.type === 'checkbox') c.checked = !!s[k]; else c.value = String(s[k]);
    c.onchange = () => {
      s[k] = c.type === 'checkbox' ? c.checked : c.dataset.num !== undefined ? Number(c.value) : c.value;
      Store.save(); applyPrefs();
      if (k === 'ambient') Ambient.show(true);
      if (k === 'discordStatus' && typeof Party !== 'undefined') Party.discord();
      toast('Saved');
    };
  });

  const toggle = (btn, box) => { $(btn, page).onclick = () => { const b = $(box, page); b.style.display = b.style.display === 'none' ? '' : 'none'; }; };
  toggle('.edit-tmdb', '.tmdb-edit'); toggle('.edit-stream', '.stream-edit');
  const form = streamingForm(sec);
  $('.stream-edit .form-slot', page).appendChild(form);

  $('.save-tmdb', page).onclick = async () => {
    const key = $('.tmdb', page).value.trim(); if (!key) return;
    const old = TMDB.key; TMDB.key = key; TMDB.cache.clear();
    try { await TMDB.get('/configuration'); await window.reel.setSecrets({ tmdbKey: key }); toast('TMDB key saved'); go('settings', {}, true); }
    catch { TMDB.key = old; toast('That TMDB key didn’t work', true); }
  };
  $('.save-stream', page).onclick = async (e) => {
    const v = form.value(), err = $('.stream-edit .err', page);
    if (!v.rdKey) return (err.textContent = `Paste your ${form.serviceName()} API key.`);
    e.currentTarget.disabled = true;
    try {
      const r = await window.reel.testStreaming(v);
      if (!r.total) throw new Error('Connected, but no streams came back.');
      await window.reel.setSecrets({ rdKey: v.rdKey, debrid: v.debrid, torrentioUrl: null });
      if (typeof Cloud !== 'undefined' && Cloud.user) Cloud.syncDebrid();
      Playback.cache.clear();
      toast('Streaming connected'); go('settings', {}, true);
    } catch (ex) { err.textContent = cleanErr(ex); e.currentTarget.disabled = false; }
  };

  $('.import-slot', page).appendChild(importBlock());

  $('.exp', page).onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Store.data, null, 1)], { type: 'application/json' }));
    a.download = `reel-backup-${today()}.json`; a.click();
  };
  // Reset needs two separate confirmations.
  $('.reset', page).onclick = () => {
    const films = Store.values().filter(i => i.watched).length;
    const a = openModal(h(`<div><h3>Reset your history?</h3><p class="muted" style="line-height:1.5">This erases ${films.toLocaleString()} watched titles, ${Store.data.diary.length.toLocaleString()} diary entries, ${Store.data.lists.length} lists and all ratings, likes and progress.</p>
      <div class="btns" style="justify-content:flex-end;margin-top:20px"><button class="btn ghost no">Cancel</button><button class="btn danger yes">Continue</button></div></div>`));
    $('.no', a.el).onclick = a.close;
    $('.yes', a.el).onclick = () => {
      a.close();
      const b = openModal(h(`<div><h3>Are you absolutely sure?</h3><p class="muted" style="line-height:1.5">This can’t be undone. Type <b>RESET</b> to confirm.</p>
        <input class="input conf" placeholder="RESET" style="margin-top:8px">
        <div class="btns" style="justify-content:flex-end;margin-top:20px"><button class="btn ghost no">Cancel</button><button class="btn danger-solid yes" disabled>Erase everything</button></div></div>`));
      const inp = $('.conf', b.el), yes = $('.yes', b.el);
      setTimeout(() => inp.focus(), 50);
      inp.oninput = () => (yes.disabled = inp.value.trim().toUpperCase() !== 'RESET');
      $('.no', b.el).onclick = b.close;
      yes.onclick = () => {
        Object.assign(Store.data, { items: {}, diary: [], lists: [], progress: {}, episodes: {}, swipeCount: 0, favorites: [], subDelay: {} });
        Store.save(); Recs.cache = null; Ambient.pool = [];
        b.close(); toast('History reset'); go('settings', {}, true);
      };
    };
  };

  const impf = $('.impf', page);
  $('.imp', page).onclick = () => impf.click();
  impf.onchange = async () => {
    try {
      const d = JSON.parse(await impf.files[0].text());
      if (!d.items) throw new Error('Not a Reel backup');
      if (!confirm('Replace your current library with this backup?')) return;
      Store.data = Object.assign({ items: {}, diary: [], lists: [], progress: {}, episodes: {}, swipeCount: 0, favorites: [], subDelay: {} }, d, { settings: Object.assign({}, Store.settings, d.settings) });
      Store.save(); Recs.cache = null; applyPrefs(); toast('Backup restored');
    } catch (e) { toast(cleanErr(e), true); }
  };
};

// Version line at the bottom, and the Live TV switch.
function personalOptions(page) {
  const wrap = $('.settings-wrap', page);
  const ver = h('<div class="settings-ver dim">Reel</div>');
  wrap.appendChild(ver);
  window.reel.version().then(v => { ver.textContent = `Reel ${v}`; }).catch(() => {});
  try { localStorage.removeItem('reel:personal'); localStorage.removeItem('reel:tw'); } catch {}   // leftovers from the old Twitch tab
  const tv = $('.tv-toggle', page);
  tv.checked = LiveTV.enabled();
  tv.onchange = () => { LiveTV.setEnabled(tv.checked); toast(tv.checked ? 'Live TV tab added' : 'Live TV tab removed'); };
}