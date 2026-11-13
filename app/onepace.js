// One Pace (onepace.net): a fan edit of One Piece that cuts the filler and padding — same story, tighter pacing.
// On One Piece's page, "One Pace version" opens every arc and episode. One Pace publishes each episode as a torrent;
// Reel plays it through your own debrid service (Real-Debrid or TorBox), just like everything else. The arc list
// comes from One Pace's own site through Reel's small "onepace" server function (browsers can't read their site).
// One Pace progress (where you are, what you've seen, Japanese or English audio) is kept apart from your library.
const OnePace = {
  ONE_PIECE: 37854,                       // TMDB id of One Piece (the anime)
  data: null, at: 0,
  art: { backdrop: null, poster: null },   // One Piece's artwork from its page

  fnUrl() {
    const base = (typeof Cloud !== 'undefined' && Cloud.cfg && Cloud.cfg.url) || 'https://tsuyeypohzfcjikuuknh.supabase.co';
    return `${base}/functions/v1/onepace`;
  },
  state() {
    const d = Store.data.onepace = Store.data.onepace || {};
    d.seen = d.seen || {}; d.pos = d.pos || {};
    if (d.dub == null) d.dub = false;   // subbed unless you pick dubbed
    return d;
  },
  key: (slug, part) => `${slug}:${part}`,

  async arcs() {
    if (this.data && Date.now() - this.at < 30 * 60e3) return this.data;
    const key = (typeof Cloud !== 'undefined' && Cloud.cfg && Cloud.cfg.key) || '';
    const r = await fetch(this.fnUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { apikey: key, Authorization: `Bearer ${key}` } : {}) }, body: '{}' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.arcs) throw new Error(j.error || 'One Pace isn’t answering right now. Try again in a minute.');
    this.data = j.arcs.filter((a) => a.parts && a.parts.some((p) => p.torrent));
    this.at = Date.now();
    return this.data;
  },
  label(arc, part) { return `${arc.title}${arc.parts.length > 1 ? ' ' + String(part.part).padStart(2, '0') : ''}`; },
  epFor(arc, part) {
    const idx = this.data ? this.data.indexOf(arc) : 0;
    const name = part.title && part.title !== arc.title ? part.title : '';
    return { season: idx + 1, episode: part.part, name, still: null, label: this.label(arc, part), onepace: { slug: arc.slug, part: part.part } };
  },
  find(slug, n) {
    const arc = (this.data || []).find((a) => a.slug === slug);
    return { arc, part: arc && arc.parts.find((p) => p.part === n) };
  },
  mins: (d) => { const h = /(\d+)\s*hr/.exec(d || ''), m = /(\d+)\s*min/.exec(d || ''); return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0) || 25; },

  async play(arc, part, { fromStart } = {}) {
    const st = this.state();
    const t = part.torrent;
    if (!t) throw new Error('That episode isn’t out yet.');
    const k = this.key(arc.slug, part.part), saved = st.pos[k];
    const meta = { type: 'onepace', id: 'onepace', onepace: true, title: 'One Pace', year: '', backdrop: this.art.backdrop, poster: this.art.poster,
      overview: part.description || arc.description, runtime: this.mins(part.duration) };
    const ep = this.epFor(arc, part);
    const stream = { url: `onepace:${t.hash}:${t.part || 0}:${encodeURIComponent(t.name || '')}`, filename: t.name || this.label(arc, part), release: t.name || '', flags: [], cached: true,
      quality: t.resolution || 1080, seeders: 0, source: 'One Pace', sizeGB: 0, langs: '' };
    // Japanese audio with English subtitles, or the English dub (when the file has one).
    Store.data.trackPrefs = Store.data.trackPrefs || {};
    Store.data.trackPrefs['onepace:onepace'] = st.dub ? { audioLang: 'eng', sub: 'off' } : { audioLang: 'jpn', sub: 'emb:eng' };
    st.last = { slug: arc.slug, part: part.part, at: Date.now() };
    Store.save();
    const resumeAt = !fromStart && saved && saved.pos > 30 && (!saved.dur || saved.pos < saved.dur - 60) ? saved.pos : 0;
    return Player.open(meta, ep, stream, [stream], { stype: 'onepace', sid: '' }, { resumeAt });
  },
  async playEp(ep) {
    await this.arcs();
    const { arc, part } = this.find(ep.onepace.slug, ep.onepace.part);
    if (arc && part) return this.play(arc, part);
  },
  next(ep) {
    const list = this.data || [];
    const ai = list.findIndex((a) => a.slug === ep.onepace.slug);
    if (ai < 0) return null;
    const arc = list[ai], pi = arc.parts.findIndex((p) => p.part === ep.onepace.part);
    if (arc.parts[pi + 1]) return this.epFor(arc, arc.parts[pi + 1]);
    const nextArc = list.slice(ai + 1).find((a) => !a.special && a.parts.length);
    return nextArc ? this.epFor(nextArc, nextArc.parts[0]) : null;
  },
  savePos(ep, pos, dur) {
    if (!ep || !ep.onepace) return;
    const st = this.state();
    st.pos[this.key(ep.onepace.slug, ep.onepace.part)] = { pos, dur, at: Date.now() };
    st.last = { slug: ep.onepace.slug, part: ep.onepace.part, at: Date.now() };
    Store.save();
  },
  markSeen(ep) {
    if (!ep || !ep.onepace) return;
    const st = this.state(), k = this.key(ep.onepace.slug, ep.onepace.part);
    st.seen[k] = today(); delete st.pos[k];
    Store.save();
  },

  // ---------- the sheet ----------
  async open() {
    const st = this.state();
    const sheet = h(`<div class="op-sheet"><div class="sheet-head"><div><div class="eyebrow">Fan edit · onepace.net</div><h3>One Pace</h3>
        <div class="muted">One Piece without the filler: the same story at a tighter pace.</div></div><button class="btn small round close">${ICON.x}</button></div>
      <div class="op-bar"><div class="seg op-ver"><button data-dub="0">Japanese · English subs</button><button data-dub="1">English dub</button></div><span class="op-note dim">Plays through your debrid service</span></div>
      <div class="op-body"><div style="display:flex;align-items:center;gap:14px;padding:20px 0"><div class="spinner"></div><div class="muted">Loading One Pace…</div></div></div></div>`);
    const m = openModal(sheet, { wide: true });
    $('.close', sheet).onclick = m.close;
    const paintVer = () => $$('.op-ver button', sheet).forEach((b) => b.classList.toggle('on', (b.dataset.dub === '1') === !!st.dub));
    $$('.op-ver button', sheet).forEach((b) => (b.onclick = () => { st.dub = b.dataset.dub === '1'; Store.save(); paintVer(); render(); }));
    paintVer();
    let arcs;
    try { arcs = await this.arcs(); }
    catch (e) { $('.op-body', sheet).innerHTML = `<div style="padding:10px 0"><div style="font-weight:600;margin-bottom:6px">Couldn’t load One Pace</div><div class="muted">${esc(cleanErr(e))}</div></div>`; return; }
    let openSlug = (st.last && st.last.slug) || arcs[0].slug;
    const body = $('.op-body', sheet);
    const go = async (arc, part, opts) => {
      try { m.close(); await this.play(arc, part, opts); } catch (e) { toast(cleanErr(e), true); }
    };
    const render = () => {
      body.innerHTML = '';
      // Continue where you left off
      const last = st.last && this.find(st.last.slug, st.last.part);
      if (last && last.arc && last.part) {
        const k = this.key(last.arc.slug, last.part.part), p = st.pos[k];
        let arc = last.arc, part = last.part, sub = p && p.dur ? `${fmtTime(Math.max(0, p.dur - p.pos))} left` : '';
        if (st.seen[k] && !p) { const nx = this.next(this.epFor(arc, part)); if (nx) { ({ arc, part } = this.find(nx.onepace.slug, nx.onepace.part)); sub = 'Next up'; } }
        const c = h(`<button class="op-continue"><span class="op-play">${ICON.playSm}</span><span><b>${p ? 'Continue' : 'Play'} · ${esc(this.label(arc, part))}</b><small>${esc([part.title !== arc.title ? part.title : '', sub].filter(Boolean).join(' · '))}</small></span></button>`);
        c.onclick = () => go(arc, part);
        body.appendChild(c);
      }
      const list = h('<div class="op-arcs"></div>');
      arcs.forEach((arc, i) => {
        const seen = arc.parts.filter((p) => st.seen[this.key(arc.slug, p.part)]).length;
        const noDub = st.dub && !arc.versions.some((v) => v.dub);
        const row = h(`<div class="op-arc ${arc.slug === openSlug ? 'open' : ''}">
          <button class="op-arc-head"><span class="op-n">${arc.special ? '★' : i + 1}</span><span class="op-t"><b>${esc(arc.title)}</b>
            <small>${arc.parts.length} episode${arc.parts.length > 1 ? 's' : ''}${arc.duration ? ' · ' + esc(arc.duration) : ''}${noDub ? ' · no dub yet' : ''}</small></span>
            ${seen ? `<span class="op-seen ${seen === arc.parts.length ? 'all' : ''}">${seen === arc.parts.length ? ICON.check : `${seen}/${arc.parts.length}`}</span>` : ''}
            <span class="op-chev">${ICON.chevDown}</span></button>
          <div class="op-eps"></div></div>`);
        $('.op-arc-head', row).onclick = () => { openSlug = openSlug === arc.slug ? '' : arc.slug; render(); };
        if (arc.slug === openSlug) {
          if (arc.description) $('.op-eps', row).appendChild(h(`<p class="op-desc">${esc(arc.description)}</p>`));
          arc.parts.forEach((part) => {
            const k = this.key(arc.slug, part.part), p = st.pos[k], done = !!st.seen[k];
            const e = h(`<button class="op-ep ${done ? 'done' : ''}">
              <span class="op-num">${String(part.part).padStart(2, '0')}${p && p.dur ? `<i style="width:${Math.min(100, (p.pos / p.dur) * 100)}%"></i>` : ''}</span>
              <span class="op-et"><b>${esc(part.title || arc.title)}</b>
                <small>${esc([part.duration, part.episodes ? 'Anime ' + part.episodes : ''].filter(Boolean).join(' · '))}</small>
                ${part.description ? `<em>${esc(part.description)}</em>` : ''}</span>
              ${done ? `<span class="op-tick">${ICON.checkCircleFill}</span>` : ''}</button>`);
            e.onclick = () => go(arc, part);
            $('.op-eps', row).appendChild(e);
          });
        }
        list.appendChild(row);
      });
      body.appendChild(list);
      const open = $('.op-arc.open', body);
      // Only scroll when the open arc is further down the list (keeps Continue in view otherwise).
      if (open) requestAnimationFrame(() => { const y = open.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop; if (y > body.clientHeight * 0.6) body.scrollTop = y - 8; });
      if (window.tvFocus && open) { const b = $('.op-ep, .op-arc-head', open); if (b) window.tvFocus.focus(b); }
    };
    render();
  },
  button(meta) {
    if (meta) this.art = { backdrop: meta.backdrop || null, poster: meta.poster || null };
    const b = h(`<button class="btn op-btn" title="Watch One Pace, the fan edit of One Piece without the filler">${ICON.sparkle} One Pace version</button>`);
    b.onclick = () => this.open();
    return b;
  },
};

// ---- the player knows about One Pace episodes: own progress, own "next", no TMDB lookups or subtitle search ----
(() => {
  if (typeof Player === 'undefined') return;
  const isOP = (s) => !!(s && s.meta && s.meta.onepace);
  const save0 = Player.saveProgress.bind(Player);
  Player.saveProgress = function () {
    const s = this.cur;
    if (!isOP(s)) return save0();
    if (!s.info || s.finished) return;
    const t = this.time(); if (t >= 30) OnePace.savePos(s.ep, t, this.duration());
  };
  const fin0 = Player.markFinished.bind(Player);
  Player.markFinished = function () {
    const s = this.cur;
    if (!isOP(s)) return fin0();
    s.finished = true; OnePace.markSeen(s.ep);
  };
  const next0 = Player.nextEpisode.bind(Player);
  Player.nextEpisode = async function () {
    const s = this.cur;
    if (!isOP(s)) return next0();
    await OnePace.arcs().catch(() => null);
    return OnePace.next(s.ep);
  };
  if (Player.loadSubs) {
    const subs0 = Player.loadSubs.bind(Player);
    // One Pace's subtitles are inside the file: use those, and skip the online subtitle search.
    Player.loadSubs = async function () {
      const s = this.cur; if (!isOP(s)) return subs0();
      return subs0();   // the online search finds nothing for One Pace, so only the file's own subtitles are used
    };
  }
  const start0 = Playback.start.bind(Playback);
  Playback.start = function (meta, ep, opts) {
    if (meta && meta.onepace && ep && ep.onepace) return OnePace.playEp(ep).catch((e) => toast(cleanErr(e), true));
    return start0(meta, ep, opts);
  };
  // Friends see "One Pace" (and land on One Piece's page), not a made-up title.
  if (typeof Party !== 'undefined' && Party.playingInfo) {
    const info0 = Party.playingInfo.bind(Party);
    Party.playingInfo = function () {
      const r = info0(), pl = Player.cur;
      if (r && pl && pl.meta && pl.meta.onepace) return { ...r, key: `tv:${OnePace.ONE_PIECE}`, title: `One Pace · ${pl.ep.label || ''}`.trim(), season: null, episode: null };
      return r;
    };
  }
})();
// Episode labels everywhere: "Arlong Park 03" for One Pace, "S2, E5" for everything else.
function epTag(ep) { return ep ? (ep.label || `S${ep.season}, E${ep.episode}`) : ''; }
