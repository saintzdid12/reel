// Reel — core: helpers, local store, TMDB client, recommendations, Letterboxd import.

// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Review text → safe HTML paragraphs. Letterboxd exports reviews with a little HTML (<br />, <p>, <i>, <b>):
// that becomes real line breaks and italics; any other tag is dropped; everything else is shown as typed.
function reviewPlain(text) {
  return String(text || '').replace(/\r/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<\/?(p|i|em|b|strong|a|span|div|u|s|blockquote)\b[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function reviewHtml(text, max) {
  let s = String(text || '').replace(/\r/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (max && s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  let out = esc(s).replace(/&lt;(\/?)(i|em|b|strong)&gt;/gi, '<$1$2>').replace(/&lt;\/?[a-z][\s\S]*?&gt;/gi, '');
  return out.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const yearOf = (d) => (d || '').slice(0, 4);
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtRuntime(min) { if (!min) return ''; const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h ${m}m` : `${m}m`; }
function starsText(r) { return r ? `★ ${r % 1 ? r.toFixed(1) : r}` : ''; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

let toastTimer;
// toast(message, isError, { label: 'Undo', fn }) — with an action, the toast gets a button and stays a bit longer.
function toast(msg, isErr, action) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-act'; b.textContent = action.label || 'Undo';
    b.onclick = () => { clearTimeout(toastTimer); t.className = ''; action.fn(); };
    t.appendChild(b);
  }
  t.className = 'show' + (isErr ? ' err' : '') + (action ? ' has-act' : '');
  clearTimeout(toastTimer);
  const ms = action ? 6000 : isErr ? 5000 : 2600;
  const start = Date.now();
  // Hovering the toast keeps it open while you reach for Undo.
  const hide = () => { if (t.matches(':hover') && Date.now() - start < 20000) return (toastTimer = setTimeout(hide, 500)); t.className = ''; };
  toastTimer = setTimeout(hide, ms);
}

// ---------- Connection status: a small pill when offline / TMDB is down, and a cheerful "Back online" ----------
const Net = {
  state: 'ok',
  pill() {
    let p = document.getElementById('net-pill');
    if (!p) { p = document.createElement('div'); p.id = 'net-pill'; document.body.appendChild(p); }
    return p;
  },
  fail(code) {
    const s = code === 'OFFLINE' || !navigator.onLine ? 'offline' : 'down';
    if (this.state === s) return;
    this.state = s;
    const p = this.pill();
    p.className = 'show bad';
    p.innerHTML = s === 'offline' ? '<i></i>You’re offline — showing what’s saved' : '<i></i>TMDB isn’t responding — showing what’s saved';
  },
  ok() {
    if (this.state === 'ok') return;
    this.state = 'ok';
    const p = this.pill();
    p.className = 'show good';
    p.innerHTML = '<i></i>Back online';
    setTimeout(() => { if (this.state === 'ok') p.className = ''; }, 2600);
    // If you were looking at the offline screen, load the real page now.
    if (document.querySelector('.offline-screen') && typeof rerender === 'function') rerender();
  },
};
window.addEventListener('offline', () => Net.fail('OFFLINE'));
window.addEventListener('online', () => {
  // The network is back; confirm TMDB answers before saying so.
  if (typeof TMDB !== 'undefined' && TMDB.key) TMDB.get('/configuration', { _: Date.now() }).then(() => Net.ok()).catch(() => {});
  else Net.ok();
});

// ---------- Store ----------
const Store = {
  data: null,
  _t: null,
  async init() {
    const d = (await window.reel.loadData()) || {};
    this.data = Object.assign({
      settings: { maxQuality: 1080, avoidDV: true, autoPlay: true, subLang: 'eng', subsOn: false },
      items: {},       // "movie:603" -> { type, id, title, year, poster, backdrop, genres, runtime, rating, liked, watched, watchedAt, watchlist, watchlistAt, notSeen, review }
      diary: [],       // { id, key, date, rating, liked, review, rewatch }
      lists: [],       // { id, name, desc, ranked, keys: [], createdAt }
      progress: {},    // progressKey -> { key, pos, dur, updatedAt, season, episode, epName, still }
      episodes: {},    // "tv:1399" -> { "1:2": { watched, rating } }
      swipeCount: 0,
    }, d);
    this.data.settings = Object.assign({
      maxQuality: 1080, avoidDV: true, autoPlay: true, subLang: 'eng', subsOn: false, audioLang: 'eng',
      subSize: 'm', subBg: true, nextEpSeconds: 10, cardSize: 'regular', ambient: true, showRatings: true,
      reduceMotion: false, heroRotate: true, autoLog: true, accent: 'mono', discordStatus: true,
    }, this.data.settings);
    // Default picture quality is now HD (1080p); 4K is a choice in setup or Settings. Older installs move once.
    if (!this.data.settings.qualityV2) { this.data.settings.maxQuality = 1080; this.data.settings.qualityV2 = true; }
    this.data.activity = this.data.activity || [];       // newest first: { id, at, kind, key, title, poster, before, value, diaryId }
    this.data.trackPrefs = this.data.trackPrefs || {};   // per title/show: { audioLang, sub: 'off' | 'emb:<lang>' | 'os:<lang>' }
    this.data.streamPick = this.data.streamPick || {};   // per title/show: last version you played
    this.data.favorites = this.data.favorites || [];   // up to 4 keys, shown at the top of Library
    this.purgeTestData();
    this.data.subDelay = this.data.subDelay || {};      // per-title subtitle timing offsets
  },
  // Removes placeholder titles that development test runs wrote into the library. They're unmistakable:
  // their poster paths are like "/p3movie" (real TMDB paths look like "/aB3xYz.jpg"). Nothing real is touched.
  purgeTestData() {
    const fake = new Set(Object.entries(this.data.items).filter(([, v]) => /^\/p\d+(movie|tv)$/.test(v.poster || '')).map(([k]) => k));
    if (!fake.size) return;
    fake.forEach(k => delete this.data.items[k]);
    this.data.diary = this.data.diary.filter(e => !fake.has(e.key));
    for (const k of Object.keys(this.data.progress)) if (fake.has(this.data.progress[k].key)) delete this.data.progress[k];
    for (const k of Object.keys(this.data.episodes)) if (fake.has(k)) delete this.data.episodes[k];
    this.data.lists = this.data.lists.map(l => ({ ...l, keys: l.keys.filter(k => !fake.has(k)) })).filter(l => l.keys.length || l.source !== undefined || !['Rainy day', 'Rainy day comfort'].includes(l.name));
    this.data.favorites = this.data.favorites.filter(k => !fake.has(k));
    this.data.swipeCount = this.data.swipeCount || 0;
    try { localStorage.removeItem('reel:recs'); } catch {}
    window.reel.saveData(this.data);
  },
  save() {
    clearTimeout(this._t);
    this._t = setTimeout(() => window.reel.saveData(this.data), 300);
  },
  get settings() { return this.data.settings; },
  item(key) { return this.data.items[key]; },
  // Merge basic metadata + user fields into an item record.
  upsert(meta, patch = {}) {
    this.data.rev = (this.data.rev || 0) + 1; // any change to your library invalidates saved recommendations
    const key = `${meta.type}:${meta.id}`;
    const cur = this.data.items[key] || {};
    const base = {
      type: meta.type, id: meta.id,
      title: meta.title || cur.title, year: meta.year || cur.year,
      poster: meta.poster || cur.poster, backdrop: meta.backdrop || cur.backdrop,
      // Keep genre names even when we only got genre ids (search results, imports) — recommendations rely on them.
      genres: (meta.genres && meta.genres.length ? meta.genres : null) || (cur.genres && cur.genres.length ? cur.genres : null)
        || (meta.genreIds || []).map(id => TMDB.genreName(meta.type, id)).filter(Boolean),
      genreIds: meta.genreIds && meta.genreIds.length ? meta.genreIds : cur.genreIds,
      runtime: meta.runtime || cur.runtime,
      imdb: meta.imdb || cur.imdb,
      lang: meta.lang || cur.lang,
    };
    this.data.items[key] = Object.assign({}, cur, base, patch);
    this.save();
    return this.data.items[key];
  },
  setRating(meta, rating) {
    const before = this._snap(meta);
    const p = { rating, notSeen: false };
    const cur = this.item(`${meta.type}:${meta.id}`) || {};
    // Rating something you've already seen doesn't invent a watch date (imported titles stay undated).
    if (rating && !cur.watched) { p.watched = true; p.watchedAt = today(); }
    const r = this.upsert(meta, p);
    this._act(rating ? 'rate' : 'unrate', meta, before, { value: rating });
    return r;
  },
  toggleWatched(meta) {
    const before = this._snap(meta);
    const it = this.item(`${meta.type}:${meta.id}`) || {};
    const on = !it.watched;
    const r = this.upsert(meta, { watched: on, watchedAt: on ? (it.watchedAt || today()) : null, notSeen: false, watchlist: on ? false : it.watchlist });
    this._act(on ? 'watched' : 'unwatched', meta, before);
    return r;
  },
  toggleWatchlist(meta) {
    const before = this._snap(meta);
    const it = this.item(`${meta.type}:${meta.id}`) || {};
    const r = this.upsert(meta, { watchlist: !it.watchlist, watchlistAt: !it.watchlist ? Date.now() : null });
    this._act(r.watchlist ? 'watchlist' : 'unwatchlist', meta, before);
    return r;
  },
  toggleLike(meta) {
    const before = this._snap(meta);
    const it = this.item(`${meta.type}:${meta.id}`) || {};
    const r = this.upsert(meta, { liked: !it.liked });
    this._act(r.liked ? 'like' : 'unlike', meta, before);
    return r;
  },
  logDiary(meta, { date, rating, liked, review, rewatch, auto }) {
    const key = `${meta.type}:${meta.id}`;
    const before = this._snap(meta);
    const prev = this.item(key) || {};
    const entry = { id: uid(), key, date: date || today(), rating: rating || 0, liked: !!liked, review: review || '', rewatch: !!rewatch };
    if (auto) entry.auto = true;
    this.data.diary.push(entry);
    // watchedAt = the most recent time you watched it (so "Recently watched", the calendar and stats agree).
    const d = date || today();
    const patch = { watched: true, watchedAt: prev.watchedAt && prev.watchedAt > d ? prev.watchedAt : d, notSeen: false, watchlist: false };
    if (rating) patch.rating = rating;
    if (liked) patch.liked = true;
    if (review) patch.review = review;
    const r = this.upsert(meta, patch);
    this._act('log', meta, before, { value: rating || 0, diaryId: entry.id, rewatch: !!rewatch, auto: !!auto });
    return r;
  },
  // Update an existing diary entry (e.g. adding stars to an auto-logged watch) and mirror it onto the title.
  updateDiary(id, patch) {
    const e = this.data.diary.find(d => d.id === id);
    if (!e) return null;
    Object.assign(e, patch);
    delete e.auto;
    const it = this.item(e.key);
    if (it) {
      const p = {};
      if (patch.rating) p.rating = patch.rating;
      if (patch.liked) p.liked = true;
      if (patch.review) p.review = patch.review;
      this.upsert(it, p);
    } else this.save();
    const a = (this.data.activity || []).find(x => x.diaryId === id);
    if (a) { a.value = e.rating; a.auto = false; }
    return e;
  },

  // Delete one review (a diary entry's text, or the standalone review). Returns an undo function.
  removeReview(key, entryId) {
    const it = this.item(key) || {};
    const e = entryId && this.data.diary.find(d => d.id === entryId);
    const prevE = e ? e.review : null, prevIt = it.review;
    if (e) { if (it.review && it.review.trim() === (e.review || '').trim()) delete it.review; e.review = ''; }
    else delete it.review;
    this.data.rev = (this.data.rev || 0) + 1; this.save();
    return () => { if (e) e.review = prevE; if (prevIt) it.review = prevIt; this.data.rev++; this.save(); };
  },
  // Move everything recorded for one title onto another (fixing a wrong match). Returns false if there's nothing to move.
  moveTitle(fromKey, toMeta) {
    const toKey = `${toMeta.type}:${toMeta.id}`;
    const it = this.data.items[fromKey]; if (!it || fromKey === toKey) return false;
    const cur = this.data.items[toKey] || {};
    const keep = ['watched', 'watchedAt', 'rating', 'liked', 'review', 'watchlist', 'watchlistAt', 'lbImported', 'lbAdded', 'noRecs'];
    const patch = {};
    for (const k of keep) if (it[k] != null && it[k] !== false && cur[k] == null) patch[k] = it[k];
    if (it.watched) { patch.watched = true; patch.notSeen = false; patch.watchlist = false; }
    this.data.diary.forEach(e => { if (e.key === fromKey) e.key = toKey; });
    this.data.lists.forEach(l => { if (l.keys.includes(fromKey)) l.keys = [...new Set(l.keys.map(k => (k === fromKey ? toKey : k)))]; });
    if (this.data.favorites.includes(fromKey)) this.data.favorites = [...new Set(this.data.favorites.map(k => (k === fromKey ? toKey : k)))];
    for (const p of Object.values(this.data.progress)) if (p.key === fromKey) p.key = toKey;
    delete this.data.items[fromKey];
    this.upsert(toMeta, patch);
    return true;
  },
  // Take a title completely off your profile: rating, like, review, watched, watchlist, diary, lists, favorites,
  // episode history, playback position. Returns a snapshot that restoreTitle() puts back exactly.
  clearTitle(key) {
    const snap = {
      key, item: this.data.items[key] ? JSON.parse(JSON.stringify(this.data.items[key])) : null,
      diary: this.data.diary.filter(e => e.key === key),
      lists: this.data.lists.map(l => [l.id, l.keys.indexOf(key)]).filter(([, i]) => i >= 0),
      fav: this.data.favorites.indexOf(key),
      episodes: this.data.episodes[key] ? JSON.parse(JSON.stringify(this.data.episodes[key])) : null,
      progress: Object.entries(this.data.progress).filter(([, p]) => p.key === key),
    };
    delete this.data.items[key];
    this.data.diary = this.data.diary.filter(e => e.key !== key);
    this.data.lists.forEach(l => { l.keys = l.keys.filter(k => k !== key); });
    this.data.favorites = this.data.favorites.filter(k => k !== key);
    delete this.data.episodes[key];
    snap.progress.forEach(([pk]) => delete this.data.progress[pk]);
    if (snap.item) this.data.activity = (this.data.activity || []).map(a => (a.key === key ? { ...a, undone: true } : a));
    this.data.rev = (this.data.rev || 0) + 1; this.save();
    return snap;
  },
  restoreTitle(snap) {
    if (snap.item) this.data.items[snap.key] = snap.item;
    this.data.diary.push(...snap.diary.filter(e => !this.data.diary.some(d => d.id === e.id)));
    snap.lists.forEach(([id, i]) => { const l = this.data.lists.find(x => x.id === id); if (l && !l.keys.includes(snap.key)) l.keys.splice(Math.min(i, l.keys.length), 0, snap.key); });
    if (snap.fav >= 0 && !this.data.favorites.includes(snap.key)) this.data.favorites.splice(Math.min(snap.fav, this.data.favorites.length), 0, snap.key);
    if (snap.episodes) this.data.episodes[snap.key] = snap.episodes;
    snap.progress.forEach(([pk, p]) => (this.data.progress[pk] = p));
    this.data.rev = (this.data.rev || 0) + 1; this.save();
  },

  // ---------- Activity log (newest first) with undo ----------
  _FIELDS: ['rating', 'liked', 'watched', 'watchedAt', 'watchlist', 'watchlistAt', 'notSeen', 'review'],
  _snap(meta) {
    const it = this.item(`${meta.type}:${meta.id}`);
    if (!it) return null;
    const s = {};
    this._FIELDS.forEach(f => { s[f] = it[f] ?? null; });
    return s;
  },
  _act(kind, meta, before, extra = {}) {
    const a = this.data.activity || (this.data.activity = []);
    const key = `${meta.type}:${meta.id}`;
    const last = a[0];
    // Tapping stars a few times in a row is one action, not five.
    if (last && !last.undone && last.key === key && last.kind === kind && kind === 'rate' && Date.now() - last.at < 60000) {
      Object.assign(last, extra, { at: Date.now() });
    } else {
      a.unshift({ id: uid(), at: Date.now(), kind, key, title: meta.title, poster: meta.poster, type: meta.type, before, ...extra });
    }
    if (a.length > 400) a.length = 400;
    this.save();
  },
  // Only the newest action on a title can be undone (older ones would clobber later changes).
  canUndo(act) {
    if (act.undone) return false;
    const newest = (this.data.activity || []).find(x => x.key === act.key && !x.undone);
    return newest === act;
  },
  undo(act) {
    if (!this.canUndo(act)) return false;
    const it = this.data.items[act.key];
    if (it) {
      if (act.before) this._FIELDS.forEach(f => { it[f] = act.before[f]; });
      else this._FIELDS.forEach(f => { delete it[f]; });
    }
    if (act.diaryId) this.data.diary = this.data.diary.filter(d => d.id !== act.diaryId);
    act.undone = true;
    this.data.rev = (this.data.rev || 0) + 1;
    this.save();
    return true;
  },
  values() { return Object.values(this.data.items); },
};

// ---------- Disk cache (localStorage) for faster launches ----------
const DiskCache = {
  max: 450,
  key: (path, params) => 'tm:' + path + '?' + Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&'),
  get(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; } },
  set(k, v) {
    const put = () => localStorage.setItem(k, JSON.stringify({ t: Date.now(), v }));
    try { put(); this.track(k); }
    catch { this.prune(.5); try { put(); this.track(k); } catch {} }
  },
  track(k) {
    try {
      const idx = JSON.parse(localStorage.getItem('tm:index') || '[]').filter(x => x !== k);
      idx.push(k);
      while (idx.length > this.max) localStorage.removeItem(idx.shift());
      localStorage.setItem('tm:index', JSON.stringify(idx));
    } catch {}
  },
  prune(frac) {
    try {
      const idx = JSON.parse(localStorage.getItem('tm:index') || '[]');
      idx.splice(0, Math.ceil(idx.length * frac)).forEach(k => localStorage.removeItem(k));
      localStorage.setItem('tm:index', JSON.stringify(idx));
    } catch {}
  },
};

// ---------- TMDB ----------
const TMDB = {
  key: '',
  cache: new Map(),
  img: (p, size = 'w500') => (p ? (/^https?:\/\//.test(p) ? p : `https://image.tmdb.org/t/p/${size}${p}`) : ''),
  async get(path, params = {}) {
    if (!this.key) throw new Error('NO_TMDB');
    const url = new URL('https://api.themoviedb.org/3' + path);
    const headers = { accept: 'application/json' };
    if (this.key.length > 40) headers.Authorization = `Bearer ${this.key}`;
    else url.searchParams.set('api_key', this.key);
    url.searchParams.set('language', 'en-US');
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, v);
    const ck = url.toString();
    if (this.cache.has(ck)) return this.cache.get(ck);
    // Errors come back as plain codes the app turns into friendly screens: OFFLINE, TMDB_DOWN.
    const net = async (tries = 0) => {
      let r;
      try { r = await fetch(ck, { headers }); }
      catch { throw new Error(navigator.onLine ? 'TMDB_DOWN' : 'OFFLINE'); }
      if (r.status === 401) throw new Error('Your TMDB key was rejected. Check it in Settings.');
      if (r.status === 429 && tries < 2) { await sleep(1200 * (tries + 1)); return net(tries + 1); }   // rate limited: wait and retry
      if (r.status >= 500 || r.status === 429) throw new Error('TMDB_DOWN');
      if (!r.ok) throw new Error(`TMDB error ${r.status}`);
      Net.ok();
      return r.json();
    };
    // Disk cache: fresh (< 6 h) answers return instantly; stale ones (< 3 days) show immediately and refresh quietly.
    // Offline or TMDB down: anything saved, however old, beats an error.
    const sk = DiskCache.key(path, params), hit = DiskCache.get(sk);
    let p;
    if (hit && (Date.now() - hit.t < 6 * 3600e3 || !navigator.onLine)) p = Promise.resolve(hit.v);
    else if (hit && Date.now() - hit.t < 72 * 3600e3) { p = Promise.resolve(hit.v); net().then(v => DiskCache.set(sk, v)).catch(() => {}); }
    else {
      p = net().catch(e => { if (hit && /OFFLINE|TMDB_DOWN/.test(e.message)) { Net.fail(e.message); return hit.v; } if (/OFFLINE|TMDB_DOWN/.test(e.message)) Net.fail(e.message); throw e; });
      p.then(v => { if (v !== (hit && hit.v)) DiskCache.set(sk, v); }).catch(() => {});
    }
    this.cache.set(ck, p);
    p.catch(() => this.cache.delete(ck));
    return p;
  },
  // Normalize a TMDB result into Reel's meta shape.
  meta(r, forceType) {
    const type = forceType || r.media_type || (r.first_air_date !== undefined || r.name ? 'tv' : 'movie');
    return {
      type, id: r.id,
      title: r.title || r.name || r.original_title || '',
      year: yearOf(r.release_date || r.first_air_date),
      poster: r.poster_path || null,
      backdrop: r.backdrop_path || null,
      overview: r.overview || '',
      vote: r.vote_average || 0,
      votes: r.vote_count || 0,
      genreIds: r.genre_ids || (r.genres || []).map(g => g.id),
      lang: r.original_language || undefined,
    };
  },
  list: async (path, params, type) => (await TMDB.get(path, params)).results.filter(r => (r.media_type || type) !== 'person').map(r => TMDB.meta(r, type)),
  details(type, id) {
    const extra = type === 'movie' ? 'credits,videos,recommendations,similar,external_ids,images,release_dates' : 'credits,videos,recommendations,similar,external_ids,images,content_ratings';
    return this.get(`/${type}/${id}`, { append_to_response: extra, include_image_language: 'en,null' });
  },
  season(id, n) { return this.get(`/tv/${id}/season/${n}`); },
  async imdbId(type, id) {
    const d = await this.get(`/${type}/${id}/external_ids`);
    return d.imdb_id;
  },
  async logo(type, id) {
    try {
      const d = await this.get(`/${type}/${id}/images`, { include_image_language: 'en,null' });
      const l = (d.logos || []).find(x => x.iso_639_1 === 'en') || (d.logos || [])[0];
      return l ? l.file_path : null;
    } catch { return null; }
  },
  genres: { movie: {}, tv: {} },
  async loadGenres() {
    for (const t of ['movie', 'tv']) {
      try { const d = await this.get(`/genre/${t}/list`); d.genres.forEach(g => (this.genres[t][g.id] = g.name)); } catch {}
    }
  },
  genreName(type, id) { return this.genres[type][id] || this.genres.movie[id] || this.genres.tv[id] || ''; },
};

function metaFromDetails(type, d) {
  return {
    type, id: d.id,
    title: d.title || d.name,
    year: yearOf(d.release_date || d.first_air_date),
    poster: d.poster_path, backdrop: d.backdrop_path,
    genres: (d.genres || []).map(g => g.name),
    runtime: d.runtime || (d.episode_run_time && d.episode_run_time[0]) || null,
    imdb: (d.external_ids && d.external_ids.imdb_id) || d.imdb_id || null,
  };
}

// ---------- Recommendations ----------
// Candidates come from TMDB "recommendations" (co-watching) and "similar" (genres/keywords) for the titles you
// love. A candidate must genuinely relate to the title that suggested it (shared genres, or suggested by both lists
// / by several titles you rated highly), clear a quality bar, and fit your taste profile. Low ratings, "Not interested"
// and thumbs-down push similar titles away. Results are spread across many of your top-rated titles so no single one dominates.
const Recs = {
  cache: null, at: 0,
  key: (m) => `${m.type}:${m.id}`,
  // Titles that should never be recommended (memoized until your library changes).
  excluded() {
    const rev = Store.data.rev || 0;
    if (this._ex && this._ex.rev === rev) return this._ex.s;
    const s = new Set();
    for (const it of Store.values()) if (it.watched || it.notInterested || it.feedback === -1 || (it.lean || 0) <= -2) s.add(`${it.type}:${it.id}`);
    this._ex = { rev, s };
    return s;
  },

  // ---------- "Would this person plausibly want it?" — language / reach check used by every recommender ----------
  // English titles always qualify. Other languages qualify when you actually watch that language (3+ titles in
  // your history) or when the title is internationally big (Parasite, Spirited Away, Squid Game…). This is what
  // stops obscure regional releases with a few hundred votes from showing up out of nowhere.
  langs() {
    const rev = Store.data.rev || 0;
    if (this._langs && this._langs.rev === rev) return this._langs.c;
    const c = {};
    for (const it of Store.values()) if (it.lang && (it.watched || it.rating || it.liked || it.watchlist)) c[it.lang] = (c[it.lang] || 0) + 1;
    this._langs = { rev, c };
    return c;
  },
  mainstream(m) {
    const l = m.lang;
    if (!l || l === 'en') return true;
    if ((this.langs()[l] || 0) >= 3) return true;
    return (m.votes || 0) >= (m.type === 'tv' ? 1200 : 3500);
  },

  // How much Reel knows about you: 0–100 plus a label. Ratings matter most; likes, favorites, Rank duels,
  // This or That answers and Quick Rate "seen" marks all add. ~25 rated titles is a usable start, ~100 is good.
  strength() {
    const it = Store.values();
    const rated = it.filter(i => i.rating).length, liked = it.filter(i => i.liked).length;
    const watched = it.filter(i => i.watched).length, favs = Store.data.favorites.length;
    const duels = it.reduce((a, i) => a + (i.duels || 0), 0) / 2, tot = Store.data.totCount || 0;
    const genres = Object.keys(this.genreTaste()).length;
    // Seen It marks count: a "seen" tap is worth a quarter of a rating, a "loved" or "not for me" nearly a full one.
    const meh = it.filter(i => i.watched && i.feedback === -1 && !i.rating).length;
    const pts = rated * 1 + liked * .8 + meh * .6 + favs * 2 + Math.min(50, watched * .25) + Math.min(25, duels * .25) + Math.min(25, tot * .5) + Math.min(10, genres);
    const score = Math.round(Math.min(100, 100 * (1 - Math.exp(-pts / 70))));
    const level = score >= 80 ? 'Strong' : score >= 55 ? 'Good' : score >= 30 ? 'Getting there' : 'Just started';
    const need = Math.max(0, 25 - rated);
    return { score, level, rated, liked, watched, favs, duels: Math.round(duels), tot, need,
      note: score >= 80 ? 'Reel knows your taste well — recommendations are tuned to you.'
        : score >= 55 ? 'Good enough for solid picks. A few more ratings will sharpen the edges.'
        : score >= 30 ? 'Recommendations will be hit-and-miss for now. Rate a few dozen more to dial them in.'
        : `Reel barely knows you yet, so picks will lean on what’s popular. Rate ${need || 'a few dozen'} more titles to get real recommendations.` };
  },

  // ---------- One mixed pool for everything in Discover ----------
  // Your personal picks + popular right now + trending this week + all-time greats (TMDB's top rated, which tracks
  // IMDb's Top 250 closely) + well-loved titles in your favorite genres. Every candidate must clear a quality bar,
  // is scored by quality, how well it fits your taste and which sources vouch for it, and shows are woven in at a
  // much lower rate than films (about 1 in 5 by default).
  //   mode 'watch' — things to watch next (unseen, quality and taste first)
  //   mode 'rate'  — things you've probably SEEN, for Quick Rate (famous + well-liked first)
  _src: {},
  async sources(type) {
    const c = this._src[type];
    if (c && Date.now() - c.at < 30 * 60e3) return c.p;
    const p = (async () => {
      const P = (path, n, params = {}) => Promise.all(Array.from({ length: n }, (_, i) => TMDB.list(path, { ...params, page: i + 1 }, type).catch(() => []))).then(r => r.flat());
      const taste = this.genreTaste();
      const ids = Object.fromEntries(((typeof GENRES !== 'undefined' && GENRES[type]) || []).map(([id, n]) => [n, id]));
      const favG = Object.entries(taste).filter(([g, v]) => ids[g] && v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => ids[g]);
      const [trending, popular, greats, liked] = await Promise.all([
        P(`/trending/${type}/week`, 2),
        P(`/${type}/popular`, 2),
        P(`/${type}/top_rated`, type === 'movie' ? 6 : 3),
        favG.length ? P(`/discover/${type}`, 3, { with_genres: favG.join('|'), sort_by: 'vote_count.desc', 'vote_average.gte': type === 'tv' ? 7.4 : 6.9 }) : [],
      ]);
      return { trending, popular, greats, liked };
    })();
    this._src[type] = { at: Date.now(), p };
    p.catch(() => delete this._src[type]);
    return p;
  },
  async pool({ mode = 'watch', shows = .2, types = ['movie', 'tv'] } = {}) {
    const want = new Set(types);
    const [mv, tv] = await Promise.all([want.has('movie') ? this.sources('movie') : null, want.has('tv') && shows > 0 ? this.sources('tv') : null]);
    let personal = [];
    if (mode === 'watch' && this.seeds().length) { try { personal = (await this.build()).forYou; } catch {} }
    const cand = new Map();
    const add = (list, src) => (list || []).forEach((m, i) => {
      if (!want.has(m.type) || !m.poster || !m.backdrop) return;
      const k = `${m.type}:${m.id}`;
      const e = cand.get(k) || { m, src: {} };
      e.src[src] = Math.min(e.src[src] ?? 1, i / Math.max(1, list.length));   // best (lowest) relative position in that source
      if (m.why && !e.m.why) e.m = { ...e.m, why: m.why, drivers: m.drivers };
      cand.set(k, e);
    });
    add(personal, 'personal');
    for (const s of [mv, tv]) if (s) { add(s.trending, 'trending'); add(s.popular, 'popular'); add(s.greats, 'greats'); add(s.liked, 'liked'); }
    const ex = this.excluded(), taste = this.genreTaste();
    const W = mode === 'rate'
      ? { personal: 0, trending: .2, popular: .35, greats: .45, liked: .45, fame: 1.1, quality: .35, fit: .45 }
      : { personal: 1.0, trending: .3, popular: .15, greats: .4, liked: .35, fame: .25, quality: .5, fit: .65 };
    const out = { movie: [], tv: [] };
    for (const { m, src } of cand.values()) {
      const k = `${m.type}:${m.id}`;
      if (ex.has(k)) continue;
      const it = Store.item(k) || {};
      if (mode === 'rate' && (it.notSeen || it.watchlist)) continue;
      const tv_ = m.type === 'tv';
      // Quality floor — this is what keeps the stinkers out. TV scores run higher, so its bar is higher.
      // Quick Rate is about things you've plausibly SEEN, so it needs real reach (thousands of votes).
      const minVote = tv_ ? 7.0 : 6.4;
      const minVotes = mode === 'rate' ? (tv_ ? 500 : 1500) : src.personal != null || src.trending != null ? 150 : (tv_ ? 300 : 800);
      if ((m.vote || 0) < minVote || (m.votes || 0) < minVotes) continue;
      if (!this.mainstream(m)) continue;
      const g = (m.genreIds || []).map(id => TMDB.genreName(m.type, id)).filter(Boolean);
      // Not "movies & shows" in the usual sense: talk, news, reality, kids, soaps, and (unless you like them)
      // documentaries, concert/stage recordings and TV movies.
      const gi = m.genreIds || [];
      if (tv_ && gi.some(x => [10767, 10763, 10764, 10762, 10766].includes(x))) continue;
      const nicheIds = gi.filter(x => (tv_ ? [99] : [99, 10402, 10770]).includes(x));
      const nicheNames = nicheIds.map(x => TMDB.genreName(m.type, x)).filter(Boolean);
      if (nicheIds.length && !nicheNames.some(n => (taste[n] || 0) > .3)) continue;
      const fit = g.reduce((a, x) => a + (taste[x] || 0), 0) / Math.max(1, g.length);
      const fame = Math.min(1.2, Math.log10(Math.max(10, m.votes || 0)) / 4);
      const quality = (m.vote - (tv_ ? 7.6 : 7.0));
      const srcs = Object.keys(src);
      const srcScore = srcs.reduce((a, s) => a + W[s] * (1 - .5 * src[s]), 0) + (srcs.length > 1 ? .12 * (srcs.length - 1) : 0);
      // Quick Rate wants things you've likely already seen: brand-new releases go to the back.
      const age = new Date().getFullYear() - (parseInt(m.year, 10) || 2000);
      const fresh = mode === 'rate' ? (age <= 0 ? -.9 : age === 1 ? -.35 : 0) : 0;
      const s = srcScore + W.fame * fame + W.quality * quality + W.fit * fit + fresh + (it.feedback === 1 ? .4 : 0);
      const why = m.why || (src.greats != null && m.vote >= 8 ? `All-time great · TMDB ${m.vote.toFixed(1)}` : src.trending != null ? 'Trending this week'
        : src.liked != null ? `Loved by ${g[0] ? g[0].toLowerCase() + ' fans' : 'fans'}` : src.popular != null ? 'Popular right now' : `TMDB ${m.vote.toFixed(1)}`);
      out[m.type].push({ ...m, why, poolScore: s, sources: srcs });
    }
    out.movie.sort((a, b) => b.poolScore - a.poolScore);
    out.tv.sort((a, b) => b.poolScore - a.poolScore);
    return this.weave(out.movie, out.tv, shows);
  },
  // Interleave: roughly one show for every (1/share − 1) films, never two shows in a row.
  weave(movies, shows, share = .2) {
    if (!shows.length || share <= 0) return movies;
    if (!movies.length) return shows;
    const every = Math.max(2, Math.round(1 / share));
    const out = []; let i = 0, j = 0;
    while (i < movies.length || j < shows.length) {
      if ((out.length + 1) % every === 0 && j < shows.length) out.push(shows[j++]);
      else if (i < movies.length) out.push(movies[i++]);
      else out.push(shows[j++]);
    }
    return out;
  },
  // Changes whenever anything in your profile changes (ratings, likes, favorites, lists, diary, watchlist).
  sig() { return [Store.data.rev || 0, Store.data.diary.length, Store.data.favorites.join(), Store.data.lists.reduce((a, l) => a + l.keys.length, 0)].join('|'); },
  avgRating() {
    const r = Store.values().filter(i => i.rating);
    return r.length ? r.reduce((a, i) => a + i.rating, 0) / r.length : 3.5;
  },
  // ONE score per title from your whole profile, used by every recommender (Home, For You, Mood Match, Roulette,
  // Tonight's Pick, people rows): star rating (vs. your own average), like, favorites, rewatches, Rank duels,
  // thumbs, your own lists, your watchlist (intent), plain "watched", and "Not interested".
  profile() {
    if (this._prof && this._prof.rev === (Store.data.rev || 0) && this._prof.dl === Store.data.diary.length && this._prof.fv === Store.data.favorites.join()) return this._prof;
    const avg = this.avgRating(), favs = new Set(Store.data.favorites);
    const views = {}; Store.data.diary.forEach(e => (views[e.key] = (views[e.key] || 0) + 1));
    const inLists = {}; Store.data.lists.forEach(l => l.keys.forEach(k => (inLists[k] = (inLists[k] || 0) + 1)));
    const score = new Map();
    for (const it of Store.values()) {
      const k = `${it.type}:${it.id}`;
      let v = 0, known = false;
      if (it.rating) { v += (it.rating - avg) * 1.1; known = true; }
      if (it.liked) { v += .7; known = true; }
      if (favs.has(k)) { v += 1.3; known = true; }
      if ((views[k] || 0) > 1) { v += Math.min(.9, .3 * (views[k] - 1)); known = true; }
      if (it.duels >= 3) { v += ((it.elo || 1500) - 1500) / 300; known = true; }
      if (it.feedback) { v += it.feedback * .8; known = true; }
      if (inLists[k]) { v += Math.min(.4, .2 * inLists[k]); known = true; }
      if (it.watchlist && !it.watched) { v += .35; known = true; }
      if (it.lean) { v += Math.max(-.45, Math.min(.6, it.lean * .2)); known = true; }   // This or That answers
      if (it.watched && !known) { v += .12; known = true; }
      if (it.notInterested) { v -= .9; known = true; }
      if (known) score.set(k, { it, v, watched: !!it.watched, views: views[k] || 0, fav: favs.has(k) });
    }
    this._prof = { rev: Store.data.rev || 0, dl: Store.data.diary.length, fv: Store.data.favorites.join(), score, avg };
    return this._prof;
  },
  // Titles that best represent you, strongest first: favorites, high ratings, likes, rewatches, top of your Rank.
  // A few watchlist titles join with a low weight so recommendations also lean toward what you want to see next.
  seeds() {
    const all = [...this.profile().score.values()].filter(s => !s.it.noRecs);
    const watched = all.filter(s => s.watched && (s.v >= .5 || s.fav || s.it.liked || (s.it.rating || 0) >= 4))
      .map(s => ({ it: s.it, w: 1 + s.v }))
      .sort((a, b) => b.w - a.w || String(b.it.watchedAt || '').localeCompare(String(a.it.watchedAt || ''))).slice(0, 16);
    const thumbs = all.filter(s => !s.watched && s.it.feedback === 1).slice(0, 2).map(s => ({ it: s.it, w: 1.1 }));
    // Up to 8 watchlist titles (newest first) — enough that a big watchlist pulls picks toward what you want to see.
    const wl = all.filter(s => !s.watched && s.it.watchlist && s.it.feedback !== 1).sort((a, b) => (b.it.watchlistAt || 0) - (a.it.watchlistAt || 0)).slice(0, 8)
      .map((s, i) => ({ it: s.it, w: .6 - i * .03 }));
    return [...watched, ...thumbs, ...wl];
  },
  loved() { return this.seeds().filter(s => s.it.watched && ((s.it.rating || 0) >= 4.5 || s.it.liked || Store.data.favorites.includes(`${s.it.type}:${s.it.id}`))).map(s => s.it); },
  // Genre affinity from your whole profile (see profile()).
  genreTaste() {
    const sum = {}, n = {};
    for (const { it, v } of this.profile().score.values()) {
      for (const g of it.genres || []) { if (!g) continue; sum[g] = (sum[g] || 0) + v; n[g] = (n[g] || 0) + 1; }
    }
    // Genre leanings from This or That count like a handful of ratings in that genre.
    for (const [g, v] of Object.entries(Store.data.tot || {})) { sum[g] = (sum[g] || 0) + v * .6; n[g] = (n[g] || 0) + 1; }
    const out = {};
    for (const g in sum) out[g] = (sum[g] / Math.sqrt(n[g]));
    return out;
  },
  async lists(it) {
    const [r, s] = await Promise.all([
      TMDB.get(`/${it.type}/${it.id}/recommendations`).catch(() => ({ results: [] })),
      TMDB.get(`/${it.type}/${it.id}/similar`).catch(() => ({ results: [] })),
    ]);
    return { rec: r.results.map(x => TMDB.meta(x, it.type)), sim: s.results.map(x => TMDB.meta(x, it.type)) };
  },
  async build(force) {
    if (!force && this.cache && Date.now() - this.at < 10 * 60e3) return this.cache;
    // Reuse the last result from disk if nothing in your library changed since (instant Home on launch).
    if (!force && !this.cache) {
      try {
        const saved = JSON.parse(localStorage.getItem('reel:recs') || 'null');
        if (saved && saved.rev === this.sig() && Date.now() - saved.t < 12 * 3600e3) { this.cache = saved.data; this.at = Date.now(); return this.cache; }
      } catch {}
    }
    const seeds = this.seeds();
    const ex = this.excluded();
    const taste = this.genreTaste();
    const names = (m) => (m.genreIds || []).map(id => TMDB.genreName(m.type, id)).filter(Boolean);
    const cand = new Map(); // key -> { m, total, by: Map(seedKey -> contribution) }
    const perSeed = new Map(); // seedKey -> [{ m, c }]
    // Same rules as the Discover pool: no talk/news/reality/kids/soaps, and no documentaries, concert or stage
    // recordings or TV movies unless your taste actually leans that way.
    const niche = (m) => {
      const gi = m.genreIds || [], tv = m.type === 'tv';
      if (tv && gi.some(x => [10767, 10763, 10764, 10762, 10766].includes(x))) return true;
      const ids = gi.filter(x => (tv ? [99] : [99, 10402, 10770]).includes(x));
      return ids.length > 0 && !ids.map(x => TMDB.genreName(m.type, x)).filter(Boolean).some(n => (taste[n] || 0) > .3);
    };
    const passes = (m) => m.backdrop && m.poster && !ex.has(this.key(m)) && (m.vote || 0) >= 6.3 && (m.votes || 0) >= (m.type === 'tv' ? 80 : 150) && !niche(m) && this.mainstream(m);

    await Promise.all(seeds.map(async ({ it, w }) => {
      const { rec, sim } = await this.lists(it);
      let seedNames = it.genres || [];
      if (!seedNames.length) { try { seedNames = ((await TMDB.get(`/${it.type}/${it.id}`)).genres || []).map(g => g.name); } catch {} }
      const seedG = new Set(seedNames);
      const recRank = new Map(rec.map((m, i) => [m.id, i])), simRank = new Map(sim.map((m, i) => [m.id, i]));
      const mine = [];
      for (const m of [...rec, ...sim.filter(x => !recRank.has(x.id))]) {
        if (!passes(m)) continue;
        const inRec = recRank.has(m.id), inSim = simRank.has(m.id);
        const g = names(m);
        // Unknown seed genres count as no overlap, so only titles both TMDB lists agree on get through.
        const overlap = seedG.size ? g.filter(x => seedG.has(x)).length / seedG.size : 0;
        // Unrelated suggestions (no shared genre, only one list) are dropped here.
        if (overlap === 0 && !(inRec && inSim)) continue;
        const rel = (inRec ? 1 - recRank.get(m.id) / 25 : 0) + (inSim ? .8 * (1 - simRank.get(m.id) / 25) : 0) + (inRec && inSim ? .5 : 0);
        const c = w * rel * (.4 + overlap);
        const k = this.key(m);
        const e = cand.get(k) || { m, total: 0, by: new Map() };
        e.total += c; e.by.set(this.key(it), (e.by.get(this.key(it)) || 0) + c);
        cand.set(k, e);
        mine.push({ m, c });
      }
      perSeed.set(this.key(it), mine.sort((a, b) => b.c - a.c));
    }));

    // Titles close to things you disliked get pushed down.
    const dislikes = Store.values().filter(i => (i.rating && i.rating <= 2.5) || i.feedback === -1 || i.notInterested).slice(0, 10);
    const bad = new Set();
    await Promise.all(dislikes.map(async d => { try { (await this.lists(d)).rec.slice(0, 12).forEach(m => bad.add(this.key(m))); } catch {} }));

    const seedTitle = new Map(seeds.map(s => [this.key(s.it), s.it.title]));
    const scored = [...cand.values()].map(e => {
      const g = names(e.m);
      const tasteFit = g.reduce((a, x) => a + (taste[x] || 0), 0) / Math.max(1, g.length);
      const support = e.by.size;
      const s = e.total + .45 * tasteFit + .25 * ((e.m.vote || 0) - 6.8) + (support > 1 ? .7 * Math.min(support - 1, 3) : 0) - (bad.has(this.key(e.m)) ? 1.2 : 0);
      const top = [...e.by.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { m: e.m, s, top, support, by: e.by };
    }).sort((a, b) => b.s - a.s);

    // Spread picks out: at most 2 credited to any one title.
    const forYou = [], used = new Set(), perTop = {};
    for (const x of scored) {
      if (forYou.length >= 40) break;
      if ((perTop[x.top] || 0) >= 2 && scored.length > 30) continue;
      perTop[x.top] = (perTop[x.top] || 0) + 1;
      used.add(this.key(x.m));
      const topIt = Store.item(x.top) || {};
      forYou.push({ ...x.m, why: x.support > 2 ? `Matches ${x.support} titles in your profile` : topIt.watched ? `Because you liked ${seedTitle.get(x.top)}` : `Like ${seedTitle.get(x.top)}, on your watchlist`, recScore: x.s, drivers: [...x.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ key: k, title: seedTitle.get(k), pct: Math.round((v / [...x.by.values()].reduce((a, b) => a + b, 0)) * 100) })) });
    }

    // "Because you loved X": one row per loved title, from different genres, no repeats across rows.
    const because = [], usedG = new Set(), shown = new Set(forYou.slice(0, 12).map(m => this.key(m)));
    for (const it of this.loved()) {
      if (because.length >= 8) break;
      const g0 = (it.genres || [])[0];
      if (g0 && usedG.has(g0) && this.loved().length > 8) continue;
      const items = (perSeed.get(this.key(it)) || []).map(x => x.m).filter(m => !shown.has(this.key(m))).slice(0, 14);
      if (items.length < 6) continue;
      items.forEach(m => shown.add(this.key(m)));
      if (g0) usedG.add(g0);
      because.push({ seed: it, items });
    }
    this.cache = { forYou, because, taste };
    try { localStorage.setItem('reel:recs', JSON.stringify({ t: Date.now(), rev: this.sig(), data: this.cache })); } catch {}
    this.at = Date.now();
    return this.cache;
  },
  // Rank any list of titles by how well it fits your taste (used for Mood Match, Roulette and personal rows).
  fit(list) {
    const taste = (this.cache && this.cache.taste) || this.genreTaste();
    const ex = this.excluded();
    return list.filter(m => !ex.has(this.key(m)) && this.mainstream(m))
      .map(m => ({ m, s: (m.genreIds || []).map(id => TMDB.genreName(m.type, id)).reduce((a, g) => a + (taste[g] || 0), 0) + (m.vote || 0) / 3 }))
      .sort((a, b) => b.s - a.s).map(x => x.m);
  },
  // Directors and actors you rate highly (from the credits of your top films).
  async people() {
    if (this._people && Date.now() - this._people.at < 30 * 60e3) return this._people;
    const avg = this.avgRating();
    const P = this.profile();
    const top = [...P.score.values()].filter(s => s.it.type === 'movie' && s.watched && s.v >= .4).sort((a, b) => b.v - a.v).slice(0, 30).map(s => s.it);
    const credits = await Promise.all(top.map(i => TMDB.get(`/movie/${i.id}/credits`).then(c => ({ i, c })).catch(() => null)));
    const dirs = {}, acts = {};
    credits.filter(Boolean).forEach(({ i, c }) => {
      const v = 1 + P.score.get(`movie:${i.id}`).v;
      (c.crew || []).filter(x => x.job === 'Director').forEach(x => { dirs[x.id] = dirs[x.id] || { id: x.id, name: x.name, n: 0, s: 0 }; dirs[x.id].n++; dirs[x.id].s += v; });
      (c.cast || []).slice(0, 5).forEach(x => { acts[x.id] = acts[x.id] || { id: x.id, name: x.name, n: 0, s: 0 }; acts[x.id].n++; acts[x.id].s += v; });
    });
    const rank = (o) => Object.values(o).filter(p => p.n >= 2).sort((a, b) => b.s - a.s);
    this._people = { directors: rank(dirs), actors: rank(acts), at: Date.now() };
    return this._people;
  },
  // Pick from the watchlist, preferring titles that fit your taste.
  async tonight() {
    const wl = Store.values().filter(it => it.watchlist && !it.watched && !it.notInterested);
    if (!wl.length) return null;
    const taste = this.genreTaste();
    const scored = wl.map(it => ({ it, s: Math.random() * 1.5 + (it.genres || []).reduce((a, g) => a + (taste[g] || 0), 0) / Math.max(1, (it.genres || []).length) }));
    return scored.sort((a, b) => b.s - a.s)[0].it;
  },
  // Older entries (e.g. Letterboxd imports) may be missing details. Fill them in quietly in the background, highest-rated
  // first: genres/runtime (for taste checks) plus the crowd score, vote count, director and main cast — so Taste
  // Profile can draw instantly from your own data instead of looking up hundreds of titles every time it opens.
  fill: { done: 0, total: 0, running: false },
  async backfill() {
    if (this._filling) return;
    this._filling = true;
    const need = Store.values().filter(i => !(i.genres && i.genres.length) || (i.type === 'movie' && !i.runtime) || (i.watched && (i.crowd === undefined || !i.people)))
      .sort((a, b) => (b.watched - a.watched) || ((b.rating || (b.liked ? 4 : 0)) - (a.rating || (a.liked ? 4 : 0))));
    this.fill = { done: 0, total: need.length, running: need.length > 0 };
    let changed = 0;
    const tell = () => { try { window.dispatchEvent(new CustomEvent('reel:backfill', { detail: { ...this.fill } })); } catch {} };
    for (let n = 0; n < need.length; n += 6) {
      await Promise.all(need.slice(n, n + 6).map(async it => {
        try {
          const d = await TMDB.get(`/${it.type}/${it.id}`, { append_to_response: 'credits' });
          const cur = Store.data.items[`${it.type}:${it.id}`];
          if (!cur) return;
          cur.genres = (d.genres || []).map(g => g.name);
          cur.genreIds = (d.genres || []).map(g => g.id);
          cur.runtime = cur.runtime || d.runtime || (d.episode_run_time && d.episode_run_time[0]) || null;
          cur.crowd = (d.vote_count || 0) >= 20 ? +(d.vote_average / 2).toFixed(2) : null;   // TMDB score on a 5-star scale
          cur.votes = d.vote_count || 0;
          const cr = d.credits || {};
          const who = (x) => ({ id: x.id, n: x.name, p: x.profile_path || null });
          cur.people = {
            dir: (it.type === 'movie' ? (cr.crew || []).filter(x => x.job === 'Director') : (d.created_by || [])).slice(0, 3).map(who),
            cast: (cr.cast || []).slice(0, 6).map(who),
          };
          changed++;
        } catch {}
      }));
      this.fill.done = Math.min(need.length, n + 6);
      if (n % 60 === 0 || this.fill.done >= need.length) { if (changed) Store.save(); tell(); }
    }
    if (changed) { Store.save(); this.cache = null; try { localStorage.removeItem('reel:recs'); } catch {} }
    this.fill.running = false; tell();
    this._filling = false;
  },  // Variety: instead of always leading with the single top-scored title, draw the first few picks at random from
  // the strongest candidates (higher-ranked = more likely) and skip ones recently shown in this same spot.
  // `slot` names the spot (hero, foryou, tonight…) so each keeps its own short history.
  vary(list, slot, n = 6, keyFn = (m) => `${m.type}:${m.id}`) {
    if (!list || list.length < 2) return list || [];
    let hist = [];
    try { hist = JSON.parse(localStorage.getItem(`reel:shown:${slot}`) || '[]'); } catch {}
    const recent = new Set(hist);
    const top = list.slice(0, Math.max(18, n * 2));
    const fresh = top.filter(m => !recent.has(keyFn(m)));
    const cands = (fresh.length >= Math.min(n, 3) ? fresh : top).map(m => ({ m, w: 1 / (list.indexOf(m) + 3) }));
    const picked = [];
    while (picked.length < n && cands.length) {
      let r = Math.random() * cands.reduce((a, c) => a + c.w, 0), i = 0;
      while ((r -= cands[i].w) > 0 && i < cands.length - 1) i++;
      picked.push(cands.splice(i, 1)[0].m);
    }
    const chosen = new Set(picked);
    try { localStorage.setItem(`reel:shown:${slot}`, JSON.stringify([...picked.slice(0, 3).map(keyFn), ...hist].slice(0, 12))); } catch {}
    return [...picked, ...list.filter(m => !chosen.has(m))];
  },
  // Thumbs up / down and "Not interested" from any card.
  feedback(m, v) {
    const it = Store.item(this.key(m)) || {};
    Store.upsert(m, { feedback: it.feedback === v ? 0 : v });
    this.cache = null;
  },
  notInterested(m) { Store.upsert(m, { notInterested: true, watchlist: false }); this.cache = null; },
};

// ---------- Letterboxd CSV import ----------
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// `exp` comes from the folder/zip picker: { files: { 'watched.csv': text, 'likes/films.csv': text, ... }, lists: [{ name, text }] }
// What an export contains, for the "choose what to import" step.
function letterboxdSummary(exp) {
  const n = (f) => (exp.files[f] ? parseCSV(exp.files[f]).length : 0);
  return {
    watched: n('watched.csv'), rating: n('ratings.csv'), diary: n('diary.csv'), review: n('reviews.csv'),
    like: n('likes/films.csv'), watchlist: n('watchlist.csv'), list: (exp.lists || []).length,
    favorite: lbFavoriteUris(exp).length,
  };
}
function lbFavoriteUris(exp) {
  const p = exp.files['profile.csv'] ? parseCSV(exp.files['profile.csv'])[0] : null;
  return p && p['Favorite Films'] ? p['Favorite Films'].split(',').map(s => s.trim()).filter(Boolean).slice(0, 4) : [];
}

// Title matching that doesn't just trust TMDB's first search hit: compares normalized titles and release years.
// (lbMatchOld is the earlier matcher, kept only to find — and undo — the mistakes it made in past imports.)
const lbNorm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
async function lbMatchOld(name, year) {
  const y = parseInt(year, 10) || null;
  const pick = (results) => {
    let best = null, bestS = -1;
    for (const r of results || []) {
      const ry = parseInt((r.release_date || '').slice(0, 4), 10) || null;
      const t = lbNorm(name), a = lbNorm(r.title), o = lbNorm(r.original_title);
      let s = 0;
      if (t === a || t === o) s += 4; else if (a.startsWith(t) || t.startsWith(a)) s += 1.5;
      if (y && ry === y) s += 3; else if (y && ry && Math.abs(ry - y) === 1) s += 1.5; else if (y && ry) s -= 2;
      s += Math.min(1, Math.log10((r.vote_count || 0) + 1) / 4);   // tiebreak: the well-known one
      if (s > bestS) { bestS = s; best = r; }
    }
    return bestS >= 3 ? best : null;
  };
  const tries = y ? [{ primary_release_year: y }, { year: y }, {}] : [{}];
  let fallback = null;
  for (const extra of tries) {
    const d = await TMDB.get('/search/movie', { query: name, ...extra });
    const hit = pick(d.results);
    if (hit) return TMDB.meta(hit, 'movie');
    if (!fallback && d.results && d.results[0]) fallback = d.results[0];
  }
  return fallback ? TMDB.meta(fallback, 'movie') : null;
}
// How much a TMDB result's title looks like the Letterboxd title (0 = not the same film, whatever the year says).
function lbTitleScore(name, r) {
  const t = lbNorm(name), a = lbNorm(r.title), o = lbNorm(r.original_title);
  if (!t) return 0;
  if (t === a || t === o) return 6;
  const strip = (s) => s.replace(/^(the|a|an) /, '');
  if (strip(t) === strip(a) || strip(t) === strip(o)) return 5;
  // One title is the other plus a subtitle: "Glass Onion" = "Glass Onion: A Knives Out Mystery".
  const sub = (full, short) => { const f = String(full || '').toLowerCase(), sh = String(short || '').toLowerCase().trim(); return sh.length > 2 && (f.startsWith(sh + ':') || f.startsWith(sh + ' -') || f.startsWith(sh + ' –')); };
  if (sub(r.title, name) || sub(r.original_title, name) || sub(name, r.title)) return 4.5;
  // Same words, mostly ("Star Wars" ~ "Star Wars: A New Hope" no; "Mission Impossible Fallout" ~ "Mission: Impossible - Fallout" yes).
  const T = t.split(' ');
  const sim = Math.max(...[a, o].map(x => { const A = new Set(x.split(' ').filter(Boolean)); if (!A.size) return 0; return T.filter(w => A.has(w)).length / Math.max(T.length, A.size); }));
  return sim >= 0.75 ? 4 * sim : 0;
}
// Letterboxd and TMDB sometimes disagree on the year by one (festival vs. release), so search with and without it
// and take the best-looking title overall. No good title match → no match (it's listed as "couldn't be matched").
async function lbMatch(name, year) {
  const y = parseInt(year, 10) || null;
  const seen = new Map();
  for (const extra of y ? [{ year: y }, { primary_release_year: y }, {}] : [{}]) {
    const d = await TMDB.get('/search/movie', { query: name, ...extra });
    for (const r of d.results || []) if (!seen.has(r.id)) seen.set(r.id, r);
  }
  let best = null, bestS = -Infinity;
  for (const r of seen.values()) {
    const ts = lbTitleScore(name, r); if (!ts) continue;
    const ry = parseInt((r.release_date || '').slice(0, 4), 10) || null;
    let s = ts;
    if (y && ry) { const d = Math.abs(ry - y); s += d === 0 ? 3 : d === 1 ? 2.5 : d === 2 ? 0.5 : -4; }
    s += Math.min(1.5, Math.log10((r.vote_count || 0) + 1) / 2.5);   // tiebreak: the well-known one
    if (s > bestS) { bestS = s; best = r; }
  }
  return best && bestS >= 5 ? TMDB.meta(best, 'movie') : null;
}
// Undo a past import's wrong match: take what came from Letterboxd for film f off `wrongKey`, and (if f now has the
// right match) put it on that title instead. Anything you added yourself in Reel stays where it is.
function lbRepair(wrongKey, f, rightMeta) {
  const it = Store.item(wrongKey); if (!it || !it.lbImported) return false;
  const rightKey = rightMeta ? `movie:${rightMeta.id}` : null;
  const dates = new Set(f.diary.map(d => d.date));
  const moved = Store.data.diary.filter(e => e.key === wrongKey && e.source === 'letterboxd' && dates.has(e.date));
  if (rightKey) moved.forEach(e => { e.key = rightKey; }); else Store.data.diary = Store.data.diary.filter(e => !moved.includes(e));
  // Lists and favorites that pointed at the wrong film.
  Store.data.lists.forEach(l => { if (l.keys.includes(wrongKey)) l.keys = [...new Set(l.keys.map(k => (k === wrongKey ? rightKey : k)).filter(Boolean))]; });
  if (Store.data.favorites.includes(wrongKey)) Store.data.favorites = [...new Set(Store.data.favorites.map(k => (k === wrongKey ? rightKey : k)).filter(Boolean))];
  const own = Store.data.diary.some(e => e.key === wrongKey);   // you logged it yourself in Reel too
  if (!own) { delete Store.data.items[wrongKey]; delete Store.data.episodes[wrongKey]; }
  else {
    const p = { ...it };
    if (f.rating && p.rating === f.rating) delete p.rating;
    if (f.review && p.review === f.review) delete p.review;
    if (f.liked) delete p.liked;
    delete p.lbImported; delete p.lbAdded;
    Store.data.items[wrongKey] = p;
  }
  return true;
}

// How Letterboxd's export works (and how it maps here):
//  watched.csv   Date = when you added it on Letterboxd, NOT when you watched it → only marks it watched.
//  ratings.csv   your current star rating (Date = when you rated).
//  diary.csv     real watches: "Watched Date", rating at the time, Rewatch → diary entries + watch dates.
//  reviews.csv   diary entries that have review text → attached to the matching diary entry.
//  likes/films   hearts.   watchlist.csv   to-watch.   profile.csv   your 4 favorite films (boxd.it links).
async function importLetterboxd(exp, onProgress, kinds) {
  const want = (k) => !kinds || kinds.has(k);
  const rowsOf = (f) => (exp.files[f] ? parseCSV(exp.files[f]) : []);
  const ok = (r) => r && r.Name;
  const films = new Map();      // "name|year" -> { name, year, uris:Set, watched, added, rating, liked, watchlist, wlAt, diary:[], reviewOnly:[] }
  const film = (r) => {
    const k = `${r.Name}|${r.Year}`;
    if (!films.has(k)) films.set(k, { name: r.Name, year: r.Year, uris: new Set(), diary: [], reviewOnly: [] });
    const f = films.get(k);
    if (r['Letterboxd URI']) f.uris.add(r['Letterboxd URI'].trim());
    return f;
  };
  // Every CSV contributes film URIs, so favorites (which are only links) can be resolved.
  const all = { watched: rowsOf('watched.csv'), rating: rowsOf('ratings.csv'), diary: rowsOf('diary.csv'), review: rowsOf('reviews.csv'), like: rowsOf('likes/films.csv'), watchlist: rowsOf('watchlist.csv') };
  Object.values(all).forEach(rows => rows.filter(ok).forEach(film));

  if (want('watched')) all.watched.filter(ok).forEach(r => { const f = film(r); f.watched = true; f.added = r.Date; });
  if (want('rating')) all.rating.filter(ok).forEach(r => { const f = film(r); const v = parseFloat(r.Rating); if (v) { f.rating = v; f.ratedAt = r.Date; f.watched = true; } });
  if (want('like')) all.like.filter(ok).forEach(r => { film(r).liked = true; });
  if (want('watchlist')) all.watchlist.filter(ok).forEach(r => { const f = film(r); f.watchlist = true; f.wlAt = Date.parse(r.Date) || Date.now(); });
  if (want('diary')) all.diary.filter(ok).forEach(r => {
    const f = film(r); f.watched = true;
    f.diary.push({ uri: (r['Letterboxd URI'] || '').trim(), date: r['Watched Date'] || r.Date, rating: parseFloat(r.Rating) || 0, rewatch: r.Rewatch === 'Yes', review: '' });
  });
  if (want('review')) all.review.filter(ok).forEach(r => {
    const f = film(r); f.watched = true;
    const date = r['Watched Date'] || r.Date, uri = (r['Letterboxd URI'] || '').trim();
    const e = f.diary.find(d => (uri && d.uri === uri) || d.date === date);
    if (e) e.review = r.Review || '';
    else if (want('diary') || !f.diary.length) f.diary.push({ uri, date, rating: parseFloat(r.Rating) || 0, rewatch: r.Rewatch === 'Yes', review: r.Review || '' });
    f.review = r.Review || f.review;
  });

  // Lists: header block, then a "Position,Name,Year,URL,Description" table.
  const newLists = [];
  for (const { name, text } of want('list') ? exp.lists || [] : []) {
    const lines = text.replace(/\r/g, '').split('\n');
    const at = lines.findIndex(l => /^Position,Name,Year/i.test(l));
    if (at < 0) continue;
    const meta = parseCSV(lines.slice(1, 3).join('\n'))[0] || {};
    const rows = parseCSV(lines.slice(at).join('\n')).filter(ok);
    const title = meta.Name || name.replace(/-/g, ' ');
    let l = Store.data.lists.find(x => x.name === title && x.source === 'letterboxd');
    if (!l) { l = { id: uid(), name: title, desc: meta.Description || '', ranked: rows.some(r => r.Position), keys: [], createdAt: Date.now(), source: 'letterboxd' }; Store.data.lists.push(l); }
    l.rows = rows.map((r, i) => ({ f: film(r), pos: parseInt(r.Position, 10) || i + 1 }));
    newLists.push(l);
  }
  const favUris = want('favorite') ? lbFavoriteUris(exp) : [];
  const used = [...films.values()].filter(f => f.watched || f.rating || f.liked || f.watchlist || f.diary.length
    || newLists.some(l => l.rows.some(x => x.f === f)) || favUris.some(u => f.uris.has(u)));
  if (!used.length) throw new Error('No Letterboxd data found in that folder. Choose the folder (or .zip) you downloaded from letterboxd.com → Settings → Data → Export.');

  // Match each film once (not once per CSV row), 6 at a time.
  let done = 0; const failed = [], queue = [...used];
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const f = queue.shift();
      try { f.m = await lbMatch(f.name, f.year); if (!f.m) failed.push(f.name); } catch { failed.push(f.name); }
      onProgress && onProgress(++done, used.length);
    }
  }));

  // Fix what earlier imports matched wrongly (only titles that came from Letterboxd are touched).
  let fixed = 0;
  if (Object.values(Store.data.items).some(i => i.lbImported)) {
    const q2 = [...used];
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (q2.length) {
        const f = q2.shift();
        try {
          const old = await lbMatchOld(f.name, f.year);
          if (old && (!f.m || old.id !== f.m.id) && lbRepair(`movie:${old.id}`, f, f.m)) fixed++;
        } catch {}
      }
    }));
  }

  const diaryIdx = new Map(Store.data.diary.map(d => [`${d.key}|${d.date}`, d]));
  for (const f of used) {
    if (!f.m) continue;
    const key = `movie:${f.m.id}`, cur = Store.item(key) || {};
    const dates = f.diary.map(d => d.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const patch = {};
    if (f.watched) {
      patch.watched = true; patch.notSeen = false; patch.watchlist = false;
      // The real "last watched" date comes from the diary. Titles without one stay undated (like on Letterboxd),
      // and dates an older import guessed from the "added" date are cleared.
      const last = dates[dates.length - 1] || null;
      const genuine = cur.watchedAt && cur.watchedAt !== f.added && cur.watchedAt !== f.ratedAt ? cur.watchedAt : null;
      patch.watchedAt = [last, genuine].filter(Boolean).sort().pop() || null;
      if (f.added) patch.lbAdded = f.added;
    }
    if (f.rating) patch.rating = f.rating;
    if (f.liked) patch.liked = true;
    if (f.review) patch.review = f.review;
    if (f.watchlist && !f.watched && !cur.watched) { patch.watchlist = true; patch.watchlistAt = f.wlAt; }
    patch.lbImported = true;
    Store.upsert(f.m, patch);
    for (const d of f.diary) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) continue;
      const ex = diaryIdx.get(`${key}|${d.date}`);
      if (ex) { if (d.review && !ex.review) ex.review = d.review; if (d.rating && !ex.rating) ex.rating = d.rating; if (f.liked) ex.liked = true; if (d.rewatch) ex.rewatch = true; continue; }
      const e = { id: uid(), key, date: d.date, rating: d.rating, liked: !!f.liked, review: d.review || '', rewatch: d.rewatch, source: 'letterboxd' };
      Store.data.diary.push(e); diaryIdx.set(`${key}|${d.date}`, e);
    }
  }
  for (const l of newLists) {
    const slots = [];
    l.rows.forEach(({ f, pos }) => { if (f.m) slots[pos - 1] = `movie:${f.m.id}`; });
    l.keys = [...new Set(slots.filter(Boolean))];
    delete l.rows;
  }
  // Favorite films → Library's four film slots (keeps your shows, fills empty film spots in order).
  if (favUris.length) {
    const favKeys = favUris.map(u => [...films.values()].find(f => f.uris.has(u))).filter(f => f && f.m).map(f => `movie:${f.m.id}`);
    const shows = Store.data.favorites.filter(k => k.startsWith('tv:'));
    const filmsNow = Store.data.favorites.filter(k => k.startsWith('movie:'));
    const merged = [...new Set([...favKeys, ...filmsNow])].slice(0, 4);
    if (favKeys.length) Store.data.favorites = [...merged, ...shows];
  }
  Store.data.rev = (Store.data.rev || 0) + 1;
  Store.save();
  Recs.cache = null;
  try { localStorage.removeItem('reel:recs'); } catch {}
  Recs.backfill();
  return { failed, fixed, films: used.filter(f => f.m).length };
}
