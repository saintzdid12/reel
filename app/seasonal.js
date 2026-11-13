// Reel — seasonal picks. Halloween all October (takes over the big banner Oct 25–31);
// Christmas all December (takes over the banner Dec 19–25). Picks come from TMDB's holiday keywords,
// ordered by how well each fits your taste, with the classics you loved mixed back in as rewatches.

const SEASONS = [
  {
    id: 'halloween', theme: 'halloween', icon: 'pumpkin', keywords: ['halloween'],
    row: [[10, 1], [10, 31]], peak: [[10, 25], [10, 31]],
    title: 'Halloween Picks', sub: 'spooky season', peakTag: 'Halloween week', rowTv: 'Halloween episodes & specials',
  },
  {
    id: 'christmas', theme: 'christmas', icon: 'snow', keywords: ['christmas', 'christmas movie'],
    row: [[12, 1], [12, 31]], peak: [[12, 19], [12, 25]],
    title: 'Christmas Movies', sub: 'for the holidays', peakTag: 'Christmas week', rowTv: 'Holiday specials',
  },
];

const Season = {
  // Tests can pin a date with window.__reelToday = 'YYYY-MM-DD'.
  now() { return window.__reelToday ? new Date(window.__reelToday + 'T12:00') : new Date(); },
  within(range, d = this.now()) {
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    return md >= range[0][0] * 100 + range[0][1] && md <= range[1][0] * 100 + range[1][1];
  },
  active() { return SEASONS.find(s => this.within(s.row)) || null; },
  peak() { const s = this.active(); return s && this.within(s.peak) ? s : null; },

  // TMDB keyword ids, looked up once and remembered.
  async keywordIds(s) {
    const k = `reel:kw:${s.id}`;
    try { const c = JSON.parse(localStorage.getItem(k) || 'null'); if (c && c.length) return c; } catch {}
    const ids = [];
    for (const q of s.keywords) {
      try {
        const r = await TMDB.get('/search/keyword', { query: q });
        const hit = (r.results || []).find(x => x.name.toLowerCase() === q);
        if (hit) ids.push(hit.id);
      } catch {}
    }
    if (ids.length) try { localStorage.setItem(k, JSON.stringify(ids)); } catch {}
    return ids;
  },

  _cache: {},
  // Holiday titles for this season, best first for you. Unseen picks lead; titles you rated 4+ come back as rewatches.
  async picks(s, type = 'movie') {
    const ck = `${s.id}:${type}:${Store.data.rev || 0}`;
    if (this._cache[ck]) return this._cache[ck];
    const p = (async () => {
      const ids = await this.keywordIds(s);
      if (!ids.length) return [];
      const base = { with_keywords: ids.join('|'), sort_by: 'popularity.desc', 'vote_count.gte': type === 'tv' ? 30 : 120 };
      const list = (await pagesOf(`/discover/${type}`, 3, base, type)).filter(m => m.backdrop && m.poster && Recs.mainstream(m));
      const taste = Recs.genreTaste();
      const scored = list.map((m, i) => {
        const it = Store.item(`${m.type}:${m.id}`) || {};
        if (it.notInterested || it.feedback === -1) return null;
        const g = (m.genreIds || []).map(id => TMDB.genreName(m.type, id));
        const fit = g.reduce((a, x) => a + (taste[x] || 0), 0) / Math.max(1, g.length);
        let sc = 1.2 * (1 - i / list.length) + .35 * ((m.vote || 6) - 6.5) + .5 * fit;
        let tag = '';
        if (it.watched) {
          if ((it.rating || 0) >= 4 || it.liked || Store.data.favorites.includes(`${m.type}:${m.id}`)) { sc -= .4; tag = 'A favorite of yours — rewatch'; }
          else sc -= 3;   // seen and not loved: last
        }
        return { ...m, seasonTag: tag, _s: sc };
      }).filter(Boolean).sort((a, b) => b._s - a._s);
      return scored;
    })();
    this._cache[ck] = p;
    p.catch(() => delete this._cache[ck]);
    return p;
  },

  // A themed row ("Christmas Movies", with a snowflake). Excludes anything already on the banner.
  row(container, { type = 'movie', skip = new Set() } = {}) {
    const s = this.active();
    if (!s) return;
    const wrap = h(`<div class="season-row season-${s.theme}"></div>`);
    container.appendChild(wrap);
    const title = type === 'tv' ? s.rowTv : s.title;
    asyncRow(wrap, title, async () => {
      const list = (await this.picks(s, type)).filter(m => !skip.has(`${m.type}:${m.id}`));
      return Recs.vary(list, `season-${s.id}-${type}`, 6).slice(0, 20);
    }, (m) => landCard(m, { sub: m.seasonTag || [m.year, m.vote ? `TMDB ${m.vote.toFixed(1)}` : ''].filter(Boolean).join(' · ') }), this.peak() ? `${s.peakTag} · ${s.sub}` : s.sub);
    const h2 = $('h2', wrap);
    if (h2) h2.insertBefore(h(`<span class="season-ico">${ICON[s.icon]}</span>`), h2.firstChild);
  },

  // During the holiday week the big banner becomes seasonal.
  async heroItems(n = 5) {
    const s = this.peak();
    if (!s) return null;
    const list = await this.picks(s, 'movie').catch(() => []);
    if (list.length < 3) return null;
    return Recs.vary(list, `season-hero-${s.id}`, n).slice(0, n).map(m => ({ ...m, heroTag: m.seasonTag ? `${s.peakTag} · ${m.seasonTag}` : s.peakTag }));
  },
};
