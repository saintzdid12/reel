// Reel — Seen It: sort what you've watched with PACKS. A shelf of themed packs (franchises, studios, directors,
// stars, decades, genres, themes, and a few for shows), each with its own progress. Open a pack as a calm Grid
// (tap = seen, ♥ / 👎 on hover) or as a Swipe deck (→ seen · ↑ loved · ← not seen · ↓ watchlist).

// ---------- Marking ----------
function seenStateOf(m) {
  const it = Store.item(`${m.type}:${m.id}`) || {};
  if (!it.watched) return it.watchlist ? 'want' : it.notSeen ? 'notseen' : 'none';
  if (it.feedback === -1 || (it.rating && it.rating <= 2)) return 'meh';
  if (it.liked || (it.rating || 0) >= 4.5) return 'loved';
  return 'seen';
}
const packHistory = [];
function seenSet(m, state) {
  const k = `${m.type}:${m.id}`;
  packHistory.push({ m, prev: JSON.parse(JSON.stringify(Store.item(k) || null)) });
  if (packHistory.length > 300) packHistory.shift();
  // Bulk marking: no invented watch dates (stay undated like Letterboxd), no Activity-feed flood.
  const P = {
    none: { watched: false, notSeen: false, liked: false, feedback: 0, watchedAt: null, watchlist: false },
    notseen: { watched: false, notSeen: true, liked: false, feedback: 0, watchlist: false },
    want: { watched: false, notSeen: true, liked: false, feedback: 0, watchlist: true, watchlistAt: Date.now() },
    seen: { watched: true, notSeen: false, watchlist: false, liked: false, feedback: 0 },
    loved: { watched: true, notSeen: false, watchlist: false, liked: true, feedback: 0 },
    meh: { watched: true, notSeen: false, watchlist: false, liked: false, feedback: -1 },
  }[state];
  Store.upsert(m, P);
  Recs.cache = null;
}
function packUndo() {
  const h_ = packHistory.pop(); if (!h_) return null;
  const k = `${h_.m.type}:${h_.m.id}`;
  if (h_.prev) Store.data.items[k] = h_.prev; else delete Store.data.items[k];
  Store.data.rev = (Store.data.rev || 0) + 1; Store.save(); Recs.cache = null;
  return h_.m;
}

// ---------- The catalog ----------
// kinds: q (discover query), path (TMDB list path), col (collection by name), co (company by name),
// dir / act (person by name), kw (keyword by name). `all` = keep every language (Ghibli, anime, Bong…).
const PACK_CATS = [['general', 'General'], ['franchise', 'Franchises'], ['studio', 'Studios'], ['director', 'Directors'], ['star', 'Stars'], ['decade', 'Decades'], ['genre', 'Genres'], ['theme', 'Themes'], ['tv', 'Shows']];
const y0 = new Date().getFullYear();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const PACKS = [
  // General — the big, everybody packs
  { id: 'top50', cat: 'general', title: 'Top 50 of all time', sub: 'rated highest by the most people — the IMDb Top 250 crowd', q: { sort_by: 'vote_average.desc', 'vote_count.gte': 10000 }, pages: 3, max: 50 },
  { id: 'biggest', cat: 'general', title: 'Biggest movies ever', sub: 'the most-watched films of all time', q: { sort_by: 'vote_count.desc' }, pages: 3, max: 50 },
  { id: 'boxoffice', cat: 'general', title: 'Box office giants', sub: 'the highest-grossing films', q: { sort_by: 'revenue.desc' }, pages: 3, max: 50 },
  { id: 'greats', cat: 'general', title: 'All-time greats', sub: 'the highest-rated films', path: '/movie/top_rated', pages: 3, max: 50 },
  { id: 'thisyear', cat: 'general', title: `Biggest of ${y0}`, q: { sort_by: 'vote_count.desc', primary_release_year: y0, 'vote_count.gte': 100 }, pages: 2, max: 36 },
  { id: 'lastyear', cat: 'general', title: `Biggest of ${y0 - 1}`, q: { sort_by: 'vote_count.desc', primary_release_year: y0 - 1, 'vote_count.gte': 150 }, pages: 2, max: 36 },
  { id: 'recent', cat: 'general', title: 'Recent hits', sub: `big films since ${y0 - 3}`, q: { sort_by: 'vote_count.desc', 'primary_release_date.gte': `${y0 - 3}-01-01` }, pages: 2, max: 40 },
  { id: 'modern', cat: 'general', title: 'Modern classics', sub: 'beloved films from 1975–2005', q: { sort_by: 'vote_count.desc', 'vote_average.gte': 7.3, 'primary_release_date.gte': '1975-01-01', 'primary_release_date.lte': '2005-12-31' }, pages: 2, max: 40 },
  { id: 'acclaimed', cat: 'general', title: 'Acclaimed favorites', sub: 'critics and audiences agree', q: { sort_by: 'vote_count.desc', 'vote_average.gte': 7.8, 'primary_release_date.gte': `${y0 - 15}-01-01` }, pages: 2, max: 40 },
  { id: 'feelgood', cat: 'general', title: 'Feel-good favorites', q: { with_genres: '35|10751', without_genres: '27,53', 'vote_average.gte': 7, sort_by: 'vote_count.desc' }, pages: 2, max: 40 },
  { id: 'datenight', cat: 'general', title: 'Date night', q: { with_genres: '10749', 'vote_average.gte': 6.6, sort_by: 'vote_count.desc' }, pages: 2, max: 36 },
  { id: 'friends', cat: 'general', title: 'Friends’ movie night', q: { with_genres: '35|28|27', without_genres: '16,10751', sort_by: 'vote_count.desc' }, pages: 2, max: 40 },
  { id: 'familynight', cat: 'general', title: 'Family movie night', q: { with_genres: '10751', sort_by: 'vote_count.desc' }, pages: 2, max: 40 },
  { id: 'mind', cat: 'general', title: 'Mind-benders', q: { with_genres: '878|9648', 'vote_average.gte': 7.2, sort_by: 'vote_count.desc' }, pages: 2, max: 36 },
  { id: 'short', cat: 'general', title: 'Under 100 minutes', q: { 'with_runtime.lte': 100, 'with_runtime.gte': 70, sort_by: 'vote_count.desc' }, pages: 2, max: 40 },
  { id: 'epics', cat: 'general', title: 'Epic 3-hour movies', q: { 'with_runtime.gte': 165, sort_by: 'vote_count.desc' }, pages: 2, max: 30 },
  { id: 'childhood', cat: 'general', title: 'Childhood favorites', sub: 'family and animated hits, 1995–2012', q: { with_genres: '10751|16', 'primary_release_date.gte': '1995-01-01', 'primary_release_date.lte': '2012-12-31', sort_by: 'vote_count.desc' }, pages: 2, max: 40 },
  { id: 'oscar', cat: 'general', title: 'Award-season dramas', q: { with_genres: '18', 'vote_average.gte': 7.6, 'vote_count.gte': 5000, sort_by: 'vote_count.desc' }, pages: 2, max: 40 },
  { id: 'teen', cat: 'general', title: 'High school & teen movies', kw: 'high school', max: 36 },
  { id: 'tv-everyone', cat: 'general', type: 'tv', title: 'Shows everyone’s seen', q: { sort_by: 'vote_count.desc', without_genres: '10767,10763,10764' }, pages: 2, max: 40 },
  { id: 'tv-top', cat: 'general', type: 'tv', title: 'Top-rated shows', q: { sort_by: 'vote_average.desc', 'vote_count.gte': 3000, without_genres: '10767,10763,10764' }, pages: 2, max: 36 },
  // Franchises (TMDB collections, found by name)
  ...[['Harry Potter', 'Harry Potter Collection'], ['The Lord of the Rings', 'The Lord of the Rings Collection'], ['The Hobbit', 'The Hobbit Collection'], ['Star Wars', 'Star Wars Collection'],
    ['The Avengers', 'The Avengers Collection'], ['Iron Man', 'Iron Man Collection'], ['Captain America', 'Captain America Collection'], ['Thor', 'Thor Collection'],
    ['Guardians of the Galaxy', 'Guardians of the Galaxy Collection'], ['Spider-Man (MCU)', 'Spider-Man (Avengers) Collection'], ['Spider-Man (Raimi)', 'Spider-Man Collection'], ['Deadpool', 'Deadpool Collection'],
    ['X-Men', 'X-Men Collection'], ['The Dark Knight', 'The Dark Knight Collection'], ['Toy Story', 'Toy Story Collection'], ['Cars', 'Cars Collection'], ['Frozen', 'Frozen Collection'],
    ['Shrek', 'Shrek Collection'], ['Despicable Me', 'Despicable Me Collection'], ['Ice Age', 'Ice Age Collection'], ['Madagascar', 'Madagascar Collection'], ['Kung Fu Panda', 'Kung Fu Panda Collection'],
    ['How to Train Your Dragon', 'How to Train Your Dragon Collection'], ['Pirates of the Caribbean', 'Pirates of the Caribbean Collection'], ['Jurassic Park', 'Jurassic Park Collection'],
    ['Fast & Furious', 'The Fast and the Furious Collection'], ['Mission: Impossible', 'Mission: Impossible Collection'], ['John Wick', 'John Wick Collection'], ['Bourne', 'The Bourne Collection'],
    ['James Bond', 'James Bond Collection'], ['Indiana Jones', 'Indiana Jones Collection'], ['Back to the Future', 'Back to the Future Collection'], ['The Matrix', 'The Matrix Collection'],
    ['Alien', 'Alien Collection'], ['Terminator', 'The Terminator Collection'], ['Rocky', 'Rocky Collection'], ['The Godfather', 'The Godfather Collection'], ['Men in Black', 'Men in Black Collection'],
    ['Transformers', 'Transformers Collection'], ['The Hunger Games', 'The Hunger Games Collection'], ['Twilight', 'The Twilight Collection'], ['Dune', 'Dune Collection'],
    ['Scream', 'Scream Collection'], ['The Conjuring', 'The Conjuring Collection'], ['Home Alone', 'Home Alone Collection'], ['The Hangover', 'The Hangover Collection'], ['Jumanji', 'Jumanji Collection'], ['Die Hard', 'Die Hard Collection'],
  ].map(([title, name]) => ({ id: 'col-' + slug(name), cat: 'franchise', title, col: name, franchise: true })),
  // Studios
  ...[['Marvel Cinematic Universe', 'Marvel Studios', { 'primary_release_date.gte': '2008-01-01' }], ['Pixar', 'Pixar'], ['Disney Animation', 'Walt Disney Animation Studios'], ['DreamWorks Animation', 'DreamWorks Animation'],
    ['Studio Ghibli', 'Studio Ghibli', {}, true], ['Illumination', 'Illumination'], ['A24', 'A24'], ['Blumhouse', 'Blumhouse Productions'], ['Lucasfilm', 'Lucasfilm Ltd.'], ['Sony Pictures Animation', 'Sony Pictures Animation'],
  ].map(([title, name, q = {}, all]) => ({ id: 'co-' + slug(name), cat: 'studio', title, co: name, q, all, max: 45 })),
  // Directors
  ...['Christopher Nolan', 'Steven Spielberg', 'Quentin Tarantino', 'Martin Scorsese', 'David Fincher', 'Stanley Kubrick', 'Denis Villeneuve', 'Wes Anderson', 'Ridley Scott', 'James Cameron',
    'Edgar Wright', 'Jordan Peele', 'Greta Gerwig', 'Guy Ritchie', 'Tim Burton', 'Peter Jackson', 'Robert Zemeckis', 'Guillermo del Toro', 'Paul Thomas Anderson', 'Taika Waititi', 'M. Night Shyamalan', 'Joel Coen', 'Hayao Miyazaki', 'Bong Joon-ho',
  ].map(n => ({ id: 'dir-' + slug(n), cat: 'director', title: n, dir: n, all: ['Hayao Miyazaki', 'Bong Joon-ho'].includes(n) })),
  // Stars
  ...['Tom Hanks', 'Leonardo DiCaprio', 'Will Smith', 'Adam Sandler', 'Jim Carrey', 'Denzel Washington', 'Tom Cruise', 'Keanu Reeves', 'Brad Pitt', 'Robin Williams', 'Ryan Gosling', 'Dwayne Johnson',
    'Scarlett Johansson', 'Will Ferrell', 'Matt Damon', 'Christian Bale', 'Johnny Depp', 'Robert Downey Jr.', 'Ryan Reynolds', 'Hugh Jackman', 'Jake Gyllenhaal', 'Margot Robbie', 'Emma Stone', 'Zendaya',
  ].map(n => ({ id: 'act-' + slug(n), cat: 'star', title: n, act: n })),
  // Decades
  ...[1960, 1970, 1980, 1990, 2000, 2010, 2020].map(d => ({ id: `dec-${d}`, cat: 'decade', title: `${d}s hits`, sub: `the biggest films of ${d}–${String(d + 9).slice(2)}`, q: { sort_by: 'vote_count.desc', 'primary_release_date.gte': `${d}-01-01`, 'primary_release_date.lte': `${d + 9}-12-31` }, pages: 2, max: 40 })),
  // Genres
  ...[['Comedy classics', { with_genres: '35', without_genres: '16' }], ['Rom-coms', { with_genres: '35,10749' }], ['Horror hits', { with_genres: '27' }], ['Action blockbusters', { with_genres: '28' }],
    ['Sci-fi', { with_genres: '878' }], ['Animated favorites', { with_genres: '16' }], ['Thrillers', { with_genres: '53' }], ['Crime', { with_genres: '80' }],
    ['War films', { with_genres: '10752' }], ['Westerns', { with_genres: '37' }], ['Fantasy epics', { with_genres: '14' }], ['Mysteries', { with_genres: '9648' }], ['Dramas', { with_genres: '18' }], ['Adventure', { with_genres: '12' }],
  ].map(([title, q]) => ({ id: 'gen-' + slug(title), cat: 'genre', title, q: { ...q, sort_by: 'vote_count.desc' }, pages: 2, max: 40 })),
  // Themes (TMDB keywords, found by name)
  ...[['superhero', 'Superheroes'], ['time travel', 'Time travel'], ['heist', 'Heists'], ['zombie', 'Zombies'], ['dystopia', 'Dystopias'], ['sports', 'Sports movies'], ['christmas', 'Christmas'],
    ['based on true story', 'True stories'], ['space', 'Space'], ['coming of age', 'Coming of age'], ['survival', 'Survival'], ['serial killer', 'Serial killers'], ['artificial intelligence', 'A.I.'],
    ['spy', 'Spies'], ['martial arts', 'Martial arts'], ['based on video game', 'Video game movies'], ['vampire', 'Vampires'], ['post-apocalyptic future', 'Post-apocalyptic'], ['time loop', 'Time loops'], ['dinosaur', 'Dinosaurs'],
  ].map(([k, title]) => ({ id: 'kw-' + slug(k), cat: 'theme', title, kw: k, max: 40 })),
  // Shows — a handful
  { id: 'tv-sitcoms', cat: 'tv', type: 'tv', title: 'Sitcoms', q: { with_genres: '35', without_genres: '16,10764,10767', sort_by: 'vote_count.desc' }, pages: 2, max: 36 },
  { id: 'tv-prestige', cat: 'tv', type: 'tv', title: 'Prestige dramas', q: { with_genres: '18', without_genres: '16,10764,10766', sort_by: 'vote_average.desc', 'vote_count.gte': 1500 }, pages: 2, max: 36 },
  { id: 'tv-crime', cat: 'tv', type: 'tv', title: 'Crime & mystery shows', q: { with_genres: '80|9648', sort_by: 'vote_count.desc' }, pages: 2, max: 36 },
  { id: 'tv-scifi', cat: 'tv', type: 'tv', title: 'Sci-fi & fantasy shows', q: { with_genres: '10765', sort_by: 'vote_count.desc' }, pages: 2, max: 36 },
  { id: 'tv-animated', cat: 'tv', type: 'tv', title: 'Animated shows', q: { with_genres: '16', without_genres: '10762', sort_by: 'vote_count.desc' }, pages: 2, max: 36 },
  { id: 'tv-anime', cat: 'tv', type: 'tv', title: 'Anime', all: true, q: { with_genres: '16', with_original_language: 'ja', sort_by: 'vote_count.desc' }, pages: 2, max: 36 },
  { id: 'tv-kids', cat: 'tv', type: 'tv', title: 'Shows you grew up with', q: { with_genres: '10762|10751', sort_by: 'vote_count.desc', 'first_air_date.lte': '2012-12-31' }, pages: 1, max: 30 },
];

// ---------- Loading ----------
const Packs = {
  mem: {},
  ids(kind, name) { try { return JSON.parse(localStorage.getItem(`reel:pk:${kind}:${name}`) || 'null'); } catch { return null; } },
  saveId(kind, name, v) { try { localStorage.setItem(`reel:pk:${kind}:${name}`, JSON.stringify(v)); } catch {} },
  async resolve(kind, name, search, pick) {
    const c = this.ids(kind, name); if (c !== null) return c;
    let id = 0;
    try { const r = await TMDB.get(search, { query: name }); const hit = pick(r.results || []); id = hit ? hit.id : 0; } catch { return null; }
    this.saveId(kind, name, id);
    return id;
  },
  norm: (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  async items(p) {
    if (this.mem[p.id]) return this.mem[p.id];
    const run = (async () => {
      const type = p.type || 'movie';
      const P = (path, params, n) => Promise.all(Array.from({ length: n || 1 }, (_, i) => TMDB.list(path, { ...params, page: i + 1 }, type).catch(() => []))).then(r => r.flat());
      let list = [];
      if (p.path) list = await P(p.path, {}, p.pages);
      else if (p.q && !p.co) list = await P(`/discover/${type}`, { 'vote_count.gte': type === 'tv' ? 300 : 500, ...p.q }, p.pages);
      else if (p.col) {
        const id = await this.resolve('col', p.col, '/search/collection', rs => rs.find(r => this.norm(r.name) === this.norm(p.col)) || rs.find(r => this.norm(r.name).startsWith(this.norm(p.title))));
        if (id) { const c = await TMDB.get(`/collection/${id}`).catch(() => ({})); list = (c.parts || []).filter(x => x.release_date && x.release_date <= today()).sort((a, b) => a.release_date.localeCompare(b.release_date)).map(x => TMDB.meta(x, 'movie')); }
      } else if (p.co) {
        const id = await this.resolve('co', p.co, '/search/company', rs => rs.find(r => this.norm(r.name) === this.norm(p.co)) || rs[0]);
        if (id) list = await P('/discover/movie', { with_companies: id, sort_by: 'vote_count.desc', 'vote_count.gte': 200, ...(p.q || {}) }, 2);
      } else if (p.dir || p.act) {
        const name = p.dir || p.act;
        const id = await this.resolve('person', name, '/search/person', rs => rs.find(r => this.norm(r.name) === this.norm(name) && r.known_for_department === (p.dir ? 'Directing' : 'Acting')) || rs.find(r => this.norm(r.name) === this.norm(name)));
        if (id) {
          const c = await TMDB.get(`/person/${id}/movie_credits`).catch(() => ({}));
          const raw = p.dir ? (c.crew || []).filter(x => x.job === 'Director') : (c.cast || []).filter(x => (x.order ?? 99) <= 6);
          list = raw.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i && x.release_date && x.release_date <= today() && (x.vote_count || 0) >= 150)
            .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)).map(x => TMDB.meta(x, 'movie'));
        }
      } else if (p.kw) {
        const id = await this.resolve('kw', p.kw, '/search/keyword', rs => rs.find(r => r.name.toLowerCase() === p.kw));
        if (id) list = await P('/discover/movie', { with_keywords: id, sort_by: 'vote_count.desc', 'vote_count.gte': 300 }, 2);
      }
      list = list.filter((m, i, a) => m.poster && a.findIndex(x => x.id === m.id) === i && (p.franchise || p.dir || p.act || p.all || Recs.mainstream(m)));
      return list.slice(0, p.max || (p.franchise ? 30 : 40));
    })();
    this.mem[p.id] = run;
    run.catch(() => delete this.mem[p.id]);
    return run;
  },
  progress(list) {
    const marked = list.filter(m => !['none', 'notseen', 'want'].includes(seenStateOf(m))).length;
    const decided = list.filter(m => seenStateOf(m) !== 'none').length;
    return { marked, decided, total: list.length, done: list.length > 0 && decided === list.length };
  },
};

// ---------- Seen It page ----------
const packState = Fresh.keep('seen', { cat: 'general', q: '', open: null, view: 'grid', hideMarked: false });
async function dSeen(main) {
  if (packState.open) return packView(main, PACKS.find(p => p.id === packState.open));
  const it = Store.values();
  const seen = it.filter(i => i.watched).length, loved = it.filter(i => i.watched && i.liked).length, st = Recs.strength();
  dHead(main, 'Seen It', 'Pick a pack and mark what you’ve watched — tap in a grid, or swipe through one at a time.');
  main.appendChild(h(`<div class="pk-summary">
    <div class="pk-sum-stats"><div><b>${seen.toLocaleString()}</b><span>seen</span></div><div><b>${loved.toLocaleString()}</b><span>loved</span></div><div><b>${st.score}</b><span>taste · ${esc(st.level.toLowerCase())}</span></div></div>
    <div class="pk-sum-cta"><button class="btn primary start">${ICON.playSm} ${seen < 40 ? 'Start with the essentials' : 'Quick swipe: biggest movies'}</button></div></div>`));
  $('.start', main).onclick = () => { packState.open = 'biggest'; packState.view = 'swipe'; discGo(); };
  // One category at a time, picked from a menu — plus a search box that finds any pack by name.
  if (!PACK_CATS.some(c => c[0] === packState.cat)) packState.cat = 'general';
  const bar = h('<div class="pk-cats toolbar"></div>');
  const catOpts = PACK_CATS.map(([k, l]) => [k, `${l} · ${PACKS.filter(p => p.cat === k).length}`]);
  const sel = glassSelect('Category', catOpts, packState.cat, v => { packState.cat = v; packState.q = ''; search.value = ''; paint(); });
  bar.appendChild(sel);
  const search = h(`<input class="input pk-search" placeholder="Find a pack — Nolan, Pixar, heists…" value="${esc(packState.q)}">`);
  let st_; search.oninput = () => { clearTimeout(st_); st_ = setTimeout(() => { packState.q = search.value.trim(); paint(); }, 140); };
  bar.appendChild(search);
  // Quick-jump chips for the categories, compact and scroll-free.
  const chips = h('<div class="pk-jump"></div>');
  PACK_CATS.forEach(([k, l]) => { const b = h(`<button class="${k === packState.cat ? 'on' : ''}" data-k="${k}">${esc(l)}</button>`); b.onclick = () => { packState.cat = k; packState.q = ''; search.value = ''; $('b', sel).textContent = catOpts.find(o => o[0] === k)[1]; paint(); }; chips.appendChild(b); });
  main.appendChild(bar);
  main.appendChild(chips);
  const shelf = h('<div class="pk-shelf"></div>');
  main.appendChild(shelf);
  const cards = new Map();
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); } }), { rootMargin: '400px' });
  onLeave(() => io.disconnect());
  const fill = async (card) => {
    const p = card._pack;
    const list = await Packs.items(p);
    if (!card.isConnected) return;
    if (!list.length) { card.classList.add('empty'); card.remove(); return; }
    const pr = Packs.progress(list);
    const covers = list.slice(0, 3);
    $('.pk-cover', card).innerHTML = covers.map((m, i) => `<div style="--i:${i};background-image:url('${TMDB.img(m.poster, 'w185')}')"></div>`).join('');
    $('.pk-meta', card).innerHTML = pr.done ? `<span class="pk-done">${ICON.checkCircleFill} All ${pr.total} sorted</span>` : `<span>${pr.marked} of ${pr.total} seen</span>`;
    $('.pk-bar i', card).style.width = `${pr.total ? (pr.decided / pr.total) * 100 : 0}%`;
    card.classList.toggle('done', pr.done);
    card.classList.add('ready');
  };
  const paint = () => {
    shelf.innerHTML = '';
    $$('button', chips).forEach(b => b.classList.toggle('on', !packState.q && b.dataset.k === packState.cat));
    const q = packState.q.toLowerCase();
    const groups = q
      ? [['results', `Packs matching “${packState.q}”`, PACKS.filter(p => (p.title + ' ' + (p.sub || '') + ' ' + ((PACK_CATS.find(c => c[0] === p.cat) || [])[1] || '')).toLowerCase().includes(q))]]
      : PACK_CATS.filter(c => c[0] === packState.cat).map(([cat, label]) => [cat, label, PACKS.filter(p => p.cat === cat)]);
    groups.forEach(([cat, label, ps]) => {
      if (!ps.length) { shelf.appendChild(h('<div class="center-empty glass-empty"><h3>No packs match</h3>Try a director, a franchise, a studio or a theme.</div>')); return; }
      const sec = h(`<section class="pk-sec"><div class="pk-sec-head"><h2>${esc(label)}</h2><span class="dim">${ps.length} pack${ps.length === 1 ? '' : 's'}</span></div><div class="pk-grid"></div></section>`);
      const grid = $('.pk-grid', sec);
      ps.forEach((p, i) => {
        const card = h(`<button class="pk-card" style="animation-delay:${Math.min(i, 12) * 25}ms"><div class="pk-cover"><div class="sk"></div></div>
          <div class="pk-body"><b>${esc(p.title)}</b><div class="pk-meta dim">${esc(p.sub || (p.type === 'tv' ? 'Shows' : '…'))}</div><div class="pk-bar"><i></i></div></div></button>`);
        card._pack = p;
        card.onclick = () => { packState.open = p.id; packState.view = 'grid'; discGo(); };
        grid.appendChild(card);
        io.observe(card);
      });
      shelf.appendChild(sec);
    });
  };
  paint();
}

// ---------- One pack: Grid or Swipe ----------
async function packView(main, p) {
  if (!p) { packState.open = null; return dSeen(main); }
  const head = h(`<div class="pk-head">
    <button class="btn small ghost pk-back">${ICON.back} All packs</button>
    <div class="pk-title"><div class="eyebrow">${esc((PACK_CATS.find(c => c[0] === p.cat) || [])[1] || 'Pack')}</div><h1>${esc(p.title)}</h1><div class="pk-prog"><div class="pk-bar big"><i></i></div><span class="pk-count dim">Loading…</span></div></div>
    <div class="pk-tools"></div></div>`);
  main.appendChild(head);
  $('.pk-back', head).onclick = () => { packState.open = null; discGo(); };
  const tools = $('.pk-tools', head);
  tools.appendChild(segmented([['grid', 'Grid'], ['swipe', 'Swipe']], packState.view, v => { packState.view = v; discGo(); }));
  const body = h('<div class="pk-body-wrap"><div class="spinner" style="margin:80px auto"></div></div>');
  main.appendChild(body);
  const list = await Packs.items(p);
  if (!main.isConnected) return;
  const paintProg = () => {
    const pr = Packs.progress(list);
    $('.pk-bar i', head).style.width = `${pr.total ? (pr.decided / pr.total) * 100 : 0}%`;
    $('.pk-count', head).innerHTML = pr.done ? `${ICON.checkCircleFill} Pack complete · ${pr.marked} of ${pr.total} seen` : `${pr.marked} of ${pr.total} seen · ${pr.total - pr.decided} left to sort`;
  };
  body.innerHTML = '';
  if (!list.length) { body.appendChild(h('<div class="center-empty glass-empty"><h3>Couldn’t load this pack</h3>Check your connection and try again.</div>')); return; }
  paintProg();
  if (packState.view === 'swipe') swipeDeck(body, p, list, paintProg);
  else packGrid(body, p, list, paintProg, tools);
}

function packGrid(body, p, list, paintProg, tools) {
  // Franchises: one tap for "I've seen them all".
  if (p.franchise || p.dir || p.act) {
    const all = h(`<button class="btn small">${ICON.checkCircle} Seen them all</button>`);
    all.onclick = () => {
      let n = 0; list.forEach(m => { if (['none', 'notseen'].includes(seenStateOf(m))) { seenSet(m, 'seen'); n++; } });
      repaintAll();
      if (n) toast(`Marked ${n} from ${p.title} as seen`, false, { label: 'Undo', fn: () => { for (let k = 0; k < n; k++) packUndo(); repaintAll(); } });
    };
    tools.insertBefore(all, tools.firstChild);
  }
  const hide = segmented([['0', 'Show all'], ['1', 'Hide sorted']], packState.hideMarked ? '1' : '0', v => { packState.hideMarked = v === '1'; repaintAll(); });
  tools.insertBefore(hide, tools.firstChild);
  const grid = h('<div class="pk-tiles"></div>');
  body.appendChild(grid);
  body.appendChild(h(`<div class="pk-hint dim">Tap a poster to mark it seen · hover for ♥ loved or 🔖 watchlist · Ctrl+Z undoes</div>`));
  const tiles = [];
  const paintTile = (el, m) => {
    const s = seenStateOf(m);
    el.dataset.s = s;
    $('.pt-state', el).innerHTML = s === 'seen' ? `${ICON.check}<span>Seen</span>` : s === 'loved' ? `${ICON.heartFill}<span>Loved</span>` : s === 'meh' ? `${ICON.thumbDown}<span>Not for me</span>` : s === 'want' ? `${ICON.bookmarkFill}<span>On watchlist</span>` : s === 'notseen' ? `<span>Not seen</span>` : '';
    el.style.display = packState.hideMarked && s !== 'none' ? 'none' : '';
  };
  const repaintAll = () => { tiles.forEach(([el, m]) => paintTile(el, m)); paintProg(); };
  list.forEach((m, i) => {
    const el = h(`<div class="pk-tile" style="animation-delay:${Math.min(i, 18) * 20}ms">
      <div class="pt-art" data-bg="${TMDB.img(m.poster, 'w342')}"><div class="pt-state"></div>
        <div class="pt-actions"><button class="pt-btn love" title="Loved it">${ICON.heart}</button><button class="pt-btn want" title="Haven’t seen it — add to watchlist">${ICON.bookmark}</button></div></div>
      <div class="pt-cap"><b>${esc(m.title)}</b><span>${esc([m.type === 'tv' ? 'Series' : '', m.year].filter(Boolean).join(' · '))}</span></div></div>`);
    lazyArt($('.pt-art', el));
    withMenu(el, m, $('.pt-art', el), 'st-more');
    el.onclick = (e) => {
      if (e.target.closest('.pt-btn, .more-btn')) return;
      seenSet(m, ['none', 'notseen', 'want'].includes(seenStateOf(m)) ? 'seen' : 'none');
      paintTile(el, m); paintProg();
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    };
    $('.love', el).onclick = (e) => { e.stopPropagation(); seenSet(m, seenStateOf(m) === 'loved' ? 'seen' : 'loved'); paintTile(el, m); paintProg(); };
    $('.want', el).onclick = (e) => { e.stopPropagation(); const on = seenStateOf(m) === 'want'; seenSet(m, on ? 'none' : 'want'); if (!on) toast(`Added ${m.title} to your watchlist`); paintTile(el, m); paintProg(); };
    paintTile(el, m);
    tiles.push([el, m]);
    grid.appendChild(el);
  });
  keyHandler((e) => { if (!typing(e) && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (packUndo()) repaintAll(); } });
}

function swipeDeck(body, p, list, paintProg) {
  const deck = list.filter(m => seenStateOf(m) === 'none');
  let i = 0;
  const done = [];
  const stage = h(`<div class="sw">
    <div class="sw-card-slot"></div>
    <div class="sw-actions">
      <button class="sw-btn no" title="Not seen (←)"><span>${ICON.x}</span><b>Not seen</b><kbd>←</kbd></button>
      <button class="sw-btn yes" title="Seen it (→)"><span>${ICON.check}</span><b>Seen it</b><kbd>→</kbd></button>
      <button class="sw-btn love" title="Loved it (↑)"><span>${ICON.heartFill}</span><b>Loved it</b><kbd>↑</kbd></button>
      <button class="sw-btn want" title="Haven’t seen it — want to (↓)"><span>${ICON.bookmark}</span><b>Watchlist</b><kbd>↓</kbd></button>
    </div>
    <div class="sw-foot"><button class="btn small ghost undo">${ICON.undo} Undo <kbd>Ctrl+Z</kbd></button><span class="dim sw-left"></span><span class="dim">1–5 to rate with stars</span></div></div>`);
  body.appendChild(stage);
  const slot = $('.sw-card-slot', stage);
  const render = () => {
    $('.sw-left', stage).textContent = deck.length ? `${Math.min(i, deck.length)} of ${deck.length} in this deck` : '';
    slot.innerHTML = '';
    const m = deck[i];
    if (!m) {
      slot.appendChild(h(`<div class="sw-done"><div class="sw-done-ico">${ICON.checkCircleFill}</div><h2>${deck.length ? 'Pack sorted' : 'Nothing left to sort here'}</h2><p class="muted">Pick another pack — or switch to Grid to fine-tune.</p>
        <div class="btns" style="justify-content:center"><button class="btn primary nextpk">${ICON.layers} Next pack</button><button class="btn allpk">All packs</button></div></div>`));
      // Next pack: the following one on the shelf (wraps to the start).
      const next = PACKS[(PACKS.indexOf(p) + 1) % PACKS.length];
      $('.nextpk', slot).innerHTML = `${ICON.layers} Next: ${esc(next.title)}`;
      $('.nextpk', slot).onclick = () => { packState.open = next.id; discGo(); };
      $('.allpk', slot).onclick = () => { packState.open = null; discGo(); };
      return;
    }
    const card = h(`<div class="sw-card">
      <div class="sw-poster" style="background-image:url('${TMDB.img(m.poster, 'w500')}')"></div>
      <div class="sw-info"><div class="eyebrow">${esc([m.type === 'tv' ? 'Series' : 'Film', m.year].filter(Boolean).join(' · '))}</div><h2>${esc(m.title)}</h2>
        <div class="dim sw-genres">${esc((m.genreIds || []).map(g => TMDB.genreName(m.type, g)).filter(Boolean).slice(0, 3).join(' · '))}${m.vote ? ` · TMDB ${m.vote.toFixed(1)}` : ''}</div>
        <p>${esc(m.overview || '')}</p></div>
      <div class="sw-stamp"></div></div>`);
    slot.appendChild(card);
    // Pre-load the next poster so the deck never waits.
    if (deck[i + 1]) { const im = new Image(); im.src = TMDB.img(deck[i + 1].poster, 'w500'); }
  };
  const decide = (state, dir, stamp) => {
    const m = deck[i]; if (!m) return;
    if (state) seenSet(m, state);
    done.push({ i, state });
    const card = $('.sw-card', slot);
    if (card) {
      $('.sw-stamp', card).textContent = stamp || '';
      card.classList.add('fly', dir);
    }
    paintProg();
    i++;
    setTimeout(render, 230);
  };
  const act = { no: () => decide('notseen', 'left', 'Not seen'), yes: () => decide('seen', 'right', 'Seen'), love: () => decide('loved', 'up', 'Loved'), want: () => decide('want', 'down', 'Watchlist') };
  $$('.sw-btn', stage).forEach(b => { const k = [...b.classList].find(c => act[c]); b.onclick = () => act[k](); });
  const undo = () => { const last = done.pop(); if (!last) return; if (last.state) packUndo(); i = last.i; paintProg(); render(); };
  $('.undo', stage).onclick = undo;
  keyHandler((e) => {
    if (typing(e)) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
    if (k === 'ArrowRight') { e.preventDefault(); act.yes(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); act.no(); }
    else if (k === 'ArrowUp') { e.preventDefault(); act.love(); }
    else if (k === 'ArrowDown' || k.toLowerCase() === 'w') { e.preventDefault(); act.want(); }
    else if (/^[1-5]$/.test(k) && deck[i]) { const m = deck[i]; seenSet(m, +k >= 5 ? 'loved' : +k <= 2 ? 'meh' : 'seen'); Store.setRating(m, +k); done.push({ i, state: 'seen' }); paintProg(); i++; const c = $('.sw-card', slot); if (c) { $('.sw-stamp', c).textContent = '★'.repeat(+k); c.classList.add('fly', 'right'); } setTimeout(render, 230); }
  });
  render();
}
