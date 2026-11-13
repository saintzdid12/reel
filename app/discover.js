// Reel — For You: a sidebar app — tonight's picks, Mood Match, Seen It packs, and the tools that build your taste.

// One list, no groups: your picks first, then the tools that teach Reel your taste.
const DISC = [
  // Find something to watch → teach Reel your taste (biggest impact first) → see what it learned.
  ['', [['foryou', 'Tonight', 'compass'], ['mood', 'Mood Match', 'sparkle'], ['seen', 'Seen It', 'eye'], ['tot', 'This or That', 'shuffle'], ['rank', 'Rank', 'layers'], ['taste', 'Taste Profile', 'user']]],
];
const discState = { mode: 'foryou' };

Views.discover = async (root, params = {}) => {
  if (params.mode) discState.mode = params.mode;
  if (discState.mode === 'rate') discState.mode = 'seen';   // Quick Rate was replaced by Seen It
  if (!DISC.some(([, ms]) => ms.some(m => m[0] === discState.mode))) discState.mode = 'foryou';
  const page = h(`<div class="disc"><aside class="disc-side"></aside><section class="disc-main"></section></div>`);
  root.appendChild(page);
  const side = $('.disc-side', page);
  side.appendChild(h('<div class="side-title">For You</div>'));
  DISC.forEach(([group, modes]) => {
    if (group) side.appendChild(h(`<div class="side-group">${esc(group)}</div>`));
    modes.forEach(([k, label, icon]) => {
      const b = h(`<button class="side-item ${discState.mode === k ? 'on' : ''}" data-mode="${k}">${ICON[icon]}<span>${esc(label)}</span></button>`);
      b.onclick = () => discGo(k);
      side.appendChild(b);
    });
  });
  const main = $('.disc-main', page);
  // Like a macOS sidebar: switching sections swaps only the content pane (no full-page rebuild, no flicker).
  discRunner = async () => {
    leaveFns.forEach(f => { try { f(); } catch {} });
    leaveFns = [];
    document.querySelectorAll('.ctx-menu, .rate-pop').forEach(p => (p.close ? p.close() : p.remove()));
    $$('.side-item', side).forEach(x => x.classList.toggle('on', x.dataset.mode === discState.mode));
    main.innerHTML = '';
    main.classList.remove('swap'); void main.offsetWidth; main.classList.add('swap');
    $('#view').scrollTop = 0;
    await DMODES[discState.mode](main);
  };
  await DMODES[discState.mode](main);
};
let discRunner = null;
// Change Discover section (or refresh the current one) in place when Discover is open; otherwise navigate there.
function discGo(mode) {
  if (mode && mode !== discState.mode) { Fresh.reset(mode); discState.mode = mode; }
  if (route.name === 'discover' && discRunner && document.querySelector('.disc-main')) return discRunner();
  return go('discover', mode ? { mode } : {});
}

// ---------- Small shared controls ----------
function segmented(opts, value, onChange) {
  const el = h(`<div class="segm">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(value) ? 'on' : ''}">${l}</button>`).join('')}</div>`);
  $$('button', el).forEach(b => (b.onclick = () => { $$('button', el).forEach(x => x.classList.toggle('on', x === b)); onChange(b.dataset.v); }));
  return el;
}
// A glass pop-up menu button: "Source · Popular ▾".
function glassSelect(label, opts, value, onChange) {
  const cur = () => (opts.find(o => String(o[0]) === String(value)) || opts[0])[1];
  const el = h(`<button class="gsel"><span class="gl">${esc(label)}</span><b></b>${ICON.chevDown}</button>`);
  $('b', el).textContent = cur();
  el.onclick = (e) => {
    e.stopPropagation();
    document.querySelectorAll('.ctx-menu').forEach(x => x.remove());
    const menu = h('<div class="ctx-menu gsel-menu"></div>');
    opts.forEach(([v, l]) => {
      const b = h(`<button class="${String(v) === String(value) ? 'on' : ''}"><span>${esc(l)}</span></button>`);
      b.onclick = () => { value = v; $('b', el).textContent = l; menu.remove(); onChange(v); };
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    const r = el.getBoundingClientRect();
    menu.style.left = `${Math.min(r.left, innerWidth - menu.offsetWidth - 12)}px`;
    menu.style.top = `${Math.min(r.bottom + 8, innerHeight - menu.offsetHeight - 12)}px`;
    const away = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', away, true); } };
    setTimeout(() => document.addEventListener('mousedown', away, true));
  };
  return el;
}
function dHead(main, title, sub, tools = []) {
  const el = h(`<header class="d-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="d-tools"></div></header>`);
  tools.forEach(t => $('.d-tools', el).appendChild(t));
  main.appendChild(el);
  return el;
}
const isSeen = (m) => !!(Store.item(`${m.type}:${m.id}`) || {}).watched;
const typeOpts = [['movie', 'Movies'], ['tv', 'Shows']];
const pages = async (path, n, params = {}, type) => (await Promise.all(Array.from({ length: n }, (_, i) => TMDB.list(path, { ...params, page: i + 1 }, type)))).flat();
function keyHandler(fn) { document.addEventListener('keydown', fn); onLeave(() => document.removeEventListener('keydown', fn)); }
const typing = (e) => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || document.querySelector('.modal-back') || Player.active();

// =====================================================================
// For You
// =====================================================================
async function dForYou(main) {
  const hr = new Date().getHours();
  dHead(main, hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening', 'Something to watch tonight, and ways to sharpen your recommendations.');
  // Tonight's pick
  // Tonight's pick comes from the mixed pool: your picks + popular + trending + all-time greats, shows ~1 in 5.
  let mixed = [];
  try { mixed = await Recs.pool({ mode: 'watch' }); } catch {}
  let pool = Recs.vary(mixed.filter(m => !isSeen(m)), 'tonight', 4).slice(0, 12);
  if (pool.length < 3) pool = pool.concat((await TMDB.list('/trending/movie/week', {}, 'movie')).filter(m => !isSeen(m) && (m.vote || 0) >= 6.4));
  let i = 0;
  const card = h('<div class="tonight"></div>');
  main.appendChild(card);
  const paint = () => {
    const m = pool[i % pool.length];
    if (!m) return;
    card.innerHTML = `<div class="tn-bg" style="background-image:url('${TMDB.img(m.backdrop, 'w1280')}')"></div>
      <div class="tn-body"><div class="eyebrow">Tonight’s pick</div><div class="tn-logo"><h2>${esc(m.title)}</h2></div>
      <div class="muted">${esc([m.year, (m.genreIds || []).map(g => TMDB.genreName(m.type, g)).filter(Boolean).slice(0, 2).join(', ')].filter(Boolean).join(' · '))}${m.why ? ` · ${esc(m.why)}` : ''}</div>
      <p>${esc(m.overview || '')}</p>
      <div class="btns"><button class="btn primary p">${ICON.playSm} Play</button><button class="btn d">Details</button><button class="btn round twl" title="Watchlist">${(Store.item(`${m.type}:${m.id}`) || {}).watchlist ? ICON.bookmarkFill : ICON.bookmark}</button><button class="btn ghost n">${ICON.shuffle} Another</button></div></div>`;
    TMDB.logo(m.type, m.id).then(p => { if (p && card.isConnected && pool[i % pool.length] === m) $('.tn-logo', card).innerHTML = `<img src="${TMDB.img(p, 'w500')}" alt="">`; });
    $('.p', card).onclick = () => (m.type === 'movie' ? Playback.start(m) : go('detail', { type: m.type, id: m.id }));
    $('.d', card).onclick = () => go('detail', { type: m.type, id: m.id });
    $('.twl', card).onclick = (e) => { const r = Store.toggleWatchlist(m); e.currentTarget.innerHTML = r.watchlist ? ICON.bookmarkFill : ICON.bookmark; toast(r.watchlist ? `Added ${m.title} to your watchlist` : 'Removed from watchlist'); };
    $('.btns', card).appendChild(moreBtn(m, 'inline'));
    $('.n', card).onclick = () => { i++; card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); paint(); };
  };
  paint();

  // Quick stats + jump-off tiles
  const items = Store.values();
  const duels = Math.round(items.reduce((a, x) => a + (x.duels || 0), 0) / 2);
  const best = Math.max(0, ...Object.values(Store.data.trivia || {}));
  const tiles = [
    ['mood', 'sparkle', 'Mood Match', 'Tell it the vibe, get three picks'],
    ['seen', 'eye', 'Seen It', `${Store.values().filter(i => i.watched).length.toLocaleString()} marked · tap what you’ve watched`],
    ['tot', 'shuffle', 'This or That', (Store.data.totCount || 0) ? `${Store.data.totCount} answers · keep teaching it` : 'Teach Reel your taste in a minute'],
    ['rank', 'layers', 'Rank', `${duels} matchups played`],
    ['taste', 'user', 'Taste Profile', `Strength ${Recs.strength().score} · ${Recs.strength().level.toLowerCase()}`],
  ];
  const grid = h('<div class="d-tiles"></div>');
  tiles.forEach(([k, icon, t, s], n) => {
    const c = h(`<button class="d-tile" style="animation-delay:${n * 40}ms"><span class="ti">${ICON[icon]}</span><b>${t}</b><small>${esc(s)}</small></button>`);
    c.onclick = () => discGo(k);
    grid.appendChild(c);
  });
  main.appendChild(grid);
  // Rows: a blend first, then each ingredient on its own — all quality-filtered, all mixing in a few shows.
  // Each row skips anything already shown above it, so nothing repeats down the page.
  const shown = new Set(pool.slice(0, 4).map(m => `${m.type}:${m.id}`));
  const take = (l, n) => { const out = l.filter(m => !shown.has(`${m.type}:${m.id}`)).slice(0, n); out.forEach(m => shown.add(`${m.type}:${m.id}`)); return out; };
  const bySrc = (s) => mixed.filter(m => (m.sources || []).includes(s));
  const sub = (m) => [m.type === 'tv' ? 'Series' : m.year, m.vote ? `TMDB ${m.vote.toFixed(1)}` : ''].filter(Boolean).join(' · ');
  const rowsData = [
    [Recs.seeds().length ? 'More picked for you' : 'Picks to start with', take(Recs.vary(mixed, 'disc-more', 6), 20), m => landCard(m, { feedback: true, sub: m.why }), 'your taste + what’s popular + all-time greats'],
    ['Trending this week', take(bySrc('trending'), 20), m => landCard(m, { sub: sub(m) }), ''],
    ['All-time greats you haven’t seen', take(bySrc('greats'), 24), m => posterCard(m, { sub: sub(m) }), 'the highest-rated films and shows, ordered by your taste'],
    ['Popular right now', take(bySrc('popular'), 20), m => landCard(m, { sub: sub(m) }), ''],
  ];
  rowsData.forEach(([title, list, render, s]) => list.length && asyncRow(main, title, async () => list, render, s));
}

// =====================================================================
// Mood Match
// =====================================================================
// Mood comes first. Each vibe has its own genre rules per type (TV and movies use different genre codes):
// `all` = must have every one, `any` = at least one, `not` = never. Who you're watching with adds its own
// exclusions and "crowd" boosts. Candidates are ranked by quality + popularity + how strongly they fit the mood;
// your personal taste is only a light tiebreaker within the mood (it never drags in off-mood titles).
const VIBES = [
  ['Feel-good', '#f7b733', { movie: { any: [35, 10751, 10402], not: [27, 53, 80, 10752, 99] }, tv: { any: [35, 10751], not: [80, 99, 10768, 9648] } }],
  ['Thrilling', '#e94057', { movie: { any: [53, 28], not: [16, 10751, 99, 10749] }, tv: { any: [80, 9648, 10759], not: [16, 10751, 99, 35, 10764] } }],
  ['Dark', '#3a3a5c', { movie: { any: [80, 53, 27], not: [16, 10751, 35, 10402] }, tv: { any: [80, 9648], not: [16, 10751, 35, 10764] } }],
  ['Mind-bending', '#7f5af0', { movie: { any: [878, 9648], not: [16, 10751, 10402, 35] }, tv: { any: [10765, 9648], not: [16, 10751, 35, 10764] } }],
  ['Romantic', '#ff6b9a', { movie: { all: [10749], not: [27, 10752, 53, 80] }, tv: { all: [18], not: [80, 10765, 10759, 9648, 16, 99, 10764] } }],
  ['Funny', '#ffb347', { movie: { all: [35], not: [18, 27, 10752, 36, 99, 53] }, tv: { all: [35], not: [18, 10764, 10767, 99, 10768] } }],
  ['Epic', '#2a9d8f', { movie: { any: [12, 14, 10752, 36], not: [35, 27, 16, 10751] }, tv: { any: [10759, 10765, 10768], not: [35, 16, 10764] } }],
  ['Cozy', '#c08552', { movie: { any: [10751, 16, 35, 14], not: [27, 53, 80, 10752] }, tv: { any: [35, 10751, 16], not: [80, 9648, 10768] } }],
  ['Scary', '#5c1a1b', { movie: { all: [27], not: [35, 16, 10751] }, tv: { any: [9648, 10765], not: [35, 16, 10751, 10764] } }],
  ['Heartfelt', '#4ea8de', { movie: { all: [18], not: [27, 53, 80, 10752, 878] }, tv: { all: [18], not: [80, 10765, 10759, 9648] } }],
  ['True stories', '#6c757d', { movie: { any: [99, 36], not: [16, 14, 878] }, tv: { all: [99], not: [16] } }],
  ['Animated', '#00b4d8', { movie: { all: [16], not: [27] }, tv: { all: [16], not: [] } }],
];
// Who you're watching with: extra exclusions, genres that get a boost, and how "crowd-pleasing" titles must be.
const COMPANY = {
  solo: { not: [], boost: [], votes: 1 },
  date: { not: [99, 10751, 10762], boost: [10749, 35, 18], votes: 1.5 },
  friends: { not: [99, 36, 10751, 10762, 10402], boost: [35, 28, 27, 12, 53, 10759, 80], votes: 3 },
  family: { not: [27, 53, 80, 10752, 10768, 9648], boost: [10751, 16, 12, 14], votes: 1.5 },
};
const moodState = Fresh.keep('mood', { vibe: 'Funny', who: 'friends', len: 'any', era: 'any', type: 'all', ranked: [], shown: 0 });

function dMood(main) {
  dHead(main, 'Mood Match', 'Pick a vibe and who you’re watching with. You’ll get three strong picks you haven’t seen, plus more.');
  const wrap = h(`<div class="mood"><div class="mood-opts"></div><div class="mood-res"></div></div>`);
  main.appendChild(wrap);
  const opts = $('.mood-opts', wrap), res = $('.mood-res', wrap);
  const vibes = h('<div class="vibes"></div>');
  VIBES.forEach(([n, c]) => {
    const b = h(`<button class="vibe ${moodState.vibe === n ? 'on' : ''}" style="--c:${c}"><span>${n}</span></button>`);
    b.onclick = () => { moodState.vibe = n; $$('.vibe', vibes).forEach(x => x.classList.toggle('on', x === b)); find(); };
    vibes.appendChild(b);
  });
  const field = (label, el) => { const f = h(`<div class="mfield"><label>${label}</label></div>`); f.appendChild(el); opts.appendChild(f); };
  field('Vibe', vibes);
  field('Watching with', segmented([['solo', 'Just me'], ['date', 'Date night'], ['friends', 'Friends'], ['family', 'Family']], moodState.who, v => { moodState.who = v; find(); }));
  field('Time', segmented([['any', 'Any'], ['short', '< 100 min'], ['mid', '< 2 hrs'], ['long', 'Epic']], moodState.len, v => { moodState.len = v; find(); }));
  const row = h('<div class="mrow"></div>');
  row.appendChild(segmented([['all', 'Mix'], ...typeOpts], moodState.type, v => { moodState.type = v; find(); }));
  row.appendChild(glassSelect('Era', [['any', 'Any time'], ['new', 'Last 5 years'], ['2010', '2010s'], ['2000', '2000s'], ['1990', '1990s'], ['1980', '1980s'], ['old', 'Before 1980']], moodState.era, v => { moodState.era = v; find(); }));
  field('Type & era', row);

  // Build the TMDB query for the current choices.
  function query(sort, page, minVotes, t = moodState.type === 'all' ? 'movie' : moodState.type) {
    const y = new Date().getFullYear();
    const rule = VIBES.find(v => v[0] === moodState.vibe)[2][t];
    const co = COMPANY[moodState.who];
    const wanted = new Set([...(rule.all || []), ...(rule.any || [])]);
    const not = [...new Set([...(rule.not || []), ...co.not])].filter(g => !wanted.has(g)); // never exclude what the vibe asks for
    const p = { sort_by: sort, page, 'vote_count.gte': minVotes, 'vote_average.gte': t === 'tv' ? 6.6 : 6.3, without_genres: not.join(',') };
    p.with_genres = rule.all ? rule.all.join(',') : rule.any.join('|');
    const dk = t === 'tv' ? 'first_air_date' : 'primary_release_date';
    const era = { new: [y - 5, y], 2010: [2010, 2019], 2000: [2000, 2009], 1990: [1990, 1999], 1980: [1980, 1989], old: [1900, 1979] }[moodState.era];
    if (era) { p[`${dk}.gte`] = `${era[0]}-01-01`; p[`${dk}.lte`] = `${Math.min(era[1], y)}-12-31`; }
    else p[`${dk}.lte`] = today();
    if (t === 'movie') {
      if (moodState.len === 'short') p['with_runtime.lte'] = 100;
      if (moodState.len === 'mid') p['with_runtime.lte'] = 120;
      if (moodState.len === 'long') p['with_runtime.gte'] = 140;
      if (moodState.who === 'family') { p.certification_country = 'US'; p['certification.lte'] = 'PG'; }
    } else if (moodState.len === 'short') p['with_runtime.lte'] = 35;
    return { p, rule, co, wanted };
  }

  async function find() {
    res.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';
    // Mix = films and shows ranked separately, then woven together at about one show per five.
    const types = moodState.type === 'all' ? ['movie', 'tv'] : [moodState.type];
    const lists = await Promise.all(types.map(rankFor));
    moodState.ranked = types.length > 1 ? Recs.weave(lists[0], lists[1], .2) : lists[0];
    // Rotate the top three among the strongest matches so the same mood doesn't always lead with the same title.
    moodState.ranked = Recs.vary(moodState.ranked, `mood:${moodState.type}:${moodState.vibe}:${moodState.who}`, 3, x => `${x.m.type}:${x.m.id}`);
    moodState.shown = 0;
    paint();
  }
  async function rankFor(t) {
    const base = t === 'tv' ? 120 : 300;
    const { co, wanted } = query('vote_count.desc', 1, 0, t);
    const minV = Math.round(base * co.votes);
    let pool = [];
    try {
      // Crowd favorites (most-rated) plus the best-rated within the mood, then de-duplicated.
      const reqs = [1, 2, 3].map(pg => TMDB.list(`/discover/${t}`, query('vote_count.desc', pg, minV, t).p, t))
        .concat([1, 2].map(pg => TMDB.list(`/discover/${t}`, query('vote_average.desc', pg, Math.max(minV, base * 2), t).p, t)));
      pool = (await Promise.all(reqs)).flat().filter((m, i, a) => a.findIndex(x => x.id === m.id) === i);
    } catch {}
    pool = notSeenYet(pool);
    // Rank: quality + popularity + mood fit (+ company boosts) + your taste + a lift for titles already picked for you.
    const taste = Recs.genreTaste();
    const mine = new Set(((Recs.cache && Recs.cache.forYou) || []).map(x => `${x.type}:${x.id}`));
    return pool.map(m => {
      const g = m.genreIds || [];
      const quality = Math.min(1.2, Math.max(0, ((m.vote || 0) - 6) / 2.5));
      const pop = Math.min(1, Math.log10(Math.max(10, m.votes || 0)) / 4.6);
      const moodFit = g.filter(x => wanted.has(x)).length * .12;
      const boost = Math.min(.3, g.filter(x => co.boost.includes(x)).length * .12);
      // The mood still decides what qualifies; within it, your taste now genuinely moves things.
      const personal = Math.max(-.25, Math.min(.25, g.reduce((a, x) => a + (taste[TMDB.genreName(t, x)] || 0), 0) / Math.max(1, g.length) * .3));
      const picked = mine.has(`${m.type}:${m.id}`) ? .22 : 0;
      const s = .45 * quality + (moodState.who === 'friends' ? .45 : .32) * pop + moodFit + boost + personal + picked;
      return { m, s, why: picked ? 'Picked for you' : pop > .8 ? `Crowd favorite · ${(m.votes || 0).toLocaleString()} ratings` : quality > .8 ? `Critically loved · TMDB ${m.vote.toFixed(1)}` : `Great fit for ${moodState.vibe.toLowerCase()}` };
    }).sort((a, b) => b.s - a.s);
  }

  function paint() {
    res.innerHTML = '';
    const all = moodState.ranked;
    if (!all.length) { res.innerHTML = '<div class="center-empty glass-empty"><h3>Nothing new matched</h3>Try another era, time or company.</div>'; return; }
    const list = all.slice(moodState.shown, moodState.shown + 15);
    const who = { solo: '', date: ' for date night', friends: ' with friends', family: ' for the family' }[moodState.who];
    const head = h(`<div class="res-head"><div><b>${esc(moodState.vibe)}${who}</b> <span class="dim">· ${all.length} you haven’t seen</span></div><button class="btn small ghost">${ICON.shuffle} More picks</button></div>`);
    // "More picks" walks down the ranked list instead of reshuffling into weaker titles.
    $('button', head).onclick = () => { moodState.shown = moodState.shown + 15 >= all.length ? 0 : moodState.shown + 15; paint(); };
    res.appendChild(head);
    const top = h('<div class="top3"></div>');
    list.slice(0, 3).forEach(({ m, why }, n) => {
      const c = h(`<div class="pick3" style="animation-delay:${n * 70}ms"><div class="p3-bg" style="background-image:url('${TMDB.img(m.backdrop, 'w780')}')"></div>
        <div class="p3-body"><div class="eyebrow">${n === 0 && moodState.shown === 0 ? 'Best match' : esc(why)}</div><h3>${esc(m.title)}</h3>
        <div class="dim">${esc([m.year, (m.genreIds || []).map(g => TMDB.genreName(m.type, g)).filter(Boolean).slice(0, 2).join(', '), `TMDB ${m.vote.toFixed(1)}`].filter(Boolean).join(' · '))}</div>
        <div class="btns"><button class="btn small primary pl">${ICON.playSm} ${m.type === 'tv' ? 'Watch' : 'Play'}</button><button class="btn small round wl" title="Add to watchlist">${ICON.bookmark}</button></div></div></div>`);
      c.onclick = () => go('detail', { type: m.type, id: m.id });
      $('.pl', c).onclick = (e) => { e.stopPropagation(); m.type === 'movie' ? Playback.start(m) : go('detail', { type: m.type, id: m.id }); };
      $('.wl', c).onclick = (e) => { e.stopPropagation(); const r = Store.toggleWatchlist(m); e.currentTarget.innerHTML = r.watchlist ? ICON.bookmarkFill : ICON.bookmark; toast(r.watchlist ? 'Added to watchlist' : 'Removed'); };
      withMenu(c, m, $('.btns', c), 'inline');
      top.appendChild(c);
    });
    res.appendChild(top);
    if (list.length > 3) {
      res.appendChild(h('<div class="res-sub">More picks</div>'));
      const g = h('<div class="grid mini-grid"></div>');
      list.slice(3).forEach(({ m }, n) => { const c = posterCard(m, { sub: [m.year, `TMDB ${m.vote.toFixed(1)}`].join(' · ') }); c.style.animationDelay = `${n * 25}ms`; g.appendChild(c); });
      res.appendChild(g);
    }
  }
  find();
}

// =====================================================================
// Rank (This or That, Elo)
// =====================================================================
const rk = Fresh.keep('rank', { type: 'movie', scope: 'all', prevRanks: {} }, ['prevRanks']);
function dRank(main) {
  const items = Store.values().filter(i => i.watched && i.poster && i.type === rk.type);
  const decades = [...new Set(items.map(i => i.year && i.year.slice(0, 3) + '0').filter(Boolean))].sort().reverse();
  const gcount = {};
  items.forEach(i => (i.genres || []).forEach(g => (gcount[g] = (gcount[g] || 0) + 1)));
  const genres = Object.entries(gcount).filter(([, c]) => c >= 4).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
  const scopes = [['all', `All ${rk.type === 'tv' ? 'shows' : 'films'}`], ['fav', 'Rated 4★ and up'], ...genres.map(g => [`g:${g}`, g]), ...decades.map(d => [`d:${d}`, `${d}s`])];
  if (!scopes.some(s => s[0] === rk.scope)) rk.scope = 'all';
  const saveBtn = h(`<button class="btn small">${ICON.listPlus} Save as list</button>`);
  dHead(main, 'Rank', 'Pick the one you like more. Every choice refines a true all-time ranking — your top picks feed recommendations.', [
    segmented(typeOpts, rk.type, v => { rk.type = v; rk.scope = 'all'; discGo(); }),
    glassSelect('Rank', scopes, rk.scope, v => { rk.scope = v; discGo(); }),
    saveBtn,
  ]);
  const inScope = (i) => rk.scope === 'all' || (rk.scope === 'fav' ? (i.rating || 0) >= 4 : rk.scope.startsWith('g:') ? (i.genres || []).includes(rk.scope.slice(2)) : (i.year || '').slice(0, 3) + '0' === rk.scope.slice(2));
  let pool = items.filter(inScope);
  if (pool.length < 4) {
    main.appendChild(h(`<div class="center-empty glass-empty"><div class="empty-ico">${ICON.layers}</div><h3>Need at least 4 ${rk.type === 'tv' ? 'shows' : 'films'} here</h3>Mark more in Seen It, or choose a wider ranking.</div>`));
    return;
  }
  const elo = (i) => i.elo || 1500;
  const wrap = h(`<div class="rank"><div class="rank-stage"><div class="tot"></div><div class="rank-foot"><button class="btn small ghost sk">${ICON.skip} Skip <kbd>↓</kbd></button><span class="dim">← / → to pick</span></div></div>
    <aside class="rank-side"><div class="conf"><div class="conf-top"><b>Ranking confidence</b><span></span></div><div class="bar"><i></i></div></div><div class="rank-list"></div></aside></div>`);
  main.appendChild(wrap);
  let a, b;
  const pickPair = () => {
    // Favor films with few matchups, against similarly scored opponents.
    const s = [...pool].sort((x, y) => (x.duels || 0) - (y.duels || 0) + (Math.random() - .5) * 3);
    a = s[0];
    b = pool.filter(x => x !== a).sort((x, y) => Math.abs(elo(x) - elo(a)) - Math.abs(elo(y) - elo(a)) + (Math.random() - .5) * 60).slice(0, 5)[Math.floor(Math.random() * Math.min(5, pool.length - 1))];
  };
  const paintSide = () => {
    const ranked = pool.filter(i => i.duels).sort((x, y) => elo(y) - elo(x));
    const total = pool.reduce((s, i) => s + (i.duels || 0), 0) / 2, need = pool.length * 3;
    const pct = Math.min(100, Math.round((total / need) * 100));
    $('.conf span', wrap).textContent = `${pct}%`;
    $('.conf i', wrap).style.width = `${pct}%`;
    const box = $('.rank-list', wrap);
    box.innerHTML = ranked.length ? '' : '<div class="dim" style="padding:12px">Your ranking appears here as you pick.</div>';
    ranked.slice(0, 12).forEach((i, n) => {
      const k = `${i.type}:${i.id}`, prev = rk.prevRanks[k];
      const mv = prev == null ? '' : prev > n ? `<em class="up">▲${prev - n}</em>` : prev < n ? `<em class="dn">▼${n - prev}</em>` : '';
      const r = h(`<div class="rl"><b>${n + 1}</b><img src="${TMDB.img(i.poster, 'w92')}"><div class="t">${esc(i.title)}<small>${esc(i.year || '')}</small></div>${mv}</div>`);
      r.onclick = () => go('detail', { type: i.type, id: i.id });
      box.appendChild(r);
    });
    rk.prevRanks = Object.fromEntries(ranked.map((i, n) => [`${i.type}:${i.id}`, n]));
  };
  const render = () => {
    pickPair();
    const t = $('.tot', wrap);
    t.innerHTML = '';
    const card = (m) => h(`<div class="pick"><div class="poster" style="background-image:url('${TMDB.img(m.poster, 'w500')}')"></div><h3>${esc(m.title)}</h3><div class="dim">${esc(m.year || '')}${m.rating ? ` · ★ ${m.rating}` : ''}</div></div>`);
    const ca = card(a), cb = card(b);
    ca.onclick = () => choose(a, b, ca);
    cb.onclick = () => choose(b, a, cb);
    t.append(ca, h('<div class="vs">or</div>'), cb);
  };
  const choose = (w, l, el) => {
    const ew = elo(w), el2 = elo(l), exp = 1 / (1 + 10 ** ((el2 - ew) / 400)), K = (w.duels || 0) < 5 ? 40 : 24;
    Store.upsert(w, { elo: ew + K * (1 - exp), duels: (w.duels || 0) + 1 });
    Store.upsert(l, { elo: el2 - K * (1 - exp), duels: (l.duels || 0) + 1 });
    pool = pool.map(p => Store.item(`${p.type}:${p.id}`));
    el && el.classList.add('chosen');
    Recs.cache = null;
    setTimeout(() => { render(); paintSide(); }, 240);
  };
  $('.sk', wrap).onclick = render;
  saveBtn.onclick = () => {
    const ranked = pool.filter(i => i.duels).sort((x, y) => elo(y) - elo(x));
    if (ranked.length < 3) return toast('Make a few more picks first', true);
    const name = `My ranking — ${scopes.find(s => s[0] === rk.scope)[1]}`;
    let l = Store.data.lists.find(x => x.name === name);
    if (!l) { l = { id: uid(), name, desc: 'Built with Rank in Discover', ranked: true, keys: [], createdAt: Date.now() }; Store.data.lists.push(l); }
    l.keys = ranked.map(i => `${i.type}:${i.id}`);
    Store.save(); toast(`Saved “${name}” to your lists`);
  };
  keyHandler((e) => {
    if (typing(e)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); choose(a, b, $('.tot .pick', wrap)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); choose(b, a, $$('.tot .pick', wrap)[1]); }
    if (e.key === 'ArrowDown') { e.preventDefault(); render(); }
  });
  render(); paintSide();
}

// =====================================================================
// This or That — "which would you rather watch?" Works for things you haven't seen, so it builds a taste
// profile fast. Each answer nudges genre leanings and leans toward / away from the exact titles.
// =====================================================================
const totState = { session: 0, pool: null, recent: [] };
const genresOf = (m) => (m.genreIds || []).map(id => TMDB.genreName(m.type, id)).filter(Boolean);
function totRecord(w, l, kind = 'pick') {
  const tot = Store.data.tot = Store.data.tot || {};
  const clamp = (g) => (tot[g] = Math.max(-4, Math.min(4, tot[g])));
  const gw = w ? genresOf(w) : [], gl = l ? genresOf(l) : [];
  const delta = kind === 'both' ? [.3, .3] : kind === 'neither' ? [-.2, -.2] : [.5, -.3];
  gw.forEach(g => { if (kind !== 'pick' || !gl.includes(g)) { tot[g] = (tot[g] || 0) + delta[0]; clamp(g); } });
  gl.forEach(g => { if (kind !== 'pick' || !gw.includes(g)) { tot[g] = (tot[g] || 0) + delta[1]; clamp(g); } });
  const lean = (m, d) => { if (!m) return; const it = Store.item(`${m.type}:${m.id}`) || {}; Store.upsert(m, { lean: Math.max(-3, Math.min(3, (it.lean || 0) + d)) }); };
  if (kind === 'pick') { lean(w, 1); lean(l, -1); } else if (kind === 'both') { lean(w, .5); lean(l, .5); } else { lean(w, -.5); lean(l, -.5); }
  Store.data.totCount = (Store.data.totCount || 0) + 1;
  Recs.cache = null;
  Store.save();
  return kind === 'pick' ? gw.filter(g => !gl.includes(g)) : [];
}
async function dThisThat(main) {
  dHead(main, 'This or That', 'Which would you rather watch tonight? You don’t need to have seen them — every answer teaches Reel your taste.');
  const wrap = h(`<div class="tt"><div class="tt-stage"><div class="spinner" style="margin:120px auto"></div></div>
    <aside class="tt-side"><div class="tt-strength"></div><div class="tt-lean"></div></aside></div>`);
  main.appendChild(wrap);
  const stage = $('.tt-stage', wrap), side = $('.tt-side', wrap);
  if (!totState.pool) {
    let pool = [];
    try { pool = await Recs.pool({ mode: 'watch', shows: .2 }); } catch {}
    // Add plain popular titles so it isn't only things the recommender already likes.
    try { const s = await Recs.sources('movie'); pool = pool.concat([...s.popular, ...s.greats].filter(m => m.backdrop && m.vote >= 6.5 && Recs.mainstream(m) && !Recs.excluded().has(`movie:${m.id}`))); } catch {}
    totState.pool = pool.filter((m, i, a) => a.findIndex(x => x.id === m.id && x.type === m.type) === i);
  }
  const pool = totState.pool;
  if (pool.length < 6) { stage.innerHTML = '<div class="center-empty glass-empty"><h3>Not enough titles to compare yet</h3>Check your connection and try again.</div>'; return; }
  let a, b;
  const pickPair = () => {
    const recent = new Set(totState.recent);
    const avail = pool.filter(m => !recent.has(`${m.type}:${m.id}`));
    const src = avail.length >= 6 ? avail : pool;
    a = src[Math.floor(Math.random() * Math.min(src.length, 80))];
    // The other one: different main genre (so the answer says something), similar quality.
    const ga = genresOf(a)[0];
    const cands = src.filter(m => m !== a && genresOf(m)[0] !== ga && Math.abs((m.vote || 7) - (a.vote || 7)) < 1.2);
    b = (cands.length ? cands : src.filter(m => m !== a))[Math.floor(Math.random() * Math.min(cands.length || src.length - 1, 40))];
    totState.recent = [`${a.type}:${a.id}`, `${b.type}:${b.id}`, ...totState.recent].slice(0, 40);
  };
  const card = (m, side) => {
    const it = Store.item(`${m.type}:${m.id}`) || {};
    const c = h(`<button class="tt-card ${side}"><div class="tt-art" style="background-image:url('${TMDB.img(m.backdrop, 'w1280')}')"></div><div class="tt-shade"></div>
      <div class="tt-body"><div class="tt-kicker">${esc([m.type === 'tv' ? 'Series' : 'Film', m.year, genresOf(m).slice(0, 2).join(' · ')].filter(Boolean).join(' · '))}</div>
        <div class="tt-logo"><h2>${esc(m.title)}</h2></div><p>${esc(m.overview || '')}</p>
        <div class="tt-foot"><span class="tt-key">${side === 'l' ? '←' : '→'}</span><span class="tt-wl ${it.watchlist ? 'on' : ''}" title="Add to watchlist">${it.watchlist ? ICON.bookmarkFill : ICON.bookmark}</span></div></div></button>`);
    TMDB.logo(m.type, m.id).then(p => { if (p && c.isConnected) $('.tt-logo', c).innerHTML = `<img src="${TMDB.img(p, 'w500')}" alt="${esc(m.title)}">`; }).catch(() => {});
    withMenu(c, m, $('.tt-foot', c), 'inline');
    $('.tt-wl', c).onclick = (e) => { e.stopPropagation(); const r = Store.toggleWatchlist(m); e.currentTarget.classList.toggle('on', !!r.watchlist); e.currentTarget.innerHTML = r.watchlist ? ICON.bookmarkFill : ICON.bookmark; toast(r.watchlist ? `Added ${m.title} to your watchlist` : 'Removed from watchlist'); };
    return c;
  };
  const paintSide = () => {
    const st = Recs.strength();
    side.querySelector('.tt-strength').innerHTML = `<div class="ps-mini"><div class="ps-top"><b>Taste profile</b><span>${st.level}</span></div><div class="ps-bar"><i style="width:${st.score}%"></i></div>
      <small>${totState.session} answered this session · ${(Store.data.totCount || 0).toLocaleString()} all time</small></div>`;
    const lean = Object.entries(Store.data.tot || {}).sort((x, y) => y[1] - x[1]);
    side.querySelector('.tt-lean').innerHTML = lean.length ? `<div class="tt-lh">You lean toward</div>${lean.slice(0, 5).map(([g, v]) => `<div class="tt-g"><span>${esc(g)}</span><i style="--w:${Math.min(100, Math.abs(v) / 4 * 100)}%" class="${v >= 0 ? 'pos' : 'neg'}"></i></div>`).join('')}
      ${lean.length > 5 && lean[lean.length - 1][1] < 0 ? `<div class="tt-lh" style="margin-top:14px">Less into</div>${lean.slice(-3).reverse().filter(([, v]) => v < 0).map(([g, v]) => `<div class="tt-g"><span>${esc(g)}</span><i style="--w:${Math.min(100, Math.abs(v) / 4 * 100)}%" class="neg"></i></div>`).join('')}` : ''}`
      : '<div class="dim" style="font-size:13px">Your leanings show up here as you answer.</div>';
  };
  const render = () => {
    pickPair();
    stage.innerHTML = '';
    const ca = card(a, 'l'), cb = card(b, 'r');
    ca.onclick = () => choose('pick', a, b, ca);
    cb.onclick = () => choose('pick', b, a, cb);
    const mid = h(`<div class="tt-or">or</div>`);
    const row = h('<div class="tt-row"></div>'); row.append(ca, mid, cb);
    const foot = h(`<div class="tt-actions"><button class="btn small ghost both">${ICON.heart} Both <kbd>↑</kbd></button><button class="btn small ghost neither">${ICON.x} Neither <kbd>↓</kbd></button><button class="btn small ghost skip">${ICON.skip} Skip <kbd>Space</kbd></button></div>`);
    $('.both', foot).onclick = () => choose('both', a, b);
    $('.neither', foot).onclick = () => choose('neither', a, b);
    $('.skip', foot).onclick = () => render();
    stage.append(row, foot, h('<div class="tt-note"></div>'));
  };
  const choose = (kind, w, l, el) => {
    const boosted = totRecord(w, l, kind);
    totState.session++;
    if (el) { el.classList.add('chosen'); (el === $('.tt-card.l', stage) ? $('.tt-card.r', stage) : $('.tt-card.l', stage)).classList.add('lost'); }
    const note = $('.tt-note', stage);
    if (note) note.textContent = kind === 'pick' ? (boosted.length ? `Noted — a little more ${boosted.slice(0, 2).join(' & ').toLowerCase()}` : `Noted — ${w.title}`) : kind === 'both' ? 'Noted — both are your kind of thing' : 'Noted — neither is for you';
    paintSide();
    setTimeout(render, 420);
  };
  keyHandler((e) => {
    if (typing(e)) return;
    const k = e.key;
    if (k === 'ArrowLeft') { e.preventDefault(); choose('pick', a, b, $('.tt-card.l', stage)); }
    else if (k === 'ArrowRight') { e.preventDefault(); choose('pick', b, a, $('.tt-card.r', stage)); }
    else if (k === 'ArrowUp') { e.preventDefault(); choose('both', a, b); }
    else if (k === 'ArrowDown') { e.preventDefault(); choose('neither', a, b); }
    else if (k === ' ') { e.preventDefault(); render(); }
  });
  render(); paintSide();
}

// =====================================================================
// Taste Profile
// =====================================================================
const tp = Fresh.keep('taste', { type: 'movie', bin: null });
// Taste Profile — draws instantly from your own library (crowd scores, directors and cast are filled in the
// background by Recs.backfill), and refreshes itself as that fill progresses.
async function dTaste(main) {
  dHead(main, 'Taste Profile', 'What your ratings say about you.', [segmented([['movie', 'Movies'], ['tv', 'Shows'], ['all', 'Everything']], tp.type, v => { tp.type = v; tp.bin = null; discGo(); })]);
  const wrap = h('<div class="tp2"></div>');
  main.appendChild(wrap);
  // Fit the whole profile to the window (cards scroll inside); small windows fall back to a normal scrolling page.
  const fit = () => {
    if (!wrap.isConnected) return;
    const v = $('#view');
    wrap.style.height = '';
    if (!wrap.classList.contains('fit') || innerWidth < 1150) return;
    const top = wrap.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop;
    const ht = v.clientHeight - top - 20;
    wrap.style.height = ht + 'px';
    const over = v.scrollHeight - v.clientHeight;
    if (over > 0) wrap.style.height = (ht - over) + 'px';
    // Window too short for everything: let the page grow (and scroll) instead of squashing the cards.
    if (wrap.scrollHeight > wrap.clientHeight + 1) wrap.style.height = wrap.scrollHeight + 'px';
  };
  const draw = () => { const y = $('#view').scrollTop; wrap.innerHTML = ''; tasteBody(wrap); fit(); $('#view').scrollTop = y; };
  draw();
  let t;
  const onFill = () => { if (!wrap.isConnected) return; clearTimeout(t); t = setTimeout(draw, 600); };
  window.addEventListener('reel:backfill', onFill);
  window.addEventListener('resize', fit);
  onLeave(() => { window.removeEventListener('reel:backfill', onFill); window.removeEventListener('resize', fit); clearTimeout(t); });
  if (!Recs.fill.running && Store.values().some(i => i.watched && (i.crowd === undefined || !i.people))) Recs.backfill();
}
const TPI = {
  cal: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3zm12 8H5v9h14zM5 8h14V6H5z"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2s5 4.6 5 10a5 5 0 0 1-10 0c0-2 1-3.6 1-3.6s.4 2.6 2.6 2.6C10.6 7.4 12 2 12 2zm0 20a8 8 0 0 1-8-8c0-1.9.6-3.6 1.6-5 .1 3 2.3 5 2.3 5S7 10.4 9.5 7A6 6 0 0 0 8 11a4 4 0 0 0 8 0c0-1.6-.5-3-1.3-4.3A8 8 0 0 1 20 14a8 8 0 0 1-8 8z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  chart: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 19h16v2H2V3h2zm3-3V9h3v7zm5 0V5h3v11zm5 0v-5h3v5z"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 3v4.6l3.5 2-1 1.7L11 12.7V7z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.6 9.3 11.3l4 4 5.3-5.3L16 7.4V7h6v6l-1.4-1.4-7.3 7.3-4-4-4.9 4.9z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 6.4 9.3 12.7l4-4 5.3 5.3L16 16.6v.4h6v-6l-1.4 1.4-7.3-7.3-4 4-4.9-4.9z"/></svg>',
};const tpStars = (r) => '★'.repeat(Math.floor(r)) + (r % 1 ? '½' : '');
function tasteBody(wrap) {
  const noun = tp.type === 'tv' ? 'shows' : tp.type === 'all' ? 'titles' : 'films';
  const items = Store.values().filter(i => i.watched && (tp.type === 'all' || i.type === tp.type));
  if (items.length < 5) {
    wrap.appendChild(h(`<div class="center-empty glass-empty"><div class="empty-ico">${ICON.user}</div><h3>Not enough to go on yet</h3>Mark at least 5 ${noun} you’ve watched (Seen It takes a minute) and your profile appears here.</div>`));
    return;
  }
  wrap.classList.add('fit');
  const rated = items.filter(i => i.rating);
  const views = {}; Store.data.diary.forEach(e => (views[e.key] = (views[e.key] || 0) + 1));
  const vOf = (i) => Math.max(1, views[`${i.type}:${i.id}`] || 1);
  const avg = rated.length ? rated.reduce((a, i) => a + i.rating, 0) / rated.length : 0;
  const crowd = rated.filter(i => i.crowd);
  const gap = crowd.length ? crowd.reduce((a, i) => a + (i.rating - i.crowd), 0) / crowd.length : 0;
  const bins = Array.from({ length: 10 }, (_, k) => (k + 1) / 2), cnt = bins.map(b => rated.filter(i => Math.abs(i.rating - b) < .01).length);
  const peak = Math.max(1, ...cnt), sweet = bins[cnt.indexOf(Math.max(...cnt))];
  const hours = Math.round(items.reduce((a, i) => a + (i.runtime || (i.type === 'movie' ? 105 : 0)) * vOf(i), 0) / 60);
  const rewatched = items.filter(i => vOf(i) > 1);
  const fillRunning = Recs.fill.running && Recs.fill.total > 0;

  // 1) Summary
  const style = !crowd.length ? null : gap > 0.35 ? 'generous' : gap < -0.35 ? 'tough' : 'fair';
  const line = style ? `You’re a ${style} critic.` : 'Here’s your taste so far.';
  const bits = [];
  if (style) bits.push(`You rate ${noun} <b>${Math.abs(gap).toFixed(1)}★ ${gap >= 0 ? 'higher' : 'lower'}</b> than most people`);
  if (rated.length) bits.push(`your sweet spot is <b>${tpStars(sweet)}</b>`);
  const sentence = bits.length ? bits.join(', and ') + '.' : '';
  const tile = (v, l) => `<div class="tp2-tile"><b>${v}</b><span>${l}</span></div>`;
  wrap.appendChild(h(`<section class="tp2-hero">
    <div class="tp2-hero-t"><div class="tp2-eye">Your taste</div><h2>${line}</h2><p>${sentence}</p>
      ${fillRunning ? `<div class="tp2-fill"><span class="spinner sm"></span>Analyzing your library · ${Recs.fill.done.toLocaleString()} of ${Recs.fill.total.toLocaleString()}</div>` : ''}</div>
    <div class="tp2-tiles">${tile(items.length.toLocaleString(), noun[0].toUpperCase() + noun.slice(1))}${tile(hours.toLocaleString(), 'Hours watched')}${tile(avg ? avg.toFixed(2) : '–', 'Average rating')}
      ${tile(crowd.length ? `${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(2)}` : '…', 'vs. the crowd')}${tile(rated.filter(i => i.rating >= 4.5).length.toLocaleString(), 'Rated 4½+')}${rewatched.length ? tile(rewatched.length.toLocaleString(), 'Rewatched') : tile(items.filter(i => i.liked).length.toLocaleString(), 'Liked')}</div>
  </section>`));

  // 2) Ratings — Letterboxd-style spread; click a bar to show those films in the poster card
  let histCard = null;
  if (rated.length) {
    histCard = h(`<section class="tp2-card tp2-hist"><div class="tp2-card-h"><h3>Ratings</h3><span>${rated.length.toLocaleString()}</span></div>
      <div class="tp2-histrow"><span class="tp2-s1">★</span><div class="tp2-bars">${bins.map((b, k) => `<button class="tp2-bar ${tp.bin === b ? 'on' : ''} ${b === sweet ? 'peak' : ''}" data-b="${b}" data-tip="${tpStars(b)} · ${cnt[k].toLocaleString()} ${cnt[k] === 1 ? noun.slice(0, -1) : noun} · ${Math.round(cnt[k] / rated.length * 100)}%"><i style="height:${Math.max(2, cnt[k] / peak * 100)}%"></i></button>`).join('')}</div><span class="tp2-s5">★★★★★</span></div></section>`);
    wrap.appendChild(histCard);
  }

  // 3) Your habits (from your diary; falls back to watched dates)
  const typeOk = (key) => tp.type === 'all' || key.startsWith(tp.type + ':');
  const logs = Store.data.diary.filter(e => e.date && typeOk(e.key)).map(e => ({ d: e.date, key: e.key, r: e.rating || (Store.data.items[e.key] || {}).rating || 0 }));
  if (!logs.length) items.forEach(i => { if (i.watchedAt) logs.push({ d: i.watchedAt, key: `${i.type}:${i.id}`, r: i.rating || 0 }); });
  if (logs.length >= 5) {
    const nowY = new Date().getFullYear();
    const perYear = {}; logs.forEach(l => { const y = +l.d.slice(0, 4); if (y) perYear[y] = (perYear[y] || 0) + 1; });
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDay = Array(7).fill(0); logs.forEach(l => { const d = new Date(l.d + 'T12:00:00'); if (!isNaN(d)) byDay[d.getDay()]++; });
    const favDay = byDay.indexOf(Math.max(...byDay));
    const byMonth = {}; logs.forEach(l => { const m = l.d.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
    const [bm, bmN] = Object.entries(byMonth).sort((a, b) => b[1] - a[1])[0] || [];
    const days = [...new Set(logs.map(l => l.d))].sort();
    let streak = 1, best = 1;
    for (let k = 1; k < days.length; k++) { const gap = (new Date(days[k]) - new Date(days[k - 1])) / 864e5; streak = gap === 1 ? streak + 1 : 1; best = Math.max(best, streak); }
    const thisYear = perYear[nowY] || 0, weeks = Math.max(1, (Date.now() - new Date(nowY, 0, 1)) / 6048e5);
    const runtimes = items.filter(i => i.runtime && i.type === 'movie').map(i => i.runtime);
    const avgRt = runtimes.length ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : 0;
    const avgOf = (y) => { const r = logs.filter(l => +l.d.slice(0, 4) === y && l.r).map(l => l.r); return r.length >= 5 ? r.reduce((a, b) => a + b, 0) / r.length : null; };
    const ra = avgOf(nowY), rb = avgOf(nowY - 1);
    const habit = (ic, label, value, sub) => `<div class="tp2-habit"><span class="tp2-hic">${ic}</span><div><span>${label}</span><b>${value}</b>${sub ? `<em>${sub}</em>` : ''}</div></div>`;
    wrap.appendChild(h(`<section class="tp2-card tp2-habits"><div class="tp2-card-h"><h3>Your habits</h3></div><div class="tp2-hgrid">
      ${habit(TPI.cal, 'Favorite day to watch', DAYS[favDay], `${Math.round(byDay[favDay] / logs.length * 100)}% of everything you log`)}
      ${bm ? habit(TPI.fire, 'Busiest month', new Date(bm + '-15').toLocaleDateString([], { month: 'long', year: 'numeric' }), `${bmN} ${noun}`) : ''}
      ${habit(TPI.bolt, 'Longest streak', `${best} day${best === 1 ? '' : 's'} in a row`, best > 1 ? 'watching something every day' : '')}
      ${habit(TPI.chart, `${nowY} so far`, `${thisYear} ${noun}`, `${(thisYear / weeks).toFixed(1)} a week`)}
      ${avgRt && tp.type !== 'tv' ? habit(TPI.clock, 'Average film length', `${Math.floor(avgRt / 60)}h ${avgRt % 60}m`, '') : ''}
      ${ra != null && rb != null ? habit(ra >= rb ? TPI.up : TPI.down, 'Rating vs. last year', `${ra >= rb ? '+' : '−'}${Math.abs(ra - rb).toFixed(2)}★`, `You’re rating ${ra >= rb ? 'higher' : 'lower'} than in ${nowY - 1}`) : ''}
    </div></section>`));
  } else if (histCard) histCard.classList.add('wide');

  // 4) You vs the crowd — each list scrolls inside its card
  const vsPanel = (title, sub, rows) => {
    const p = h(`<section class="tp2-card tp2-col"><div class="tp2-card-h"><h3>${title}</h3><span>${rows.length || ''}</span></div><p class="tp2-sub">${sub}</p><div class="tp2-vs tp2-scroll"></div></section>`);
    const box = $('.tp2-vs', p);
    if (!rows.length) box.appendChild(h(`<div class="tp2-none">${fillRunning ? 'Still analyzing your library…' : 'Nothing here yet.'}</div>`));
    rows.slice(0, 150).forEach((i) => {
      const d = i.rating - i.crowd;
      const r = h(`<button class="tp2-vrow"><img src="${TMDB.img(i.poster, 'w92')}" alt="" loading="lazy"><div><b>${esc(i.title)}</b><span>${esc(i.year || '')}</span></div><em class="you">${tpStars(i.rating)}</em><em class="crowd">${i.crowd.toFixed(1)}</em><em class="d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}</em></button>`);
      r.onclick = () => go('detail', { type: i.type, id: i.id });
      r.oncontextmenu = (e) => { e.preventDefault(); contextMenu(e.clientX, e.clientY, i); };
      box.appendChild(r);
    });
    return p;
  };
  wrap.appendChild(vsPanel('You loved more than most', 'Half a star or more above the crowd (TMDB).', crowd.filter(i => i.rating - i.crowd >= .5).sort((a, b) => (b.rating - b.crowd) - (a.rating - a.crowd))));
  wrap.appendChild(vsPanel('Your hot takes', 'Crowd favorites you rated half a star or more lower.', crowd.filter(i => i.crowd - i.rating >= .5).sort((a, b) => (b.crowd - b.rating) - (a.crowd - a.rating))));

  // 5) Poster card — Five-star club by default; clicking a ratings bar swaps it to that rating
  const pcard = h('<section class="tp2-card tp2-col tp2-fivec"><div class="tp2-card-h"><h3></h3><span></span></div><div class="tp2-five tp2-scroll"></div></section>');
  wrap.appendChild(pcard);
  const byNewest = (a, b) => String(b.watchedAt || '').localeCompare(String(a.watchedAt || ''));
  const paintPosters = () => {
    let films, title;
    if (tp.bin != null) { films = rated.filter(i => Math.abs(i.rating - tp.bin) < .01); title = `Rated <i class="tp2-st">${tpStars(tp.bin)}</i><button class="tp2-x" data-tip="Back to Five-star club">✕</button>`; }
    else { films = rated.filter(i => i.rating === 5); title = 'Five-star club'; if (!films.length) { films = rated.filter(i => i.rating >= 4.5); title = 'Your favorites'; } }
    films = films.filter(i => i.poster).sort(byNewest);
    $('h3', pcard).innerHTML = title;
    $('.tp2-card-h span', pcard).textContent = films.length ? films.length.toLocaleString() : '';
    const grid = $('.tp2-five', pcard); grid.innerHTML = ''; grid.scrollTop = 0;
    if (!films.length) grid.appendChild(h(`<div class="tp2-none">Nothing rated here yet.</div>`));
    films.forEach((m, k) => {
      const t = h(`<button class="tp2-fp" data-tip="${esc(m.title)}${m.year ? ` (${esc(m.year)})` : ''}" style="animation-delay:${Math.min(k, 20) * 18}ms"><img src="${TMDB.img(m.poster, 'w185')}" alt="" loading="lazy"></button>`);
      t.onclick = () => go('detail', { type: m.type, id: m.id });
      t.oncontextmenu = (e) => { e.preventDefault(); contextMenu(e.clientX, e.clientY, m); };
      grid.appendChild(t);
    });
    const x = $('.tp2-x', pcard);
    if (x) x.onclick = () => setBin(null);
  };
  const setBin = (v) => { tp.bin = v; if (histCard) $$('.tp2-bar', histCard).forEach(x => x.classList.toggle('on', +x.dataset.b === tp.bin)); paintPosters(); };
  if (histCard) $$('.tp2-bar', histCard).forEach(b => (b.onclick = () => { const v = +b.dataset.b; setBin(tp.bin === v ? null : v); }));
  paintPosters();
}
const DMODES = { foryou: dForYou, mood: dMood, seen: dSeen, tot: dThisThat, rank: dRank, taste: dTaste };
