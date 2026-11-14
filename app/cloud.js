// Reel Cloud — account, library sync and friends data. Everything here is optional: without an account Reel works
// exactly as before, fully offline. With one, your library follows you to every PC and friends can see what you share.

// Stable JSON (sorted keys) so the same record always compares equal, whichever side produced it.
function stableStr(v) {
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(x => (x === undefined ? 'null' : stableStr(x))).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stableStr(v[k])).join(',') + '}';
}
const sameJSON = (a, b) => stableStr(a) === stableStr(b);

// ---------------- Account ----------------
const Cloud = {
  cfg: null, sb: null, user: null, profile: null, started: false, subs: new Set(),
  get on() { return !!this.user; },
  watch(fn) { this.subs.add(fn); return () => this.subs.delete(fn); },
  emit() { this.subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); document.dispatchEvent(new CustomEvent('reel:cloud')); },

  async init() {
    if (this.started || typeof supabase === 'undefined' || !window.reel.cloud) return;
    this.started = true;
    this.cfg = await window.reel.cloud.config();
    const c = window.reel.cloud;
    this.sb = supabase.createClient(this.cfg.url, this.cfg.key, {
      auth: {
        storage: { getItem: (k) => c.authGet(k), setItem: (k, v) => c.authSet(k, v), removeItem: (k) => c.authDel(k) },
        storageKey: 'reel-auth', flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 20 }, worker: true },   // heartbeats from a worker keep the connection alive when Reel is in the background
    });
    c.onAuthCallback((v) => this.finishSignIn(v));
    this.sb.auth.onAuthStateChange((_ev, session) => { setTimeout(() => this.onSession(session), 0); });
    try { const { data } = await this.sb.auth.getSession(); await this.onSession(data.session); } catch (e) { console.error('[cloud]', e); }
  },
  // Whose library is on this device? It belongs to whoever last synced it here (or was marked as its owner). If a
  // different account signs in, the device is cleared first, debrid key included: nothing of the previous account
  // may show, or be uploaded into this one. (The very first sign-in on a device still brings its library along.)
  async claimDevice(uid) {
    let st = null;
    try { st = await window.reel.cloud.syncLoad(); } catch {}
    const owner = Store.data.owner || (st && st.uid) || null;
    if (owner && owner !== uid) {
      Store.clearForAccount(uid);
      try { await window.reel.setSecrets({ rdKey: null, debrid: null }); } catch {}
      if (typeof Setup !== 'undefined') Setup.streaming = false;
      if (typeof Playback !== 'undefined' && Playback.cache) Playback.cache.clear();
      if (typeof go === 'function') go(typeof Setup !== 'undefined' && Setup.done ? 'home' : 'setup', {}, true);
    } else if (Store.data.owner !== uid) { Store.data.owner = uid; Store.save(); }
  },
  async onSession(session) {
    const u = session ? session.user : null;
    if ((u && u.id) === (this.user && this.user.id)) { this.user = u; return; }
    this.user = u;
    if (u) {
      await this.claimDevice(u.id);   // first: another account's library and key leave this device
      await this.loadProfile();
      Sync.start(u.id);
      Social.start();
      this.registerDevice();
      this.syncDebrid();
    } else {
      this.profile = null;
      Sync.stop(); Social.stop();
    }
    this.emit();
  },
  // Your debrid service + API key travel with your Reel account: sign in on another computer and just watch.
  async syncDebrid() {
    if (!this.sb || !this.user) return;
    const uid = this.user.id;
    try {
      const local = await window.reel.debridKey();
      const { data, error } = await this.sb.from('user_keys').select('debrid, api_key, updated_at').eq('user_id', uid).maybeSingle();
      if (error) throw error;
      const cloudAt = data ? Date.parse(data.updated_at) || 0 : 0;
      if (data && (!local || (cloudAt > local.at && (data.api_key !== local.key || data.debrid !== local.debrid)))) {
        await window.reel.setSecrets({ rdKey: data.api_key, debrid: data.debrid, debridAt: cloudAt });
        if (typeof Playback !== 'undefined') Playback.cache.clear();
        const fresh = !local;
        document.dispatchEvent(new CustomEvent('reel:debrid', { detail: { fresh, debrid: data.debrid } }));
      } else if (local && (!data || data.api_key !== local.key || data.debrid !== local.debrid)) {
        const { error: e2 } = await this.sb.from('user_keys').upsert({ user_id: uid, debrid: local.debrid, api_key: local.key, updated_at: new Date(local.at || Date.now()).toISOString() });
        if (e2) throw e2;
      }
    } catch (e) { console.error('[cloud] debrid key', e); }
  },
  redirect() { return `http://localhost:${this.cfg.port}/auth/callback`; },
  async signInDiscord() {
    const { data, error } = await this.sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: this.redirect(), skipBrowserRedirect: true } });
    if (error) throw error;
    await window.reel.cloud.openAuth(data.url);
  },
  // Username + password accounts (for people without Discord). There's no email involved: the username is turned
  // into an internal sign-in address that never receives mail.
  loginFor(username) { return `${String(username).trim().toLowerCase()}@users.reel.local`; },
  authError(e) {
    const m = String((e && e.message) || e || '');
    if (/invalid login credentials/i.test(m)) return new Error('Wrong username or password.');
    if (/already registered|already exists/i.test(m)) return new Error('That username is taken — try another.');
    if (/email not confirmed|confirm/i.test(m)) return new Error('Accounts need one more setting on Reel’s side (email confirmation is still on). Use Discord for now.');
    if (/signups? not allowed|disabled/i.test(m)) return new Error('New accounts are turned off right now. Use Discord for now.');
    if (/rate limit|too many/i.test(m)) return new Error('Too many tries — wait a minute and try again.');
    if (/password/i.test(m) && /(weak|short|least)/i.test(m)) return new Error('Pick a longer password (at least 8 characters).');
    if (/fetch|network/i.test(m)) return new Error('Can’t reach Reel’s servers — check your internet.');
    return new Error(m || 'Something went wrong. Try again.');
  },
  async signUpPassword(username, password) {
    const { data, error } = await this.sb.auth.signUp({ email: this.loginFor(username), password, options: { data: { user_name: username, full_name: username } } });
    if (error) throw this.authError(error);
    if (!data.session) throw this.authError(new Error('email not confirmed'));
    return data;
  },
  async signInPassword(username, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: this.loginFor(username), password });
    if (error) throw this.authError(error);
    return data;
  },
  async changePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw this.authError(error);
  },
  get kind() { const p = this.user && this.user.app_metadata && this.user.app_metadata.provider; return p === 'discord' ? 'discord' : 'password'; },
  async finishSignIn({ code, error }) {
    document.dispatchEvent(new CustomEvent('reel:signin-done', { detail: { error } }));
    if (error || !code) { toast(error || 'Sign-in didn’t finish', true); return; }
    const { error: e } = await this.sb.auth.exchangeCodeForSession(code);
    if (e) toast(cleanErr(e), true);
  },
  async signOut(everywhere) {
    try { await Sync.pushNow(); } catch {}
    await this.sb.auth.signOut({ scope: everywhere ? 'global' : 'local' });
    toast(everywhere ? 'Signed out on every device' : 'Signed out — your library stays on this PC');
  },
  async signOutOthers() { const { error } = await this.sb.auth.signOut({ scope: 'others' }); if (error) throw error; },
  async deleteAccount() {
    Sync.stop();
    const { error } = await this.sb.rpc('delete_my_account');
    if (error) throw error;
    await window.reel.cloud.syncSave(null);
    await this.sb.auth.signOut({ scope: 'local' }).catch(() => {});
  },
  async loadProfile() {
    const { data } = await this.sb.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
    this.profile = data || null;
    return this.profile;
  },
  async updateProfile(patch) {
    const { data, error } = await this.sb.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', this.user.id).select().single();
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'That username is taken' : /check/i.test(error.message) ? 'Usernames use 2–24 letters, numbers, dots or underscores' : error.message);
    this.profile = data; this.emit();
    return data;
  },
  async registerDevice() {
    const d = this.cfg.device;
    await this.sb.from('devices').upsert({ id: d.id, name: d.name, platform: d.platform, version: d.version, last_seen: new Date().toISOString() }).then(() => {}, () => {});
  },
  async devices() { const { data } = await this.sb.from('devices').select('*').order('last_seen', { ascending: false }); return data || []; },
  async forgetDevice(id) { await this.sb.from('devices').delete().eq('id', id); },
  avatar(p, size = 32) {
    const name = (p && (p.display_name || p.username)) || '?';
    return p && p.avatar_url
      ? `<img class="av" src="${esc(p.avatar_url)}" alt="" style="width:${size}px;height:${size}px">`
      : `<span class="av av-txt" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px">${esc(name.trim()[0] || '?').toUpperCase()}</span>`;
  },
};

// ---------------- Library sync ----------------
// Each record (a title, diary entry, list, watch position, episode set, settings document) is compared with the
// snapshot this PC last agreed with the cloud. Local edits are pushed; remote edits are merged field by field, so a
// rating on your laptop and a watchlist add on your PC both survive even if you were offline on one of them.
const LOCAL_ONLY_ITEM = ['crowd', 'votes', 'people'];          // re-derived on each PC; no need to sync
const DOCS = {
  favorites: { get: () => ({ v: Store.data.favorites }), set: (d) => { Store.data.favorites = Array.isArray(d.v) ? d.v : []; } },
  settings: { get: () => ({ ...Store.data.settings }), set: (d) => { Store.data.settings = Object.assign({}, Store.data.settings, d); if (typeof applyPrefs === 'function') applyPrefs(); } },
  tot: { get: () => Store.data.tot || {}, set: (d) => { Store.data.tot = d; } },
  trackPrefs: { get: () => Store.data.trackPrefs || {}, set: (d) => { Store.data.trackPrefs = d; } },
  streamPick: { get: () => Store.data.streamPick || {}, set: (d) => { Store.data.streamPick = d; } },
  subDelay: { get: () => Store.data.subDelay || {}, set: (d) => { Store.data.subDelay = d; } },
  profileSkips: { get: () => Store.data.profileSkips || {}, set: (d) => { Store.data.profileSkips = d; } },
  misc: { get: () => ({ totCount: Store.data.totCount || 0, swipeCount: Store.data.swipeCount || 0, trivia: Store.data.trivia || {} }),
          set: (d) => { Store.data.totCount = d.totCount || 0; Store.data.swipeCount = d.swipeCount || 0; Store.data.trivia = d.trivia || {}; } },
};
const Sync = {
  uid: null, st: null, ch: null, status: 'off', lastAt: 0, err: '', busy: false, again: false, pushT: null, pullT: null, pollT: null,
  stopped: true,

  // ----- what this PC has, as { coll: { rid: record } } -----
  snapshot() {
    const d = Store.data, out = { items: {}, diary: {}, lists: {}, progress: {}, episodes: {}, doc: {} };
    for (const [k, it] of Object.entries(d.items)) { const c = { ...it }; LOCAL_ONLY_ITEM.forEach(f => delete c[f]); out.items[k] = c; }
    d.diary.forEach(e => { if (e && e.id) out.diary[e.id] = e; });
    d.lists.forEach(l => { if (l && l.id) out.lists[l.id] = l; });
    for (const [k, p] of Object.entries(d.progress || {})) out.progress[k] = p;
    for (const [k, e] of Object.entries(d.episodes || {})) out.episodes[k] = e;
    for (const [k, doc] of Object.entries(DOCS)) out.doc[k] = doc.get();
    return out;
  },
  getLocal(coll, rid) {
    const d = Store.data;
    if (coll === 'items') { const it = d.items[rid]; if (!it) return undefined; const c = { ...it }; LOCAL_ONLY_ITEM.forEach(f => delete c[f]); return c; }
    if (coll === 'diary') return d.diary.find(e => e.id === rid);
    if (coll === 'lists') return d.lists.find(l => l.id === rid);
    if (coll === 'progress') return d.progress[rid];
    if (coll === 'episodes') return d.episodes[rid];
    if (coll === 'doc') return DOCS[rid] ? DOCS[rid].get() : undefined;
  },
  setLocal(coll, rid, val) {
    const d = Store.data, del = val === undefined;
    if (coll === 'items') {
      if (del) delete d.items[rid];
      else { const keep = {}; const cur = d.items[rid] || {}; LOCAL_ONLY_ITEM.forEach(f => { if (cur[f] !== undefined) keep[f] = cur[f]; }); d.items[rid] = Object.assign({}, val, keep); }
    } else if (coll === 'diary' || coll === 'lists') {
      const arr = d[coll], i = arr.findIndex(x => x.id === rid);
      if (del) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = val; else arr.push(val);
      if (coll === 'diary') arr.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    } else if (coll === 'progress' || coll === 'episodes') {
      if (del) delete d[coll][rid]; else d[coll][rid] = val;
    } else if (coll === 'doc' && DOCS[rid] && !del) DOCS[rid].set(val);
  },
  merge(B, L, R) {
    if (!L || !R || typeof L !== 'object' || typeof R !== 'object' || Array.isArray(L) || Array.isArray(R)) return L;
    const out = {}, base = B && typeof B === 'object' ? B : {};
    new Set([...Object.keys(L), ...Object.keys(R)]).forEach(f => {
      const v = sameJSON(L[f], base[f]) ? R[f] : L[f];    // you changed it here → yours; otherwise take the cloud's
      if (v !== undefined) out[f] = v;
    });
    return out;
  },

  // ----- lifecycle -----
  async start(uid) {
    this.stop();
    this.stopped = false;
    this.uid = uid;
    let st = await window.reel.cloud.syncLoad();
    if (this.stopped || this.uid !== uid) return;
    // A different account's sync state never applies here (claimDevice already cleared that account's library).
    if (!st || st.uid !== uid) st = { uid, cursor: 0, base: {} };
    this.st = st;
    this.setStatus('syncing');
    this.ch = Cloud.sb.channel(`records:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${uid}` }, () => this.soon(400))
      .subscribe((status) => { if ((status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !this.stopped && this.uid === uid) setTimeout(() => { if (!this.stopped && this.uid === uid) this.resubscribe(uid); }, 5000); });
    this.pollT = setInterval(() => this.soon(0), 90e3);
    window.addEventListener('focus', this._focus = () => this.soon(0));
    window.addEventListener('online', this._focus);
    await this.run();
  },
  resubscribe(uid) {
    if (this.ch) Cloud.sb.removeChannel(this.ch);
    this.ch = Cloud.sb.channel(`records:${uid}:${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records', filter: `user_id=eq.${uid}` }, () => this.soon(400))
      .subscribe((status) => { if ((status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !this.stopped && this.uid === uid) setTimeout(() => { if (!this.stopped && this.uid === uid) this.resubscribe(uid); }, 5000); });
    this.soon(0);
  },
  stop() {
    this.stopped = true;
    clearTimeout(this.pushT); clearTimeout(this.pullT); clearInterval(this.pollT);
    if (this.ch) { Cloud.sb.removeChannel(this.ch); this.ch = null; }
    if (this._focus) { window.removeEventListener('focus', this._focus); window.removeEventListener('online', this._focus); }
    this.uid = null; this.st = null;
    this.setStatus('off');
  },
  setStatus(s, err) { this.status = s; this.err = err || ''; if (s === 'ok') this.lastAt = Date.now(); document.dispatchEvent(new CustomEvent('reel:sync-status')); },
  touch() { if (!this.stopped) { clearTimeout(this.pushT); this.pushT = setTimeout(() => this.run(), 2500); } },
  soon(ms) { if (!this.stopped) { clearTimeout(this.pullT); this.pullT = setTimeout(() => this.run(), ms); } },
  async pushNow() { if (!this.stopped) await this.run(); },

  // One sync round: pull what changed in the cloud (merging), then push what changed here.
  async run() {
    if (this.stopped || !this.st) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      this.setStatus('syncing');
      const changed = await this.pull();
      await this.push();
      if (changed) { Store.data.rev = (Store.data.rev || 0) + 1; window.reel.saveData(Store.data); document.dispatchEvent(new CustomEvent('reel:synced', { detail: { changed } })); }
      Social.syncFav();
      this.setStatus('ok');
    } catch (e) {
      console.error('[sync]', e);
      this.setStatus(navigator.onLine ? 'error' : 'offline', cleanErr(e));
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.soon(300); }
    }
  },
  async pull() {
    const st = this.st;
    let changed = 0;
    for (;;) {
      const { data, error } = await Cloud.sb.from('records').select('coll,rid,data,deleted,seq').gt('seq', st.cursor).order('seq', { ascending: true }).limit(1000);
      if (error) throw error;
      if (!data.length) break;
      for (const r of data) { if (this.apply(r)) changed++; st.cursor = Math.max(st.cursor, r.seq); }
      if (data.length < 1000) break;
    }
    if (changed) await this.saveState();
    return changed;
  },
  apply(r) {
    const st = this.st, bc = st.base[r.coll] || (st.base[r.coll] = {});
    const L = this.getLocal(r.coll, r.rid), Bs = bc[r.rid], B = Bs ? JSON.parse(Bs) : undefined;
    const localStr = stableStr(L);
    if (r.deleted) {
      delete bc[r.rid];
      if (L === undefined) return false;
      if (localStr === Bs) { this.setLocal(r.coll, r.rid, undefined); return true; }
      return false;                                             // edited here since: keep it (it will be re-sent)
    }
    const Rs = stableStr(r.data);
    bc[r.rid] = Rs;
    if (localStr === Rs) return false;
    if (L === undefined) {
      if (Bs !== undefined) return false;                       // you deleted it here; that deletion goes up next
      this.setLocal(r.coll, r.rid, r.data); return true;
    }
    if (localStr === Bs) { this.setLocal(r.coll, r.rid, r.data); return true; }
    if (B === undefined && r.coll === 'doc') { this.setLocal(r.coll, r.rid, r.data); return true; }   // first link on this PC: your account's settings win
    const M = this.merge(B, L, r.data);
    if (stableStr(M) === localStr) return false;
    this.setLocal(r.coll, r.rid, M); return true;
  },
  async push() {
    const st = this.st, snap = this.snapshot(), rows = [], now = Date.now(), dev = Cloud.cfg.device.id;
    for (const [coll, recs] of Object.entries(snap)) {
      const bc = st.base[coll] || {};
      for (const [rid, v] of Object.entries(recs)) {
        const s = stableStr(v);
        if (bc[rid] !== s) rows.push({ coll, rid, data: v, cts: now, device: dev, _s: s });
      }
      for (const rid of Object.keys(bc)) if (!(rid in recs)) rows.push({ coll, rid, data: null, deleted: true, cts: now, device: dev });
    }
    if (!rows.length) return 0;
    for (let i = 0; i < rows.length; i += 300) {
      const batch = rows.slice(i, i + 300);
      const { error } = await Cloud.sb.rpc('push_records', { rows: batch.map(({ _s, ...r }) => r) });
      if (error) throw error;
      batch.forEach(r => { const bc = st.base[r.coll] || (st.base[r.coll] = {}); if (r.deleted) delete bc[r.rid]; else bc[r.rid] = r._s; });
      await this.saveState();
    }
    return rows.length;
  },
  saveState() { return window.reel.cloud.syncSave(this.st); },
  pendingCount() {
    if (!this.st) return 0;
    const snap = this.snapshot(); let n = 0;
    for (const [coll, recs] of Object.entries(snap)) { const bc = this.st.base[coll] || {}; for (const [rid, v] of Object.entries(recs)) if (bc[rid] !== stableStr(v)) n++; }
    return n;
  },
};

// ---------------- Friends, activity, now playing ----------------
const Social = {
  friends: [], incoming: [], outgoing: [], loadedAt: 0, ch: null, queue: new Map(), qT: null,
  start() { this.refresh().catch(() => {}); clearInterval(this.t); this.t = setInterval(() => this.refresh().catch(() => {}), 120e3); },
  stop() { clearInterval(this.t); this.friends = []; this.incoming = []; this.outgoing = []; this.loadedAt = 0; this.setPlaying(null).catch(() => {}); },
  // Your four Library favorites, shown on your profile to friends.
  syncFav() {
    if (!Cloud.on || !Cloud.profile) return;
    const favs = Store.data.favorites || [];
    const pick = [...favs.filter(k => k.startsWith('movie:')).slice(0, 4), ...favs.filter(k => k.startsWith('tv:')).slice(0, 4)];
    const fav = pick.map(k => { const it = Store.item(k) || {}; return { key: k, title: it.title || '', year: String(it.year || ''), poster: it.poster || null }; }).filter(f => f.poster);
    if (stableStr(fav) === stableStr(Cloud.profile.fav4 || [])) return;
    Cloud.updateProfile({ fav4: fav }).catch(() => {});
  },
  async refresh() {
    if (!Cloud.on) return;
    const me = Cloud.user.id;
    const wasOut = new Set(this.outgoing.map(p => p.id));
    const { data: rows, error } = await Cloud.sb.from('friendships').select('*');
    if (error) throw error;
    const ids = [...new Set(rows.map(r => (r.requester === me ? r.addressee : r.requester)))];
    const profs = ids.length ? ((await Cloud.sb.from('profiles').select('*').in('id', ids)).data || []) : [];
    const byId = new Map(profs.map(p => [p.id, p]));
    this.friends = rows.filter(r => r.status === 'accepted').map(r => byId.get(r.requester === me ? r.addressee : r.requester)).filter(Boolean)
      .sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username));
    this.incoming = rows.filter(r => r.status === 'pending' && r.addressee === me).map(r => byId.get(r.requester)).filter(Boolean);
    this.outgoing = rows.filter(r => r.status === 'pending' && r.requester === me).map(r => byId.get(r.addressee)).filter(Boolean);
    this.loadedAt = Date.now();
    this.friends.filter(f => wasOut.has(f.id)).forEach(f => Notify.add({ id: 'acc:' + f.id, kind: 'accepted', who: f, at: Date.now() }));
    document.dispatchEvent(new CustomEvent('reel:friends'));
    return this;
  },
  async ensure() { if (Cloud.on && Date.now() - this.loadedAt > 60e3) await this.refresh(); return this; },
  byId(id) { return this.friends.find(f => f.id === id); },
  async find(username) {
    const u = String(username || '').trim().replace(/^@/, '').toLowerCase();
    if (!u) return null;
    const { data } = await Cloud.sb.from('profiles').select('*').eq('username', u).maybeSingle();
    return data || null;
  },
  async add(username) {
    const p = await this.find(username);
    if (!p) throw new Error(`No one goes by @${String(username).replace(/^@/, '')}`);
    if (p.id === Cloud.user.id) throw new Error('That’s you!');
    if (this.friends.some(f => f.id === p.id)) throw new Error(`You’re already friends with ${p.display_name || p.username}`);
    if (this.incoming.some(f => f.id === p.id)) { await this.accept(p.id); return { accepted: true, p }; }
    const { error } = await Cloud.sb.from('friendships').insert({ requester: Cloud.user.id, addressee: p.id });
    if (error && !/duplicate/i.test(error.message)) throw error;
    await this.refresh();
    return { requested: true, p };
  },
  async accept(id) {
    const { error } = await Cloud.sb.from('friendships').update({ status: 'accepted' }).eq('requester', id).eq('addressee', Cloud.user.id);
    if (error) throw error;
    await this.refresh();
  },
  async remove(id) {
    const me = Cloud.user.id;
    await Cloud.sb.from('friendships').delete().or(`and(requester.eq.${me},addressee.eq.${id}),and(requester.eq.${id},addressee.eq.${me})`);
    await this.refresh();
  },
  // Friends' ratings for one title.
  async forTitle(key) {
    await this.ensure();
    if (!this.friends.length) return [];
    const { data } = await Cloud.sb.from('shared_items').select('*').eq('key', key).in('user_id', this.friends.map(f => f.id));
    return (data || []).map(r => ({ ...r, who: this.byId(r.user_id) })).filter(r => r.who && (r.rating || r.liked || r.watched || r.watchlist || r.review))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  },
  async library(uid) {
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await Cloud.sb.from('shared_items').select('*').eq('user_id', uid).order('updated_at', { ascending: false }).range(from, from + 999);
      if (error) throw error;
      all.push(...data);
      if (data.length < 1000) break;
    }
    return all;
  },
  async feed(limit = 40, uid) {
    await this.ensure();
    let q = Cloud.sb.from('activity').select('*').order('created_at', { ascending: false }).limit(limit);
    q = uid ? q.eq('user_id', uid) : q.neq('user_id', Cloud.user.id);
    const { data } = await q;
    return (data || []).map(a => ({ ...a, who: uid && uid === Cloud.user.id ? Cloud.profile : this.byId(a.user_id) })).filter(a => a.who);
  },
  async nowPlaying() {
    await this.ensure();
    if (!this.friends.length) return [];
    const since = new Date(Date.now() - 4 * 3600e3).toISOString();
    const { data } = await Cloud.sb.from('presence').select('*').in('user_id', this.friends.map(f => f.id)).gt('updated_at', since);
    return (data || []).filter(p => p.playing).map(p => ({ ...p, who: this.byId(p.user_id) })).filter(p => p.who);
  },
  // How closely your ratings line up with a friend's (titles you've both rated).
  match(theirs) {
    let n = 0, diff = 0;
    for (const r of theirs) { const mine = Store.item(r.key); if (mine && mine.rating && r.rating) { n++; diff += Math.abs(mine.rating - r.rating); } }
    if (n < 3) return { n, pct: null };
    return { n, pct: Math.max(0, Math.round(100 - (diff / n) * 22)) };
  },
  async setPlaying(info) {
    if (!Cloud.on) return;
    await Cloud.sb.from('presence').upsert({ user_id: Cloud.user.id, playing: info, updated_at: new Date().toISOString() });
  },
  // Activity posts are held for a few seconds and collapsed per title, so "rated, then logged" shows once.
  post(kind, meta, extra = {}) {
    if (!Cloud.on || !Cloud.profile || !Cloud.profile.share_activity || !meta || !meta.id) return;
    const key = `${meta.type}:${meta.id}`;
    if ((Store.item(key) || {}).private) return;
    const rank = { watched: 4, reviewed: 3, rated: 2, liked: 1, watchlist: 0 };
    const cur = this.queue.get(key);
    if (cur && rank[cur.kind] > rank[kind]) { if (extra.rating && !cur.rating) cur.rating = extra.rating; return; }
    this.queue.set(key, { kind, key, title: meta.title || '', year: String(meta.year || '').slice(0, 10), poster: meta.poster || null, rating: extra.rating || (cur && cur.rating) || null, body: extra.body ? String(extra.body).slice(0, 600) : null, rewatch: !!extra.rewatch });
    clearTimeout(this.qT);
    this.qT = setTimeout(() => this.flushPosts(), 15000);
  },
  async flushPosts() {
    const rows = [...this.queue.values()]; this.queue.clear();
    if (rows.length && Cloud.on) await Cloud.sb.from('activity').insert(rows).then(() => {}, () => {});
  },
};

// ---------------- Hooks into the library ----------------
(function hookStore() {
  const save = Store.save.bind(Store);
  Store.save = function () { save(); Sync.touch(); };
  const act = Store._act.bind(Store);
  Store._act = function (kind, meta, before, extra = {}) {
    act(kind, meta, before, extra);
    try {
      if (kind === 'log' && !extra.auto) Social.post('watched', meta, { rating: extra.value || null, rewatch: extra.rewatch });
      else if (kind === 'log' && extra.auto) Social.post('watched', meta, {});
      else if (kind === 'rate') Social.post('rated', meta, { rating: extra.value });
      else if (kind === 'like') Social.post('liked', meta);
      else if (kind === 'watchlist') Social.post('watchlist', meta);
    } catch {}
  };
})();
window.addEventListener('beforeunload', () => { if (Social.queue.size) Social.flushPosts(); });
