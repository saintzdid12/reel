// Reel — views: home, movies, tv, genre, detail, search, swipe, library, list.

const Views = {};

// ---------- Hero carousel ----------
function heroSkeleton(container) {
  const skel = h('<section class="hero hero-skel"><div class="hs-lines"><i></i><i></i><i></i></div></section>');
  container.appendChild(skel);
  return skel;
}
async function heroCarousel(container, items, { eyebrow, theme } = {}) {
  if (items && items.then) {
    // Show a placeholder banner while the featured titles load.
    const skel = heroSkeleton(container);
    try { items = await items; } finally { skel.remove(); }
  }
  items = items.filter(m => m.backdrop).slice(0, 7);
  if (!items.length) return;
  // Holiday weeks get a themed banner: drifting snow at Christmas, a low ember glow for Halloween.
  const fx = theme === 'christmas' ? '<div class="season-fx snow"><i></i><i></i><i></i></div>' : theme === 'halloween' ? '<div class="season-fx embers"><i></i><i></i></div>' : '';
  const el = h(`<section class="hero ${theme ? `season-hero season-${theme}` : ''}"><div class="hero-bg"></div><div class="hero-bg" style="opacity:0"></div>${fx}<div class="hero-slot"></div><div class="hero-dots">${items.map(() => '<span></span>').join('')}</div></section>`);
  container.appendChild(el);
  const bgs = $$('.hero-bg', el);
  let idx = -1, front = 0, timer;
  const show = async (i) => {
    idx = (i + items.length) % items.length;
    const m = items[idx];
    const back = bgs[1 - front];
    back.style.backgroundImage = `url('${TMDB.img(m.backdrop, 'original')}')`;
    back.style.opacity = 1; bgs[front].style.opacity = 0; front = 1 - front;
    $$('.hero-dots span', el).forEach((d, j) => d.classList.toggle('on', j === idx));
    const it = Store.item(`${m.type}:${m.id}`) || {};
    const slot = $('.hero-slot', el);
    slot.innerHTML = '';
    const tag = m.heroTag || eyebrow;
    const c = h(`<div class="hero-content">
      ${tag ? `<div class="hero-eyebrow">${theme ? `<span class="season-ico">${ICON[theme === 'christmas' ? 'snow' : 'pumpkin']}</span>` : ''}${esc(tag)}</div>` : ''}
      <div class="logo-slot"><h1 class="hero-title">${esc(m.title)}</h1></div>
      <div class="hero-meta">${m.type === 'tv' ? '<span class="badge">TV</span>' : ''}<span>${esc(m.year || '')}</span>${(m.genreIds || []).map(g => TMDB.genreName(m.type, g)).filter(Boolean).slice(0, 2).map(g => `<span>· ${esc(g)}</span>`).join('')}${m.vote ? `<span>· TMDB ${m.vote.toFixed(1)}</span>` : ''}</div>
      <p class="hero-overview">${esc(m.overview)}</p>
      <div class="btns">
        <button class="btn primary play">${ICON.playSm} ${m.type === 'tv' ? 'Watch' : 'Play'}</button>
        <button class="btn more">Details</button>
        <button class="btn round wl" title="Watchlist">${it.watchlist ? ICON.check : ICON.plus}</button>
      </div></div>`);
    slot.appendChild(c);
    $('.play', c).onclick = () => (m.type === 'movie' ? Playback.start(m) : go('detail', { type: m.type, id: m.id }));
    $('.more', c).onclick = () => go('detail', { type: m.type, id: m.id });
    $('.wl', c).onclick = (e) => { const r = Store.toggleWatchlist(m); e.currentTarget.innerHTML = r.watchlist ? ICON.check : ICON.plus; toast(r.watchlist ? 'Added to watchlist' : 'Removed from watchlist'); };
    TMDB.logo(m.type, m.id).then(p => { if (p && idx === items.indexOf(m)) $('.logo-slot', c).innerHTML = `<img class="hero-logo" src="${TMDB.img(p, 'w500')}" alt="${esc(m.title)}">`; });
    clearTimeout(timer);
    // Rotate every 9 s, but never while you're on its buttons (pointer over it, or the keyboard/remote focus inside it).
    const next = () => { if (!el.isConnected) return; if (el.matches(':hover') || el.contains(document.activeElement)) { timer = setTimeout(next, 3000); return; } show(idx + 1); };
    if (Store.settings.heroRotate) timer = setTimeout(next, 9000);
  };
  $$('.hero-dots span', el).forEach((d, j) => (d.onclick = () => show(j)));
  show(0);
}

const rowsBox = () => h('<div class="rows"></div>');

function continueRow(container, filterType) {
  // One card per show or movie: only the most recently watched episode/position.
  const latest = new Map();
  Object.values(Store.data.progress)
    .filter(p => !filterType || p.type === filterType)
    .forEach(p => { const cur = latest.get(p.key); if (!cur || p.updatedAt > cur.updatedAt) latest.set(p.key, p); });
  const items = [...latest.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 15);
  if (!items.length) return;
  const r = row('Continue Watching', items, p => {
    const card = landCard(
      { type: p.type, id: p.id, title: p.title, year: p.year, backdrop: p.type === 'tv' && p.still ? p.still : p.backdrop, poster: p.poster },
      {
        progress: p.dur ? p.pos / p.dur : 0,
        sub: p.type === 'tv' ? `S${p.season}, E${p.episode}${p.epName ? ' · ' + p.epName : ''}` : `${fmtTime(p.dur - p.pos)} left`,
        overlay: p.type === 'tv' ? p.title : '',
        onClick: () => Playback.start({ type: p.type, id: p.id, title: p.title, year: p.year, poster: p.poster, backdrop: p.backdrop, imdb: p.imdb },
          p.type === 'tv' ? { season: p.season, episode: p.episode, name: p.epName, still: p.still } : null),
      });
    const x = h(`<button class="cw-x" title="Remove from Continue Watching">${ICON.x}</button>`);
    x.addEventListener('pointerdown', (e) => e.stopPropagation());   // the shelf's drag-to-scroll would eat the click
    x.onclick = (e) => { e.stopPropagation(); e.preventDefault(); removeFromContinue(p, card, r); };
    card._cw = () => removeFromContinue(p, card, r);
    $('.art', card).appendChild(x);
    return card;
  });
  container.appendChild(r);
}
// Takes a title off Continue Watching only — your watched status, ratings and history stay exactly as they are.
// (Play it again and it comes back.)
function removeFromContinue(p, card, rowEl) {
  if (!card) { const c = [...document.querySelectorAll('.card')].find(x => x._cw && x._meta && `${x._meta.type}:${x._meta.id}` === p.key); if (c) return c._cw(); }
  const saved = Object.entries(Store.data.progress).filter(([, x]) => x.key === p.key);
  saved.forEach(([k]) => delete Store.data.progress[k]);
  const it = Store.item(p.key);
  const hadHide = it && it.cwHiddenAt;
  if (it && p.type === 'tv') it.cwHiddenAt = Date.now();   // keeps the show out of Up Next too
  Store.save();
  if (card) {
    card.classList.add('dismissed');
    setTimeout(() => { card.remove(); if (rowEl && !$('.card', rowEl)) rowEl.remove(); }, 320);
  }
  toast(`Removed ${p.title} from Continue Watching`, false, { label: 'Undo', fn: () => {
    saved.forEach(([k, v]) => (Store.data.progress[k] = v));
    if (it && p.type === 'tv') { if (hadHide) it.cwHiddenAt = hadHide; else delete it.cwHiddenAt; }
    Store.save(); rerender();
  } });
}

// Next unwatched episode of every show you're partway through (and not already in Continue Watching).
function upNextRow(container) {
  const inProgress = new Set(Object.values(Store.data.progress).map(p => p.key));
  const shows = Store.values().filter(i => i.type === 'tv' && i.lastEp && !i.cwHiddenAt && !inProgress.has(`tv:${i.id}`)).slice(0, 12);
  if (!shows.length) return;
  asyncRow(container, 'Up Next', async () => {
    const out = [];
    await Promise.all(shows.map(async s => {
      const [sn, en] = s.lastEp.split(':').map(Number);
      let nx = (await TMDB.season(s.id, sn).catch(() => ({ episodes: [] }))).episodes.find(e => e.episode_number === en + 1);
      if (!nx) nx = ((await TMDB.season(s.id, sn + 1).catch(() => ({ episodes: [] }))).episodes || [])[0];
      if (nx && (!nx.air_date || nx.air_date <= today())) out.push({ s, nx });
    }));
    return out;
  }, ({ s, nx }) => landCard({ type: 'tv', id: s.id, title: s.title, backdrop: nx.still_path || s.backdrop }, {
    overlay: s.title, sub: `S${nx.season_number}, E${nx.episode_number} · ${nx.name}`,
    onClick: () => Playback.start(s, { season: nx.season_number, episode: nx.episode_number, name: nx.name, still: nx.still_path }),
  }));
}

// Numbered Top 10 shelf.
function rankCard(m, i) {
  const el = posterCard(m);
  el.classList.add('ranked');
  el.insertBefore(h(`<div class="rank-num">${i + 1}</div>`), el.firstChild);
  return el;
}
function top10Row(container, title, path, type) {
  asyncRow(container, title, async () => (await TMDB.list(path, {}, type)).filter(m => m.poster).slice(0, 10), (m, i) => rankCard(m, i));
}

// Category tiles with artwork from each genre's most popular title.
const GENRES = {
  movie: [[28, 'Action'], [12, 'Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'], [18, 'Drama'], [14, 'Fantasy'], [27, 'Horror'], [9648, 'Mystery'], [10749, 'Romance'], [878, 'Science Fiction'], [53, 'Thriller'], [10752, 'War'], [37, 'Western']],
  tv: [[10759, 'Action & Adventure'], [16, 'Animation'], [35, 'Comedy'], [80, 'Crime'], [99, 'Documentary'], [18, 'Drama'], [10751, 'Family'], [9648, 'Mystery'], [10764, 'Reality'], [10765, 'Sci-Fi & Fantasy'], [10768, 'War & Politics']],
};
function genreTiles(container, type, title = 'Browse by Category') {
  const el = h(`<section class="row"><h2 class="row-title">${esc(title)}</h2><div class="shelf"></div></section>`);
  container.appendChild(el);
  GENRES[type].forEach(([id, name], i) => {
    const t = h(`<div class="genre-tile" style="animation-delay:${i * 40}ms"><div class="gt-bg"></div><span>${esc(name)}</span></div>`);
    t.onclick = () => go('genre', { type, id, name });
    $('.shelf', el).appendChild(t);
    TMDB.list(`/discover/${type}`, { with_genres: id, sort_by: 'popularity.desc', 'vote_count.gte': 300 }, type)
      .then(list => { const m = list.find(x => x.backdrop); if (m) $('.gt-bg', t).style.backgroundImage = `url('${TMDB.img(m.backdrop, 'w780')}')`; }).catch(() => {});
  });
}

function genreChips(container, type) {
  const el = h('<div class="chips genre-chips"></div>');
  GENRES[type].forEach(([id, name]) => { const b = h(`<button>${esc(name)}</button>`); b.onclick = () => go('genre', { type, id, name }); el.appendChild(b); });
  container.appendChild(el);
}

const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

// ---------- Personal rows built from your taste ----------
const notSeenYet = (list) => list.filter(m => m.poster && m.backdrop && !Recs.excluded().has(`${m.type}:${m.id}`) && Recs.mainstream(m));
function topGenres(type = 'movie', n = 3) {
  const taste = Recs.genreTaste();
  const ids = Object.fromEntries(GENRES[type].map(([id, name]) => [name, id]));
  return Object.entries(taste).filter(([g, v]) => ids[g] && v > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([g]) => ({ id: ids[g], name: g }));
}
async function personRow(rows, p, kind) {
  asyncRow(rows, kind === 'dir' ? `More from ${p.name}` : `Starring ${p.name}`, async () => {
    const c = await TMDB.get(`/person/${p.id}/movie_credits`);
    const list = (kind === 'dir' ? (c.crew || []).filter(x => x.job === 'Director') : (c.cast || []))
      .filter(x => (x.vote_count || 0) >= 100).sort((a, b) => b.vote_count - a.vote_count).map(x => TMDB.meta(x, 'movie'));
    const fresh = notSeenYet(list);
    return (fresh.length >= 5 ? fresh : list.filter(m => m.backdrop)).slice(0, 16);
  }, landCard, kind === 'dir' ? 'a director you rate highly' : 'an actor you watch a lot');
}
function becauseRow(rows, b) { if (b && b.items.length) rows.appendChild(row(`Because you loved ${b.seed.title}`, b.items, m => landCard(m, { feedback: true }))); }

// ---------- Home: personal ----------
Views.home = async (root) => {
  const page = h('<div class="page flush"></div>');
  root.appendChild(page);
  const skel = heroSkeleton(page);
  const trending = await TMDB.list('/trending/all/week');
  const personal = Recs.seeds().length > 0;
  let recs = { forYou: [], because: [] };
  if (personal) { try { recs = await Recs.build(); } catch {} }
  // Rotate the lead picks so the banner and For You don't open with the same title every time.
  // The big banner is what's hot right now (trending this week + popular today, films and a few shows), quality
  // checked; your personal picks live in For You just below. Holiday weeks turn the banner seasonal.
  const seasonal = await Season.heroItems(5).catch(() => null);
  const popularNow = await TMDB.list('/movie/popular', {}, 'movie').catch(() => []);
  const hot = Recs.weave(
    [...trending.filter(m => m.type === 'movie'), ...popularNow].filter((m, i, a) => a.findIndex(x => x.id === m.id) === i),
    trending.filter(m => m.type === 'tv'), .25)
    .filter(m => m.backdrop && (m.vote || 0) >= 6.2 && (m.votes || 0) >= 150 && Recs.mainstream(m))
    .map(m => ({ ...m, heroTag: m.type === 'tv' ? 'Trending series' : trending.some(x => x.id === m.id) ? 'Trending this week' : 'Popular right now' }));
  const featured = seasonal ? [...seasonal, ...hot.slice(0, 2)] : Recs.vary(hot, 'hero', 3).slice(0, 7);
  const heroKeys = new Set(featured.map(m => `${m.type}:${m.id}`));
  skel.remove();
  heroCarousel(page, featured, { theme: seasonal && Season.peak().theme });
  const rows = rowsBox();
  page.appendChild(rows);
  continueRow(rows);
  upNextRow(rows);
  if (typeof SocialUI !== 'undefined') SocialUI.homeRow(rows);
  if (typeof Party !== 'undefined') Party.rejoinBanner(rows);
  Season.row(rows, { skip: heroKeys });

  if (personal) {
    rows.appendChild(row('For You', Recs.vary(recs.forYou.filter(m => !heroKeys.has(`${m.type}:${m.id}`)), 'foryou', 6).slice(0, 20), m => landCard(m, { big: true, feedback: true }), 'picked from your ratings, likes and favorites'));
  }
  top10Row(rows, 'Top 10 Today', '/trending/all/day');
  // A different set of "Because you loved" rows each visit.
  const because = Recs.vary(recs.because || [], 'because', 4, b => `${b.seed.type}:${b.seed.id}`);
  becauseRow(rows, because[0]);

  const tg = topGenres('movie', 3), gIds = tg.map(g => g.id).join('|');
  if (personal) {
    const dirSlot = h('<div></div>'); rows.appendChild(dirSlot);
    Recs.people().then(p => { if (p.directors[0]) personRow(dirSlot, p.directors[0], 'dir'); }).catch(() => {});
    asyncRow(rows, 'New releases for you', async () => Recs.fit(notSeenYet(await TMDB.list('/discover/movie', { sort_by: 'popularity.desc', with_genres: gIds, 'primary_release_date.gte': daysAgo(365), 'primary_release_date.lte': today(), 'vote_count.gte': 80 }, 'movie'))));
  } else {
    asyncRow(rows, 'New Releases', () => TMDB.list('/discover/movie', { sort_by: 'popularity.desc', 'primary_release_date.gte': daysAgo(240), 'primary_release_date.lte': daysAgo(30), 'vote_count.gte': 80 }, 'movie'));
  }
  becauseRow(rows, because[1]);
  asyncRow(rows, personal ? 'Hidden gems for you' : 'Hidden Gems', async () => Recs.fit(notSeenYet((await pagesOf('/discover/movie', 2, { sort_by: 'vote_average.desc', with_genres: gIds, 'vote_count.gte': 250, 'vote_count.lte': 2500, 'vote_average.gte': 7.2 }, 'movie')))), posterCard, 'great films fewer people have seen');

  const wl = Store.values().filter(it => it.watchlist && !it.watched).sort((a, b) => (b.watchlistAt || 0) - (a.watchlistAt || 0));
  if (wl.length) {
    const r = row('My Watchlist', wl.slice(0, 20));
    const pick = h(`<button class="btn small ghost" style="margin-left:auto">${ICON.dice} Tonight’s Pick</button>`);
    pick.onclick = async () => { const p = await Recs.tonight(); if (p) go('detail', { type: p.type, id: p.id }); };
    $('h2', r).appendChild(pick);
    rows.appendChild(r);
  }
  const actSlot = h('<div></div>'); rows.appendChild(actSlot);
  if (personal) Recs.people().then(p => { if (p.actors[0]) personRow(actSlot, p.actors[0], 'act'); }).catch(() => {});
  if (tg[0]) asyncRow(rows, `More ${tg[0].name.toLowerCase()} for you`, async () => Recs.fit(notSeenYet(await pagesOf('/discover/movie', 2, { with_genres: tg[0].id, sort_by: 'vote_average.desc', 'vote_count.gte': 800 }, 'movie'))));
  asyncRow(rows, 'Short on time', async () => Recs.fit(notSeenYet(await TMDB.list('/discover/movie', { 'with_runtime.lte': 100, 'with_runtime.gte': 70, with_genres: gIds, sort_by: 'vote_average.desc', 'vote_count.gte': 500 }, 'movie'))), landCard, 'great films under 100 minutes');
  becauseRow(rows, because[2]);
  const old = Store.values().filter(i => i.watched && i.backdrop && (i.rating || 0) >= 4.5 && (!i.watchedAt || i.watchedAt < daysAgo(540)));
  if (old.length >= 4) rows.appendChild(row('Watch again', shuffle(old).slice(0, 16), landCard, 'titles you loved and haven’t seen in a while'));
  genreTiles(rows, 'movie', 'Browse Movies');
  const tvRecs = recs.forYou.filter(m => m.type === 'tv');
  asyncRow(rows, tvRecs.length >= 5 ? 'Shows for you' : 'Popular Shows', async () => (tvRecs.length >= 5 ? tvRecs : TMDB.list('/trending/tv/week', {}, 'tv')));
  becauseRow(rows, because[3]);
  genreTiles(rows, 'tv', 'Browse Shows');
};
const pagesOf = async (path, n, params, type) => (await Promise.all(Array.from({ length: n }, (_, i) => TMDB.list(path, { ...params, page: i + 1 }, type)))).flat().filter((m, i, a) => a.findIndex(x => x.id === m.id) === i);

// ---------- Movies / TV: browsing ----------
const STUDIOS = [[41077, 'A24'], [3, 'Pixar'], [420, 'Marvel Studios'], [10342, 'Studio Ghibli'], [3172, 'Blumhouse'], [1, 'Lucasfilm']];
const NETWORKS = [[49, 'HBO'], [213, 'Netflix'], [2552, 'Apple TV+'], [88, 'FX'], [1024, 'Prime Video'], [174, 'AMC'], [2739, 'Disney+'], [453, 'Hulu']];
Views.movies = async (root) => {
  const page = h('<div class="page flush"></div>');
  root.appendChild(page);
  const seasonal = await Season.heroItems(6).catch(() => null);
  await heroCarousel(page, seasonal || TMDB.list('/movie/popular', {}, 'movie'), seasonal ? { theme: Season.peak().theme } : { eyebrow: 'Popular right now' });
  const rows = rowsBox();
  page.appendChild(rows);
  continueRow(rows, 'movie');
  Season.row(rows, { skip: new Set((seasonal || []).map(m => `${m.type}:${m.id}`)) });
  asyncRow(rows, 'New Releases', () => TMDB.list('/discover/movie', { sort_by: 'popularity.desc', 'primary_release_date.gte': daysAgo(240), 'primary_release_date.lte': daysAgo(20), 'vote_count.gte': 80 }, 'movie'));
  top10Row(rows, 'Top 10 Movies This Week', '/trending/movie/week', 'movie');
  genreTiles(rows, 'movie', 'Categories');
  const forYouMovies = Recs.seeds().length ? Recs.build().then(r => Recs.vary(r.forYou.filter(m => m.type === 'movie'), 'movies-picks', 5)).catch(() => []) : null;
  if (forYouMovies) asyncRow(rows, 'Picked for you', () => forYouMovies, m => landCard(m, { feedback: true }));
  asyncRow(rows, 'Acclaimed', () => TMDB.list('/movie/top_rated', { page: 1 + Math.floor(Math.random() * 3) }, 'movie'), posterCard);
  asyncRow(rows, 'Hidden Gems', () => TMDB.list('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 300, 'vote_count.lte': 2500, 'vote_average.gte': 7.4, page: 1 + Math.floor(Math.random() * 4) }, 'movie'), posterCard, 'great films fewer people have seen');
  asyncRow(rows, 'Crowd Favorites', () => TMDB.list('/discover/movie', { sort_by: 'vote_count.desc', page: 1 + Math.floor(Math.random() * 3) }, 'movie'));
  STUDIOS.slice(0, 3).forEach(([id, name]) => asyncRow(rows, `From ${name}`, () => TMDB.list('/discover/movie', { with_companies: id, sort_by: 'popularity.desc', 'vote_count.gte': 100 }, 'movie')));
  for (const [g, name] of GENRES.movie) {
    asyncRow(rows, name, () => TMDB.list('/discover/movie', { with_genres: g, sort_by: 'popularity.desc', 'vote_count.gte': 200, page: 1 + Math.floor(Math.random() * 2) }, 'movie'));
    if (name === 'Drama') STUDIOS.slice(3).forEach(([id, n]) => asyncRow(rows, `From ${n}`, () => TMDB.list('/discover/movie', { with_companies: id, sort_by: 'popularity.desc', 'vote_count.gte': 100 }, 'movie')));
  }
  [[2010, 'The 2010s'], [2000, 'The 2000s'], [1990, 'The ’90s'], [1980, 'The ’80s'], [1970, 'The ’70s']].forEach(([d, label]) =>
    asyncRow(rows, label, () => TMDB.list('/discover/movie', { sort_by: 'vote_count.desc', 'primary_release_date.gte': `${d}-01-01`, 'primary_release_date.lte': `${d + 9}-12-31`, page: 1 + Math.floor(Math.random() * 2) }, 'movie'), posterCard));
  asyncRow(rows, 'Classics', () => TMDB.list('/discover/movie', { sort_by: 'vote_count.desc', 'primary_release_date.lte': '1969-12-31', page: 1 + Math.floor(Math.random() * 3) }, 'movie'), posterCard);
};

Views.tv = async (root) => {
  const page = h('<div class="page flush"></div>');
  root.appendChild(page);
  await heroCarousel(page, TMDB.list('/trending/tv/day', {}, 'tv'), { eyebrow: 'Trending today' });
  const rows = rowsBox();
  page.appendChild(rows);
  continueRow(rows, 'tv');
  upNextRow(rows);
  asyncRow(rows, 'New Episodes This Week', () => TMDB.list('/tv/on_the_air', {}, 'tv'));
  top10Row(rows, 'Top 10 Shows This Week', '/trending/tv/week', 'tv');
  genreTiles(rows, 'tv', 'Categories');
  asyncRow(rows, 'Most Acclaimed', () => TMDB.list('/tv/top_rated', {}, 'tv'), posterCard);
  NETWORKS.slice(0, 4).forEach(([id, name]) => asyncRow(rows, `On ${name}`, () => TMDB.list('/discover/tv', { with_networks: id, sort_by: 'popularity.desc', 'vote_count.gte': 100 }, 'tv')));
  asyncRow(rows, 'Limited Series', () => TMDB.list('/discover/tv', { with_type: 2, sort_by: 'vote_count.desc', 'vote_count.gte': 150 }, 'tv'), landCard, 'one season, complete stories');
  asyncRow(rows, 'Anime', () => TMDB.list('/discover/tv', { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc', 'vote_count.gte': 100 }, 'tv'));
  asyncRow(rows, 'K-Dramas', () => TMDB.list('/discover/tv', { with_genres: 18, with_origin_country: 'KR', sort_by: 'popularity.desc', 'vote_count.gte': 50 }, 'tv'));
  NETWORKS.slice(4).forEach(([id, name]) => asyncRow(rows, `On ${name}`, () => TMDB.list('/discover/tv', { with_networks: id, sort_by: 'popularity.desc', 'vote_count.gte': 100 }, 'tv')));
  for (const [g, name] of [[80, 'Crime'], [10765, 'Sci-Fi & Fantasy'], [35, 'Comedy'], [18, 'Drama'], [9648, 'Mystery'], [10759, 'Action & Adventure'], [99, 'Docuseries'], [10764, 'Reality']]) {
    asyncRow(rows, name, () => TMDB.list('/discover/tv', { with_genres: g, sort_by: 'popularity.desc', 'vote_count.gte': 120 }, 'tv'));
  }
  asyncRow(rows, 'Timeless Classics', () => TMDB.list('/discover/tv', { sort_by: 'vote_count.desc', 'first_air_date.lte': '2005-12-31' }, 'tv'), posterCard);
};

// ---------- Genre / category browser ----------
Views.genre = async (root, { type, id, name }) => {
  const page = h(`<div class="page"><div class="page-head"><h1 class="page-title">${esc(name)}</h1>
    <div class="seg sort"><button data-s="popularity.desc">Popular</button><button data-s="vote_average.desc">Top Rated</button><button data-s="primary_release_date.desc">Newest</button></div></div>
    <div class="grid"></div><div class="more-sentinel"></div></div>`);
  root.appendChild(page);
  let sort = 'popularity.desc', pageNo = 0, loading = false, hideSeen = false;
  const grid = $('.grid', page);
  const load = async () => {
    if (loading) return; loading = true; pageNo++;
    const params = { with_genres: id, sort_by: type === 'tv' ? sort.replace('primary_release_date', 'first_air_date') : sort, 'vote_count.gte': sort.startsWith('vote') ? 400 : 50, page: pageNo };
    if (sort.startsWith('primary')) params[type === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte'] = today();
    const list = (await TMDB.list(`/discover/${type}`, params, type)).filter(m => m.poster && Recs.mainstream(m));
    list.forEach((m, i) => { const c = posterCard(m); c.style.animationDelay = `${i * 25}ms`; grid.appendChild(c); });
    loading = false;
  };
  const reset = () => { grid.innerHTML = ''; pageNo = 0; load(); };
  $$('.sort button', page).forEach(b => { b.classList.toggle('on', b.dataset.s === sort); b.onclick = () => { sort = b.dataset.s; $$('.sort button', page).forEach(x => x.classList.toggle('on', x === b)); reset(); }; });
  const io = new IntersectionObserver(es => es[0].isIntersecting && pageNo < 25 && load(), { rootMargin: '600px' });
  io.observe($('.more-sentinel', page));
  onLeave(() => io.disconnect());
  await load();
};

// ---------- Detail ----------
Views.detail = async (root, { type, id, season }) => {
  const d = await TMDB.details(type, id);
  const meta = metaFromDetails(type, d);
  const key = `${type}:${id}`;
  const it = () => Store.item(key) || {};
  const logo = ((d.images && d.images.logos) || []).find(l => l.iso_639_1 === 'en') || ((d.images && d.images.logos) || [])[0];
  const cert = type === 'movie'
    ? ((((d.release_dates || {}).results || []).find(r => r.iso_3166_1 === 'US') || {}).release_dates || []).map(x => x.certification).find(Boolean)
    : (((d.content_ratings || {}).results || []).find(r => r.iso_3166_1 === 'US') || {}).rating;
  const trailer = ((d.videos || {}).results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer') || ((d.videos || {}).results || []).find(v => v.site === 'YouTube');
  const director = type === 'movie' ? ((d.credits || {}).crew || []).filter(c => c.job === 'Director').map(c => c.name) : (d.created_by || []).map(c => c.name);
  const writers = ((d.credits || {}).crew || []).filter(c => ['Screenplay', 'Writer'].includes(c.job)).map(c => c.name).slice(0, 3);

  const page = h('<div class="page flush detail-page"></div>');
  root.appendChild(page);
  const hero = h(`<section class="detail-hero ${type}">
    <div class="hero-bg" style="background-image:url('${TMDB.img(d.backdrop_path, 'original')}')"></div><div class="veil"></div>
    <div class="detail-body"><div class="detail-main">
      ${logo ? `<img class="hero-logo" src="${TMDB.img(logo.file_path, 'w500')}" alt="${esc(meta.title)}">` : `<h1 class="hero-title">${esc(meta.title)}</h1>`}
      ${d.tagline ? `<div class="detail-tagline">${esc(d.tagline)}</div>` : ''}
      <div class="hero-meta">
        ${cert ? `<span class="badge">${esc(cert)}</span>` : ''}
        <span>${esc(meta.year)}</span>
        ${type === 'movie' ? `<span>· ${fmtRuntime(d.runtime)}</span>` : `<span>· ${d.number_of_seasons} Season${d.number_of_seasons > 1 ? 's' : ''}</span>`}
        ${(meta.genres || []).length ? `<span>· ${esc(meta.genres.slice(0, 3).join(', '))}</span>` : ''}
        ${d.vote_average ? `<span>· TMDB ${d.vote_average.toFixed(1)}</span>` : ''}
      </div>
      <p class="hero-overview" style="-webkit-line-clamp:4">${esc(d.overview)}</p>
      <div class="action-row"><div class="btns actions"></div><div class="action-cluster"></div></div>
      <div class="your-line"></div>
    </div></div>
    ${type === 'tv' ? `<button class="scroll-hint">${ICON.chevDown} Episodes</button>` : ''}
  </section>`);
  page.appendChild(hero);

  // Quiet summary of your history with this title.
  const paintYours = () => {
    const c = it(), bits = [];
    const logs = Store.data.diary.filter(e => e.key === key).sort((a, b) => b.date.localeCompare(a.date));
    const last = logs[0];
    const when = last ? new Date(last.date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    // Rewatch tracker: how many times you've logged it.
    if (c.watched && type === 'movie') bits.push(`${ICON.check}${logs.length > 1 ? `Seen ${logs.length} times · last ${when}` : `Watched${when ? ' ' + when : ''}`}`);
    if (type === 'tv') {
      const em = Store.data.episodes[key] || {};
      const epsSeen = Object.keys(em).filter(k => !k.startsWith('season:') && em[k].watched).length;
      const sr = Object.keys(em).filter(k => k.startsWith('season:') && em[k].rating).map(k => em[k].rating);
      if (epsSeen) bits.push(`${ICON.check}${epsSeen} episode${epsSeen > 1 ? 's' : ''} watched`);
      if (sr.length) bits.push(`${ICON.layers}Seasons avg ${(sr.reduce((a, b) => a + b, 0) / sr.length).toFixed(1)}`);
    }
    if (c.rating) bits.push(`${ICON.starFill}You rated ${starsText(c.rating).slice(2)}`);
    if (c.liked) bits.push(`${ICON.heartFill}Liked`);
    if (c.watchlist && !c.watched) bits.push(`${ICON.bookmarkFill}On your watchlist`);
    if (Store.data.favorites.includes(key)) bits.push(`${ICON.grid}Favorite`);
    const line = $('.your-line', hero);
    line.innerHTML = bits.map(b => `<span>${b}</span>`).join('');
    // Clickable: your reviews and the lists this title is in.
    const nRev = reviewsFor(key).length;
    if (nRev) { const b = h(`<button class="yl-link">${ICON.pencil}${nRev > 1 ? `${nRev} reviews` : 'Your review'}</button>`); b.onclick = () => openReview(meta); line.appendChild(b); }
    const lists = Store.data.lists.filter(l => l.keys.includes(key));
    if (lists.length) {
      const b = h(`<button class="yl-link">${ICON.list}${lists.length > 1 ? `In ${lists.length} lists` : `In “${esc(lists[0].name)}”`}</button>`);
      b.onclick = (e) => {
        if (lists.length === 1) return go('list', { id: lists[0].id });
        document.querySelectorAll('.ctx-menu').forEach(x => x.remove());
        const menu = h('<div class="ctx-menu"><div class="ctx-title">Your lists with this title</div></div>');
        lists.forEach(l => { const o = h(`<button>${ICON.list}<span>${esc(l.name)}</span></button>`); o.onclick = () => { menu.remove(); go('list', { id: l.id }); }; menu.appendChild(o); });
        document.body.appendChild(menu);
        const r = e.currentTarget.getBoundingClientRect();
        menu.style.left = `${r.left}px`; menu.style.top = `${Math.min(r.bottom + 8, innerHeight - menu.offsetHeight - 12)}px`;
        const away = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', away, true); } };
        setTimeout(() => document.addEventListener('mousedown', away, true));
      };
      line.appendChild(b);
    }
    if (false) {
      const rm = h(`<button class="yl-link yl-rm" title="Clear your rating, like, reviews, diary entries, lists and watch status for this title">${ICON.x}Remove from profile</button>`);
      rm.onclick = () => removeFromProfile(meta);
      line.appendChild(rm);
    }
  };

  // Where to resume / what to play for TV
  const playTarget = async () => {
    if (type === 'movie') {
      const p = Store.data.progress[key];
      return { label: p ? `Resume · ${fmtTime(p.dur - p.pos)} left` : 'Play', ep: null };
    }
    const ps = Object.values(Store.data.progress).filter(p => p.key === key).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (ps) return { label: `Resume S${ps.season}, E${ps.episode}`, ep: { season: ps.season, episode: ps.episode, name: ps.epName, still: ps.still } };
    const last = it().lastEp;
    if (last) {
      const [s, e] = last.split(':').map(Number);
      const sd = await TMDB.season(id, s).catch(() => null);
      let nx = sd && sd.episodes.find(x => x.episode_number === e + 1);
      if (!nx) { const s2 = await TMDB.season(id, s + 1).catch(() => null); nx = s2 && s2.episodes && s2.episodes[0]; }
      if (nx) return { label: `Play S${nx.season_number}, E${nx.episode_number}`, ep: { season: nx.season_number, episode: nx.episode_number, name: nx.name, still: nx.still_path } };
    }
    const firstSeason = (d.seasons || []).find(s => s.season_number > 0) || (d.seasons || [])[0];
    const sd = firstSeason && await TMDB.season(id, firstSeason.season_number).catch(() => null);
    const e1 = sd && sd.episodes[0];
    return { label: 'Play S1, E1', ep: e1 ? { season: e1.season_number, episode: e1.episode_number, name: e1.name, still: e1.still_path } : { season: 1, episode: 1 } };
  };

  let detailRefresh = () => {};
  const paintActions = async () => {
    const box = $('.actions', hero), cl = $('.action-cluster', hero);
    const tgt = await playTarget();
    const cur = it();
    box.innerHTML = ''; cl.innerHTML = '';
    const play = h(`<button class="btn primary">${ICON.playSm} ${esc(tgt.label)}</button>`);
    play.onclick = () => Playback.start(meta, tgt.ep);
    box.appendChild(play);
    const streams = h(`<button class="btn" title="Choose a specific version / quality">${ICON.streams.replace('<svg', '<svg class="ic"')} Versions</button>`);
    streams.onclick = () => Playback.start(meta, tgt.ep, { manual: true });
    box.appendChild(streams);
    if (typeof Party !== 'undefined') box.appendChild(Party.button(meta, tgt.ep));
    if (trailer) { const t = h(`<button class="btn" title="Watch the trailer on YouTube">${ICON.film} Trailer</button>`); t.onclick = () => window.reel.openExternal(`https://www.youtube.com/watch?v=${trailer.key}`); box.appendChild(t); }
    const add = (icon, label, on, fn, extra = '') => { const b = h(`<button class="act ${on ? 'on' : ''} ${extra}" title="${label}">${icon}</button>`); b.onclick = (e) => fn(b, e); cl.appendChild(b); return b; };
    add(cur.watchlist ? ICON.bookmarkFill : ICON.bookmark, cur.watchlist ? 'On your watchlist — click to remove' : 'Add to watchlist', cur.watchlist, () => {
      const r = Store.toggleWatchlist(meta); toast(r.watchlist ? 'Added to watchlist' : 'Removed from watchlist'); paintActions();
    });
    add(cur.watched ? ICON.checkCircleFill : ICON.checkCircle, cur.watched ? 'Watched — click to unmark' : 'Mark as watched', cur.watched, () => {
      const r = Store.toggleWatched(meta); Recs.cache = null; toast(r.watched ? 'Marked as watched' : 'Unmarked'); paintActions();
    });
    const rate = add(cur.rating ? `${ICON.starFill}<span>${starsText(cur.rating).slice(2)}</span>` : ICON.star, cur.rating ? 'Change your rating' : 'Rate', !!cur.rating, (b) => ratePopover(b, it().rating || 0, v => {
      rateWithUndo(meta, v, () => paintActions());
    }), cur.rating ? 'wide' : '');
    add(cur.liked ? ICON.heartFill : ICON.heart, cur.liked ? 'Liked — click to unlike' : 'Like', cur.liked, () => { Store.toggleLike(meta); Recs.cache = null; paintActions(); });
    cl.appendChild(h('<i class="sep"></i>'));
    add(ICON.pencil, 'Log a watch / write a review', false, () => openLog(meta, { onSaved: () => go('detail', { type, id }, true, true) }));
    add(ICON.listPlus, 'Add to a list', false, () => openAddToList(meta));
    cl.appendChild(moreBtn(meta, 'in-cluster'));
    paintYours();
    detailRefresh();
  };
  paintActions();

  // Below the hero: a dark tinted glass sheet that scrolls over the artwork.
  const below = h('<div class="below"></div>');
  page.appendChild(below);
  if (type === 'tv') $('.scroll-hint', hero).onclick = () => below.scrollIntoView({ behavior: 'smooth' });

  if (type === 'tv') {
    const seasons = (d.seasons || []).filter(s => s.season_number > 0 || d.seasons.length === 1);
    const sec = h(`<section class="ep-section">
      <div class="ep-bar"><h2 class="row-title" style="margin:0">Episodes</h2>
        <button class="season-btn"><span></span>${ICON.chevDown}</button>
        <span class="ep-progress dim"></span>
        <button class="season-rate" title="Rate this season"></button>
        <button class="btn small ghost mark-season" style="margin-left:auto"></button>
      </div>
      <div class="shelf ep-shelf"></div></section>`);
    below.appendChild(sec);
    const shelf = $('.ep-shelf', sec);
    let curSeason;
    const showSeason = async (n) => {
      curSeason = n;
      const sMeta = seasons.find(s => s.season_number === n) || { name: `Season ${n}` };
      $('.season-btn span', sec).textContent = sMeta.name;
      shelf.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
      const sd = await TMDB.season(id, n);
      if (curSeason !== n) return;
      shelf.innerHTML = '';
      const watchedMap = Store.data.episodes[key] || {};
      const aired = sd.episodes.filter(e => !e.air_date || e.air_date <= today());
      const seenCount = aired.filter(e => (watchedMap[`${n}:${e.episode_number}`] || {}).watched).length;
      $('.ep-progress', sec).textContent = `${seenCount} of ${aired.length} watched`;
      // Season rating, plus the average of your episode ratings for this season.
      const sKey = `season:${n}`, sr = (watchedMap[sKey] || {}).rating;
      const epR = sd.episodes.map(e => (watchedMap[`${n}:${e.episode_number}`] || {}).rating).filter(Boolean);
      const sb = $('.season-rate', sec);
      sb.innerHTML = `${sr ? ICON.starFill : ICON.star}<span>${sr ? `Season ${starsText(sr).slice(2)}` : 'Rate season'}</span>${epR.length ? `<small>episodes avg ${(epR.reduce((a, b) => a + b, 0) / epR.length).toFixed(1)}</small>` : ''}`;
      sb.classList.toggle('on', !!sr);
      sb.onclick = () => ratePopover(sb, sr || 0, v => {
        Store.data.episodes[key] = Store.data.episodes[key] || {};
        Store.data.episodes[key][sKey] = { rating: v };
        Store.upsert(meta); Store.save(); showSeason(n); paintActions();
      }, `Rate ${(seasons.find(x => x.season_number === n) || {}).name || 'season'}`);
      const allSeen = aired.length && seenCount === aired.length;
      const ms = $('.mark-season', sec);
      ms.innerHTML = `${allSeen ? ICON.checkCircleFill : ICON.checkCircle} ${allSeen ? 'Season watched' : 'Mark season watched'}`;
      ms.onclick = () => {
        Store.data.episodes[key] = Store.data.episodes[key] || {};
        aired.forEach(e => { const k2 = `${n}:${e.episode_number}`; Store.data.episodes[key][k2] = Object.assign(Store.data.episodes[key][k2] || {}, { watched: !allSeen, at: today() }); });
        if (!allSeen) Store.upsert(meta, { lastEp: `${n}:${aired[aired.length - 1].episode_number}`, watched: true, watchedAt: it().watchedAt || today() }); else Store.save();
        showSeason(n); paintActions();
      };
      for (const e of sd.episodes) {
        const ek = `${n}:${e.episode_number}`;
        const w = watchedMap[ek] || {};
        const p = Store.data.progress[`tv:${id}:${n}:${e.episode_number}`];
        const isAired = !e.air_date || e.air_date <= today();
        const el = h(`<div class="ep ${isAired ? '' : 'upcoming'}" style="animation-delay:${Math.min(sd.episodes.indexOf(e), 10) * 35}ms">
          <div class="still ${e.still_path ? '' : 'no-still'}" style="background-image:url('${e.still_path ? TMDB.img(e.still_path, window.REEL_TV ? 'w300' : 'w500') : TMDB.img(d.backdrop_path, window.REEL_TV ? 'w300' : 'w780')}')">
            ${w.watched ? `<div class="seen" title="Watched">${ICON.check}</div>` : ''}
            ${isAired ? `<div class="play-ico"><span>${ICON.playSm}</span></div>` : `<div class="soon">${esc(new Date(e.air_date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' }))}</div>`}
            ${p ? `<div class="progress"><i style="width:${(p.pos / p.dur) * 100}%"></i></div>` : ''}
          </div>
          <div class="ep-num">Episode ${e.episode_number}${e.runtime ? ` · ${e.runtime} min` : ''}${w.rating ? ` · ★ ${w.rating % 1 ? w.rating.toFixed(1) : w.rating}` : ''}</div>
          <h4>${esc(e.name)}</h4>
          <p>${isAired ? esc(e.overview || '') : 'Coming soon'}</p>
          <div class="ep-actions">
            <button class="mini er" title="Rate this episode">${w.rating ? ICON.starFill : ICON.star}</button>
            <button class="mini ${w.watched ? 'on' : ''} tw" title="${w.watched ? 'Watched — click to unmark' : 'Mark as watched'}">${w.watched ? ICON.checkCircleFill : ICON.checkCircle}</button>
          </div>
        </div>`);
        $('.er', el).onclick = (ev) => {
          ev.stopPropagation();
          ratePopover(ev.currentTarget, w.rating || 0, v => {
            Store.data.episodes[key] = Store.data.episodes[key] || {};
            Store.data.episodes[key][ek] = Object.assign(Store.data.episodes[key][ek] || {}, { rating: v, watched: true });
            Store.upsert(meta); Store.save(); showSeason(n);
          }, `Rate episode ${e.episode_number}`);
        };
        $('.still', el).onclick = () => isAired && Playback.start(meta, { season: n, episode: e.episode_number, name: e.name, still: e.still_path });
        $('.tw', el).onclick = (ev) => {
          ev.stopPropagation();
          Store.data.episodes[key] = Store.data.episodes[key] || {};
          const c = Store.data.episodes[key][ek] || {};
          c.watched = !c.watched; c.at = today(); Store.data.episodes[key][ek] = c;
          if (c.watched) Store.upsert(meta, { lastEp: ek, watched: true, watchedAt: it().watchedAt || today() }); else Store.save();
          showSeason(n); paintActions();
        };
        shelf.appendChild(el);
      }
      const firstNew = [...shelf.children].findIndex((c, i) => !(watchedMap[`${n}:${sd.episodes[i] && sd.episodes[i].episode_number}`] || {}).watched);
      if (firstNew > 1) shelf.children[firstNew].scrollIntoView({ inline: 'start', block: 'nearest' });
    };
    // Season picker: a glass menu instead of a wall of buttons.
    $('.season-btn', sec).onclick = (e) => {
      document.querySelectorAll('.ctx-menu').forEach(x => x.remove());
      const menu = h(`<div class="ctx-menu season-menu"></div>`);
      const wm = Store.data.episodes[key] || {};
      seasons.forEach(s => {
        const seen = Object.keys(wm).filter(k => k.startsWith(`${s.season_number}:`) && wm[k].watched).length;
        const b = h(`<button class="${s.season_number === curSeason ? 'on' : ''}"><span>${esc(s.name)}</span><small>${(wm[`season:${s.season_number}`] || {}).rating ? `★ ${wm[`season:${s.season_number}`].rating} · ` : ''}${seen ? `${seen}/` : ''}${s.episode_count || ''} ep</small></button>`);
        b.onclick = () => { menu.remove(); showSeason(s.season_number); };
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
      const r = e.currentTarget.getBoundingClientRect();
      menu.style.left = `${r.left}px`;
      menu.style.top = `${Math.min(r.bottom + 8, innerHeight - menu.offsetHeight - 12)}px`;
      const on = $('.on', menu); if (on) on.scrollIntoView({ block: 'center' });
      const away = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', away, true); } };
      setTimeout(() => document.addEventListener('mousedown', away, true));
    };
    const lastS = it().lastEp ? +it().lastEp.split(':')[0] : null;
    showSeason(season || lastS || (seasons[0] && seasons[0].season_number) || 1);
  }

  // One-click log + how your rating compares (IMDb / TMDB / you / your genre average).
  const panels = h('<div class="detail-panels"></div>');
  below.appendChild(panels);
  const lb = logBar(meta, () => { paintActions(); ratings.refresh(); });
  panels.appendChild(lb);
  const ratings = ratingsCard(meta, d);
  panels.appendChild(ratings);
  // Your latest review, right under the log bar (full text one click away).
  const revSlot = h('<div class="your-review-slot"></div>');
  panels.appendChild(revSlot);
  if (typeof SocialUI !== 'undefined') SocialUI.detailStrip(panels, meta);
  const paintReview = () => {
    const revs = reviewsFor(key);
    revSlot.innerHTML = '';
    if (!revs.length) return;
    const r = revs[0];
    const card = h(`<section class="your-review">
      <div class="yr-head"><span class="eyebrow">${revs.length > 1 ? `Your latest review · ${revs.length} total` : 'Your review'}</span>
        <span class="yr-meta">${r.rating ? `<span class="rating-text">${starsText(r.rating)}</span>` : ''}${r.liked ? ICON.heartFill : ''}${r.date ? `<span class="dim">${esc(new Date(r.date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}</span></div>
      <p class="clamp">${esc(r.text)}</p>
      <button class="btn small ghost">${revs.length > 1 ? `Read all ${revs.length}` : 'Read full review'}</button>
    </section>`);
    card.onclick = () => openReview(meta, r.e && r.e.id);
    revSlot.appendChild(card);
  };
  paintReview();
  detailRefresh = () => { lb.refresh(); ratings.refresh(); paintReview(); };

  // Franchise progress ("You've seen 4 of 6"), then related titles that actually share genres.
  if (type === 'movie') { const slot = h('<div></div>'); below.appendChild(slot); collectionSection(slot, d); }
  const myG = new Set((d.genres || []).map(g => g.id));
  const related = [...((d.recommendations || {}).results || []), ...((d.similar || {}).results || [])]
    .filter((r, i, a) => a.findIndex(x => x.id === r.id) === i && r.backdrop_path && (r.vote_count || 0) >= 80 && (r.genre_ids || []).some(g => myG.has(g)))
    .map(r => TMDB.meta(r, type));
  if (related.length) below.appendChild(row('More Like This', related.slice(0, 20)));

  // Cast & crew: click anyone for their filmography.
  const crewTop = type === 'movie' ? ((d.credits || {}).crew || []).filter(c => c.job === 'Director') : (d.created_by || []);
  const cast = ((d.credits || {}).cast || []).slice(0, 20);
  if (cast.length || crewTop.length) {
    const r = h('<section class="row"><h2 class="row-title">Cast & Crew</h2><div class="shelf"></div></section>');
    const face = (c, role) => h(`<div class="person" data-pid="${c.id}" title="See ${esc(c.name)}’s filmography"><div class="face" style="background-image:url('${TMDB.img(c.profile_path, 'w185')}')"></div><div class="n">${esc(c.name)}</div><div class="r">${esc(role)}</div></div>`);
    crewTop.forEach(c => $('.shelf', r).appendChild(face(c, type === 'movie' ? 'Director' : 'Creator')));
    cast.forEach(c => $('.shelf', r).appendChild(face(c, c.character || '')));
    below.appendChild(r);
  }

  const entries = Store.data.diary.filter(e => e.key === key).sort((a, b) => b.date.localeCompare(a.date));
  if (entries.length || it().review) {
    const sec = h(`<section class="history"><div class="hist-head"><h2 class="row-title" style="margin:0">Your History</h2><div class="hist-acts"><button class="btn small ghost wrong">Wrong movie?</button><button class="btn small ghost rm-all">${ICON.x} Remove from your profile</button></div></div></section>`);
    $('.rm-all', sec).onclick = () => removeFromProfile(meta);
    $('.wrong', sec).onclick = () => fixWrongTitle(meta);
    entries.forEach(e => sec.appendChild(Object.assign(h(`<div class="review-item hist-item" style="grid-template-columns:160px 1fr">
      <div class="dim" style="font-size:14px">${esc(new Date(e.date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}${e.rewatch ? `<div style="margin-top:4px">${ICON.rewatch.replace('class="ic"', 'class="ic" style="width:13px;height:13px;vertical-align:-2px"')} Rewatch</div>` : ''}</div>
      <div><div class="rating-text">${e.rating ? starsText(e.rating) : 'No rating'}${e.liked ? ` <span style="margin-left:8px">${ICON.heartFill}</span>` : ''}</div>${e.review ? `<div class="rv-text">${reviewHtml(e.review)}</div>` : ''}</div></div>`),
      { onclick: () => (e.review ? openReview(meta, e.id) : editEntry(e, it(), () => go('detail', { type, id }, true, true))), title: e.review ? 'Read review' : 'Edit this entry' })));
    if (!entries.length && it().review) sec.appendChild(h(`<div class="review-item" style="grid-template-columns:1fr"><div class="rv-text">${reviewHtml(it().review)}</div></div>`));
    below.appendChild(sec);
  }

  // Details at the very bottom.
  const facts = h('<section class="about"><h2 class="row-title">About</h2><div class="facts"></div></section>');
  const fact = (label, val) => val && $('.facts', facts).appendChild(h(`<div><b>${label}</b>${esc(val)}</div>`));
  fact(type === 'movie' ? 'Director' : 'Created by', director.join(', '));
  fact('Writers', writers.join(', '));
  fact('Starring', ((d.credits || {}).cast || []).slice(0, 4).map(c => c.name).join(', '));
  fact(type === 'movie' ? 'Released' : 'First aired', (d.release_date || d.first_air_date) && new Date((d.release_date || d.first_air_date) + 'T12:00').toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }));
  if (type === 'tv') fact('Status', d.status + (d.networks && d.networks[0] ? ` · ${d.networks[0].name}` : ''));
  if (type === 'movie') fact('Runtime', fmtRuntime(d.runtime));
  if (d.budget) fact('Budget', `$${(d.budget / 1e6).toFixed(0)}M`);
  fact('Original language', d.original_language && langName(d.original_language));
  below.appendChild(facts);
};

// ---------- Ratings comparison: IMDb (via Cinemeta), TMDB, you, and your average for the genre ----------
function ratingsCard(meta, d) {
  const key = `${meta.type}:${meta.id}`;
  const el = h(`<section class="ratings-card">
    <div class="rc-head"><span class="eyebrow">Ratings</span><span class="rc-verdict"></span></div>
    <div class="rc-rows"></div>
  </section>`);
  let imdb = 'loading';
  const imdbId = d.imdb_id || (d.external_ids || {}).imdb_id;
  const tmdb = d.vote_average && d.vote_count >= 5 ? d.vote_average : null;
  // Compare against whichever of this title's genres you've rated the most.
  const gNames = (meta.genres && meta.genres.length ? meta.genres : (d.genres || []).map(g => g.name));
  const rated = Store.values().filter(v => v.rating && `${v.type}:${v.id}` !== key);
  const genre = gNames.map(g => [g, rated.filter(v => (v.genres || []).includes(g)).length]).sort((a, b) => b[1] - a[1]).map(x => x[0])[0];
  let first = true;
  const fmtN = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);

  const paint = () => {
    const mine = (Store.item(key) || {}).rating || 0;
    const gr = genre ? Store.values().filter(v => v.rating && `${v.type}:${v.id}` !== key && (v.genres || []).includes(genre)).map(v => v.rating) : [];
    // Bars grow in once; later updates glide to the new width instead of replaying.
    const prevW = {};
    $$('.rc-row', el).forEach(r => { const i = $('.rc-track i', r); if (i) prevW[r.classList[1]] = i.style.getPropertyValue('--w'); });
    el.classList.toggle('anim', first && !$$('.rc-row:not(.loading)', el).length);
    const gAvg = gr.length >= 3 ? gr.reduce((a, b) => a + b, 0) / gr.length : null;
    const rows = [
      { k: 'imdb', label: 'IMDb', val: imdb === 'loading' ? null : imdb, of10: true, loading: imdb === 'loading' },
      { k: 'tmdb', label: 'TMDB', val: tmdb, of10: true, sub: d.vote_count ? `${fmtN(d.vote_count)} votes` : '' },
      { k: 'you', label: 'You', val: mine ? mine * 2 : null, stars: mine, sub: mine ? '' : 'Not rated yet' },
      gAvg ? { k: 'genre', label: `Your ${genre}`, val: gAvg * 2, stars: gAvg, sub: `avg of ${gr.length}` } : null,
    ].filter(Boolean).filter(r => r.loading || r.val || r.k === 'you');
    $('.rc-rows', el).innerHTML = rows.map(r => `<div class="rc-row ${r.k} ${r.loading ? 'loading' : ''}">
      <span class="rc-label">${esc(r.label)}</span>
      <div class="rc-track"><i data-w="${r.val ? (r.val / 10) * 100 : 0}%" style="--w:${prevW[r.k] != null && !first ? prevW[r.k] : (r.val ? (r.val / 10) * 100 : 0) + '%'}"></i></div>
      <span class="rc-val">${r.loading ? '<span class="sk-line"></span>' : r.val ? (r.stars ? `★ ${(+r.stars).toFixed(r.stars % 1 ? 1 : 0)}` : r.val.toFixed(1)) : '—'}</span>
      <span class="rc-sub">${esc(r.sub || '')}</span>
    </div>`).join('');
    requestAnimationFrame(() => $$('.rc-track i', el).forEach(i => i.style.setProperty('--w', i.dataset.w)));
    first = false;
    // A one-line read on how your take compares to everyone else's.
    const crowd = [imdb !== 'loading' && imdb, tmdb].filter(Boolean);
    const avg = crowd.length ? crowd.reduce((a, b) => a + b, 0) / crowd.length : null;
    let v = '';
    if (mine && avg) {
      const diff = mine * 2 - avg;
      v = Math.abs(diff) < 0.6 ? 'You agree with the crowd' : diff > 0 ? `You liked it more than most (+${(diff / 2).toFixed(1)}★)` : `You liked it less than most (${(diff / 2).toFixed(1)}★)`;
    } else if (avg) v = avg >= 7.8 ? 'Highly rated' : avg >= 6.8 ? 'Well liked' : avg >= 5.8 ? 'Mixed reception' : 'Poorly rated';
    $('.rc-verdict', el).textContent = v;
  };
  el.refresh = paint;
  paint();
  if (imdbId && window.reel.imdbRating) {
    window.reel.imdbRating(meta.type, imdbId).then(r => { imdb = r && r.rating ? r.rating : null; paint(); }).catch(() => { imdb = null; paint(); });
  } else imdb = null, paint();
  return el;
}

// ---------- Search (normal + AI vibe) ----------
const searchState = Fresh.keep('search', { q: '', mode: 'search', vibeResults: null, vibeQuery: '' });
Views.search = async (root) => {
  const page = h(`<div class="page">
    <div class="search-bar">
      <input class="input q" placeholder="${searchState.mode === 'vibe' ? 'Describe a vibe… “cozy rainy-day mystery”, “mind-bending 90s sci-fi”' : 'Movies, shows…'}" value="${esc(searchState.mode === 'vibe' ? searchState.vibeQuery : searchState.q)}">
      <div class="seg"><button data-m="search">Search</button><button data-m="vibe">✨ Vibe</button></div>
    </div>
    <div class="vibe-chips" style="display:none"></div>
    <div class="results"></div>
  </div>`);
  root.appendChild(page);
  const input = $('.q', page), results = $('.results', page), chips = $('.vibe-chips', page);
  $$('.seg button', page).forEach(b => { b.classList.toggle('on', b.dataset.m === searchState.mode); b.onclick = () => { searchState.mode = b.dataset.m; go('search', {}, true); }; });
  setTimeout(() => input.focus(), 50);

  const grid = (items, reasons) => {
    results.innerHTML = '';
    const g = h('<div class="grid"></div>');
    items.forEach((m, i) => g.appendChild(posterCard(m, { reason: reasons && reasons[i], sub: [m.year, m.type === 'tv' ? 'TV' : 'Film'].filter(Boolean).join(' · ') })));
    results.appendChild(g);
  };

  if (searchState.mode === 'search') {
    const f = searchState.f = searchState.f || { type: 'all', genre: '', era: '', rating: '', hideSeen: false };
    Store.data.recentSearches = Store.data.recentSearches || [];
    // Filters
    const bar = h('<div class="search-filters"></div>');
    page.insertBefore(bar, results);
    const allGenres = [...new Map([...GENRES.movie, ...GENRES.tv].map(([id, n]) => [n, id])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
    bar.appendChild(segmented([['all', 'All'], ['movie', 'Movies'], ['tv', 'Shows'], ['person', 'People']], f.type, v => { f.type = v; run(); }));
    bar.appendChild(glassSelect('Genre', [['', 'Any'], ...allGenres.map(([n, id]) => [String(id), n])], f.genre, v => { f.genre = v; run(); }));
    bar.appendChild(glassSelect('Released', [['', 'Any time'], ['2020', '2020s'], ['2010', '2010s'], ['2000', '2000s'], ['1990', '1990s'], ['1980', '1980s'], ['1970', '1970s'], ['old', 'Before 1970']], f.era, v => { f.era = v; run(); }));
    bar.appendChild(glassSelect('Rating', [['', 'Any'], ['6', '6+'], ['7', '7+'], ['8', '8+']], f.rating, v => { f.rating = v; run(); }));
    bar.appendChild(segmented([['0', 'Include seen'], ['1', 'Unseen only']], f.hideSeen ? '1' : '0', v => { f.hideSeen = v === '1'; run(); }));
    const eraRange = () => (f.era === 'old' ? [1900, 1969] : f.era ? [+f.era, +f.era + 9] : null);
    const keep = (m) => {
      if (f.type !== 'all' && m.type !== f.type) return false;
      if (f.genre && !(m.genreIds || []).includes(+f.genre)) return false;
      const r = eraRange(); if (r && (!m.year || m.year < r[0] || m.year > r[1])) return false;
      if (f.rating && (m.vote || 0) < +f.rating) return false;
      if (f.hideSeen && (Store.item(`${m.type}:${m.id}`) || {}).watched) return false;
      return true;
    };
    const remember = (q) => {
      if (!q || q.length < 2) return;
      Store.data.recentSearches = [q, ...Store.data.recentSearches.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 10);
      Store.save();
    };
    results.addEventListener('click', (e) => { if (e.target.closest('.card, .person')) remember(input.value.trim()); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') remember(input.value.trim()); });
    const filtersOn = () => f.genre || f.era || f.rating;
    let t, token = 0;
    async function run() {
      const q = input.value.trim(); searchState.q = q;
      const my = ++token;
      if (f.type === 'person') {
        if (!q) { results.innerHTML = '<div class="center-empty glass-empty"><h3>Search for an actor or director</h3>Type a name above.</div>'; return; }
        const r = await TMDB.get('/search/person', { query: q });
        if (my !== token) return;
        results.innerHTML = '';
        const g = h('<div class="people-grid"></div>');
        r.results.filter(p => p.profile_path).forEach(p => g.appendChild(h(`<div class="person" data-pid="${p.id}"><div class="face" style="background-image:url('${TMDB.img(p.profile_path, 'w185')}')"></div><div class="n">${esc(p.name)}</div><div class="r">${esc(p.known_for_department || '')}</div></div>`)));
        results.appendChild(g.childElementCount ? g : h('<div class="center-empty glass-empty"><h3>No people found</h3></div>'));
        return;
      }
      if (!q && !filtersOn()) {
        results.innerHTML = '';
        if (Store.data.recentSearches.length) {
          const rs = h('<div class="recent"><h2 class="row-title">Recent searches <button class="btn small ghost clr">Clear</button></h2><div class="recent-list"></div></div>');
          Store.data.recentSearches.forEach(s => {
            const b = h(`<span class="recent-chip"><button class="go">${ICON.search}${esc(s)}</button><button class="rm" title="Remove">${ICON.x}</button></span>`);
            $('.go', b).onclick = () => { input.value = s; run(); };
            $('.rm', b).onclick = () => { Store.data.recentSearches = Store.data.recentSearches.filter(x => x !== s); Store.save(); run(); };
            $('.recent-list', rs).appendChild(b);
          });
          $('.clr', rs).onclick = () => { Store.data.recentSearches = []; Store.save(); run(); };
          results.appendChild(rs);
        }
        results.appendChild(h('<h2 class="row-title">Trending searches</h2>'));
        // Enough to browse (3 pages), trimmed to whole rows of 6 so the grid never ends on a half row.
        const seen = new Set();
        const all = (await Promise.all([1, 2, 3].map(page => TMDB.list('/trending/all/day', { page }).catch(() => [])))).flat()
          .filter(m => m.poster && Recs.mainstream(m) && !seen.has(m.type + m.id) && seen.add(m.type + m.id));
        const items = all.slice(0, Math.min(36, all.length - (all.length % 6)));
        if (my !== token) return;
        const g = h('<div class="grid"></div>'); items.forEach(m => g.appendChild(posterCard(m))); results.appendChild(g);
        return;
      }
      results.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';
      let items;
      if (q) {
        items = (await Promise.all([1, 2].map(pg => TMDB.list('/search/multi', { query: q, include_adult: false, page: pg })))).flat();
      } else {
        // No text, just filters: browse with them.
        const types = f.type === 'all' ? ['movie', 'tv'] : [f.type];
        const r = eraRange();
        items = (await Promise.all(types.map(ty => {
          const dk = ty === 'tv' ? 'first_air_date' : 'primary_release_date';
          const p = { sort_by: 'vote_count.desc', with_genres: f.genre, 'vote_average.gte': f.rating };
          if (r) { p[`${dk}.gte`] = `${r[0]}-01-01`; p[`${dk}.lte`] = `${r[1]}-12-31`; }
          return pagesOf(`/discover/${ty}`, 2, p, ty);
        }))).flat().sort((a, b) => (b.votes || 0) - (a.votes || 0));
      }
      if (my !== token) return;
      items = items.filter(m => m.poster && keep(m));
      if (!items.length) results.innerHTML = `<div class="center-empty glass-empty"><h3>No results</h3>Try fewer filters, another spelling, or ✨ Vibe.</div>`;
      else { results.innerHTML = `<div class="count dim">${items.length} results</div>`; const g = h('<div class="grid"></div>'); items.forEach((m, i) => { const c = posterCard(m, { sub: [m.year, m.type === 'tv' ? 'Series' : 'Film'].filter(Boolean).join(' · ') }); c.style.animationDelay = `${Math.min(i, 24) * 15}ms`; g.appendChild(c); }); results.appendChild(g); }
    }
    input.oninput = () => { clearTimeout(t); t = setTimeout(run, 300); };
    run();
  } else {
    chips.style.display = 'flex';
    ['Cozy rainy-day mystery', 'Mind-bending sci-fi like Primer', 'Feel-good 80s adventure', 'Slow-burn thriller set in a city at night', 'Gorgeous, quiet foreign film', 'Something like Fleabag'].forEach(c => {
      const b = h(`<button>${esc(c)}</button>`); b.onclick = () => { input.value = c; run(); }; chips.appendChild(b);
    });
    const run = async () => {
      const q = input.value.trim(); if (!q) return;
      searchState.vibeQuery = q;
      results.innerHTML = '<div style="display:flex;gap:14px;align-items:center"><div class="spinner"></div><div class="muted">Finding the vibe…</div></div>';
      try {
        const taste = Store.values().filter(i => (i.rating || 0) >= 4).sort((a, b) => b.rating - a.rating).slice(0, 15).map(i => `${i.title} (${i.year})`);
        const sugg = await window.reel.vibe(q, taste);
        const found = await Promise.all(sugg.map(async s => {
          try {
            const r = await TMDB.get(`/search/${s.type}`, { query: s.title, [s.type === 'movie' ? 'year' : 'first_air_date_year']: s.year });
            const hit = r.results[0] || (await TMDB.get(`/search/${s.type}`, { query: s.title })).results[0];
            return hit ? { m: TMDB.meta(hit, s.type), reason: s.reason } : null;
          } catch { return null; }
        }));
        const ok = found.filter(Boolean);
        searchState.vibeResults = ok;
        if (!ok.length) results.innerHTML = '<div class="center-empty"><h3>Nothing matched</h3>Try describing it differently.</div>';
        else grid(ok.map(x => x.m), ok.map(x => x.reason));
      } catch (e) {
        results.innerHTML = `<div class="center-empty"><h3>Vibe search unavailable</h3>${esc(cleanErr(e))}${/Settings/.test(cleanErr(e)) ? '<br><br><button class="btn primary" onclick="go(\'settings\')">Open Settings</button>' : ''}</div>`;
      }
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') run(); };
    if (searchState.vibeResults && searchState.vibeQuery) grid(searchState.vibeResults.map(x => x.m), searchState.vibeResults.map(x => x.reason));
    else results.innerHTML = '<div class="center-empty"><h3>Describe what you’re in the mood for</h3>Press Enter to search. Uses your top ratings to tune picks.</div>';
  }
};

// Search sheet that returns one title (used by lists and favorites).
function pickTitle(title, onPick) {
  const wrap = h(`<div><div class="sheet-head"><div><h3>${esc(title)}</h3></div><button class="btn small round close">${ICON.x}</button></div>
    <input class="input q" placeholder="Search movies and shows"><div class="stream-list res" style="margin-top:12px"></div></div>`);
  const m = openModal(wrap);
  $('.close', wrap).onclick = m.close;
  const q = $('.q', wrap), res = $('.res', wrap);
  setTimeout(() => q.focus(), 50);
  let t;
  q.oninput = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const s = q.value.trim(); if (!s) { res.innerHTML = ''; return; }
      const items = (await TMDB.list('/search/multi', { query: s })).filter(x => x.poster).slice(0, 8);
      res.innerHTML = '';
      items.forEach((x, i) => {
        const r = h(`<div class="stream pick" style="grid-template-columns:42px 1fr auto;animation-delay:${i * 25}ms"><img src="${TMDB.img(x.poster, 'w92')}" style="width:42px;border-radius:6px"><div><b>${esc(x.title)}</b> <span class="dim">${esc(x.year)}${x.type === 'tv' ? ' · TV' : ''}</span></div>${ICON.plus}</div>`);
        r.onclick = () => { m.close(); onPick(x); };
        res.appendChild(r);
      });
    }, 250);
  };
}

// ---------- Library ----------
const LIB_TABS = [['watched', 'Watched'], ['diary', 'Diary'], ['lists', 'Lists'], ['watchlist', 'Watchlist'], ['reviews', 'Reviews'], ['activity', 'Activity'], ['stats', 'Stats']];
const libState = Fresh.keep('library', { sort: 'recent', q: '', type: 'all', rating: 'any', decade: 'any', wlSort: 'added', diaryYear: 'all', diaryView: 'list', statsYear: 'all', actKind: 'all' });

// ---------- Activity feed: everything you did, newest first, with undo ----------
const ACT = {
  rate: [ICON.starFill, (a) => `Rated <b>${esc(a.title)}</b> <span class="rating-text">${starsText(a.value)}</span>`, 'ratings'],
  unrate: [ICON.star, (a) => `Removed your rating for <b>${esc(a.title)}</b>`, 'ratings'],
  like: [ICON.heartFill, (a) => `Liked <b>${esc(a.title)}</b>`, 'likes'],
  unlike: [ICON.heart, (a) => `Unliked <b>${esc(a.title)}</b>`, 'likes'],
  watchlist: [ICON.bookmarkFill, (a) => `Added <b>${esc(a.title)}</b> to your watchlist`, 'watchlist'],
  unwatchlist: [ICON.bookmark, (a) => `Removed <b>${esc(a.title)}</b> from your watchlist`, 'watchlist'],
  watched: [ICON.checkCircleFill, (a) => `Marked <b>${esc(a.title)}</b> as watched`, 'logs'],
  unwatched: [ICON.checkCircle, (a) => `Unmarked <b>${esc(a.title)}</b> as watched`, 'logs'],
  log: [ICON.pencil, (a) => `${a.auto ? 'Finished' : a.rewatch ? 'Rewatched' : 'Logged'} <b>${esc(a.title)}</b>${a.value ? ` <span class="rating-text">${starsText(a.value)}</span>` : ''}${a.rewatch && a.auto ? ' <span class="dim">· rewatch</span>' : ''}`, 'logs'],
};
function activityFeed(body) {
  const all = Store.data.activity || [];
  const bar = h('<div class="toolbar"></div>');
  bar.appendChild(segmented([['all', 'All'], ['ratings', 'Ratings'], ['likes', 'Likes'], ['logs', 'Watched'], ['watchlist', 'Watchlist']], libState.actKind, v => { libState.actKind = v; paint(); }));
  body.appendChild(bar);
  const list = h('<div class="act-feed"></div>');
  body.appendChild(list);
  const dayName = (ms) => {
    const d = new Date(ms), t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? d.toLocaleDateString([], { weekday: 'long' }) : d.toLocaleDateString([], { month: 'long', day: 'numeric', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' });
  };
  const paint = () => {
    list.innerHTML = '';
    const rows = all.filter(a => ACT[a.kind] && (libState.actKind === 'all' || ACT[a.kind][2] === libState.actKind));
    if (!rows.length) {
      list.appendChild(h(`<div class="center-empty glass-empty"><div class="empty-ico">${ICON.layers}</div><h3>No activity yet</h3>Ratings, likes, logs and watchlist changes show up here, newest first, and you can undo them.</div>`));
      return;
    }
    let day = '', grp;
    rows.slice(0, 200).forEach((a, i) => {
      const dn = dayName(a.at);
      if (dn !== day) { day = dn; grp = h(`<div class="act-day"><h3>${esc(dn)}</h3><div class="act-group"></div></div>`); list.appendChild(grp); grp = $('.act-group', grp); }
      const [icon, text] = ACT[a.kind];
      const item = Store.item(a.key) || {};
      const needsStars = a.kind === 'log' && !a.undone && !a.value && Store.data.diary.some(e => e.id === a.diaryId);
      const r = h(`<div class="act-row ${a.undone ? 'undone' : ''} k-${a.kind}" style="animation-delay:${Math.min(i, 14) * 22}ms">
        <img src="${TMDB.img(a.poster || item.poster, 'w92')}" alt="">
        <span class="act-ico">${icon}</span>
        <div class="act-text">${text(a)}<small>${new Date(a.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${a.undone ? ' · undone' : ''}</small></div>
        <div class="act-btns">
          ${needsStars ? `<button class="btn small stars-btn">${ICON.star} Add stars</button>` : ''}
          ${Store.canUndo(a) ? `<button class="btn small ghost act-undo" title="Undo this">${ICON.undo} Undo</button>` : ''}
        </div>
      </div>`);
      const de = a.diaryId && Store.data.diary.find(x => x.id === a.diaryId);
      if (de && de.review && !a.undone) $('.act-text', r).insertBefore(h(`<span class="act-rv">“${esc(reviewPlain(de.review).slice(0, 140))}${reviewPlain(de.review).length > 140 ? '…' : ''}”</span>`), $('.act-text small', r));
      r.onclick = (e) => {
        if (e.target.closest('button')) return;
        if (de && de.review && !a.undone) openReview(item.id ? item : { type: a.type, id: +a.key.split(':')[1], title: a.title, poster: a.poster }, de.id);
        else go('detail', { type: a.type || a.key.split(':')[0], id: +a.key.split(':')[1] });
      };
      const u = $('.act-undo', r);
      if (u) u.onclick = () => {
        if (Store.undo(a)) { Recs.cache = null; toast('Undone'); r.classList.add('undoing'); setTimeout(paint, 220); }
      };
      const sb = $('.stars-btn', r);
      if (sb) sb.onclick = () => openAfterWatch(item.id ? item : { type: a.type, id: +a.key.split(':')[1], title: a.title, poster: a.poster }, a.diaryId);
      withMenu(r, item.id ? item : { type: a.type, id: +a.key.split(':')[1], title: a.title, poster: a.poster }, $('.act-btns', r), 'inline');
      grp.appendChild(r);
    });
  };
  paint();
}

// Favorites: four films and four shows, side by side.
function addFavorite(m) {
  const key = `${m.type}:${m.id}`;
  Store.upsert(m);
  if (Store.data.favorites.includes(key)) return false;
  const same = Store.data.favorites.filter(k => k.startsWith(m.type + ':'));
  if (same.length >= 4) Store.data.favorites = Store.data.favorites.filter(k => k !== same[0]);
  Store.data.favorites.push(key);
  Store.save();
  return true;
}
function favoritesRow(container) {
  const el = h(`<section class="favs"><div class="fav-cols"></div></section>`);
  for (const [type, title] of [['movie', 'Favorite films'], ['tv', 'Favorite shows']]) {
    const favs = Store.data.favorites.filter(k => k.startsWith(type + ':'));
    const col = h(`<div><h2 class="row-title">${title}</h2><div class="fav-grid"></div></div>`);
    for (let i = 0; i < 4; i++) {
      const it = favs[i] && Store.item(favs[i]);
      const slot = it ? posterCard(it, { sub: it.year }) : h(`<div class="card poster fav-empty"><div class="art">${ICON.plus}</div><div class="cap dim">Add</div></div>`);
      if (it) {
        const rm = h(`<button class="mini fav-x" title="Remove from favorites">${ICON.x}</button>`);
        rm.onclick = (e) => { e.stopPropagation(); Store.data.favorites = Store.data.favorites.filter(k => k !== favs[i]); Store.save(); go('library', route.params, true, true); };
        $('.art', slot).appendChild(rm);
      } else slot.onclick = () => pickTitle(type === 'tv' ? 'Add a favorite show' : 'Add a favorite film', (m) => { if (m.type !== type) return toast(`That’s a ${m.type === 'tv' ? 'show' : 'film'} — add it to the other row`, true); addFavorite(m); go('library', route.params, true, true); });
      $('.fav-grid', col).appendChild(slot);
    }
    $('.fav-cols', el).appendChild(col);
  }
  container.appendChild(el);
}

Views.library = async (root, { tab = 'watched' } = {}) => {
  const items = Store.values();
  const films = items.filter(i => i.watched && i.type === 'movie').length;
  const shows = items.filter(i => i.watched && i.type === 'tv').length;
  const year = String(new Date().getFullYear());
  const page = h(`<div class="page">
    <div class="page-head"><div><h1 class="page-title" style="margin-bottom:6px">Library</h1>
      <div class="muted lib-sub">${films.toLocaleString()} film${films === 1 ? '' : 's'} · ${shows.toLocaleString()} show${shows === 1 ? '' : 's'} · ${Store.data.diary.filter(e => e.date.startsWith(year)).length} logged this year · ${Store.data.lists.length} list${Store.data.lists.length === 1 ? '' : 's'}</div></div><div class="nudge-slot"></div></div>
    <div class="seg lib-tabs"></div>
    <div class="fav-slot"></div>
    <div class="lib-body"></div></div>`);
  root.appendChild(page);
  profileNudge($('.nudge-slot', page));
  // Favorites live on the Watched tab (your "profile" view); other tabs open straight to their content.
  if (tab === 'watched') favoritesRow($('.fav-slot', page));
  LIB_TABS.forEach(([k, label]) => { const b = h(`<button class="${k === tab ? 'on' : ''}">${label}</button>`); b.onclick = () => { if (k !== tab) go('library', { tab: k }, true); }; $('.lib-tabs', page).appendChild(b); });
  const body = $('.lib-body', page);
  const empty = (title, text, action) => {
    const e = h(`<div class="center-empty glass-empty"><div class="empty-ico">${ICON.grid}</div><h3>${title}</h3>${text}${action ? `<div class="btns" style="justify-content:center;margin-top:18px">${action}</div>` : ''}</div>`);
    body.appendChild(e);
  };
  const regrid = (list, opts) => { const g = h('<div class="grid"></div>'); list.forEach((m, i) => { const c = posterCard(m, opts && opts(m)); c.style.animationDelay = `${Math.min(i, 30) * 15}ms`; g.appendChild(c); }); return g; };

  if (tab === 'watched') {
    const all = items.filter(i => i.watched);
    if (!all.length) return empty('Nothing here yet', 'Tap everything you’ve watched in Seen It — it takes a minute — or import your Letterboxd history.', `<button class="btn primary" onclick="go('discover',{mode:'seen'})">Open Seen It</button><button class="btn" onclick="go('settings',{tab:'library'})">Import history</button>`);
    const decades = [...new Set(all.map(i => i.year && i.year.slice(0, 3) + '0').filter(Boolean))].sort().reverse();
    const bar = h(`<div><div class="toolbar">
      <input class="input q" placeholder="Filter your media" value="${esc(libState.q)}">
      <div class="seg type"><button data-v="all">All</button><button data-v="movie">Movies</button><button data-v="tv">TV</button></div>
      <select class="input rating"><option value="any">Any rating</option><option value="5">★ 5</option><option value="4">★ 4+</option><option value="3">★ 3+</option><option value="low">Below ★ 3</option><option value="none">Unrated</option><option value="liked">Liked</option><option value="reviewed">Reviewed</option><option value="rewatched">Rewatched</option><option value="logged">In your diary</option></select>
      <select class="input decade"><option value="any">Any decade</option>${decades.map(d => `<option value="${d}">${d}s</option>`).join('')}</select>
      <select class="input sort"><option value="recent">Recently watched</option><option value="rating">Your rating</option><option value="title">Title</option><option value="year">Release year</option></select>
    </div><div class="count dim"></div></div>`);
    body.appendChild(bar);
    const gridSlot = h('<div></div>'); body.appendChild(gridSlot);
    const lastSeen = (i) => i.watchedAt || i.lbAdded || '';
    const sorters = { recent: (a, b) => lastSeen(b).localeCompare(lastSeen(a)), rating: (a, b) => (b.rating || 0) - (a.rating || 0), title: (a, b) => a.title.localeCompare(b.title), year: (a, b) => String(b.year).localeCompare(String(a.year)) };
    const views = {}; Store.data.diary.forEach(e => (views[e.key] = (views[e.key] || 0) + 1));
    const paint = () => {
      const q = libState.q.toLowerCase(), r = libState.rating;
      const list = all.filter(i => (libState.type === 'all' || i.type === libState.type)
        && (!q || i.title.toLowerCase().includes(q))
        && (libState.decade === 'any' || (i.year || '').slice(0, 3) + '0' === libState.decade)
        && (r === 'any' || (r === 'none' ? !i.rating : r === 'liked' ? i.liked
          : r === 'reviewed' ? hasReview(`${i.type}:${i.id}`) : r === 'rewatched' ? (views[`${i.type}:${i.id}`] || 0) > 1 : r === 'logged' ? !!views[`${i.type}:${i.id}`] : r === 'low' ? i.rating && i.rating < 3 : (i.rating || 0) >= +r)))
        .sort(sorters[libState.sort]);
      $('.count', body).textContent = `${list.length.toLocaleString()} ${list.length === 1 ? 'title' : 'titles'}`;
      gridSlot.innerHTML = ''; gridSlot.appendChild(regrid(list));
    };
    const tq = $('.q', bar); let t;
    tq.oninput = () => { clearTimeout(t); t = setTimeout(() => { libState.q = tq.value; paint(); }, 150); };
    $$('.type button', bar).forEach(b => { b.classList.toggle('on', b.dataset.v === libState.type); b.onclick = () => { libState.type = b.dataset.v; $$('.type button', bar).forEach(x => x.classList.toggle('on', x === b)); paint(); }; });
    [['.rating', 'rating'], ['.decade', 'decade'], ['.sort', 'sort']].forEach(([sel, k]) => { const s = $(sel, bar); s.value = libState[k]; s.onchange = () => { libState[k] = s.value; paint(); }; });
    paint();
  }

  if (tab === 'diary') {
    const all = [...Store.data.diary].sort((a, b) => b.date.localeCompare(a.date));
    const viewSwitch = h('<div class="toolbar"></div>');
    viewSwitch.appendChild(segmented([['list', 'List'], ['calendar', 'Calendar']], libState.diaryView || 'list', v => { libState.diaryView = v; go('library', { tab }, true, true); }));
    body.appendChild(viewSwitch);
    if ((libState.diaryView || 'list') === 'calendar') return diaryCalendar(body);
    if (!all.length) return empty('Your diary is empty', 'Every time you finish a movie, Reel asks you to log it here.');
    const years = [...new Set(all.map(e => e.date.slice(0, 4)))];
    const chips = h(`<div class="chips"><button data-y="all">All</button>${years.map(y => `<button data-y="${y}">${y}</button>`).join('')}</div>`);
    $$('button', chips).forEach(b => { b.classList.toggle('on', b.dataset.y === libState.diaryYear); b.onclick = () => { libState.diaryYear = b.dataset.y; go('library', { tab }, true, true); }; });
    // One toolbar row: view switch on the left, years next to it, count on the right.
    viewSwitch.appendChild(chips);
    viewSwitch.appendChild(h(`<span class="count" style="margin-left:auto">${all.filter(e => libState.diaryYear === 'all' || e.date.startsWith(libState.diaryYear)).length.toLocaleString()} entries</span>`));
    const entries = all.filter(e => libState.diaryYear === 'all' || e.date.startsWith(libState.diaryYear));
    let month = '', sec;
    entries.forEach(e => {
      const it = Store.item(e.key) || { title: '?' };
      const mo = e.date.slice(0, 7);
      if (mo !== month) {
        month = mo;
        sec = h(`<div class="diary-month"><h3>${new Date(mo + '-01T12:00').toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h3></div>`);
        body.appendChild(sec);
      }
      const r = h(`<div class="diary-row ${e.review ? 'has-review' : ''}"><div class="day">${+e.date.slice(8, 10)}</div><img src="${TMDB.img(it.poster, 'w92')}" alt=""><div><div class="t">${esc(it.title)} <span class="dim">${esc(it.year || '')}</span></div>${e.review ? `<div class="rv">“${esc(e.review)}”<span class="rv-open">Read review</span></div>` : ''}</div>
        <div class="marks">${e.review ? `<span title="Has a review">${ICON.pencil}</span>` : ''}${e.rewatch ? `<span title="Rewatch">${ICON.rewatch}</span>` : ''}${e.liked ? `<span title="Liked">${ICON.heartFill}</span>` : ''}<span class="rating-text">${starsText(e.rating)}</span></div>
        <button class="btn small round edit" title="Edit entry">${ICON.pencil}</button></div>`);
      r.onclick = (ev) => { if (e.review && ev.target.closest('.rv, .marks')) openReview(it, e.id); else go('detail', { type: it.type, id: it.id }); };
      $('.edit', r).onclick = (ev) => { ev.stopPropagation(); editEntry(e, it, () => go('library', { tab }, true, true)); };
      withMenu(r, it, r, 'row-more');
      sec.appendChild(r);
    });
  }

  if (tab === 'watchlist') {
    const all = items.filter(i => i.watchlist && !i.watched);
    if (!all.length) return empty('Your watchlist is empty', 'Hit + on anything you want to watch later.');
    const bar = h(`<div><div class="toolbar"><div class="seg type"><button data-v="all">All</button><button data-v="movie">Movies</button><button data-v="tv">TV</button></div>
      <select class="input sort"><option value="added">Recently added</option><option value="oldest">Oldest first</option><option value="year">Release year</option><option value="title">Title</option></select>
      <button class="btn small primary pick" style="margin-left:auto">${ICON.dice} Tonight’s Pick</button></div><div class="count dim"></div></div>`);
    body.appendChild(bar);
    const gridSlot = h('<div></div>'); body.appendChild(gridSlot);
    const sorters = { added: (a, b) => (b.watchlistAt || 0) - (a.watchlistAt || 0), oldest: (a, b) => (a.watchlistAt || 0) - (b.watchlistAt || 0), year: (a, b) => String(b.year).localeCompare(String(a.year)), title: (a, b) => a.title.localeCompare(b.title) };
    const paint = () => {
      const list = all.filter(i => libState.type === 'all' || i.type === libState.type).sort(sorters[libState.wlSort]);
      $('.count', body).textContent = `${list.length} ${list.length === 1 ? 'title' : 'titles'}`;
      gridSlot.innerHTML = ''; gridSlot.appendChild(regrid(list));
    };
    $$('.type button', bar).forEach(b => { b.classList.toggle('on', b.dataset.v === libState.type); b.onclick = () => { libState.type = b.dataset.v; $$('.type button', bar).forEach(x => x.classList.toggle('on', x === b)); paint(); }; });
    const so = $('.sort', bar); so.value = libState.wlSort; so.onchange = () => { libState.wlSort = so.value; paint(); };
    $('.pick', bar).onclick = async () => { const p = await Recs.tonight(); if (p) go('detail', { type: p.type, id: p.id }); };
    paint();
  }

  if (tab === 'lists') {
    const bar = h(`<div class="toolbar"><span class="count">${Store.data.lists.length} list${Store.data.lists.length === 1 ? '' : 's'}</span><button class="btn primary small" style="margin-left:auto">${ICON.plus} New list</button></div>`);
    $('button', bar).onclick = () => {
      const wrap = h(`<div><h3 style="margin-bottom:18px">New list</h3><div class="field"><label>Name</label><input class="input n" placeholder="e.g. Rainy day comfort"></div><div class="field"><label>Description</label><textarea class="input d" style="min-height:70px"></textarea></div><label class="check"><input type="checkbox" class="r"> Ranked list</label><div class="btns" style="justify-content:flex-end"><button class="btn primary c">Create</button></div></div>`);
      const m = openModal(wrap);
      setTimeout(() => $('.n', wrap).focus(), 30);
      $('.c', wrap).onclick = () => {
        const name = $('.n', wrap).value.trim(); if (!name) return;
        const l = { id: uid(), name, desc: $('.d', wrap).value.trim(), ranked: $('.r', wrap).checked, keys: [], createdAt: Date.now() };
        Store.data.lists.push(l); Store.save(); m.close(); go('list', { id: l.id });
      };
    };
    body.appendChild(bar);
    if (!Store.data.lists.length) return empty('No lists yet', 'Make lists like “Comfort movies” or “Best of 2025”, ranked or unranked.');
    const g = h('<div class="lists-grid"></div>');
    Store.data.lists.forEach((l, i) => {
      const c = h(`<div class="list-card" style="animation-delay:${i * 30}ms"><div class="stack">${l.keys.slice(0, 5).map((k, j) => `<div style="--i:${j};z-index:${5 - j};background-image:url('${TMDB.img((Store.item(k) || {}).poster, 'w185')}')"></div>`).join('')}</div><h4>${esc(l.name)}</h4><div class="dim" style="font-size:13px">${l.keys.length} titles${l.ranked ? ' · Ranked' : ''}</div></div>`);
      c.onclick = () => go('list', { id: l.id });
      g.appendChild(c);
    });
    body.appendChild(g);
  }

  if (tab === 'reviews') {
    // Every review you've written (diary reviews + standalone), newest first. Click one to read it in full.
    const all = items.flatMap(it => reviewsFor(`${it.type}:${it.id}`).map(r => ({ it, r })))
      .sort((a, b) => String(b.r.date || b.it.watchedAt || '').localeCompare(String(a.r.date || a.it.watchedAt || '')));
    if (!all.length) return empty('No reviews yet', 'Write one from any title’s page (the pencil in the Log bar), or after you finish a movie.');
    const bar = h(`<div class="toolbar"><input class="input q" placeholder="Search your reviews"><span class="count dim">${all.length} reviews</span></div>`);
    body.appendChild(bar);
    const box = h('<div class="review-feed"></div>'); body.appendChild(box);
    const paint = (q = '') => {
      box.innerHTML = '';
      all.filter(({ it, r }) => !q || (it.title + ' ' + r.text).toLowerCase().includes(q)).forEach(({ it, r }, i) => {
        const el = h(`<div class="review-item" style="animation-delay:${Math.min(i, 12) * 30}ms"><img src="${TMDB.img(it.poster, 'w185')}" alt=""><div>
          <h4>${esc(it.title)} <span class="dim" style="font-weight:500">${esc(it.year || '')}</span></h4>
          <div class="rv-line"><span class="rating-text">${starsText(r.rating || it.rating)}</span>${r.liked ? `<span class="rv-heart">${ICON.heartFill}</span>` : ''}${r.rewatch ? `<span class="rv-tag">${ICON.rewatch} Rewatch</span>` : ''}${r.date ? `<span class="dim">${esc(new Date(r.date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}</div>
          <div class="rv-text clamp">${reviewHtml(r.text, 700)}</div><span class="rv-open">Read full review</span></div></div>`);
        el.onclick = (ev) => { if (!ev.target.closest('.more-btn')) openReview(it, r.e && r.e.id); };
        withMenu(el, it, el, 'row-more');
        $('img', el).onclick = (ev) => { ev.stopPropagation(); go('detail', { type: it.type, id: it.id }); };
        box.appendChild(el);
      });
    };
    let t; $('.q', bar).oninput = (e) => { clearTimeout(t); t = setTimeout(() => paint(e.target.value.trim().toLowerCase()), 120); };
    paint();
  }

  if (tab === 'activity') activityFeed(body);

  if (tab === 'stats') renderStats(body, items);
};

// ---------- Diary calendar: what you watched each day, with ratings ----------
// Gathers diary logs, titles marked watched on a date (without a log), and TV episodes watched that day.
function watchDays() {
  const days = {};
  const add = (date, rec) => { if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) (days[date] = days[date] || []).push(rec); };
  const logged = new Set();
  Store.data.diary.forEach(e => { const it = Store.item(e.key); if (it) { add(e.date, { kind: 'log', e, it }); logged.add(`${e.key}|${e.date}`); } });
  Store.values().forEach(it => { if (it.type === 'movie' && it.watched && it.watchedAt && !logged.has(`movie:${it.id}|${it.watchedAt}`)) add(it.watchedAt, { kind: 'mark', it }); });
  Object.entries(Store.data.episodes).forEach(([key, eps]) => {
    const show = Store.item(key); if (!show) return;
    const byDay = {};
    Object.entries(eps).forEach(([ek, v]) => { if (!ek.startsWith('season:') && v.watched && v.at) (byDay[v.at] = byDay[v.at] || []).push(ek); });
    Object.entries(byDay).forEach(([d, list]) => add(d, { kind: 'eps', it: show, eps: list.sort((a, b) => { const [s1, e1] = a.split(':').map(Number), [s2, e2] = b.split(':').map(Number); return s1 - s2 || e1 - e2; }) }));
  });
  return days;
}
const epLabel = (eps) => { const f = eps[0].split(':'), l = eps[eps.length - 1].split(':'); return eps.length === 1 ? `S${f[0]}, E${f[1]}` : f[0] === l[0] ? `S${f[0]}, E${f[1]}–${l[1]}` : `${eps.length} episodes`; };

function diaryCalendar(body) {
  const days = watchDays();
  const dates = Object.keys(days).sort();
  const nowMonth = today().slice(0, 7);
  libState.calMonth = libState.calMonth || (dates.length ? dates[dates.length - 1].slice(0, 7) : nowMonth);
  const [Y, M] = libState.calMonth.split('-').map(Number);
  const first = new Date(Y, M - 1, 1), dim = new Date(Y, M, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const key = (d) => `${libState.calMonth}-${String(d).padStart(2, '0')}`;
  const monthRecs = dates.filter(d => d.startsWith(libState.calMonth)).flatMap(d => days[d]);
  const titles = monthRecs.filter(r => r.kind !== 'eps').length, eps = monthRecs.filter(r => r.kind === 'eps').reduce((a, r) => a + r.eps.length, 0);
  const rated = monthRecs.map(r => (r.kind === 'log' ? r.e.rating : r.kind === 'mark' ? r.it.rating : 0)).filter(Boolean);
  const shift = (n) => { const d = new Date(Y, M - 1 + n, 1); libState.calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; go('library', { tab: 'diary' }, true, true); };

  const cal = h(`<div class="cal">
    <div class="cal-head">
      <div class="cal-nav"><button class="mini prev" title="Previous month">${ICON.back}</button><h2>${first.toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h2><button class="mini next" title="Next month">${ICON.back}</button>
        ${libState.calMonth !== nowMonth ? '<button class="btn small ghost now">Today</button>' : ''}</div>
      <div class="cal-stats"><span><b>${titles}</b> titles</span><span><b>${eps}</b> episodes</span>${rated.length ? `<span><b>★ ${(rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1)}</b> avg</span>` : ''}</div>
    </div>
    <div class="cal-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="cal-dow">${d}</div>`).join('')}</div>
  </div>`);
  $('.prev', cal).onclick = () => shift(-1);
  $('.next', cal).onclick = () => shift(1);
  if ($('.now', cal)) $('.now', cal).onclick = () => { libState.calMonth = nowMonth; go('library', { tab: 'diary' }, true, true); };
  const grid = $('.cal-grid', cal);
  for (let i = 0; i < lead; i++) grid.appendChild(h('<div class="cal-day blank"></div>'));
  for (let d = 1; d <= dim; d++) {
    const k = key(d), recs = days[k] || [];
    const cell = h(`<div class="cal-day ${recs.length ? 'has' : ''} ${k === today() ? 'today' : ''} ${k > today() ? 'future' : ''}"><span class="num">${d}</span><div class="stack"></div><div class="cal-meta"></div></div>`);
    recs.slice(0, 3).forEach((r, i) => $('.stack', cell).appendChild(h(`<div class="cp" style="--i:${i};background-image:url('${TMDB.img(r.it.poster, 'w154')}')">${r.kind === 'eps' ? `<em>${r.eps.length}</em>` : ''}</div>`)));
    const top = recs.find(r => r.kind === 'log' && r.e.rating) || recs.find(r => r.kind === 'mark' && r.it.rating);
    $('.cal-meta', cell).innerHTML = `${top ? `<span class="r">${starsText(top.kind === 'log' ? top.e.rating : top.it.rating)}</span>` : ''}${recs.length > 3 ? `<span class="more">+${recs.length - 3}</span>` : ''}`;
    if (k <= today()) cell.onclick = () => dayDetail(k, recs);
    grid.appendChild(cell);
  }
  body.appendChild(cal);
}

// Everything you watched on one day, with ratings, quick edits and "log something for this day".
function dayDetail(date, recs) {
  const wrap = h(`<div><div class="sheet-head"><div><div class="eyebrow">${recs.length ? `${recs.length} ${recs.length === 1 ? 'entry' : 'entries'}` : 'Nothing logged'}</div><h3>${new Date(date + 'T12:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3></div><button class="btn small round close">${ICON.x}</button></div>
    <div class="day-list"></div><div class="btns" style="margin-top:16px"><button class="btn small add">${ICON.plus} Log something for this day</button></div></div>`);
  const m = openModal(wrap);
  $('.close', wrap).onclick = m.close;
  const list = $('.day-list', wrap);
  if (!recs.length) list.appendChild(h('<div class="dim">You didn’t log anything this day.</div>'));
  recs.forEach(r => {
    const rating = r.kind === 'log' ? r.e.rating : r.kind === 'mark' ? r.it.rating : 0;
    const label = r.kind === 'log' ? (r.e.rewatch ? 'Rewatch' : 'Logged') : r.kind === 'mark' ? 'Marked as watched' : epLabel(r.eps);
    const row = h(`<div class="day-row"><img src="${TMDB.img(r.it.poster, 'w92')}"><div><b>${esc(r.it.title)}</b> <span class="dim">${esc(r.it.year || '')}</span>
      <div class="dim" style="font-size:12.5px">${esc(label)}${r.kind === 'log' && r.e.review ? ` · “${esc(reviewPlain(r.e.review).slice(0, 80))}${reviewPlain(r.e.review).length > 80 ? '…' : ''}”` : ''}</div></div>
      <div class="marks">${r.kind === 'log' && r.e.liked ? `<span>${ICON.heartFill}</span>` : ''}<span class="rating-text">${rating ? starsText(rating) : ''}</span></div>
      ${r.kind === 'log' ? `<button class="btn small round ed" title="Edit entry">${ICON.pencil}</button>` : '<span></span>'}</div>`);
    row.onclick = () => { m.close(); if (r.kind === 'log' && r.e.review) openReview(r.it, r.e.id); else go('detail', { type: r.it.type, id: r.it.id }); };
    if (r.kind === 'log') $('.ed', row).onclick = (ev) => { ev.stopPropagation(); m.close(); editEntry(r.e, r.it, () => go('library', { tab: 'diary' }, true, true)); };
    withMenu(row, r.it, row, 'row-more');
    $('.more-btn', row).addEventListener('click', () => m.close());
    list.appendChild(row);
  });
  $('.add', wrap).onclick = () => { m.close(); pickTitle(`Log for ${new Date(date + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}`, (t) => openLog(t, { date, onSaved: () => go('library', { tab: 'diary' }, true, true) })); };
}

// Edit or delete a diary entry.
function editEntry(e, it, onDone) {
  let rating = e.rating || 0, liked = !!e.liked;
  const wrap = h(`<div>
    <div class="sheet-head"><img src="${TMDB.img(it.poster, 'w154')}" alt=""><div><div class="eyebrow">Edit diary entry</div><h3>${esc(it.title)}</h3><div class="muted">${esc(it.year || '')}</div></div><button class="btn small round close">${ICON.x}</button></div>
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0 20px"><div class="stars-slot"></div><span class="like-toggle ${liked ? 'on' : ''}">${liked ? ICON.heartFill : ICON.heart}</span></div>
    <div class="field"><textarea class="input review" placeholder="Review">${esc(e.review || '')}</textarea></div>
    <div style="display:flex;align-items:center;gap:20px">
      <label class="check" style="margin:0"><input type="checkbox" class="rewatch" ${e.rewatch ? 'checked' : ''}> Rewatch</label>
      <input type="date" class="input date" value="${esc(e.date)}" style="width:170px;padding:9px 12px">
      <div class="btns" style="margin-left:auto"><button class="btn ghost del">Delete</button><button class="btn primary save">Save</button></div>
    </div></div>`);
  $('.stars-slot', wrap).appendChild(starsInput(rating, v => (rating = v), 36));
  const heart = $('.like-toggle', wrap);
  heart.onclick = () => { liked = !liked; heart.classList.toggle('on', liked); heart.innerHTML = liked ? ICON.heartFill : ICON.heart; };
  const m = openModal(wrap);
  $('.close', wrap).onclick = m.close;
  $('.del', wrap).onclick = () => { Store.data.diary = Store.data.diary.filter(x => x.id !== e.id); Store.save(); m.close(); toast('Entry deleted'); onDone(); };
  $('.save', wrap).onclick = () => {
    Object.assign(e, { rating, liked, review: $('.review', wrap).value.trim(), rewatch: $('.rewatch', wrap).checked, date: $('.date', wrap).value || e.date });
    const latest = Store.data.diary.filter(x => x.key === e.key).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (latest === e) Store.upsert(it, { rating: rating || it.rating, liked: liked || it.liked, review: e.review || it.review });
    Store.save(); m.close(); toast('Entry updated'); onDone();
  };
}

function renderStats(body, items) {
  const years = [...new Set(Store.data.diary.map(e => e.date.slice(0, 4)))].sort().reverse();
  const chips = h(`<div class="chips"><button data-y="all">All time</button>${years.map(y => `<button data-y="${y}">${y}</button>`).join('')}</div>`);
  $$('button', chips).forEach(b => { b.classList.toggle('on', b.dataset.y === libState.statsYear); b.onclick = () => { libState.statsYear = b.dataset.y; go('library', { tab: 'stats' }, true, true); }; });
  const Y = libState.statsYear;
  // Year in Review banner
  const ry = Y === 'all' ? (years[0] || String(new Date().getFullYear())) : Y;
  const banner = h(`<div class="review-banner"><div><div class="eyebrow">Year in Review</div><b>Your ${ry}, wrapped</b><span class="dim">Top picks, your genre, busiest month, director of the year.</span></div><button class="btn primary">${ICON.sparkle} Open</button></div>`);
  banner.onclick = () => go('review', { year: ry });
  body.appendChild(banner);
  const yt = h('<div class="toolbar"></div>'); yt.appendChild(chips); body.appendChild(yt);
  const diary = Store.data.diary.filter(e => Y === 'all' || e.date.startsWith(Y));
  const keysInYear = new Set(diary.map(e => e.key));
  const watched = items.filter(i => i.watched && (Y === 'all' || keysInYear.has(`${i.type}:${i.id}`) || (i.watchedAt || '').startsWith(Y)));
  const films = watched.filter(i => i.type === 'movie');
  const rated = watched.filter(i => i.rating);
  const avg = rated.length ? rated.reduce((a, i) => a + i.rating, 0) / rated.length : 0;
  const minutes = films.reduce((a, i) => a + (i.runtime || 110), 0) + diary.filter(e => e.rewatch).reduce((a, e) => a + ((Store.item(e.key) || {}).runtime || 0), 0);
  const epCount = Object.values(Store.data.episodes).reduce((a, s) => a + Object.values(s).filter(e => e.watched && (Y === 'all' || (e.at || '').startsWith(Y))).length, 0);
  const tile = (v, l) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  body.appendChild(h(`<div class="stat-tiles">
    ${tile(films.length.toLocaleString(), 'Movies')}${tile(Math.round(minutes / 60).toLocaleString(), 'Hours watched')}${tile(diary.length.toLocaleString(), 'Diary entries')}
    ${tile(epCount.toLocaleString(), 'Episodes')}${tile(avg ? avg.toFixed(2) : '–', 'Average rating')}${tile(watched.filter(i => i.liked).length, 'Likes')}
    ${tile(diary.filter(e => e.rewatch).length, 'Rewatches')}${tile(diary.filter(e => e.review).length, 'Reviews')}
  </div>`));

  const dist = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(v => rated.filter(i => i.rating === v).length);
  const max = Math.max(1, ...dist);
  const two = h('<div class="grid2 stats-2"></div>');
  two.appendChild(h(`<div class="panel"><h3>Ratings</h3><div class="bars">${dist.map((c, i) => `<div class="b" title="${c}"><i style="height:${(c / max) * 100}%"></i><span>${(i + 1) / 2}</span></div>`).join('')}</div></div>`));
  if (Y !== 'all') {
    const months = Array.from({ length: 12 }, (_, i) => diary.filter(e => +e.date.slice(5, 7) === i + 1).length);
    const mmax = Math.max(1, ...months);
    two.appendChild(h(`<div class="panel"><h3>By month</h3><div class="bars">${months.map((c, i) => `<div class="b" title="${c}"><i style="height:${(c / mmax) * 100}%"></i><span>${'JFMAMJJASOND'[i]}</span></div>`).join('')}</div></div>`));
  } else {
    const decs = {};
    films.forEach(i => { if (i.year) { const d = i.year.slice(0, 3) + '0'; decs[d] = (decs[d] || 0) + 1; } });
    const ds = Object.keys(decs).sort().slice(-10), dmax = Math.max(1, ...ds.map(d => decs[d]));
    two.appendChild(h(`<div class="panel"><h3>By decade</h3><div class="bars">${ds.map(d => `<div class="b" title="${decs[d]}"><i style="height:${(decs[d] / dmax) * 100}%"></i><span>${d.slice(2)}s</span></div>`).join('')}</div></div>`));
  }
  body.appendChild(two);

  const g = {};
  watched.forEach(i => (i.genres || []).forEach(x => (g[x] = (g[x] || 0) + 1)));
  const top = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) {
    const gm = top[0][1];
    body.appendChild(h(`<div class="panel"><h3>Top genres</h3>${top.map(([n, c]) => `<div class="hbar"><span>${esc(n)}</span><i style="width:${(c / gm) * 100}%"></i><span class="dim">${c}</span></div>`).join('')}</div>`));
  }
  const best = rated.filter(i => i.rating >= 4.5).sort((a, b) => b.rating - a.rating).slice(0, 20);
  if (best.length) body.appendChild(row(Y === 'all' ? 'Your highest rated' : `Best of ${Y}`, best, posterCard));
  const rewatched = {};
  Store.data.diary.forEach(e => (rewatched[e.key] = (rewatched[e.key] || 0) + 1));
  const most = Object.entries(rewatched).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, c]) => ({ ...Store.item(k), _c: c })).filter(i => i.id);
  if (most.length) body.appendChild(row('Most watched', most, (m) => posterCard(m, { sub: `${m._c} times` })));
}

// ---------- A single list ----------
Views.list = async (root, { id }) => {
  const l = Store.data.lists.find(x => x.id === id);
  if (!l) return go('library', { tab: 'lists' });
  const page = h(`<div class="page">
    <div class="page-head"><div><div class="eyebrow">List · ${l.keys.length} title${l.keys.length === 1 ? '' : 's'}${l.ranked ? ' · Ranked' : ''}</div><h1 class="page-title" contenteditable="true" spellcheck="false" title="Click to rename" style="outline:none;margin:4px 0 6px">${esc(l.name)}</h1></div>
      <div class="list-tools"><button class="btn small primary add">${ICON.plus} Add titles</button><button class="btn small shuffle">${ICON.dice} Random pick</button><button class="btn small round more-list" title="More">${ICON.more}</button></div></div>
    <textarea class="input desc" placeholder="Add a description…" style="min-height:48px;margin-bottom:12px">${esc(l.desc || '')}</textarea>
    <label class="check" style="margin-bottom:22px"><input type="checkbox" class="ranked" ${l.ranked ? 'checked' : ''}> Ranked list <span class="dim">— drag posters to reorder</span></label>
    <div class="grid items"></div>
  </div>`);
  root.appendChild(page);
  const title = $('.page-title', page);
  title.onblur = () => { l.name = title.textContent.trim() || l.name; Store.save(); };
  title.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } };
  $('.desc', page).onchange = (e) => { l.desc = e.target.value; Store.save(); };
  $('.ranked', page).onchange = (e) => { l.ranked = e.target.checked; Store.save(); paint(); };
  $('.more-list', page).onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    menuAt(r.right - 240, r.bottom + 6, l.name, [
      [ICON.rewatch, l.ranked ? 'Make unranked' : 'Make it a ranked list', () => { l.ranked = !l.ranked; Store.save(); rerender(); }],
      [ICON.dice, 'Random pick', () => $('.shuffle', page).click()],
      'sep',
      [ICON.x, 'Delete list…', async () => {
        if (await confirmSheet(`Delete “${l.name}”?`, `The list goes away; the ${l.keys.length} titles in it stay in your library.`, 'Delete list', true)) {
          Store.data.lists = Store.data.lists.filter(x => x !== l); Store.save(); toast(`Deleted “${l.name}”`); back();
        }
      }, 'danger'],
    ]);
  };
  $('.add', page).onclick = () => pickTitle(`Add to “${l.name}”`, (m) => { const k = `${m.type}:${m.id}`; if (!l.keys.includes(k)) { l.keys.push(k); Store.upsert(m); } paint(); toast(`Added ${m.title}`); });
  $('.shuffle', page).onclick = () => { const k = l.keys[Math.floor(Math.random() * l.keys.length)]; const it = k && Store.item(k); if (it) go('detail', { type: it.type, id: it.id }); };
  let dragFrom = null;
  const paint = () => {
    const g = $('.items', page); g.innerHTML = '';
    if (!l.keys.length) g.appendChild(h('<div class="dim">Use Add to put titles in this list.</div>'));
    l.keys.forEach((k, i) => {
      const it = Store.item(k); if (!it) return;
      const c = posterCard(it, { sub: l.ranked ? `#${i + 1}` : it.year });
      c.draggable = true;
      c.ondragstart = () => { dragFrom = i; c.classList.add('dragging'); };
      c.ondragend = () => c.classList.remove('dragging');
      c.ondragover = (e) => { e.preventDefault(); c.classList.add('drop'); };
      c.ondragleave = () => c.classList.remove('drop');
      c.ondrop = (e) => { e.preventDefault(); if (dragFrom == null || dragFrom === i) return; const [x] = l.keys.splice(dragFrom, 1); l.keys.splice(i, 0, x); dragFrom = null; Store.save(); paint(); };
      const rm = h(`<button class="mini fav-x" title="Remove from list">${ICON.x}</button>`);
      rm.onclick = (e) => { e.stopPropagation(); l.keys.splice(i, 1); Store.save(); paint(); };
      $('.art', c).appendChild(rm);
      g.appendChild(c);
    });
  };
  paint();
};
