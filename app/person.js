// Reel — person pages (actors, directors) and franchise / collection progress.

const personState = { type: 'movie', sort: 'popular', hideSeen: false };
Views.person = async (root, { id }) => {
  const p = await TMDB.get(`/person/${id}`, { append_to_response: 'combined_credits' });
  const dept = p.known_for_department || 'Acting';
  const credits = (p.combined_credits || {});
  // One entry per title; directors see their directing work first.
  const raw = dept === 'Directing' ? [...(credits.crew || []).filter(c => c.job === 'Director'), ...(credits.cast || [])] : [...(credits.cast || []), ...(credits.crew || []).filter(c => c.job === 'Director')];
  const seenIds = new Set();
  const all = raw.filter(c => (c.media_type === 'movie' || c.media_type === 'tv') && c.poster_path && !(c.media_type === 'tv' && (c.character || '').match(/^(himself|herself|self)/i)) && !seenIds.has(`${c.media_type}:${c.id}`) && seenIds.add(`${c.media_type}:${c.id}`))
    .map(c => ({ ...TMDB.meta(c, c.media_type), role: c.job === 'Director' ? 'Director' : c.character ? `as ${c.character}` : c.job || '', pop: c.popularity || 0, votes: c.vote_count || 0 }));
  const movies = all.filter(m => m.type === 'movie'), shows = all.filter(m => m.type === 'tv');
  if (!movies.length && shows.length) personState.type = 'tv';
  const seen = (m) => !!(Store.item(`${m.type}:${m.id}`) || {}).watched;
  const sig = movies.filter(m => m.votes >= 50);
  const seenCount = sig.filter(seen).length;
  const rated = all.map(m => Store.item(`${m.type}:${m.id}`)).filter(i => i && i.rating);
  const avg = rated.length ? (rated.reduce((a, i) => a + i.rating, 0) / rated.length).toFixed(1) : null;

  const page = h(`<div class="page person-page">
    <div class="ph">
      <div class="ph-face" style="background-image:url('${TMDB.img(p.profile_path, 'h632')}')"></div>
      <div class="ph-body">
        <div class="eyebrow">${esc(dept === 'Directing' ? 'Director' : dept === 'Acting' ? 'Actor' : dept)}</div>
        <h1>${esc(p.name)}</h1>
        <div class="muted">${esc([p.birthday && `Born ${new Date(p.birthday + 'T12:00').toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`, p.place_of_birth].filter(Boolean).join(' · '))}</div>
        ${p.biography ? `<p class="bio">${esc(p.biography)}</p><button class="btn small ghost more-bio">Read more</button>` : ''}
        <div class="ph-stats">
          <div><b>${seenCount}</b><span>of ${sig.length} films seen</span></div>
          ${avg ? `<div><b>★ ${avg}</b><span>your average</span></div>` : ''}
          <div><b>${shows.length}</b><span>shows</span></div>
        </div>
        <div class="ch-bar" style="max-width:420px"><i style="width:${sig.length ? (seenCount / sig.length) * 100 : 0}%"></i></div>
      </div>
    </div>
    <div class="toolbar ph-tools"></div>
    <div class="grid ph-grid"></div>
  </div>`);
  root.appendChild(page);
  const mb = $('.more-bio', page);
  if (mb) mb.onclick = () => { $('.bio', page).classList.toggle('open'); mb.textContent = $('.bio', page).classList.contains('open') ? 'Show less' : 'Read more'; };
  const tools = $('.ph-tools', page);
  tools.appendChild(segmented([['movie', `Films · ${movies.length}`], ['tv', `Shows · ${shows.length}`]], personState.type, v => { personState.type = v; paint(); }));
  tools.appendChild(glassSelect('Sort', [['popular', 'Most popular'], ['new', 'Newest'], ['old', 'Oldest'], ['rating', 'Your rating']], personState.sort, v => { personState.sort = v; paint(); }));
  tools.appendChild(segmented([['0', 'Show all'], ['1', 'Unseen only']], personState.hideSeen ? '1' : '0', v => { personState.hideSeen = v === '1'; paint(); }));
  const paint = () => {
    const g = $('.ph-grid', page);
    g.innerHTML = '';
    const rating = (m) => (Store.item(`${m.type}:${m.id}`) || {}).rating || 0;
    const sorters = { popular: (a, b) => b.votes - a.votes, new: (a, b) => String(b.year).localeCompare(String(a.year)), old: (a, b) => String(a.year || '9999').localeCompare(String(b.year || '9999')), rating: (a, b) => rating(b) - rating(a) };
    const list = (personState.type === 'tv' ? shows : movies).filter(m => !personState.hideSeen || !seen(m)).sort(sorters[personState.sort]);
    if (!list.length) g.appendChild(h('<div class="dim">Nothing here.</div>'));
    list.forEach((m, n) => {
      const c = posterCard(m, { sub: [m.year, m.role].filter(Boolean).join(' · ') });
      if (seen(m)) $('.art', c).appendChild(h(`<div class="seen-badge" title="Seen">${ICON.check}</div>`));
      c.style.animationDelay = `${Math.min(n, 30) * 14}ms`;
      g.appendChild(c);
    });
  };
  paint();
};

// Make any cast/crew face open its person page.
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('.person[data-pid]');
  if (el && !el.closest('.dragging-shelf')) go('person', { id: +el.dataset.pid });
});

// Franchise progress on a movie page: "You've seen 4 of 6".
async function collectionSection(container, d) {
  const col = d.belongs_to_collection;
  if (!col) return;
  let c;
  try { c = await TMDB.get(`/collection/${col.id}`); } catch { return; }
  const parts = (c.parts || []).filter(m => m.release_date && m.release_date <= today()).sort((a, b) => a.release_date.localeCompare(b.release_date)).map(m => TMDB.meta(m, 'movie'));
  if (parts.length < 2) return;
  const seen = (m) => !!(Store.item(`movie:${m.id}`) || {}).watched;
  const n = parts.filter(seen).length;
  const nextUp = parts.find(m => !seen(m));
  const sec = h(`<section class="row collection"><div class="col-head"><div><h2 class="row-title" style="margin:0 0 4px">${esc(c.name)}</h2>
    <div class="dim">You’ve seen ${n} of ${parts.length}${n === parts.length ? ' — complete!' : ''}</div></div>
    ${nextUp ? `<button class="btn small next-col">${ICON.playSm} Next up: ${esc(nextUp.title)}</button>` : ''}</div>
    <div class="ch-bar" style="max-width:360px;margin:10px 0 0"><i style="width:${(n / parts.length) * 100}%"></i></div>
    <div class="shelf"></div></section>`);
  parts.forEach((m, i) => {
    const card = posterCard(m, { sub: `${i + 1} · ${m.year}` });
    if (seen(m)) $('.art', card).appendChild(h(`<div class="seen-badge" title="Seen">${ICON.check}</div>`));
    if (m.id === d.id) card.classList.add('current-part');
    $('.shelf', sec).appendChild(card);
  });
  if (nextUp) $('.next-col', sec).onclick = () => go('detail', { type: 'movie', id: nextUp.id });
  container.appendChild(sec);
}
