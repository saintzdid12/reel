// Watch parties: everyone streams the same release through their own debrid account, and Reel keeps playback in
// step — play, pause and seeks go to everyone; small drift is corrected by nudging speed, big gaps by a seek.
// A party opens in a lobby: nothing plays until the host presses Start. Chat docks beside the video (theater) or
// floats over it (transparent), and can be hidden. Parties use a random code; anyone signed in with it can join.

const REACTIONS = ['😂', '😮', '😭', '🔥', '❤️', '👏', '💀', '🍿'];
const hashOf = (url) => ((String(url || '').match(/[a-f0-9]{40}/i) || [])[0] || '').toLowerCase();
const PI = {
  sync: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a8 8 0 0 1 7.4 5H17v2h6V5h-2v2.3A10 10 0 0 0 2.1 11h2A8 8 0 0 1 12 4zm7.9 9A8 8 0 0 1 4.6 15H7v-2H1v6h2v-2.3A10 10 0 0 0 21.9 13z"/></svg>',
  send: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.6 2-12.6 2z"/></svg>',
  chat: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm0 2v11.2L7.2 16H20V6z"/></svg>',
  side: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v12h10V6zm12 0v12h4V6z"/></svg>',
  float: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v12h16V6zm9 6h6v4h-6z"/></svg>',
  leave: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M10 3h9a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-9v-2h9V5h-9zm-.6 4.4L5.8 11H15v2H5.8l3.6 3.6L8 18l-6-6 6-6z"/></svg>',
  link: '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a3 3 0 0 1 4.2 4.2l-2.1 2.1-1.4-1.4 2.1-2.1a1 1 0 0 0-1.4-1.4l-3.5 3.5a1 1 0 0 1-1.4 0zm2.8-2.8a1 1 0 0 1 0 1.4l-3.5 3.5a3 3 0 0 1-4.2-4.2l2.1-2.1 1.4 1.4-2.1 2.1a1 1 0 0 0 1.4 1.4l3.5-3.5a1 1 0 0 1 1.4 0z"/></svg>',
};
const statusText = (s) => ({ loading: 'Loading…', ready: 'Ready', playing: 'Watching', paused: 'Paused', buffering: 'Buffering…' })[s] || 'Here';

const Party = {
  cur: null,          // { code, row, ch, me, members, isHost, lobby, ui, pl }
  pendingHost: null,  // the next stream you start becomes a party
  pendingJoin: null,

  // ---------- entry points ----------
  button(meta, ep) {
    const b = h(`<button class="btn" title="Start a watch party — friends join with a code and stay in sync">${PARTY_SVG} Watch together</button>`);
    b.onclick = () => this.startHost(meta, ep);
    return b;
  },
  startHost(meta, ep) {
    if (!Cloud.on) return AccountUI.signIn('Sign in to start a watch party — your friends join with a code and everyone stays in sync.');
    this.pendingHost = { key: `${meta.type}:${meta.id}`, ep: ep || null, at: Date.now() };
    toast('Pick a version — your party opens in a lobby, nothing plays until you press Start');
    Playback.start(meta, ep, { manual: true });
  },
  async join(code) {
    code = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return;
    if (!Cloud.on) return AccountUI.signIn('Sign in to join the watch party.');
    if (this.cur && this.cur.code === code) return toast('You’re already in this party');
    const wait = h(`<div class="party-join"><div class="spinner"></div><b>Joining party ${esc(code)}…</b><span class="muted msg">Finding the same version your friends are watching</span></div>`);
    const m = openModal(wait);
    try {
      const { data, error } = await Cloud.sb.rpc('get_party', { p_code: code });
      if (error) throw error;
      const row = data && data[0];
      if (!row) throw new Error('That party has ended or the code is wrong.');
      const [type, id] = row.key.split(':');
      const d = await TMDB.details(type, +id);
      const meta = metaFromDetails(type, d);
      const ep = type === 'tv' ? { season: row.season, episode: row.episode } : null;
      if (ep) { try { const s = await TMDB.get(`/tv/${id}/season/${ep.season}`); const e = (s.episodes || []).find(x => x.episode_number === ep.episode); if (e) Object.assign(ep, { name: e.name, still: e.still_path, runtime: e.runtime }); } catch {} }
      const { list, stype, sid } = await Playback.getStreams(meta, ep);
      if (!list.length) throw new Error('No playable streams were found for this title on your account.');
      const rel = row.release || {};
      const ok = (x) => x.cached;   // a debrid link that isn't ready (not cached) would just sit on a black screen
      const exact = list.find(x => ok(x) && rel.hash && hashOf(x.url) === rel.hash && (!rel.file || x.filename === rel.file)) || list.find(x => ok(x) && rel.hash && hashOf(x.url) === rel.hash);
      const byName = !exact && rel.file ? list.find(x => ok(x) && x.filename === rel.file) : null;
      const close = !exact && !byName ? [...list].filter(x => ok(x) && !x.flags.includes('CAM')).sort((a, b) => Math.abs((a.quality || 0) - (rel.q || 0)) - Math.abs((b.quality || 0) - (rel.q || 0)) || Math.abs((a.sizeGB || 0) - (rel.size || 0)) - Math.abs((b.sizeGB || 0) - (rel.size || 0)))[0] : null;
      let pick = exact || byName || close || list[0];
      // This PC can't show HEVC pictures directly (it would have to convert them live, which looks worse and can fall
      // behind the party): take the closest version it can play as-is. Parties sync fine across versions.
      if (!CAN_HEVC && pick.flags.includes('HEVC')) {
        const direct = list.filter(x => ok(x) && !x.flags.includes('HEVC') && !x.flags.includes('CAM'))
          .sort((a, b) => Math.abs((a.quality || 0) - (pick.quality || 0)) - Math.abs((b.quality || 0) - (pick.quality || 0)) || (b.score || 0) - (a.score || 0))[0];
        if (direct) { pick = direct; toast('Playing a version this PC shows directly, so it stays sharp and in sync'); }
      }
      m.close();
      if (!exact && !byName) toast('Playing a different version from the host — timing may be a second or two off', true);
      this.pendingJoin = { row, at: Date.now() };
      Player.open(meta, ep, pick, list, { stype, sid }, { resumeAt: 0 });
    } catch (e) {
      m.close();
      toast(cleanErr(e), true);
    }
  },

  // ---------- player hooks ----------
  async onPlay(pl) {
    const key = `${pl.meta.type}:${pl.meta.id}`;
    const c0 = this.cur;
    if (c0 && c0.detachedAt && pl.meta.type === 'tv' && pl.meta.id === c0.meta.id) return this.reattach(pl);
    if (this.pendingJoin && Date.now() - this.pendingJoin.at < 120e3) {
      const { row } = this.pendingJoin; this.pendingJoin = null;
      pl.video.pause();
      return this.attach(pl, row, row.host === Cloud.user.id);
    }
    if (this.pendingHost && this.pendingHost.key === key && Date.now() - this.pendingHost.at < 10 * 60e3) {
      this.pendingHost = null;
      pl.video.pause();                                        // nothing plays until you press Start
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
      const row = { code, key, title: pl.meta.title, year: String(pl.meta.year || ''), poster: pl.meta.poster || null,
        season: pl.ep ? pl.ep.season : null, episode: pl.ep ? pl.ep.episode : null,
        release: { hash: hashOf(pl.stream.url), file: pl.stream.filename || '', q: pl.stream.quality || 0, size: +(pl.stream.sizeGB || 0).toFixed(2) } };
      this.attach(pl, { ...row, host: Cloud.user.id }, true);
      const { error } = await Cloud.sb.from('parties').insert(row);
      if (error) { this.leave(true); toast(`Couldn’t start the party: ${cleanErr(error)}`, true); return; }
      if (Cloud.profile && Cloud.profile.share_activity) Cloud.sb.from('activity').insert({ kind: 'party', key, title: row.title, year: row.year, poster: row.poster, party: code }).then(() => {}, () => {});
    }
  },
  onStop(pl) {
    const c = this.cur; if (!c || c.pl !== pl) return;
    // Moving on to the next episode closes this player quietly — keep the party and wait for the new one.
    if (pl.meta.type === 'tv' && pl.silentClose && !c.lobby) return this.detach();
    this.leave(true);
  },
  detach() {
    const c = this.cur; if (!c || !c.pl) return;
    if (c.unwire) c.unwire();
    c.ui.remove(); c.chat.remove();
    c.pl.root.classList.remove('party-on', 'party-chat-open', 'party-side', 'party-overlay', 'party-lobby-on');
    c.pl = null; c.detachedAt = Date.now();
    clearTimeout(c.detachT);
    c.detachT = setTimeout(() => { if (this.cur === c && !c.pl) { this.leave(true); toast('The watch party ended'); } }, 30000);
  },
  async reattach(pl) {
    const c = this.cur; if (!c) return;
    clearTimeout(c.detachT); c.detachedAt = 0;
    c.pl = pl; c.meta = pl.meta;
    pl.root.classList.add('party-on');
    pl.root.append(c.ui, c.chat);
    document.addEventListener('keydown', c.onKey, true);
    this.setChatMode(c.chatMode, true);
    pl.root.classList.toggle('party-chat-open', !!c.chatOpen);
    this.wireVideo();
    this.paintLobby(); this.paintMembers();
    const ep = pl.ep || {};
    if (c.isHost) {
      c.row = { ...c.row, season: ep.season, episode: ep.episode, release: { hash: hashOf(pl.stream.url), file: pl.stream.filename || '', q: pl.stream.quality || 0, size: +(pl.stream.sizeGB || 0).toFixed(2) } };
      Cloud.sb.from('parties').update({ season: ep.season, episode: ep.episode, release: c.row.release }).eq('code', c.code).then(() => {}, () => {});
      c.ch && c.ch.send({ type: 'broadcast', event: 'episode', payload: { season: ep.season, episode: ep.episode, name: ep.name || '', by: c.me.name } });
      this.sys(`Now playing S${ep.season} · E${ep.episode}`);
      setTimeout(() => this.sendState('sync'), 2500);
    } else {
      c.ch && c.ch.send({ type: 'broadcast', event: 'resync', payload: {} });
    }
    this.discordSoon();
  },
  // The host moved to another episode: open the same one here (best version on your account).
  async followEpisode(p) {
    const c = this.cur; if (!c || !c.meta) return;
    if (c.pl && c.pl.ep && c.pl.ep.season === p.season && c.pl.ep.episode === p.episode) return;
    if (c.following === `${p.season}:${p.episode}`) return;
    c.following = `${p.season}:${p.episode}`;
    try {
      const ep = { season: p.season, episode: p.episode, name: p.name || '' };
      const { list, stype, sid, best } = await Playback.getStreams(c.meta, ep);
      if (!list.length || this.cur !== c) return;
      if (c.pl) c.pl.silentClose = true;
      Player.open(c.meta, ep, best || list[0], list, { stype, sid }, { resumeAt: 0 });
    } catch (e) { toast(`Couldn’t open the next episode: ${cleanErr(e)}`, true); }
    finally { setTimeout(() => { if (c.following === `${p.season}:${p.episode}`) c.following = null; }, 20000); }
  },

  // ---------- the live session ----------
  attach(pl, row, isHost) {
    if (this.cur) this.leave(true);
    const p = Cloud.profile || {};
    const me = { uid: Cloud.user.id, name: fname(p), avatar: p.avatar_url || null, joinedAt: Date.now(), status: 'loading' };
    const cur = this.cur = { code: row.code, row, pl, meta: pl.meta, me, isHost, lobby: true, hostOnly: false, members: [], statuses: {}, applying: 0, ignoreUntil: 0, rateT: null,
      chatOpen: false, chatMode: Store.settings.partyChat === 'overlay' ? 'overlay' : 'side' };
    // Remembered so Home can offer "Rejoin" if Reel closes mid-party.
    try { localStorage.setItem('reel:party', JSON.stringify({ code: row.code, key: row.key, title: row.title, poster: row.poster, at: Date.now() })); } catch {}
    this.buildUi();
    this.wireVideo();
    this.connect(cur, true);
    cur.hb = setInterval(() => { if (cur.pl && this.leader() && !cur.lobby && !cur.pl.video.paused) this.sendState('sync'); }, 3000);
    try { pl.video.preload = 'auto'; } catch {}
    cur.waitT = setInterval(() => { this.checkHost(); this.updateStatus(); this.checkWait(); this.paintDrift(); }, 1000);
    this.discord();
    Social.setPlaying(this.playingInfo()).catch(() => {});
  },
  // The live channel. If the connection drops (sleep, Wi-Fi blip), it rejoins and catches up with the others.
  async connect(cur, first) {
    const me = cur.me;
    // Fully close the old connection first: two live joins to the same party collide and drop messages.
    if (cur.ch) { const old = cur.ch; cur.ch = null; await Cloud.sb.removeChannel(old).catch(() => {}); if (this.cur !== cur) return; }
    const ch = cur.ch = Cloud.sb.channel(`party:${cur.code}`, { config: { broadcast: { self: false, ack: false }, presence: { key: me.uid } } });
    ch.on('broadcast', { event: 'state' }, ({ payload }) => this.onState(payload))
      .on('broadcast', { event: 'hello' }, ({ payload }) => { if (cur.isHost) ch.send({ type: 'broadcast', event: 'host', payload: { uid: me.uid, name: me.name, quiet: true } }); if (this.leader()) this.sendState('sync'); this.updateStatus(true); if (!payload.again) this.sys(`${payload.name} joined`); })
      .on('broadcast', { event: 'status' }, ({ payload }) => { cur.statuses[payload.uid] = payload.status; this.paintMembers(); })
      .on('broadcast', { event: 'chat' }, ({ payload }) => this.addMsg(payload))
      .on('broadcast', { event: 'countdown' }, ({ payload }) => this.countdown(payload.sec || 3))
      .on('broadcast', { event: 'episode' }, ({ payload }) => { this.sys(`${payload.by} moved on to S${payload.season} · E${payload.episode}`); this.followEpisode(payload); })
      .on('broadcast', { event: 'resync' }, () => { if (this.leader()) this.sendState('sync'); })
      .on('broadcast', { event: 'host' }, ({ payload }) => {
        // The host left: drop them right away instead of waiting for the connection to time out.
        if (payload.left && payload.from) { cur.members = cur.members.filter(m => m.uid !== payload.from); delete cur.statuses[payload.from]; cur.saidLeft = payload.from; this.sys(`${payload.by} left`); }
        this.setHost(payload.uid, payload.name, payload.left ? null : payload.by, payload.quiet);
      })
      .on('broadcast', { event: 'react' }, ({ payload }) => this.floatReaction(payload.emoji, payload.name))
      .on('presence', { event: 'sync' }, () => { cur.members = Object.values(ch.presenceState()).map(a => a[0]).filter(Boolean).sort((a, b) => a.joinedAt - b.joinedAt); this.paintMembers(); this.discordSoon(); })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => (leftPresences || []).forEach(x => { if (!cur.members.some(m => m.uid === x.uid)) { delete cur.statuses[x.uid]; if (!cur.saidLeft || cur.saidLeft !== x.uid) this.sys(`${x.name} left`); } }))
      .subscribe(async (status) => {
        if (this.cur !== cur || cur.ch !== ch) return;
        if (status === 'SUBSCRIBED') {
          me.status = this.statusNow();
          await ch.track({ uid: me.uid, name: me.name, avatar: me.avatar, joinedAt: me.joinedAt });
          this.updateStatus(true);
          ch.send({ type: 'broadcast', event: 'hello', payload: { name: me.name, again: !first } });
          first = false;
        } else if (status === 'CLOSED') {
          // Errors and timeouts rejoin on their own; only a closed channel needs a fresh one.
          clearTimeout(cur.reT);
          cur.reT = setTimeout(() => { if (this.cur === cur && cur.ch === ch) this.connect(cur, false); }, 2500);
        }
      });
  },
  leave(silent) {
    const c = this.cur; if (!c) return;
    clearTimeout(c.reT); clearTimeout(c.detachT); clearTimeout(c.cdT);
    try { localStorage.removeItem('reel:party'); } catch {}
    const others = c.members.filter(m => m.uid !== c.me.uid);
    if (c.isHost && others.length && c.ch) c.ch.send({ type: 'broadcast', event: 'host', payload: { uid: others[0].uid, name: others[0].name, by: c.me.name, left: true, from: c.me.uid } });
    this.cur = null;
    clearInterval(c.hb); clearInterval(c.waitT); clearTimeout(c.rateT); clearTimeout(c.trackT);
    if (c.ch) { c.ch.untrack().catch(() => {}); Cloud.sb.removeChannel(c.ch); }
    if (c.ui) c.ui.remove();
    if (c.chat) c.chat.remove();
    if (c.pl) {
      c.pl.root.classList.remove('party-on', 'party-chat-open', 'party-side', 'party-overlay', 'party-lobby-on');
      if (c.unwire) c.unwire();
      c.pl.video.playbackRate = 1;
    }
    if (c.isHost && !others.length) Cloud.sb.from('parties').update({ ended_at: new Date().toISOString() }).eq('code', c.code).then(() => {}, () => {});
    if (!silent) toast('You left the watch party');
  },
  leader() {
    const c = this.cur; if (!c) return false;
    const ids = c.members.map(m => m.uid);
    const lead = ids.includes(c.row.host) ? c.row.host : ids[0];
    return lead ? lead === c.me.uid : c.isHost;
  },
  setHost(uid, name, by, quiet) {
    const c = this.cur; if (!c) return;
    const changed = c.row.host !== uid;
    c.row = { ...c.row, host: uid };
    c.isHost = uid === c.me.uid;
    c.hostGoneAt = 0;
    if (changed || !quiet) this.sys(c.isHost ? (by ? `${by} made you the host` : 'You’re the host now') : `${name} is now the host`);
    if (c.isHost) c.hostOnly = c.hostOnly || false;
    this.paintLobby(); this.paintMembers();
  },
  // If the host disappears without handing over (Reel closed, connection lost), the longest-standing member
  // takes over after a few seconds. Everyone works out the same person, so nobody argues about it.
  checkHost() {
    const c = this.cur; if (!c || !c.ch || !c.members.length) return;
    if (c.members.some(m => m.uid === c.row.host)) { c.hostGoneAt = 0; return; }
    if (!c.members.some(m => m.uid === c.me.uid)) return;     // not fully connected yet
    c.hostGoneAt = c.hostGoneAt || Date.now();
    if (Date.now() - c.hostGoneAt < 6000) return;
    const next = c.members[0];
    if (next.uid === c.me.uid) c.ch.send({ type: 'broadcast', event: 'host', payload: { uid: next.uid, name: next.name } });
    this.setHost(next.uid, next.name);
  },
  makeHost(m) {
    const c = this.cur; if (!c || !c.isHost || !c.ch) return;
    c.ch.send({ type: 'broadcast', event: 'host', payload: { uid: m.uid, name: m.name, by: c.me.name } });
    this.setHost(m.uid, m.name);
  },
  setHostOnly(on) {
    const c = this.cur; if (!c || !c.isHost) return;
    c.hostOnly = !!on;
    this.sendState('sync');
    this.sys(on ? 'Only you can pause and skip now' : 'Everyone can pause and skip');
    this.paintLobby();
  },
  hostName() {
    const c = this.cur; if (!c) return '';
    const h0 = c.members.find(m => m.uid === c.row.host);
    return c.isHost ? 'you' : h0 ? h0.name : 'the host';
  },
  playingInfo() {
    const c = this.cur, pl = c ? c.pl : Player.cur;
    if (!pl) return null;
    return { key: `${pl.meta.type}:${pl.meta.id}`, title: pl.meta.title, year: pl.meta.year || '', poster: pl.meta.poster || null,
      season: pl.ep ? pl.ep.season : null, episode: pl.ep ? pl.ep.episode : null, party: c ? c.code : null };
  },

  // ---------- lobby ----------
  start() {
    const c = this.cur; if (!c || !c.isHost || c.counting) return;
    c.ch && c.ch.send({ type: 'broadcast', event: 'countdown', payload: { sec: 3 } });
    this.countdown(3, () => this.go());
  },
  countdown(sec, done) {
    const c = this.cur; if (!c || !c.ui) return;
    c.counting = true;
    c.pl && c.pl.root.classList.add('party-counting');
    let n = sec;
    const el = $('.party-count', c.ui) || c.ui.appendChild(h('<div class="party-count"></div>'));
    const tick = () => {
      if (this.cur !== c) return;
      if (n <= 0) { el.remove(); c.counting = false; c.pl && c.pl.root.classList.remove('party-counting'); if (done) done(); return; }
      el.innerHTML = `Starting in <b>${n}</b>`; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      n--; c.cdT = setTimeout(tick, 1000);
    };
    tick();
  },
  go() {
    const c = this.cur; if (!c || !c.isHost || !c.pl) return;
    c.lobby = false;
    this.paintLobby();
    c.applying = Date.now() + 1200;
    c.pl.video.play().catch(() => {});
    this.sendState('start');
    this.sys('You started the party');
    this.updateStatus();
    this.discordSoon();
  },

  // A small note under the party bar when you're well out of step and it isn't fixing itself:
  // "You're 6s behind · Catch up · ✕". Dismissing hides it until the gap changes a lot (or 10 minutes pass).
  paintDrift() {
    const c = this.cur; if (!c || !c.ui) return;
    let el = $('.party-drift', c.ui);
    const now = Date.now();
    const playing = c.pl && !c.pl.video.paused;
    const d = c.lastDiff || 0, fresh = now - (c.lastDiffAt || 0) < 7000;
    const off = fresh && playing && !c.lobby && !c.wait && !this.leader() && Math.abs(d) > 3;
    c.offSince = off ? (c.offSince || now) : 0;
    const dismissed = c.driftDismiss && now < c.driftDismiss.until && Math.abs(Math.abs(d) - c.driftDismiss.at) < 10;
    const show = off && now - c.offSince > 4000 && !dismissed;
    if (!show) { if (el) el.remove(); return; }
    if (!el) {
      el = h(`<div class="party-drift"><span class="pd-t"></span><button class="pd-go">Catch up</button><button class="pd-x" title="Dismiss">${ICON.x}</button></div>`);
      $('.pd-go', el).onclick = (e) => { e.stopPropagation(); this.catchUp(); el.remove(); };
      $('.pd-x', el).onclick = (e) => { e.stopPropagation(); c.driftDismiss = { at: Math.abs(c.lastDiff || 0), until: Date.now() + 10 * 60e3 }; el.remove(); };
      const bar = $('.party-bar', c.ui); bar.after(el);
    }
    $('.pd-t', el).textContent = `You’re ${Math.round(Math.abs(d))}s ${d > 0 ? 'behind' : 'ahead'}`;
  },

  // ---------- keeping in step ----------
  // "Catch up": a guest asks for the party's spot and jumps straight there (no waiting, no easing); the leader instead
  // sends everyone to their own spot. Works the same on the PC and the TV.
  catchUp() {
    const c = this.cur; if (!c || !c.ch) return;
    if (this.leader()) { this.sendState('sync', { force: true }); this.sys('Everyone was brought to your spot'); return; }
    c.forceJump = Date.now();
    c.ch.send({ type: 'broadcast', event: 'resync', payload: {} });
    toast('Catching up with the party…');
  },
  sendState(reason, extra) {
    const c = this.cur; if (!c || !c.ch || !c.pl) return;
    const v = c.pl.video;
    if (reason === 'play' || reason === 'pause' || reason === 'seek') this.endWait(reason === 'play');
    c.ch.send({ type: 'broadcast', event: 'state', payload: { t: Player.time(), paused: c.lobby ? true : v.paused, lobby: c.isHost ? c.lobby : false, hostOnly: c.isHost ? c.hostOnly : undefined, reason, by: c.me.name, from: c.me.uid, ...(extra || {}) } });
  },
  // ---------- waiting for whoever is loading ----------
  // When anyone's video stalls (slow connection, a laptop converting the picture), the leader pauses
  // everyone and resumes once that person has a few seconds loaded — instead of everyone else running ahead and
  // the slow one reloading over and over to catch up.
  checkWait() {
    const c = this.cur; if (!c || !c.pl || c.lobby || !c.ch || !this.leader()) return;
    const v = c.pl.video, now = Date.now();
    const loading = this.loadingMembers();
    if (!c.wait) {
      if (v.paused || now < (c.noWaitUntil || 0)) { c.stallSince = 0; return; }
      if (!loading.length) { c.stallSince = 0; return; }
      c.stallSince = c.stallSince || now;
      if (now - c.stallSince < 2000) return;   // brief hiccups don't stop the party
      c.wait = { since: now, names: loading.map(m => m.name) };
      c.applying = now + 1200; v.pause();
      this.sendState('wait', { waitFor: c.wait.names, waitUids: loading.map(m => m.uid) });
      this.showWait(c.wait.names);
      return;
    }
    if (!v.paused) { this.endWait(); return; }
    if (loading.length) {
      const names = loading.map(m => m.name).join();
      if (names !== c.wait.names.join()) { c.wait.names = loading.map(m => m.name); this.showWait(c.wait.names); }
      if (!c.wait.told && now - c.wait.since > 45000) { c.wait.told = true; this.sys(`Still loading for ${c.wait.names.join(', ')} — press play to keep going without waiting`); }
      return;
    }
    // Everyone has enough loaded: go again together.
    c.wait = null; c.stallSince = 0; this.showWait(null);
    c.applying = now + 1200; v.play().catch(() => {});
    setTimeout(() => this.sendState('resume'), 150);
  },
  // Members (including me) whose video can't play right now.
  loadingMembers() {
    const c = this.cur;
    const ms = c.members.length ? c.members : [c.me];
    return ms.filter(m => (m.uid === c.me.uid ? c.me.status : c.statuses[m.uid]) === 'buffering');
  },
  endWait(manual) {
    const c = this.cur; if (!c) return;
    if (c.wait && manual) c.noWaitUntil = Date.now() + 30000;   // someone chose to keep going
    c.wait = null; c.stallSince = 0; this.showWait(null);
  },
  showWait(names) {
    const c = this.cur; if (!c || !c.pl) return;
    let el = $('.party-wait', c.pl.root);
    if (!names || !names.length) { if (el) el.remove(); c.pl.root.classList.remove('party-waiting'); return; }
    if (!el) {
      el = h('<div class="party-wait"><div class="spinner"></div><b></b><span></span><button class="btn small ghost pw-go">Keep watching without waiting</button></div>');
      c.pl.root.appendChild(el);
      $('.pw-go', el).onclick = (e) => {
        e.stopPropagation();
        if (c.hostOnly && !c.isHost) return this.locked();
        c.intentAt = Date.now(); c.applying = 0;
        const v = c.pl.video; v.play().catch(() => {});
      };
    }
    c.pl.root.classList.add('party-waiting');
    const mine = names.includes(c.me.name);
    const others = names.filter(n => n !== c.me.name);
    $('b', el).textContent = mine ? 'Loading your stream…' : `Waiting for ${others.join(', ')}`;
    $('span', el).textContent = mine ? (others.length ? `Everyone’s waiting for you and ${others.join(', ')} — it starts again by itself.` : 'Everyone’s waiting for you — it starts again by itself.') : 'Their video is still loading. The party starts again by itself as soon as they’re ready.';
    $('.pw-go', el).hidden = mine || (c.hostOnly && !c.isHost);
  },
  onState(s) {
    const c = this.cur; if (!c || !c.pl || !Player.cur || Player.cur !== c.pl) return;
    const v = c.pl.video;
    // Lobby: the host hasn't started yet — wait (paused) at their spot.
    if (s.from === c.row.host && !c.isHost) {
      if (s.hostOnly !== undefined && !!s.hostOnly !== c.hostOnly) { c.hostOnly = !!s.hostOnly; this.paintLobby(); this.sys(c.hostOnly ? `Only ${s.by} can pause and skip` : 'Everyone can pause and skip'); }
      const wasLobby = c.lobby;
      c.lobby = !!s.lobby;
      if (wasLobby !== c.lobby) { this.paintLobby(); if (!c.lobby) this.sys(`${s.by} started the party`); this.discordSoon(); }
    }
    if (s.reason === 'wait') { c.wait = { since: (c.wait && c.wait.since) || Date.now(), names: s.waitFor || [], remote: true }; c.stallSince = 0; this.showWait(c.wait.names); if ((s.waitUids || []).includes(c.me.uid)) this.slowNote(); }
    else if (s.reason === 'resume') { c.wait = null; c.stallSince = 0; this.showWait(null); }
    // The leader hears others' play/pause too: a real choice ends an automatic wait.
    if (s.reason === 'play' || s.reason === 'pause' || s.reason === 'seek') this.endWait(s.reason === 'play');
    const target = s.t + (s.paused ? 0 : 0.08);   // ~one network hop
    const diff = target - Player.time();
    const loadingHere = Player.cur.pendingSeek != null || (!v.paused && c.pl.root.classList.contains('buffering'));
    const reloads = Player.cur.info && (Player.cur.info.mode === 'remux' || Player.cur.needTx);   // a jump restarts the stream
    // Only what Reel itself does here is muted from being re-broadcast — your own clicks always go out.
    const hold = () => (c.applying = Date.now() + 1200);
    if (s.reason !== 'sync' && s.reason !== 'start' && s.by) this.sys(s.reason === 'seek' ? `${s.by} jumped to ${fmtTime(s.t)}` : s.reason === 'pause' ? `${s.by} paused` : s.reason === 'play' ? `${s.by} pressed play` : '');
    // A seek reloads the stream (which starts it playing) — if the party is paused, it stays paused afterwards.
    c.stayPaused = 0;
    // A jump on a file that has to reload (converted/remuxed) takes a few seconds, during which the party moves on.
    // So: aim where the party WILL be once it's loaded (learned from this PC's own load times), then hold there if
    // it lands early and start at the exact moment the party arrives. No more jump → load → behind → jump loops.
    const jump = () => {
      hold(); c.fixAt = Date.now(); v.playbackRate = 1;
      if (Player.jumpLoaded(target)) { if (s.paused) c.stayPaused = Date.now() + 5000; return; }
      const lead = reloads && !s.paused ? (c.loadLead || 4) : 0;
      c.jumpedAt = Date.now(); c.reloadJumpAt = reloads ? Date.now() : 0; c.holding = reloads && !s.paused;
      Player.seek(target + lead);
      if (s.paused) c.stayPaused = Date.now() + 5000;
    };
    c.lastDiff = diff; c.lastDiffAt = Date.now();
    // Landed early after a reload jump, now loaded: wait right here until the party catches up, then go together.
    if (c.holding && !loadingHere && !s.paused) {
      c.holding = false;
      if (diff < -0.35 && diff > -20) { hold(); v.pause(); clearTimeout(c.holdT); c.holdT = setTimeout(() => { if (this.cur === c) { hold(); v.play().catch(() => {}); } }, -diff * 1000); return; }
    }
    const recentReloadJump = c.reloadJumpAt && Date.now() - c.reloadJumpAt < 20000;
    const forced = s.force || (c.forceJump && Date.now() - c.forceJump < 8000);
    if (forced) { c.forceJump = 0; c.fixAt = 0; if (Math.abs(diff) > 0.25) jump(); }
    else if (s.reason === 'seek' && Math.abs(diff) > 0.8) jump();
    // Still loading here: let it finish (the party waits for us) rather than restarting the stream again.
    else if (loadingHere && s.reason !== 'start') { if (s.paused && !v.paused) { hold(); v.pause(); } return; }
    else if (s.paused && Math.abs(diff) > 0.5 && Player.jumpLoaded(target)) hold();
    else if (Math.abs(diff) > (reloads ? (recentReloadJump ? 30 : 8) : 2) && Date.now() - (c.fixAt || 0) > 6000) jump();
    else if (!s.paused && Math.abs(diff) > 0.3) {
      // Catch up (or ease back) by playing a little faster/slower — pitch is preserved — for as long as the gap needs.
      // Files that reload on a jump lean on this more (up to 25%) instead of jumping again.
      const k = Math.abs(diff) >= 3 ? (reloads ? 0.25 : 0.2) : Math.abs(diff) >= 1 ? 0.12 : 0.08;
      v.playbackRate = 1 + Math.sign(diff) * k;
      clearTimeout(c.rateT); c.rateT = setTimeout(() => { if (v) v.playbackRate = 1; }, Math.min(15000, Math.abs(diff) / k * 1000));
    } else if (Math.abs(diff) <= 0.25) v.playbackRate = 1;
    if (s.paused && !v.paused) { hold(); v.pause(); }
    if (!s.paused && v.paused && Player.cur && Player.cur.pendingSeek == null) { hold(); v.play().catch(() => {}); }
    Player.paint && Player.paint();
  },
  wireVideo() {
    const c = this.cur, v = c.pl.video;
    const user = () => Date.now() > c.applying && Date.now() > c.ignoreUntil;
    // Only a real click / keypress counts as "you pressed play" — the player's own automatic start doesn't.
    const intent = () => (c.intentAt = Date.now());
    c.pl.root.addEventListener('pointerdown', intent, true);
    c.pl.root.addEventListener('keydown', intent, true);
    document.addEventListener('keydown', intent, true);
    const onPlay = () => {
      if (c.lobby) {
        const pressed = Date.now() - (c.intentAt || 0) < 1000;
        if (c.isHost && pressed) return this.start();       // pressing play in the lobby starts it for everyone
        c.applying = Date.now() + 800; v.pause();
        if (pressed) toast(`Waiting for ${this.hostName()} to start`);
        return;
      }
      if (Date.now() < (c.stayPaused || 0) && !(Date.now() - (c.intentAt || 0) < 1000)) { c.applying = Date.now() + 800; v.pause(); return; }
      if (c.hostOnly && !c.isHost && Date.now() - (c.intentAt || 0) < 1000 && Date.now() > c.applying) { c.applying = Date.now() + 800; v.pause(); this.locked(); return; }
      if (user() || (Date.now() - (c.intentAt || 0) < 1000 && Date.now() > c.applying)) this.sendState('play');
    };
    const onPause = () => {
      if (c.lobby) return;
      const pressed = Date.now() - (c.intentAt || 0) < 1000 && Date.now() > c.applying;
      if (c.hostOnly && !c.isHost && pressed) { c.applying = Date.now() + 800; v.play().catch(() => {}); this.locked(); return; }
      if (pressed || (user() && Player.cur && Player.cur.pendingSeek == null && !c.pl.root.classList.contains('buffering'))) this.sendState('pause');
    };
    const st = () => this.updateStatus();
    v.addEventListener('play', onPlay); v.addEventListener('pause', onPause);
    ['waiting', 'playing', 'canplay', 'loadeddata'].forEach(e => v.addEventListener(e, st));
    // Seeks (arrow keys, the timeline, ±10s) go through Player.seek.
    const seek0 = Player.seek;
    Player.seek = function (t) {
      const r = seek0.call(this, t);
      if (Party.cur === c && Date.now() > c.applying) {
        if (c.hostOnly && !c.isHost) { Party.locked(); c.ch && c.ch.send({ type: 'broadcast', event: 'resync', payload: {} }); return r; }
        c.ignoreUntil = Date.now() + 2500; clearTimeout(c.seekT); c.seekT = setTimeout(() => Party.sendState('seek'), 400);
      }
      return r;
    };
    c.unwire = () => { c.pl.root.removeEventListener('pointerdown', intent, true); c.pl.root.removeEventListener('keydown', intent, true); document.removeEventListener('keydown', intent, true); v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); ['waiting', 'playing', 'canplay', 'loadeddata'].forEach(e => v.removeEventListener(e, st)); Player.seek = seek0; document.removeEventListener('keydown', c.onKey, true); };
  },
  locked() { clearTimeout(this._lkT); this._lkT = setTimeout(() => toast(`Only ${this.hostName()} can pause and skip in this party`), 150); },
  statusNow() {
    const c = this.cur; if (!c || !c.pl) return 'loading';
    const v = c.pl.video;
    const waited = c.wait ? Date.now() - c.wait.since : 0;
    const enough = () => v.readyState >= 4 || Player.ahead() >= 6 || (v.readyState >= 3 && waited > 4000) || (v.readyState >= 2 && waited > 20000);
    if (c.lobby) return v.readyState >= 3 ? 'ready' : 'loading';
    if (Player.cur && Player.cur.pendingSeek != null) return 'buffering';
    if (!v.paused && c.pl.root.classList.contains('buffering')) return 'buffering';   // (a paused video keeps the class)
    // While the party waits, keep saying "loading" until there's a cushion, so it doesn't stall again right away.
    if (v.paused && c.wait && !enough()) return 'buffering';
    return v.paused ? 'paused' : 'playing';
  },
  // If the party keeps waiting on me, suggest a lighter stream (once).
  slowNote() {
    const c = this.cur; if (!c) return;
    const now = Date.now();
    c.myWaits = (c.myWaits || []).filter(t => now - t < 5 * 60e3).concat(now);
    if (c.myWaits.length >= 3 && !c.slowTold) { c.slowTold = true; toast('Your stream is having trouble keeping up. A smaller (1080p or 720p) stream from the Streams list will load faster.'); }
  },
  // Your status (Ready / Watching / Paused / Buffering) goes out as a small party message, not a presence update:
  // the realtime server disconnects anyone who updates presence more than a few times a minute.
  updateStatus(force) {
    const c = this.cur; if (!c) return;
    const s = this.statusNow();
    if (c.me.status === 'buffering' && s === 'playing' && c.jumpedAt && Date.now() - c.jumpedAt < 30000) {
      const took = (Date.now() - c.jumpedAt) / 1000 + 0.4;
      c.loadLead = Math.max(1, Math.min(15, c.loadLead ? c.loadLead * 0.5 + took * 0.5 : took));
      c.jumpedAt = 0;
    }
    if (c.me.status === 'buffering' && s === 'playing' && !this.leader() && c.ch && !c.lobby && !c.holding) {
      c.forceJump = Date.now(); c.ch.send({ type: 'broadcast', event: 'resync', payload: {} });
    }
    if (s !== c.me.status) { c.me.status = s; this.paintMembers(); }
    if (!c.ch || (!force && c.me.status === c.sentStatus)) return;
    const wait = 700 - (Date.now() - (c.sentAt || 0));
    clearTimeout(c.trackT);
    if (wait > 0 && !force) { c.trackT = setTimeout(() => this.updateStatus(), wait); return; }
    c.sentAt = Date.now(); c.sentStatus = c.me.status;
    c.ch.send({ type: 'broadcast', event: 'status', payload: { uid: c.me.uid, status: c.me.status } });
  },

  // ---------- in-player UI ----------
  buildUi() {
    const c = this.cur, root = c.pl.root;
    root.classList.add('party-on');
    // The stage covers the video area (it shrinks when chat docks beside it).
    const ui = c.ui = h(`<div class="party-stage">
      <div class="party-bar"><span class="pb-live"></span><button class="pb-code" title="Copy the party code">${esc(c.code)}</button><span class="pb-avs"></span>
        <i class="pb-sep"></i>
        <button class="pb-btn pb-sync" title="Catch up — jump to where the party is">${PI.sync}</button>
        <button class="pb-btn pb-inv" title="Invite friends">${PI.link}</button>
        <button class="pb-btn pb-chat" title="Chat (C)">${PI.chat}</button>
        <button class="pb-btn pb-leave" title="Leave the party">${PI.leave}</button></div>
      <div class="party-lobby"></div>
      <div class="party-float"></div>
    </div>`);
    root.appendChild(ui);
    const chat = c.chat = h(`<aside class="party-chat">
      <div class="pc-head"><div><b>Party chat</b><span class="pc-n"></span></div>
        <div class="pc-modes"><button class="pc-mode" data-m="side" title="Theater — chat beside the video">${PI.side}</button><button class="pc-mode" data-m="overlay" title="Transparent — chat over the video">${PI.float}</button><button class="pc-mode pc-x" title="Hide chat (C)">${ICON.x}</button></div></div>
      <div class="pc-members"></div>
      <div class="pc-msgs"><div class="pc-empty">Say hi — messages show up for everyone in the party.</div></div>
      <div class="pc-bottom">
        <div class="pc-reacts">${REACTIONS.map(e => `<button data-e="${e}" title="React">${e}</button>`).join('')}</div>
        <form class="pc-form" autocomplete="off"><input placeholder="Message the party…" maxlength="300"><button class="pc-send" type="submit" title="Send">${PI.send}</button></form>
      </div>
    </aside>`);
    root.appendChild(chat);
    $('.pb-code', ui).onclick = () => { navigator.clipboard.writeText(c.code); toast('Party code copied'); };
    $('.pb-inv', ui).onclick = () => { c.showInvite = !c.showInvite; this.paintLobby(); };
    $('.pb-leave', ui).onclick = () => this.confirmLeave();
    $('.pb-sync', ui).onclick = () => this.catchUp();
    $('.pb-chat', ui).onclick = () => this.toggleChat();
    $('.pc-x', chat).onclick = () => this.toggleChat(false);
    $$('.pc-mode[data-m]', chat).forEach(b => (b.onclick = () => this.setChatMode(b.dataset.m)));
    $$('.pc-reacts button', chat).forEach(b => (b.onclick = () => { this.floatReaction(b.dataset.e, c.me.name); c.ch && c.ch.send({ type: 'broadcast', event: 'react', payload: { emoji: b.dataset.e, name: c.me.name } }); }));
    $('.pc-form', chat).onsubmit = (e) => {
      e.preventDefault();
      const inp = $('.pc-form input', chat), text = inp.value.trim(); if (!text) return;
      const msg = { name: c.me.name, avatar: c.me.avatar, uid: c.me.uid, text: text.slice(0, 300), at: Date.now() };
      c.ch && c.ch.send({ type: 'broadcast', event: 'chat', payload: msg });
      this.addMsg(msg); inp.value = '';
    };
    // Typing in chat never triggers player shortcuts; C toggles chat; Esc closes it.
    chat.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); this.toggleChat(false); } });
    c.onKey = (e) => {
      if (Player.cur !== c.pl || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); e.stopPropagation(); this.toggleChat(); }
    };
    document.addEventListener('keydown', c.onKey, true);
    this.setChatMode(c.chatMode, true);
    this.paintMembers();
    this.paintLobby();
  },
  toggleChat(open) {
    const c = this.cur; if (!c) return;
    c.chatOpen = open == null ? !c.chatOpen : !!open;
    if (!c.pl) return;
    c.pl.root.classList.toggle('party-chat-open', c.chatOpen);
    $('.pb-chat', c.ui).classList.toggle('on', c.chatOpen);
    if (c.chatOpen) { $('.pb-chat', c.ui).classList.remove('dot'); const box = $('.pc-msgs', c.chat); box.scrollTop = box.scrollHeight; setTimeout(() => $('.pc-form input', c.chat).focus(), 60); }
    else if (document.activeElement && c.chat.contains(document.activeElement)) document.activeElement.blur();
  },
  setChatMode(m, quiet) {
    const c = this.cur; if (!c) return;
    c.chatMode = m === 'overlay' ? 'overlay' : 'side';
    if (!c.pl) return;
    c.pl.root.classList.toggle('party-side', c.chatMode === 'side');
    c.pl.root.classList.toggle('party-overlay', c.chatMode === 'overlay');
    $$('.pc-mode[data-m]', c.chat).forEach(b => b.classList.toggle('on', b.dataset.m === c.chatMode));
    if (!quiet) { Store.settings.partyChat = c.chatMode; Store.save(); }
  },
  async confirmLeave() {
    const c = this.cur; if (!c) return;
    if (!(await confirmSheet('Leave the watch party?', c.isHost ? (c.members.filter(m => m.uid !== c.me.uid).length ? `${c.members.filter(m => m.uid !== c.me.uid)[0].name} becomes the host and the party keeps going for everyone else.` : 'The party ends and you go back Home.') : 'You’ll go back Home. The party keeps going for everyone else.', 'Leave'))) return;
    this.leave();
    if (Player.cur) Player.close(true);
    go('home', {}, true);
    window.reel.discord(null); Social.setPlaying(null).catch(() => {});
  },
  paintMembers() {
    const c = this.cur; if (!c || !c.ui) return;
    const ms = (c.members.length ? c.members : [c.me]).map(m => (m.uid === c.me.uid ? c.me : { ...m, status: c.statuses[m.uid] || 'loading' }));
    const av = (m, s) => Cloud.avatar({ avatar_url: m.avatar, display_name: m.name }, s);
    $('.pb-avs', c.ui).innerHTML = ms.slice(0, 4).map(m => av(m, 24)).join('') + (ms.length > 4 ? `<em>+${ms.length - 4}</em>` : '');
    $('.pb-live', c.ui).textContent = c.lobby ? 'Lobby' : `${ms.length} watching`;
    $('.pb-live', c.ui).classList.toggle('lobby', !!c.lobby);
    $('.pc-n', c.chat).textContent = `${ms.length} here · ${c.code}`;
    const row = (m) => `<div class="pm">${av(m, 28)}<b>${esc(m.name)}${m.uid === c.row.host ? '<em>Host</em>' : ''}${m.uid === c.me.uid ? '<span class="you">you</span>' : ''}</b>${c.isHost && m.uid !== c.me.uid ? `<button class="pm-host" data-uid="${esc(m.uid)}" title="Make ${esc(m.name)} the host">Make host</button>` : ''}<span class="st ${m.status}">${statusText(m.status)}</span></div>`;
    $('.pc-members', c.chat).innerHTML = ms.map(row).join('');
    const lm = $('.pl-members', c.ui); if (lm) lm.innerHTML = ms.map(row).join('');
    $$('.pm-host', c.ui).concat($$('.pm-host', c.chat)).forEach(b => (b.onclick = (e) => { e.stopPropagation(); const m = ms.find(x => x.uid === b.dataset.uid); if (m) this.makeHost(m); }));
    const sb = $('.pl-start', c.ui);
    if (sb) { const ready = ms.filter(m => m.status === 'ready').length; sb.innerHTML = `${ICON.play} Start for everyone${ms.length > 1 ? ` <span>${ready}/${ms.length} ready</span>` : ''}`; }
  },
  // The lobby card (host: invite + Start; guests: waiting). After the start it reappears only as an invite card.
  paintLobby() {
    const c = this.cur; if (!c || !c.ui) return;
    const box = $('.party-lobby', c.ui);
    const show = c.lobby || c.showInvite;
    if (c.pl) c.pl.root.classList.toggle('party-lobby-on', !!show);
    if (!show) { box.innerHTML = ''; this.paintMembers(); return; }
    if (!c.pl) return;
    const m = c.pl.meta, ep = c.pl.ep;
    const link = `${Cloud.cfg.site}/join.html?c=${c.code}`;
    const guestWait = c.lobby && !c.isHost;
    box.innerHTML = `<div class="pl-card">
      <div class="pl-poster" style="background-image:url('${m.poster ? TMDB.img(m.poster, 'w342') : ''}')"></div>
      <div class="pl-main">
        <div class="pl-eyebrow">${PARTY_SVG}<span>Watch party</span></div>
        <h2>${esc(m.title)}</h2>
        <div class="pl-sub">${ep ? `S${ep.season} · E${ep.episode}${ep.name ? ' — ' + esc(ep.name) : ''}` : esc(String(m.year || ''))}</div>
        ${guestWait ? `<div class="pl-wait"><span class="spinner sm"></span>Waiting for ${esc(this.hostName())} to start</div>`
          : `<div class="pl-codewrap"><div class="pl-codelbl">Party code</div><button class="pl-code" title="Copy">${esc(c.code)}</button></div>
             <div class="pl-share"><button class="btn small primary cl">${PI.link} Copy invite link</button><button class="btn small cc">Copy code</button></div>`}
        ${c.isHost ? `<label class="pl-opt"><input type="checkbox" class="tw-sw pl-lock" ${c.hostOnly ? 'checked' : ''}><span><b>Only I can pause and skip</b><em>Others can still chat and react</em></span></label>` : c.hostOnly ? '<div class="pl-note">Only the host can pause and skip in this party.</div>' : ''}
        <div class="pl-h">In the party</div>
        <div class="pl-members"></div>
        <div class="pl-actions">${c.lobby && c.isHost ? '<button class="btn primary pl-start"></button>' : ''}${!c.lobby ? '<button class="btn small ghost pl-close">Close</button>' : ''}<button class="btn small ghost pl-leave">${PI.leave} Leave</button></div>
      </div></div>`;
    const cl = $('.cl', box); if (cl) cl.onclick = () => { navigator.clipboard.writeText(`Join my Reel watch party for ${m.title}: ${link}  (code ${c.code})`); toast('Invite copied — paste it in Discord'); };
    const cc = $('.cc', box); if (cc) cc.onclick = () => { navigator.clipboard.writeText(c.code); toast('Code copied'); };
    const pc = $('.pl-code', box); if (pc) pc.onclick = () => { navigator.clipboard.writeText(c.code); toast('Code copied'); };
    const st = $('.pl-start', box); if (st) st.onclick = () => this.start();
    const lk = $('.pl-lock', box); if (lk) lk.onchange = () => this.setHostOnly(lk.checked);
    const cls = $('.pl-close', box); if (cls) cls.onclick = () => { c.showInvite = false; this.paintLobby(); };
    $('.pl-leave', box).onclick = () => this.confirmLeave();
    this.paintMembers();
  },
  addMsg(m) {
    const c = this.cur; if (!c || !c.chat) return;
    const box = $('.pc-msgs', c.chat);
    const empty = $('.pc-empty', box); if (empty) empty.remove();
    const mine = m.uid === c.me.uid;
    box.appendChild(h(`<div class="pc-msg ${mine ? 'mine' : ''}">${Cloud.avatar({ avatar_url: m.avatar, display_name: m.name }, 26)}<div class="pc-bub"><b>${esc(mine ? 'You' : m.name)}</b><p>${esc(m.text)}</p></div></div>`));
    while (box.children.length > 200) box.firstChild.remove();
    box.scrollTop = box.scrollHeight;
    if (!c.chatOpen && !mine) {
      $('.pb-chat', c.ui).classList.add('dot');
      const t = h(`<div class="party-toast">${Cloud.avatar({ avatar_url: m.avatar, display_name: m.name }, 22)}<b>${esc(m.name)}</b><span>${esc(m.text.slice(0, 120))}</span></div>`);
      $('.party-float', c.ui).appendChild(t); setTimeout(() => t.remove(), 6000);
    }
  },
  sys(text) {
    const c = this.cur; if (!c || !c.chat || !text) return;
    const box = $('.pc-msgs', c.chat);
    box.appendChild(h(`<div class="pc-sys">${esc(text)}</div>`));
    box.scrollTop = box.scrollHeight;
    if (!c.chatOpen && c.pl) {
      let bar = $('.party-banners', c.pl.root);
      if (!bar) { bar = h('<div class="party-banners"></div>'); c.pl.root.appendChild(bar); }
      const t = h(`<div class="party-banner">${esc(text)}</div>`);
      bar.appendChild(t); while (bar.children.length > 3) bar.firstElementChild.remove();
      setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
    }
  },
  floatReaction(emoji, name) {
    const c = this.cur; if (!c || !c.ui) return;
    const e = h(`<div class="party-react" style="left:${6 + Math.random() * 16}%">${esc(emoji)}<span>${esc(name || '')}</span></div>`);
    c.ui.appendChild(e); setTimeout(() => e.remove(), 3200);
  },

  // ---------- Home: "your party is still going" ----------
  async rejoinBanner(container) {
    if (!Cloud.on || this.cur) return;
    let saved; try { saved = JSON.parse(localStorage.getItem('reel:party') || 'null'); } catch {}
    if (!saved || Date.now() - saved.at > 6 * 3600e3) return;
    let data = null;
    try { ({ data } = await Cloud.sb.rpc('get_party', { p_code: saved.code })); } catch {}
    if (!data || !data.length) { try { localStorage.removeItem('reel:party'); } catch {} return; }
    const el = h(`<div class="rejoin">
      <div class="rj-p" style="background-image:url('${saved.poster ? TMDB.img(saved.poster, 'w154') : ''}')"></div>
      <div class="rj-t"><div class="pl-eyebrow">${PARTY_SVG}<span>Watch party still going</span></div><b>${esc(saved.title || '')}</b><span>Code ${esc(saved.code)} · jump back in where everyone is</span></div>
      <button class="btn primary rj-go">Rejoin</button><button class="btn small ghost round rj-x" title="Dismiss">${ICON.x}</button></div>`);
    $('.rj-go', el).onclick = () => { el.remove(); this.join(saved.code); };
    $('.rj-x', el).onclick = () => { el.remove(); try { localStorage.removeItem('reel:party'); } catch {} };
    container.prepend(el);
  },

  // ---------- Discord status + "now watching" for friends ----------
  discordSoon() { clearTimeout(this._dT); this._dT = setTimeout(() => this.discord(), 500); },
  discord() {
    if (!Store.settings.discordStatus) { window.reel.discord(null); return; }
    const pl = Player.cur;
    if (!pl || pl.closed) { window.reel.discord(null); return; }
    const m = pl.meta, v = pl.video, t = Player.time(), dur = Player.duration();
    const c = this.cur && this.cur.pl === pl ? this.cur : null;
    const img = (p, s) => { const u = p ? TMDB.img(p, s) : ''; return /^https:/.test(u) ? u : null; };
    const it = Store.item(`${m.type}:${m.id}`) || {};
    const others = c ? c.members.filter(x => x.uid !== c.me.uid).map(x => x.name.split(' ')[0]) : [];
    const with_ = others.length ? `with ${others.length > 2 ? `${others.slice(0, 2).join(', ')} +${others.length - 2}` : others.join(' & ')}` : '';
    const genre = (m.genres || []).slice(0, 2).join(' · ');
    let state;
    if (c && c.lobby) state = `🍿 Watch party lobby${with_ ? ' ' + with_ : ''}`;
    else if (c) state = `🍿 Watch party${with_ ? ' ' + with_ : ''}`;
    else if (pl.ep) state = `S${pl.ep.season} · E${pl.ep.episode}${pl.ep.name ? ' — ' + pl.ep.name : ''}`;
    else state = [it.watched ? 'Rewatching' : '', genre, m.runtime ? fmtRuntime(m.runtime) : ''].filter(Boolean).join(' · ') || 'Watching';
    if (v.paused && !(c && c.lobby)) state = `⏸ Paused · ${state}`;
    window.reel.discord({
      title: m.title + (m.year && m.type === 'movie' ? ` (${m.year})` : ''),
      subtitle: state,
      poster: img(m.poster, 'w500'),
      posterText: pl.ep ? `${m.title} — Season ${pl.ep.season}` : it.rating ? `${m.title} · I gave it ${'★'.repeat(Math.floor(it.rating))}${it.rating % 1 ? '½' : ''}` : m.title,
      icon: Cloud.cfg ? `${Cloud.cfg.site}/icon.png` : null,
      iconText: c ? `Reel watch party · ${c.code}` : 'Reel',
      start: v.paused || (c && c.lobby) ? null : Date.now() - t * 1000,
      end: v.paused || (c && c.lobby) || !dur ? null : Date.now() + (dur - t) * 1000,
      party: c ? { id: c.code, size: [Math.max(1, c.members.length), 10] } : null,
      partyUrl: c ? `${Cloud.cfg.site}/join.html?c=${c.code}` : null,
      siteUrl: Cloud.cfg ? Cloud.cfg.site : null,
    });
  },
};

// Player lifecycle → party, Discord status, friends' "now watching".
document.addEventListener('reel:play', (e) => {
  const pl = e.detail;
  Party.onPlay(pl);
  Party.discord();
  if (Cloud.on) Social.setPlaying(Party.playingInfo()).catch(() => {});
  const v = pl.video;
  let t;
  const upd = () => { clearTimeout(t); t = setTimeout(() => { if (Player.cur === pl) Party.discord(); }, 600); };
  ['play', 'pause', 'seeked', 'playing'].forEach(ev => v.addEventListener(ev, upd));
});
document.addEventListener('reel:stop', (e) => {
  Party.onStop(e.detail);
  setTimeout(() => { if (!Player.cur) { window.reel.discord(null); if (Cloud.on) Social.setPlaying(null).catch(() => {}); } }, 300);
});
