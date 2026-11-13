// Reel on the web — window.reel for a browser (phones first). The PC app gets these from Electron and the TV from
// Android; here they come from the browser itself plus Reel's server function "web-stream", which keeps your debrid
// key on the server (it never comes to the browser) and turns debrid files into something a phone can play.
(() => {
  const K = window.REEL_WEB || {};
  const SB_URL = 'https://tsuyeypohzfcjikuuknh.supabase.co';
  const SB_KEY = 'sb_publishable_mc8VFdYKE_sMALLgRGsZhw_QqkJPlTm';
  const noop = () => {};
  const listeners = {};
  const on = (ev) => (cb) => { (listeners[ev] = listeners[ev] || []).push(cb); };
  const emit = (ev, ...a) => (listeners[ev] || []).forEach((cb) => { try { cb(...a); } catch (e) { console.error(e); } });

  // ---- storage: the library in IndexedDB (it can outgrow localStorage), small values in localStorage ----
  const idb = new Promise((res) => {
    try {
      const r = indexedDB.open('reel', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch { res(null); }
  });
  async function kvGet(k) {
    const db = await idb;
    if (!db) { try { return localStorage.getItem('reel:' + k); } catch { return null; } }
    return new Promise((res) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result ?? null); t.onerror = () => res(null); });
  }
  async function kvSet(k, v) {
    const db = await idb;
    if (!db) { try { v == null ? localStorage.removeItem('reel:' + k) : localStorage.setItem('reel:' + k, v); } catch {} return; }
    return new Promise((res) => { const s = db.transaction('kv', 'readwrite').objectStore('kv'); const t = v == null ? s.delete(k) : s.put(v, k); t.onsuccess = t.onerror = () => res(); });
  }
  const lget = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lset = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, String(v)); } catch {} };

  // Which debrid service the account uses (the key itself stays on the server).
  const acct = () => { try { return JSON.parse(lget('reel:debrid') || 'null'); } catch { return null; } };
  // Signed in = a saved session. Without one, nothing from a previous person is shown (shared phones, borrowed laptops).
  const signedIn = () => { try { return Object.keys(localStorage).some((k) => k.startsWith('reel:auth:')); } catch { return false; } };
  async function wipe() {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('reel:') && k !== 'reel:device') localStorage.removeItem(k); } catch {}
    await kvSet('reel-data', null); await kvSet('reel-sync', null);
  }

  // ---- the server function ----
  async function server(body) {
    const sb = typeof Cloud !== 'undefined' && Cloud.sb;
    const s = sb ? (await sb.auth.getSession()).data.session : null;
    if (!s) throw new Error('Sign in to watch.');
    let r;
    try {
      r = await fetch(`${SB_URL}/functions/v1/web-stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}`, apikey: SB_KEY }, body: JSON.stringify(body) });
    } catch { throw new Error('Can’t reach Reel’s servers. Check your connection.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || `Something went wrong (${r.status}).`);
    return j;
  }

  // ---- streams ----
  function parseStream(s) {
    const name = s.name || '', title = s.title || s.description || '', lines = title.split('\n'), all = name + ' ' + title;
    const q = /2160p|4k|uhd/i.test(all) ? 2160 : /1080p/i.test(all) ? 1080 : /720p/i.test(all) ? 720 : /480p/i.test(all) ? 480 : 0;
    const sizeM = title.match(/💾\s*([\d.]+)\s*(TB|GB|MB)/i);
    const sizeGB = sizeM ? parseFloat(sizeM[1]) * ({ TB: 1024, GB: 1, MB: 1 / 1024 }[sizeM[2].toUpperCase()]) : 0;
    const flags = [];
    if (/\bDV\b|dolby.?vision/i.test(all)) flags.push('DV');
    if (/HDR10\+/i.test(all)) flags.push('HDR10+'); else if (/HDR/i.test(all)) flags.push('HDR');
    if (/remux/i.test(all)) flags.push('REMUX');
    if (/atmos/i.test(all)) flags.push('Atmos');
    if (/x265|hevc|h\.?265/i.test(all)) flags.push('HEVC');
    if (/\b(cam|hdcam|ts|telesync|hdts|telecine)\b/i.test(lines[0] || '')) flags.push('CAM');
    if (/\b3d\b|half.?sbs|\bsbs\b/i.test(lines[0] || '')) flags.push('3D');
    if (/upscal|\bai\b.?enhanc/i.test(all)) flags.push('UPSCALE');
    if (/\bhc\b|hardcoded|korsub/i.test(lines[0] || '')) flags.push('HC');
    const langLine = lines.slice(1).join(' ');
    return {
      foreignOnly: /[\u{1F1E6}-\u{1F1FF}]/u.test(langLine) && !/🇬🇧|🇺🇸|multi/i.test(langLine),
      url: s.url, cached: /\[[A-Z]{2,3}\+\]/.test(name), quality: q, sizeGB,
      seeders: parseInt((title.match(/👤\s*(\d+)/) || [])[1] || '0', 10),
      source: ((title.match(/⚙️\s*([^\n]+)/) || [])[1] || '').trim(), flags,
      release: lines[0] || '',
    filename: (s.behaviorHints && s.behaviorHints.filename) || lines[0] || '',
      group: (s.behaviorHints && s.behaviorHints.bingeGroup) || '',
      langs: (lines.slice(1).find((l) => /[\u{1F1E6}-\u{1F1FF}]|multi/iu.test(l)) || '').trim(),
    };
  }
  // Real-Debrid converts anything to phone-friendly video on its own servers. Other services hand over the file
  // as-is, so only versions a browser plays directly are offered (MP4, not HEVC).
  const browserPlays = (x) => /\.mp4$/i.test(x.filename) && !x.flags.includes('HEVC') && !x.flags.includes('DV');
  async function fetchStreams(type, id) {
    const j = await server({ action: 'streams', type, id });
    lset('reel:debrid', JSON.stringify({ debrid: j.service }));
    let list = (j.streams || []).map(parseStream);
    if (j.service !== 'realdebrid') list = list.filter(browserPlays);
    return list;
  }

  // ---- the bridge ----
  window.reel = {
    platform: 'web',
    web: true,
    async loadData() {
      if (!signedIn()) { await wipe(); return null; }
      const t = await kvGet('reel-data'); try { return t ? JSON.parse(t) : null; } catch { return null; }
    },
    wipe,
    async saveData(d) { await kvSet('reel-data', JSON.stringify(d)); return true; },
    async getSecrets() {
      const a = acct();
      const ok = !!a && signedIn();
      return { tmdbKey: K.tmdb, tmdbBuiltIn: true, hasRd: ok, debrid: ok ? a.debrid : '', hasAI: false, torrentioUrl: '' };
    },
    async setSecrets(patch) {
      // Only remember WHICH service the account uses; a key handed over here is not kept in the browser.
      if (patch && (patch.debrid || patch.rdKey)) lset('reel:debrid', JSON.stringify({ debrid: patch.debrid || (acct() || {}).debrid || 'realdebrid' }));
      if (patch && patch.rdKey === null) lset('reel:debrid', null);
      return true;
    },
    async debridKey() { return null; },
    streams: (type, id) => fetchStreams(type, id),
    async testStreaming() { throw new Error('Set up your debrid service in Reel on your computer — it comes with your account.'); },
    async prepare(url) {
      const p = await server({ action: 'play', url });
      if (p.kind === 'hls') {
        const src = p.variants[p.pick];
        return { id: 'web', mode: 'direct', hls: true, directUrl: src, variants: p.variants, quality: p.pick, duration: p.duration || 0, audioTracks: [], subTracks: [], videoCodec: 'h264' };
      }
      return { id: 'web', mode: 'direct', hls: false, directUrl: p.url, duration: 0, audioTracks: [], subTracks: [], videoCodec: 'h264' };
    },
    async endPlayback() { return true; },
    async subsList(type, id) {
      try { const r = await fetch(`https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`); const j = await r.json(); return (j.subtitles || []).map((s) => ({ id: s.id, url: s.url, lang: s.lang, matched: false })); } catch { return []; }
    },
    async subsGet(url) { const r = await fetch(url); return r.text(); },
    async imdbRating(type, imdbId) {
      if (!/^tt\d+$/.test(imdbId || '')) return null;
      try { const r = await fetch(`https://v3-cinemeta.strem.io/meta/${type === 'tv' ? 'series' : 'movie'}/${imdbId}.json`); const m = (await r.json()).meta || {}; return { rating: parseFloat(m.imdbRating) || null }; } catch { return null; }
    },
    async vibe() { throw new Error('Vibe search is on the computer app.'); },
    async lbPick() { throw new Error('Import your Letterboxd history in Reel on your computer — it syncs here.'); },
    // Full screen for the player (Android/desktop); on iPhone the player just fills the screen.
    async fullscreen(onOff) {
      const toggle = onOff === undefined;
      if (toggle) onOff = !document.fullscreenElement;
      try {
        // iPhone has no full screen for web pages, only for a video: use it when you press the button.
        if (onOff && !document.documentElement.requestFullscreen) {
          const v = typeof Player !== 'undefined' && Player.cur && Player.cur.video;
          if (toggle && v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
          return true;
        }
        if (onOff && !document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          try { await screen.orientation.lock('landscape'); } catch {}
        } else if (!onOff && document.fullscreenElement) {
          try { screen.orientation.unlock(); } catch {}
          await document.exitFullscreen();
        }
      } catch {}
      return true;
    },
    async closeWindow() {}, async minimizeWindow() {},
    onFullscreen: (cb) => document.addEventListener('fullscreenchange', () => cb(!!document.fullscreenElement)),
    onNavBack: on('back'),
    async openExternal(url) { window.open(url, '_blank', 'noopener'); },
    async version() { return K.version || '1.0.0'; },
    iptv: new Proxy({}, { get: (_t, k) => (k === 'onEpg' ? noop : async () => { throw new Error('Live TV is on the computer app.'); }) }),
    cloud: {
      async config() {
        let id = lget('reel:device'); if (!id) { id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join(''); lset('reel:device', id); }
        const phone = /iphone|android.+mobile/i.test(navigator.userAgent);
        return { url: SB_URL, key: SB_KEY, site: 'https://saintzdid12.github.io/reel', port: 0,
          device: { id, name: phone ? 'Phone' : 'Browser', platform: 'web', version: K.version || '1.0.0' } };
      },
      async authGet(k) { return lget('reel:auth:' + k); },
      async authSet(k, v) { lset('reel:auth:' + k, v); return true; },
      async authDel(k) { lset('reel:auth:' + k, null); return true; },
      async syncLoad() { const t = await kvGet('reel-sync'); try { return t ? JSON.parse(t) : null; } catch { return null; } },
      async syncSave(st) { await kvSet('reel-sync', st == null ? null : JSON.stringify(st)); return true; },
      async openAuth() { throw new Error('On the web, sign in with your username or a code from Reel on your computer.'); },
      onAuthCallback: on('authCallback'), onDeepLink: noop, async takeLink() { return null; },
    },
    async discord() { return true; },
    async updateStatus() { return null; }, async installUpdate() { return false; },
    onUpdateReady: noop, onUpdateDownloading: noop, onUpdateProgress: noop, onUpdateAvailable: noop,
    async macUpdate() { return null; },
  };
  // The browser/phone Back button: close what's open or go back a screen (see web.js).
  window.__reelWebEmit = emit;

  // Back from Discord: the address carries ?code=… (or ?error=…). Tidy the address, then hand it to Reel's sign-in
  // as soon as that's listening (the same path the computer app uses).
  try {
    const q = new URLSearchParams(location.search);
    const code = q.get('code'), error = q.get('error_description') || q.get('error');
    if (code || error) {
      history.replaceState(null, '', location.pathname);
      let n = 0;
      const t = setInterval(() => {
        if ((listeners.authCallback || []).length || ++n > 100) { clearInterval(t); emit('authCallback', { code, error }); }
      }, 100);
    }
  } catch {}
})();
