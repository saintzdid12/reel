// Reel — router and startup.

let route = { name: 'home', params: {} };
const backStack = [];
let leaveFns = [];
function onLeave(fn) { leaveFns.push(fn); }

// Setup must be finished (TMDB key + a streaming source) before the rest of the app opens.
const Setup = { tmdb: false, streaming: false, get done() { return this.tmdb && this.streaming; } };

// Pages with their own full-bleed artwork don't need the ambient backdrop.
const OWN_ART = new Set(['home', 'movies', 'tv', 'detail']);

// Main tabs. Opening a title or category from a tab keeps that tab highlighted, and Back returns to the same spot.
const TABS = ['home', 'movies', 'tv', 'discover', 'library'];

async function go(name, params = {}, replace = false, keepScroll = false, restoreScroll = null) {
  if (!Setup.done && name !== 'setup') { name = 'setup'; params = {}; replace = true; }
  if (name === 'swipe') name = 'discover';
  const view0 = $('#view');
  if (TABS.includes(name) && !replace) {                             // a tab click starts fresh
    backStack.length = 0;
    if (name === 'library') Fresh.reset('library');
    if (name === 'discover') { Fresh.reset('mood', 'seen', 'rank', 'taste'); if (!params.mode) discState.mode = 'foryou'; }
  }
  if (name === 'search' && !replace) Fresh.reset('search');
  else if (!replace && (route.name !== name || JSON.stringify(route.params) !== JSON.stringify(params))) backStack.push({ ...route, scroll: view0.scrollTop, shelves: shelfPositions() });
  const tab = TABS.includes(name) ? name : ['search', 'settings', 'setup', 'friends', 'friend'].includes(name) ? null
    : route.tab || (name === 'genre' ? (params.type === 'tv' ? 'tv' : 'movies') : name === 'list' ? 'library' : null);
  route = { name, params, tab };
  leaveFns.forEach(f => { try { f(); } catch {} });
  leaveFns = [];
  document.querySelectorAll('.rate-pop, .ctx-menu').forEach(p => (p.close ? p.close() : p.remove()));
  document.body.classList.toggle('setup-mode', name === 'setup');
  const view = $('#view');
  const scroll = view.scrollTop;
  view.dataset.view = name;
  view.innerHTML = '';
  const root = document.createElement('div');
  view.appendChild(root);
  view.scrollTop = 0;
  ScrollKeeper.watch(root);
  $$('[data-go]').forEach(b => b.classList.toggle('active', b.dataset.go === (tab || name)));
  moveIndicator();
  const bb = $('#backBtn');
  bb.classList.toggle('show', backStack.length > 0 && !TABS.includes(name) && name !== 'setup');
  // Like a macOS toolbar: the Back button names where it goes ("‹ Library", "‹ Dune").
  const prev = backStack[backStack.length - 1];
  const prevName = !prev ? 'Back' : prev.name === 'detail' ? (Store.item(`${prev.params.type}:${prev.params.id}`) || {}).title || 'Back'
    : prev.name === 'genre' ? prev.params.name || 'Back' : prev.name === 'list' ? ((Store.data.lists.find(l => l.id === prev.params.id) || {}).name || 'List')
    : ({ home: 'Home', movies: 'Movies', tv: 'TV Shows', discover: 'For You', library: 'Library', search: 'Search', settings: 'Settings', person: 'Back', review: 'Year in Review', complete: 'Your profile', friends: 'Friends' })[prev.name] || 'Back';
  $('span', bb).textContent = prevName.length > 22 ? prevName.slice(0, 20) + '…' : prevName;
  bb.title = prev ? `Back to ${prevName}` : 'Back';
  Ambient.show(!OWN_ART.has(name));
  try {
    await Views[name](root, params);
    if (keepScroll) view.scrollTop = scroll;
    if (restoreScroll != null) {
      // Put you back where you were — but the moment you scroll, click or press a key, stop re-applying it.
      let mine = false;
      const stop = () => { mine = true; ['wheel', 'pointerdown', 'keydown', 'touchstart'].forEach(ev => window.removeEventListener(ev, stop, true)); };
      ['wheel', 'pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, stop, { capture: true, passive: true }));
      const apply = () => { if (!mine && Math.abs(view.scrollTop - restoreScroll) > 4) view.scrollTop = restoreScroll; };
      apply(); setTimeout(apply, 350); setTimeout(() => { apply(); stop(); }, 900);
    }
  } catch (e) {
    if (String(e.message) === 'NO_TMDB') { Setup.tmdb = false; return go('setup', {}, true); }
    if (/OFFLINE|TMDB_DOWN/.test(String(e.message))) return offlineScreen(root, String(e.message));
    root.innerHTML = `<div class="page"><div class="center-empty glass-empty"><div class="empty-ico">${ICON.x}</div><h3>Something went wrong</h3>${esc(cleanErr(e))}<br><br><button class="btn" onclick="rerender()">Try again</button></div></div>`;
  }
}
// Offline / TMDB-down page: clean, explains what still works, and retries by itself.
function offlineScreen(root, code) {
  const off = code === 'OFFLINE' || !navigator.onLine;
  Net.fail(off ? 'OFFLINE' : 'TMDB_DOWN');
  root.innerHTML = '';
  const el = h(`<div class="page offline-screen"><div class="off-card">
    <div class="off-ico">${off
      ? '<svg viewBox="0 0 24 24"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.1 4.5 4.5 0 0 0 7 18z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v3.5M12 16v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'}</div>
    <h2>${off ? 'You’re offline' : 'TMDB isn’t responding'}</h2>
    <p class="muted">${off ? 'Reel needs the internet for posters, details and streaming. Your library, diary, ratings and lists are all saved on this PC.' : 'The movie database Reel uses for posters and details is down or busy right now. That’s on their side — your library is safe.'}</p>
    <div class="off-retry"><span class="spinner sm"></span><span class="off-msg">Trying again automatically…</span></div>
    <div class="btns" style="justify-content:center;margin-top:18px"><button class="btn primary now">Try now</button><button class="btn lib">Open my Library</button></div>
  </div></div>`);
  root.appendChild(el);
  let n = 0, t;
  const retry = async () => {
    if (!el.isConnected) return;
    $('.off-msg', el).textContent = 'Checking…';
    try { await TMDB.get('/configuration', { _: Date.now() }); Net.ok(); if (el.isConnected) rerender(); }
    catch { n++; const wait = Math.min(30, 5 * n); $('.off-msg', el).textContent = `Trying again in ${wait}s…`; t = setTimeout(retry, wait * 1000); }
  };
  $('.now', el).onclick = () => { clearTimeout(t); retry(); };
  $('.lib', el).onclick = () => go('library');
  t = setTimeout(retry, 5000);
  onLeave(() => clearTimeout(t));
}

// Each row's sideways scroll, keyed by its title, so Back can put every row where you left it.
function shelfPositions() {
  const out = {};
  document.querySelectorAll('#view .shelf').forEach(s => {
    const t = s.parentElement && s.parentElement.querySelector('h2');
    if (t && s.scrollLeft > 0) out[t.textContent.trim()] = s.scrollLeft;
  });
  return out;
}
window.__shelfRestore = {};
function back() {
  const r = backStack.pop();
  if (!r) return;
  window.__shelfRestore = r.shelves || {};
  route = { name: r.name, params: r.params, tab: r.tab };
  go(r.name, r.params, true, false, r.scroll || 0);
}
function rerender() { if (route.name === 'discover' || route.name === 'setup') return; go(route.name, route.params, true, true); }

$$('[data-go]').forEach(b => (b.onclick = () => go(b.dataset.go)));
$('#backBtn').onclick = back;

// Mouse "back" side button (and the Windows back app-command): close the top sheet/menu first, else go back.
let lastNavBack = 0;
function navBack() {
  if (Player.active() || Date.now() - lastNavBack < 350) return;   // one press can arrive twice (mouse + app-command)
  lastNavBack = Date.now();
  const menu = document.querySelector('.ctx-menu, .rate-pop');
  if (menu) return menu.close ? menu.close() : menu.remove();
  const sheets = document.querySelectorAll('.modal-back');
  if (sheets.length) return sheets[sheets.length - 1].close();
  back();
}
window.addEventListener('mouseup', (e) => { if (e.button === 3) { e.preventDefault(); navBack(); } });
window.addEventListener('auxclick', (e) => { if (e.button === 3 || e.button === 4) e.preventDefault(); });
if (window.reel.onNavBack) window.reel.onNavBack(() => navBack());

// Glass tooltips: any button's title becomes a small label on hover.
const tip = document.createElement('div');
tip.id = 'tip';
document.body.appendChild(tip);
let tipT;
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest && e.target.closest('[title], [data-tip]');
  if (!el) return;
  if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }
  clearTimeout(tipT);
  tipT = setTimeout(() => {
    if (!el.isConnected || !el.matches(':hover')) return;
    tip.textContent = el.dataset.tip;
    const r = el.getBoundingClientRect();
    tip.classList.add('on');
    const below = r.top < 70;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
    tip.style.top = `${below ? r.bottom + 10 : r.top - tip.offsetHeight - 10}px`;
  }, 280);
});
document.addEventListener('mouseout', (e) => { if (e.target.closest && e.target.closest('[data-tip]')) { clearTimeout(tipT); tip.classList.remove('on'); } });
document.addEventListener('pointerdown', () => { clearTimeout(tipT); tip.classList.remove('on'); });

// Sliding highlight behind the active tab.
function moveIndicator() {
  const ind = $('#tabs .indicator'), active = $('#tabs button.active');
  if (!active) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1;
  ind.style.width = `${active.offsetWidth}px`;
  ind.style.transform = `translateX(${active.offsetLeft}px)`;
}
window.addEventListener('resize', moveIndicator);
document.fonts.ready.then(moveIndicator);

// Soft, blurred artwork behind plain pages (Library, Settings, Search…) so they never look flat black.
const Ambient = {
  el: null, pool: [],
  show(on) {
    this.el = this.el || $('#ambient');
    const enabled = on && Store.settings.ambient;
    this.el.classList.toggle('on', enabled);
    if (enabled) this.pick();
  },
  async pick() {
    if (!this.pool.length) {
      const mine = Store.values().filter(i => i.backdrop && (i.watched || i.watchlist)).map(i => i.backdrop);
      let trend = [];
      try { trend = (await TMDB.list('/trending/movie/week', {}, 'movie')).map(m => m.backdrop).filter(Boolean); } catch {}
      this.pool = shuffle([...mine, ...trend]).slice(0, 20);
    }
    const img = this.pool[Math.floor(Math.random() * this.pool.length)];
    if (!img) return;
    const layers = $$('.amb', this.el);
    const next = layers.find(l => !l.classList.contains('vis')) || layers[0];
    const pre = new Image();
    pre.onload = () => { next.style.backgroundImage = `url('${pre.src}')`; layers.forEach(l => l.classList.toggle('vis', l === next)); };
    pre.src = TMDB.img(img, 'w780');
  },
};

// Apply display preferences as body classes.
function applyPrefs() {
  const s = Store.settings;
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
  document.body.classList.toggle('compact', s.cardSize === 'compact');
  document.body.classList.toggle('large-cards', s.cardSize === 'large');
  document.body.dataset.subsize = s.subSize;
  document.body.dataset.accent = s.accent || 'mono';
  document.body.classList.toggle('subs-nobg', !s.subBg);
}

// Cursor-tracked highlight on glass controls and cards (a subtle specular glow).
document.addEventListener('pointermove', (e) => {
  const t = e.target.closest && e.target.closest('.btn, .card .art, .tile, .list-card, .panel, .stream, .genre-tile, .pill, .nav-cluster');
  if (!t) return;
  const r = t.getBoundingClientRect();
  t.style.setProperty('--mx', `${e.clientX - r.left}px`);
  t.style.setProperty('--my', `${e.clientY - r.top}px`);
}, { passive: true });
// Press ripple on buttons.
document.addEventListener('pointerdown', (e) => {
  const b = e.target.closest && e.target.closest('.btn, .pbtn, .icon-btn, .chips button, .seg button, .pill button');
  if (!b) return;
  const r = b.getBoundingClientRect(), dot = document.createElement('span');
  dot.className = 'ripple';
  dot.style.left = `${e.clientX - r.left}px`; dot.style.top = `${e.clientY - r.top}px`;
  b.appendChild(dot);
  setTimeout(() => dot.remove(), 600);
});

// Clock in the top-right cluster, like tvOS.
const tick = () => ($('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
tick(); setInterval(tick, 15000);
$('#view').addEventListener('scroll', (e) => $('#nav').classList.toggle('scrolled', e.target.scrollTop > 40));
ScrollKeeper.init();

// Safety net: if the wheel lands on something that isn't part of the page's scroll (pinned artwork, the empty
// area beside the nav, the ambient background…), scroll the page anyway. Menus, popovers, sheets and the player
// keep their own scrolling.
window.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.defaultPrevented) return;
  const view = $('#view');
  if (route.name === 'livetv' || document.querySelector('.modal-back, .player') || e.target.closest && e.target.closest('.ctx-menu, .rate-pop, #modal-root, #player-root, .popover')) return;
  // Walk up from the cursor: if we reach #view through normal (non-pinned) elements, the browser handles it.
  for (let el = e.target; el && el !== document.body; el = el.parentElement) {
    if (el === view) return;
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed') break;
    // An inner scroller (a shelf, a list) that can still move in this direction keeps the wheel.
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      const canMove = e.deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
      if (canMove) return;
    }
  }
  const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * view.clientHeight : e.deltaY;
  view.scrollBy({ top: dy, behavior: 'auto' });
}, { passive: true });
window.addEventListener('mouseup', (e) => { if (e.button === 3 && !Player.active()) back(); });
document.addEventListener('keydown', (e) => {
  if (Player.active() || document.querySelector('.modal-back') || !Setup.done) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  const openSearch = () => (route.name === 'livetv' && typeof LiveTV !== 'undefined' && LiveTV.el ? LiveTV.openSearch() : go('search'));   // Live TV has its own search
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  if (e.key === '/' && !typing) { e.preventDefault(); openSearch(); }
  if (e.altKey && e.key === 'ArrowLeft') back();
  if (e.key === 'Escape' && document.body.dataset.winfs === '1' && route.name !== 'livetv' && !Player.active()) window.reel.fullscreen(false);
  if (e.key === 'Backspace' && !typing && !['discover', 'livetv'].includes(route.name)) back();
  if (!typing && !e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key) && TABS[+e.key - 1] && !['discover', 'livetv'].includes(route.name)) go(TABS[+e.key - 1]);
});

// Launch: a short logo animation while the first page loads, then it lifts away.
function endLaunch() {
  const l = document.getElementById('launch');
  if (!l || l.classList.contains('out')) return;
  l.classList.add('out');
  setTimeout(() => l.remove(), 700);
}
(async () => {
  const t0 = Date.now();
  setTimeout(endLaunch, 4000);   // never longer than this, even on a slow connection
  await Store.init();
  applyPrefs();
  if (Store.settings.reduceMotion) endLaunch();
  const sec = await window.reel.getSecrets();
  TMDB.key = sec.tmdbKey || '';
  Setup.tmdb = !!TMDB.key;
  Setup.streaming = !!sec.hasRd;
  if (TMDB.key) { await TMDB.loadGenres().catch(() => {}); setTimeout(() => Recs.backfill(), 4000); }
  // Always opens on Home (or setup on a first run).
  try { localStorage.removeItem('reel:lastTab'); } catch {}
  await go(Setup.done ? 'home' : 'setup', {}, true);
  setTimeout(endLaunch, Math.max(0, 1100 - (Date.now() - t0)));
  // Reel account (optional): sign-in session, library sync, friends. Never blocks startup.
  const takeLink = async () => { const l = window.reel.cloud && await window.reel.cloud.takeLink(); if (l) openLink(l); };
  if (typeof Cloud !== 'undefined') Cloud.init().then(takeLink).catch(e => { console.error('[cloud]', e); takeLink(); });
  else takeLink();
  window.reel.updateStatus && window.reel.updateStatus().then(v => { if (v) updateToast(v); });
})();

// Playing something brings it back to Continue Watching if you'd removed it.
document.addEventListener('reel:play', (e) => { const m = e.detail && e.detail.meta; const it = m && Store.item(`${m.type}:${m.id}`); if (it && it.cwHiddenAt) { delete it.cwHiddenAt; Store.save(); } });
// reel:// links — watch party invites (reel://party/CODE).
function openLink(url) {
  url = String(url || '');
  const m = url.match(/^reel:\/\/(party|join)\/([A-Za-z0-9]{4,12})/i);
  if (m && typeof Party !== 'undefined') { if (!Setup.done) return toast('Finish setting up Reel first, then open the invite again'); return Party.join(m[2]); }
}
if (window.reel.cloud) window.reel.cloud.onDeepLink(openLink);
// Signed in on a new computer: the debrid key came from the account, so setup is done.
document.addEventListener('reel:debrid', (e) => {
  Setup.streaming = true;
  if (route.name === 'setup') { toast('Signed in — you’re all set'); go('home', {}, true); }
  else if (e.detail && e.detail.fresh) toast('Your debrid key came from your Reel account');
  else if (route.name === 'settings') go('settings', {}, true);
});
// Updates (Windows): a top-bar button appears as soon as one is found, shows download progress, then
// "Update ready · Restart". Restarting shows an "Updating Reel" screen so the app doesn't just vanish.
const UPD_ICON = '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 3v10.2l3.6-3.6L17 11l-5 5-5-5 1.4-1.4 3.6 3.6V3zM5 19h14v2H5z"/></svg>';
function updButton() {
  let b = document.querySelector('#nav .upd-btn');
  if (!b) {
    b = document.createElement('button'); b.className = 'upd-btn';
    const nav = document.getElementById('nav'); if (nav) nav.appendChild(b);
  }
  return b;
}
function updateDownloading(v) {
  const b = updButton(); if (b.classList.contains('ready')) return;
  b.classList.add('loading'); b.disabled = true; b.title = `Downloading Reel ${v}`;
  b.innerHTML = `<span class="spinner sm"></span><span>Downloading update…</span>`;
}
function updateProgress(p) {
  const b = document.querySelector('#nav .upd-btn.loading'); if (b) b.lastElementChild.textContent = `Downloading update · ${p}%`;
}
function installNow(v) {
  const o = document.createElement('div'); o.className = 'upd-screen';
  o.innerHTML = `<div class="spinner"></div><b>Updating Reel${v ? ' to ' + v : ''}…</b><span>Reel will close, install the update, and open again by itself. This takes about a minute.</span>`;
  document.body.appendChild(o);
  try { document.querySelector('.player') && Player.close && Player.close(); } catch {}
  setTimeout(() => window.reel.installUpdate(), 1600);
}
function updateToast(v) {
  const b = updButton();
  b.classList.remove('loading'); b.classList.add('ready'); b.disabled = false; b.title = `Restart Reel to install version ${v}`;
  b.innerHTML = `${UPD_ICON}<span>Update ready · Restart</span>`;
  b.onclick = () => { b.disabled = true; installNow(v); };
}
if (window.reel.onUpdateReady) window.reel.onUpdateReady(updateToast);
if (window.reel.onUpdateDownloading) window.reel.onUpdateDownloading(updateDownloading);
if (window.reel.onUpdateProgress) window.reel.onUpdateProgress(updateProgress);
// Mac: a new version can't install itself (Apple signing), so the button downloads it instead.
function macUpdateButton(u) {
  if (!u || document.querySelector('#nav .upd-btn')) return;
  const b = document.createElement('button');
  b.className = 'upd-btn'; b.title = `Download Reel ${u.version} — open it and drag Reel into Applications`;
  b.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 3v10.2l3.6-3.6L17 11l-5 5-5-5 1.4-1.4 3.6 3.6V3zM5 19h14v2H5z"/></svg><span>Reel ${u.version} · Download</span>`;
  b.onclick = () => { window.reel.openExternal(u.url); toast('Open the download, then drag Reel into Applications (replace the old one)'); };
  const nav = document.getElementById('nav'); if (nav) nav.appendChild(b);
}
if (window.reel.onUpdateAvailable) window.reel.onUpdateAvailable(macUpdateButton);
if (window.reel.macUpdate) window.reel.macUpdate().then(macUpdateButton);
document.body.classList.toggle('mac', window.reel.platform === 'darwin');
// Changes from your other devices: refresh the page you're on (quietly, and never mid-typing or mid-movie).
// It also waits while you're actively clicking, scrolling or pressing keys, so the page never changes under you.
let syncedT, lastInputAt = 0;
['keydown', 'pointerdown', 'wheel'].forEach(ev => window.addEventListener(ev, () => { lastInputAt = Date.now(); }, { capture: true, passive: true }));
document.addEventListener('reel:synced', () => {
  clearTimeout(syncedT);
  syncedT = setTimeout(function again() {
    const busy = Player.active() || document.querySelector('.modal-back, .ctx-menu, .rate-pop') || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')
      || Date.now() - lastInputAt < 8000;
    if (busy) { syncedT = setTimeout(again, 3000); return; }
    Recs.cache = null;
    if (['home', 'library', 'detail', 'list', 'friends', 'friend'].includes(route.name)) rerender();
  }, 1200);
});

// Track whether the window is full screen (Esc uses this to get you out of it).
if (window.reel.onFullscreen) window.reel.onFullscreen((on) => { document.body.dataset.winfs = on ? '1' : '0'; });
// Mac full screen hides the red/yellow/green buttons; Reel shows its own so there's always a way out.
{
  const lights = h(`<div class="mac-lights" title=""><button class="ml-close" title="Close"></button><button class="ml-min" title="Minimize"></button><button class="ml-full" title="Exit full screen"></button></div>`);
  $('.ml-close', lights).onclick = () => window.reel.closeWindow();
  $('.ml-min', lights).onclick = () => window.reel.minimizeWindow();
  $('.ml-full', lights).onclick = () => window.reel.fullscreen(false);
  document.body.appendChild(lights);
}
