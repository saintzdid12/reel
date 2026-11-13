// Page state that should NOT stick around: filters, toggles and picks reset on a fresh visit (tab click,
// sidebar switch, Ctrl+K) but survive Back, so returning from a title puts you exactly where you were.
const Fresh = {
  list: [],
  keep(scope, obj, persist = []) { this.list.push({ scope, obj, persist, d: JSON.parse(JSON.stringify(obj)) }); return obj; },
  reset(...scopes) {
    this.list.filter(x => scopes.includes(x.scope)).forEach(({ obj, persist, d }) => {
      Object.keys(obj).forEach(k => { if (!persist.includes(k)) delete obj[k]; });
      Object.entries(JSON.parse(JSON.stringify(d))).forEach(([k, v]) => { if (!persist.includes(k)) obj[k] = v; });
    });
  },
};
// Reel — shared UI components: cards, rows, stars, modals.

function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

// ---------- "⋯" button: the full quick-actions menu (rate, like, review, log, watchlist, lists, favorites, remove…)
// on any poster, card, row or tile — the same menu as right-click, for people who don't right-click.
function moreBtn(m, cls = '') {
  const b = h(`<button class="more-btn ${cls}" title="More — rate, review, add to list…" aria-label="More options">${ICON.more}</button>`);
  b.onclick = (e) => { e.stopPropagation(); e.preventDefault(); const r = b.getBoundingClientRect(); contextMenu(Math.max(12, r.left - 8), r.bottom + 6, (Store.item(`${m.type}:${m.id}`) || {}).id ? Store.item(`${m.type}:${m.id}`) : m); };
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  return b;
}
// Anything with a title on it can carry the menu: set el._meta and add data-menu.
function withMenu(el, m, host = el, cls = '') { el._meta = m; el.dataset.menu = '1'; host.appendChild(moreBtn(m, cls)); return el; }

// ---------- Cards ----------
function landCard(m, opts = {}) {
  const it = Store.item(`${m.type}:${m.id}`) || {};
  const el = h(`<div class="card land ${opts.big ? 'big' : ''}">
    <div class="art" data-bg="${TMDB.img(m.backdrop || m.still, window.REEL_TV ? 'w300' : 'w780')}">
      <div class="shade"></div>
      ${opts.progress != null ? `<div class="progress"><i style="width:${Math.min(100, opts.progress * 100)}%"></i></div>` : ''}
      <div class="title-on">${esc(opts.overlay || m.title)}</div>
    </div>
    <div class="sub">${esc(opts.sub || [m.year, m.type === 'tv' ? 'TV' : '', Store.settings.showRatings && starsText(it.rating)].filter(Boolean).join(' · '))}</div>
    ${m.why ? `<div class="why">${esc(m.why)}</div>` : ''}
  </div>`);
  el.onclick = opts.onClick || (() => go('detail', { type: m.type, id: m.id }));
  el._meta = m;
  lazyArt($('.art', el));
  if (opts.feedback) {
    // Thumbs on recommendations: tune what you see.
    const fb = h(`<div class="fb">${m.drivers && m.drivers.length ? `<button class="mini why-btn" title="Why this pick?">${ICON.info}</button>` : ''}<button class="mini up ${it.feedback === 1 ? 'on' : ''}" title="More like this">${ICON.thumbUp}</button><button class="mini down" title="Not for me">${ICON.thumbDown}</button></div>`);
    if ($('.why-btn', fb)) $('.why-btn', fb).onclick = (e) => { e.stopPropagation(); whyPopover(e.currentTarget, m); };
    $('.up', fb).onclick = (e) => { e.stopPropagation(); Recs.feedback(m, 1); e.currentTarget.classList.toggle('on'); toast('Got it — more like this'); };
    $('.down', fb).onclick = (e) => { e.stopPropagation(); Recs.feedback(m, -1); el.classList.add('dismissed'); setTimeout(() => el.remove(), 350); toast('Got it — fewer like this'); };
    $('.art', el).appendChild(fb);
  }
  if (opts.logo !== false && !opts.overlay) lazyLogo(el, m);
  if (opts.menu !== false && m.id && !window.REEL_TV) $('.art', el).appendChild(moreBtn(m));
  return el;
}

// Artwork loads when it's about to be seen, then fades in over a shimmer placeholder (no pop-in).
const artObserver = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    artObserver.unobserve(e.target);
    const art = e.target, url = art.dataset.bg;
    const img = new Image();
    const show = () => { const l = art.querySelector('.img'); if (l) { l.style.backgroundImage = `url('${url}')`; requestAnimationFrame(() => l.classList.add('ready')); } art.classList.remove('loading'); };
    img.src = url;
    img.decode().catch(() => {}).then(show);   // decoded off the main thread first, so showing it never stutters scrolling
  }
}, { rootMargin: window.REEL_TV ? '6000px' : '600px' });   // TVs load further ahead: they decode images slowly
function lazyArt(art) {
  if (!art || !art.dataset.bg) { if (art) art.classList.remove('loading'); return; }
  art.classList.add('loading');
  art.insertBefore(h('<div class="img"></div>'), art.firstChild);
  artObserver.observe(art);
}

// ---------- Shelves: hover arrows + drag to scroll, for every horizontal row in the app ----------
function enhanceShelf(shelf) {
  if (window.REEL_TV) return;   // arrows and drag are for a mouse; on a TV they only cost layout work
  if (shelf._enhanced) return;
  shelf._enhanced = true;
  const host = shelf.parentElement;
  if (!host) return;
  host.classList.add('shelf-host');
  const prev = h(`<button class="sh-arrow prev" aria-label="Scroll left">${ICON.back}</button>`);
  const next = h(`<button class="sh-arrow next" aria-label="Scroll right">${ICON.back}</button>`);
  host.append(prev, next);
  const sync = () => {
    // Restore this row's position after Back, once its cards are in.
    const t = host.querySelector('h2');
    const want = t && window.__shelfRestore && window.__shelfRestore[t.textContent.trim()];
    if (want && shelf.scrollWidth - shelf.clientWidth >= want - 4 && !shelf.querySelector('.skeleton')) {
      shelf.style.scrollBehavior = 'auto'; shelf.scrollLeft = want; shelf.style.scrollBehavior = '';
      delete window.__shelfRestore[t.textContent.trim()];
    }
    const max = shelf.scrollWidth - shelf.clientWidth;
    prev.classList.toggle('show', shelf.scrollLeft > 8);
    next.classList.toggle('show', shelf.scrollLeft < max - 8);
    // Center arrows on the artwork, not the captions.
    const art = shelf.querySelector('.art, .still, .face, .genre-tile');
    if (art) { const top = art.offsetTop + art.offsetHeight / 2 - shelf.scrollTop; prev.style.top = next.style.top = `${shelf.offsetTop + top}px`; }
  };
  const page = (dir) => shelf.scrollBy({ left: dir * shelf.clientWidth * .82, behavior: 'smooth' });
  prev.onclick = (e) => { e.stopPropagation(); page(-1); };
  next.onclick = (e) => { e.stopPropagation(); page(1); };
  shelf.addEventListener('scroll', sync, { passive: true });
  new ResizeObserver(sync).observe(shelf);
  new MutationObserver(sync).observe(shelf, { childList: true });
  // Click-and-drag to scroll; a real drag doesn't count as a click.
  let sx = 0, sl = 0, down = false, moved = false;
  shelf.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('button')) return; down = true; moved = false; sx = e.clientX; sl = shelf.scrollLeft; });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 6) { moved = true; shelf.classList.add('dragging-shelf'); }
    if (moved) shelf.scrollLeft = sl - dx;
  });
  window.addEventListener('pointerup', () => { if (!down) return; down = false; setTimeout(() => shelf.classList.remove('dragging-shelf'), 0); });
  shelf.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  // Plain mouse wheel stays vertical page scrolling; Shift+wheel or trackpads scroll sideways.
  setTimeout(sync, 60);
}
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    if (n.classList.contains('shelf')) enhanceShelf(n);
    n.querySelectorAll && n.querySelectorAll('.shelf').forEach(enhanceShelf);
  }
}).observe(document.body, { childList: true, subtree: true });

// Fetch title logos lazily when the card scrolls into view (Apple TV style).
const logoObserver = new IntersectionObserver(entries => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    logoObserver.unobserve(e.target);
    const { type, id } = e.target.dataset;
    TMDB.logo(type, id).then(p => {
      if (!p) return;
      const slot = e.target.querySelector('.title-on');
      if (slot && !slot.childElementCount) slot.innerHTML = `<img src="${TMDB.img(p, 'w300')}" alt="">`;
    });
  }
}, { rootMargin: window.REEL_TV ? '1200px' : '200px' });
function lazyLogo(el, m) { el.dataset.type = m.type; el.dataset.id = m.id; logoObserver.observe(el); }

function posterCard(m, opts = {}) {
  const it = Store.item(`${m.type}:${m.id}`) || {};
  const el = h(`<div class="card poster">
    <div class="art" data-bg="${TMDB.img(m.poster, 'w342')}"></div>
    <div class="cap">${esc(m.title)}</div>
    <div class="sub">${esc(opts.sub || [m.year, opts.showRating !== false && Store.settings.showRatings && starsText(it.rating)].filter(Boolean).join(' · '))}${it.liked ? `<span class="cm" title="Liked">${ICON.heartFill}</span>` : ''}${it.review || (it.watched && hasReview(`${m.type}:${m.id}`)) ? `<span class="cm rv-cm" title="Read your review">${ICON.pencil}</span>` : ''}</div>
    ${opts.reason ? `<div class="reason">${esc(opts.reason)}</div>` : ''}
  </div>`);
  el.onclick = opts.onClick || (() => go('detail', { type: m.type, id: m.id }));
  const rc = $('.rv-cm', el);
  if (rc) rc.onclick = (e) => { e.stopPropagation(); openReview(it.id ? it : m); };
  el._meta = m;
  lazyArt($('.art', el));
  if (opts.menu !== false && m.id && !window.REEL_TV) $('.art', el).appendChild(moreBtn(m));
  return el;
}

// "Why this pick?" — which of your titles drove a recommendation, with a switch to stop using any of them.
function whyPopover(anchor, m) {
  document.querySelectorAll('.ctx-menu').forEach(x => x.remove());
  const menu = h(`<div class="ctx-menu why-menu"><div class="ctx-title">Recommended because you liked</div></div>`);
  m.drivers.forEach(d => {
    const it = Store.item(d.key);
    if (!it) return;
    const r = h(`<div class="why-row"><img src="${TMDB.img(it.poster, 'w92')}"><div><b>${esc(it.title)}</b><small>${d.pct}% of this pick${it.rating ? ` · you rated ${starsText(it.rating).slice(2)}` : ''}</small></div><button class="btn small ghost">Don’t use</button></div>`);
    $('button', r).onclick = (e) => {
      e.stopPropagation();
      Store.upsert(it, { noRecs: true }); Recs.cache = null;
      r.classList.add('off'); $('button', r).textContent = 'Excluded';
      toast(`${it.title} won’t shape recommendations anymore`);
    };
    menu.appendChild(r);
  });
  menu.appendChild(h('<div class="dim" style="font-size:11.5px;padding:8px 12px 4px">Undo anytime: right-click the title → Use for recommendations.</div>'));
  document.body.appendChild(menu);
  const rc = anchor.getBoundingClientRect();
  menu.style.left = `${Math.max(12, Math.min(rc.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 12))}px`;
  menu.style.top = `${Math.min(rc.bottom + 8, innerHeight - menu.offsetHeight - 12)}px`;
  const away = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', away, true); } };
  setTimeout(() => document.addEventListener('mousedown', away, true));
}

// ---------- Shared glass menu: items = [icon, label, fn, 'danger'?] or 'sep'. Always fully on-screen. ----------
function menuAt(x, y, title, items) {
  document.querySelectorAll('.ctx-menu').forEach(e => e.remove());
  const menu = h(`<div class="ctx-menu">${title ? `<div class="ctx-title">${esc(title)}</div>` : ''}</div>`);
  items.filter(Boolean).forEach((i, n, a) => {
    if (i === 'sep') { if (n > 0 && a[n - 1] !== 'sep' && n < a.length - 1) menu.appendChild(h('<div class="sep"></div>')); return; }
    const b = h(`<button class="${i[3] || ''}">${i[0]}<span>${esc(i[1])}</span></button>`);
    b.onclick = (e) => { e.stopPropagation(); const rect = b.getBoundingClientRect(); menu.remove(); i[2]({ getBoundingClientRect: () => rect, contains: () => false }); };
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  menu.style.left = `${Math.max(12, Math.min(x, innerWidth - menu.offsetWidth - 12))}px`;
  menu.style.top = `${Math.max(12, Math.min(y, innerHeight - menu.offsetHeight - 12))}px`;
  const away = (e) => { if (!menu.contains(e.target)) close(); };
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  function close() { menu.remove(); document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', key, true); }
  menu.close = close;
  setTimeout(() => { document.addEventListener('mousedown', away, true); document.addEventListener('keydown', key, true); });
  return menu;
}

// macOS-style confirm sheet (replaces the browser's confirm()). Resolves true/false.
function confirmSheet(title, text, okLabel = 'OK', danger = false) {
  return new Promise(resolve => {
    const wrap = h(`<div class="confirm-sheet"><h3>${esc(title)}</h3>${text ? `<p class="muted">${esc(text)}</p>` : ''}
      <div class="btns" style="justify-content:flex-end;margin-top:22px"><button class="btn no">Cancel</button><button class="btn ${danger ? 'danger-solid' : 'primary'} yes">${esc(okLabel)}</button></div></div>`);
    let done = false;
    const m = openModal(wrap, { onClose: () => { if (!done) resolve(false); } });
    $('.no', wrap).onclick = () => m.close();
    $('.yes', wrap).onclick = () => { done = true; m.close(); resolve(true); };
    setTimeout(() => $('.yes', wrap).focus(), 50);
  });
}

// ---------- Right-click quick actions on any poster ----------
function contextMenu(x, y, m) {
  const key = `${m.type}:${m.id}`, it = Store.item(key) || {};
  const fav = Store.data.favorites.includes(key);
  const meta = it.id ? it : m;
  const logged = Store.data.diary.filter(e => e.key === key).length;
  const nRev = reviewsFor(key).length;
  const anything = Store.item(key) && (it.watched || it.rating || it.liked || it.watchlist || it.review || logged);
  // After an action on a Library or list page, refresh it so the change shows.
  const then = (fn) => (a) => { fn(a); if (route.name === 'library' || route.name === 'list') setTimeout(rerender, 60); };
  // Grouped like a macOS menu: open · your rating & words · your collection · recommendations · remove.
  menuAt(x, y, m.title, [
    m.type === 'movie' && [ICON.playSm, 'Play', () => Playback.start(meta)],
    [ICON.info, 'Details', () => go('detail', { type: m.type, id: m.id })],
    'sep',
    [it.rating ? ICON.starFill : ICON.star, it.rating ? `Rated ${starsText(it.rating).slice(2)}★ — change…` : 'Rate…', (a) => ratePopover(a, it.rating || 0, v => rateWithUndo(meta, v))],
    [it.liked ? ICON.heartFill : ICON.heart, it.liked ? 'Unlike' : 'Like', then(() => { Store.toggleLike(meta); Recs.cache = null; })],
    [ICON.pencil, nRev ? 'Write another review…' : 'Write a review…', () => openLog(meta, { review: true, onSaved: () => rerender() })],
    nRev && [ICON.list, nRev > 1 ? `Read your ${nRev} reviews` : 'Read your review', () => openReview(meta)],
    [ICON.film, 'Log a watch…', () => openLog(meta, { onSaved: () => rerender() })],
    'sep',
    [it.watched ? ICON.checkCircleFill : ICON.checkCircle, it.watched ? 'Mark as unwatched' : 'Mark as watched', then(() => { const r = Store.toggleWatched(meta); Recs.cache = null; toast(r.watched ? 'Marked as watched' : 'Marked as unwatched'); })],
    [it.watchlist ? ICON.bookmarkFill : ICON.bookmark, it.watchlist ? 'Remove from watchlist' : 'Add to watchlist', then(() => { const r = Store.toggleWatchlist(meta); toast(r.watchlist ? 'Added to watchlist' : 'Removed from watchlist'); })],
    [ICON.listPlus, 'Add to list…', () => openAddToList(meta)],
    Object.values(Store.data.progress).some(p => p.key === key) && [ICON.x, 'Remove from Continue Watching', () => { const p = Object.values(Store.data.progress).find(x => x.key === key); removeFromContinue(p, null, null); }],
    [ICON.grid, fav ? 'Remove from favorites' : 'Add to favorites', then(() => {
      if (fav) { Store.data.favorites = Store.data.favorites.filter(k => k !== key); Store.save(); } else addFavorite(meta);
      toast(fav ? 'Removed from favorites' : `Added to favorite ${m.type === 'tv' ? 'shows' : 'films'}`);
    })],
    logged && [ICON.layers, `Open in Diary · logged ${logged}×`, () => { libState.diaryView = 'list'; libState.diaryYear = 'all'; go('library', { tab: 'diary' }); }],
    'sep',
    it.watched && [ICON.sparkle, it.noRecs ? 'Use for recommendations' : 'Don’t use for recommendations', then(() => { Store.upsert(meta, { noRecs: !it.noRecs }); Recs.cache = null; toast(it.noRecs ? 'Will shape your recommendations again' : 'Won’t shape your recommendations'); })],
    !it.watched && [ICON.thumbDown, 'Not interested', () => { Recs.notInterested(meta); toast('Hidden from your recommendations'); document.querySelectorAll('.card').forEach(c => { if (c._meta && c._meta.id === m.id && c._meta.type === m.type && !route.name.startsWith('library')) { c.classList.add('dismissed'); setTimeout(() => c.remove(), 350); } }); }],
    anything && 'sep',
    anything && [ICON.search || ICON.x, 'Wrong movie? Move to the right title…', () => fixWrongTitle(meta)],
    anything && [ICON.x, 'Remove from your profile…', () => removeFromProfile(meta), 'danger'],
  ]);
}
document.addEventListener('contextmenu', (e) => {
  const card = e.target.closest && e.target.closest('.card, [data-menu]');
  if (!card || !card._meta || Player.active() || e.target.closest('input, textarea')) return;
  e.preventDefault();
  contextMenu(e.clientX, e.clientY, card._meta);
});

// ---------- Scroll keeper: what you're looking at stays put while rows above it load, resize or disappear ----------
// Rows load lazily and some turn out empty (removed) or a different height than their placeholder. Without this the
// page jumps hundreds of pixels under your scroll. We remember an element near the top of the screen and, whenever the
// page's height changes, move the scroll position so that element stays exactly where it was.
const ScrollKeeper = {
  anchors: [], ro: null, root: null, raf: 0,
  view() { return document.getElementById('view'); },
  watch(root) {
    if (this.ro) this.ro.disconnect();
    this.root = root; this.anchors = [];
    this.ro = new ResizeObserver(() => this.fix());
    this.ro.observe(root);
  },
  unit(el) { return el && el.closest('.row, section, .panel, .grid > *, .diary-row, .diary-month > h3, .review-item, .cp-row, .act-row, .list-card, .ep'); },
  pick() {
    const v = this.view(); this.anchors = [];
    if (!v || !this.root || v.scrollTop < 4) return;
    const r = v.getBoundingClientRect(), x = r.left + r.width / 2;
    // Two anchors (one near the top, one lower) so a removed row still leaves us something to hold on to.
    for (const y of [r.top + 110, r.top + r.height * .6]) {
      const u = this.unit(document.elementFromPoint(x, y));
      if (u && this.root.contains(u)) this.anchors.push({ el: u, top: u.getBoundingClientRect().top });
    }
  },
  fix() {
    const v = this.view(); if (!v) return;
    const a = this.anchors.find(a => a.el.isConnected);
    if (a) {
      const d = a.el.getBoundingClientRect().top - a.top;
      if (Math.abs(d) > 1) v.scrollTop += d;
    }
    this.pick();
  },
  init() {
    const v = this.view();
    v.style.overflowAnchor = 'none';   // we do it ourselves; the browser's version was losing its anchor
    v.addEventListener('scroll', () => { cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(() => this.pick()); }, { passive: true });
  },
};

function row(title, items, render = landCard, sub = '') {
  const el = h(`<section class="row"><h2 class="row-title">${esc(title)} ${sub ? `<small>${esc(sub)}</small>` : ''}</h2><div class="shelf"></div></section>`);
  const shelf = $('.shelf', el);
  items.forEach((m, i) => { const c = render(m, i); c.style.animationDelay = `${Math.min(i, 8) * 40}ms`; shelf.appendChild(c); });
  return el;
}

async function asyncRow(container, title, loader, render = landCard, sub = '') {
  // Placeholders shaped like the real cards (posters vs. landscape), so nothing jumps when content arrives.
  const poster = /posterCard|rankCard/.test(String(render));
  const ph = poster ? '<div class="card poster"><div class="art skeleton"></div><div class="cap sk-line"></div></div>' : '<div class="card land"><div class="art skeleton"></div><div class="sub sk-line"></div></div>';
  const el = h(`<section class="row"><h2 class="row-title">${esc(title)} ${sub ? `<small>${esc(sub)}</small>` : ''}</h2><div class="shelf">${ph.repeat(poster ? 8 : 5)}</div></section>`);
  container.appendChild(el);
  // Load only when the row comes near the screen, so long pages stay fast.
  // The page scrolls inside #view, so the observer watches #view itself — that's what lets its margin reach rows
  // below the screen. The TV looks further ahead (about three screens) so moving down never waits.
  await new Promise(res => { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); res(); } }, { root: document.getElementById('view'), rootMargin: window.REEL_TV ? '2200px 0px' : '900px 0px' }); io.observe(el); });
  try {
    const items = await loader();
    if (!items || !items.length) { el.remove(); return; }
    const shelf = $('.shelf', el);
    shelf.innerHTML = '';
    items.forEach((m, i) => { const c = render(m, i); c.style.animationDelay = `${Math.min(i, 8) * 40}ms`; shelf.appendChild(c); });
  } catch (e) { el.remove(); }
}

// ---------- Stars ----------
function starsInput(value, onChange, size = 30) {
  const el = h(`<div class="stars" style="--sz:${size}px">${'<div class="s"><div class="fill"></div></div>'.repeat(5)}</div>`);
  const stars = $$('.s', el);
  let cur = value || 0;
  const paint = (v) => stars.forEach((s, i) => { $('.fill', s).style.width = `${Math.max(0, Math.min(1, v - i)) * 100}%`; });
  const valAt = (s, i, ev) => { const r = s.getBoundingClientRect(); return i + (ev.clientX - r.left < r.width / 2 ? .5 : 1); };
  stars.forEach((s, i) => {
    s.onmousemove = (ev) => paint(valAt(s, i, ev));
    s.onclick = (ev) => { const v = valAt(s, i, ev); cur = v === cur ? 0 : v; paint(cur); onChange && onChange(cur); };
  });
  el.onmouseleave = () => paint(cur);
  el.set = (v) => { cur = v; paint(v); };
  paint(cur);
  return el;
}

// Rate (or clear a rating) with a disappearing Undo in the toast.
function rateWithUndo(meta, v, after) {
  Store.setRating(meta, v);
  Recs.cache = null;
  const act = (Store.data.activity || [])[0];
  toast(v ? `Rated ${meta.title ? meta.title + ' · ' : ''}${starsText(v)}` : 'Rating removed', false, {
    label: 'Undo', fn: () => { if (act && Store.undo(act)) { Recs.cache = null; toast(v ? 'Rating undone' : 'Rating restored'); rerender(); } },
  });
  after && after();
}

// "Wrong movie?": pick the right title, and your rating, diary, review, lists and favorites move over to it.
function fixWrongTitle(meta) {
  const key = `${meta.type}:${meta.id}`, it = Store.item(key) || meta;
  pickTitle(`Which title did you mean instead of “${it.title || meta.title}”?`, (right) => {
    if (`${right.type}:${right.id}` === key) return;
    if (!Store.moveTitle(key, right)) return toast('Nothing to move for this title');
    Recs.cache = null;
    toast(`Moved everything to ${right.title}`);
    if (route.name === 'detail') go('detail', { type: right.type, id: right.id }, true); else rerender();
  });
}

// Take a title off your profile completely — after a confirm that lists exactly what goes — with Undo.
function removeFromProfile(meta, after) {
  const key = `${meta.type}:${meta.id}`, it = Store.item(key) || {};
  const logs = Store.data.diary.filter(e => e.key === key);
  const nRev = reviewsFor(key).length;
  const lists = Store.data.lists.filter(l => l.keys.includes(key));
  const eps = Object.keys(Store.data.episodes[key] || {}).filter(k => !k.startsWith('season:') && Store.data.episodes[key][k].watched).length;
  const bits = [
    it.rating && `your ${starsText(it.rating)} rating`, it.liked && 'your like', nRev && `${nRev} review${nRev > 1 ? 's' : ''}`,
    logs.length && `${logs.length} diary entr${logs.length > 1 ? 'ies' : 'y'}`, it.watched && 'watched status', eps && `${eps} watched episode${eps > 1 ? 's' : ''}`,
    it.watchlist && 'watchlist', lists.length && `${lists.length} list${lists.length > 1 ? 's' : ''}`, Store.data.favorites.includes(key) && 'favorites',
  ].filter(Boolean);
  const wrap = h(`<div class="rm-sheet">
    <div class="sheet-head"><img src="${TMDB.img(it.poster || meta.poster, 'w154')}" alt=""><div><div class="eyebrow">Remove from your profile</div><h3>${esc(it.title || meta.title)}</h3><div class="muted">${esc(it.year || meta.year || '')}</div></div><button class="btn small round close">${ICON.x}</button></div>
    <p class="muted" style="margin:14px 0 10px">${bits.length ? 'This clears everything you’ve recorded for this title:' : 'There’s nothing recorded for this title.'}</p>
    ${bits.length ? `<div class="rm-chips">${bits.map(b => `<span>${esc(b)}</span>`).join('')}</div>` : ''}
    <div class="btns" style="justify-content:flex-end;margin-top:22px"><button class="btn ghost no">Cancel</button>${bits.length ? '<button class="btn danger-solid yes">Remove everything</button>' : ''}</div>
  </div>`);
  const m = openModal(wrap);
  $('.close', wrap).onclick = $('.no', wrap).onclick = m.close;
  if ($('.yes', wrap)) $('.yes', wrap).onclick = () => {
    const snap = Store.clearTitle(key);
    Recs.cache = null; m.close();
    toast(`Removed ${it.title || meta.title} from your profile`, false, { label: 'Undo', fn: () => { Store.restoreTitle(snap); Recs.cache = null; toast('Restored'); rerender(); } });
    after ? after() : rerender();
  };
}

// A small glass popover with stars, anchored under a button (tvOS style).
function ratePopover(anchor, value, onChange, title = 'Your rating') {
  document.querySelectorAll('.rate-pop').forEach(p => p.close());
  const pop = h(`<div class="rate-pop"><div class="rp-title">${esc(title)}</div><div class="slot"></div><div class="rp-value">${value ? '<button class="rp-clear">Remove rating</button>' : '<span>Click a star · left half = ½</span>'}<b>${value ? starsText(value) : '—'}</b></div></div>`);
  const label = $('.rp-value b', pop);
  if ($('.rp-clear', pop)) $('.rp-clear', pop).onclick = () => { onChange(0); close(); };
  $('.slot', pop).appendChild(starsInput(value, v => { label.textContent = v ? starsText(v) : '—'; onChange(v); setTimeout(close, 380); }, 34));
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.min(r.left, innerWidth - pop.offsetWidth - 16)}px`;
  pop.style.top = `${r.bottom + 12 + pop.offsetHeight > innerHeight ? r.top - pop.offsetHeight - 12 : r.bottom + 12}px`;
  const away = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
  const esc_ = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  function close() { pop.remove(); document.removeEventListener('mousedown', away, true); document.removeEventListener('keydown', esc_, true); }
  pop.close = close;
  setTimeout(() => { document.addEventListener('mousedown', away, true); document.addEventListener('keydown', esc_, true); });
  return pop;
}

// ---------- Modals ----------
function openModal(content, { wide, onClose } = {}) {
  const back = h(`<div class="modal-back"><div class="sheet ${wide ? 'wide' : ''}"></div></div>`);
  const sheet = $('.sheet', back);
  if (typeof content === 'string') sheet.innerHTML = content; else sheet.appendChild(content);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); onClose && onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey, true);
  $('#modal-root').appendChild(back);
  back.close = close;
  return { el: sheet, close };
}

// Log / review / rate a title (also shown after you finish watching).
function openLog(meta, { afterWatch, onSaved, date, review: reviewMode } = {}) {
  const it = Store.item(`${meta.type}:${meta.id}`) || {};
  let rating = it.rating || 0, liked = !!it.liked;
  const wrap = h(`<div class="${reviewMode ? 'log-review' : ''}">
    <div class="sheet-head">
      <img src="${TMDB.img(meta.poster, 'w154')}" alt="">
      <div><div class="eyebrow">${afterWatch ? 'Finished watching' : reviewMode ? 'Write a review' : 'Add to diary'}</div><h3>${esc(meta.title)}</h3><div class="muted">${esc(meta.year || '')}</div></div>
      <button class="btn small round close">${ICON.x}</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:18px 0 22px">
      <div class="stars-slot"></div>
      <span class="like-toggle ${liked ? 'on' : ''}" title="Like">${liked ? ICON.heartFill : ICON.heart}</span>
      <span class="rating-text rt" style="margin-left:auto">${rating ? starsText(rating) : 'How was it?'}</span>
    </div>
    <div class="field"><textarea class="input review" placeholder="Add a review (optional)"></textarea></div>
    <div style="display:flex;align-items:center;gap:20px">
      <label class="check" style="margin:0"><input type="checkbox" class="rewatch" ${it.watched && !afterWatch && !reviewMode ? 'checked' : ''}> Rewatch</label>
      <input type="date" class="input date" value="${date || today()}" style="width:170px;padding:9px 12px">
      <div class="btns" style="margin-left:auto">
        ${afterWatch ? '<button class="btn skip">Not now</button>' : ''}
        <button class="btn primary save">Save</button>
      </div>
    </div>
  </div>`);
  $('.stars-slot', wrap).appendChild(starsInput(rating, v => { rating = v; $('.rt', wrap).textContent = v ? starsText(v) : 'How was it?'; }, 38));
  const heart = $('.like-toggle', wrap);
  heart.onclick = () => { liked = !liked; heart.classList.toggle('on', liked); heart.innerHTML = liked ? ICON.heartFill : ICON.heart; };
  const m = openModal(wrap);
  $('.close', wrap).onclick = m.close;
  if (reviewMode) { const ta = $('.review', wrap); ta.placeholder = 'What did you think?'; ta.style.minHeight = '150px'; setTimeout(() => ta.focus(), 80); }
  if ($('.skip', wrap)) $('.skip', wrap).onclick = m.close;
  $('.save', wrap).onclick = () => {
    Store.logDiary(meta, { date: $('.date', wrap).value, rating, liked, review: $('.review', wrap).value.trim(), rewatch: $('.rewatch', wrap).checked });
    Recs.cache = null;
    m.close();
    toast(`Logged ${meta.title}${rating ? ' · ' + starsText(rating) : ''}`);
    onSaved && onSaved();
  };
}

// ---------- Your reviews, readable from anywhere (detail page, diary, calendar, cards, menus, activity) ----------
// Every review you've written for a title: diary entries with text, plus a standalone review (e.g. imported).
function reviewsFor(key) {
  const it = Store.item(key) || {};
  const out = Store.data.diary.filter(e => e.key === key && e.review).sort((a, b) => b.date.localeCompare(a.date))
    .map(e => ({ e, text: e.review, date: e.date, rating: e.rating, liked: e.liked, rewatch: e.rewatch }));
  if (it.review && !out.some(r => r.text.trim() === it.review.trim())) out.push({ e: null, text: it.review, date: null, rating: it.rating, liked: it.liked });
  return out;
}
const hasReview = (key) => reviewsFor(key).length > 0;

function openReview(meta, focusId) {
  const key = `${meta.type}:${meta.id}`;
  const it = Store.item(key) || meta;
  const render = () => {
    const revs = reviewsFor(key);
    const views = Store.data.diary.filter(e => e.key === key).length;
    const wrap = h(`<div class="rv-sheet">
      <div class="rv-art" style="background-image:url('${TMDB.img(it.backdrop || it.poster, 'w780')}')"></div>
      <div class="rv-top">
        <img class="rv-poster" src="${TMDB.img(it.poster, 'w185')}" alt="">
        <div class="rv-info"><div class="eyebrow">${revs.length > 1 ? `Your ${revs.length} reviews` : 'Your review'}</div><h3>${esc(it.title)} <span class="dim">${esc(it.year || '')}</span></h3>
          <div class="rv-meta">${it.rating ? `<span class="rating-text">${starsText(it.rating)}</span>` : ''}${it.liked ? `<span>${ICON.heartFill} Liked</span>` : ''}${views ? `<span>${ICON.film} Logged ${views}×</span>` : ''}</div></div>
        <button class="btn small round close">${ICON.x}</button>
      </div>
      <div class="rv-list"></div>
      <div class="rv-foot"><button class="btn small ghost det">${ICON.info} Details</button><button class="btn small primary add">${ICON.pencil} ${revs.length ? 'Write another' : 'Write a review'}</button></div>
    </div>`);
    const list = $('.rv-list', wrap);
    if (!revs.length) list.appendChild(h(`<div class="dim" style="padding:8px 0 4px">You haven’t reviewed this yet.</div>`));
    revs.forEach((r, i) => {
      const el = h(`<article class="rv-item ${r.e && r.e.id === focusId ? 'focus' : ''}" style="animation-delay:${i * 40}ms">
        <div class="rv-when">${r.date ? `<b>${esc(new Date(r.date + 'T12:00').toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }))}</b>` : '<b>Review</b>'}
          ${r.rating ? `<span class="rating-text">${starsText(r.rating)}</span>` : ''}${r.liked ? `<span class="rv-heart">${ICON.heartFill}</span>` : ''}${r.rewatch ? `<span class="rv-tag">${ICON.rewatch} Rewatch</span>` : ''}
          <span class="rv-acts">${r.e ? `<button class="act rv-edit" title="Edit this entry">${ICON.pencil}</button>` : ''}<button class="act rv-del" title="Delete this review">${ICON.x}</button></span></div>
        <div class="rv-text">${reviewHtml(r.text)}</div></article>`);
      if (r.e) $('.rv-edit', el).onclick = () => { m.close(); editEntry(r.e, it, () => openReview(meta, r.e.id)); };
      $('.rv-del', el).onclick = () => {
        const undo = Store.removeReview(key, r.e && r.e.id);
        el.classList.add('rv-gone');
        setTimeout(() => { m.close(); if (reviewsFor(key).length) openReview(meta); rerender(); }, 260);
        toast('Review deleted', false, { label: 'Undo', fn: () => { undo(); toast('Review restored'); rerender(); } });
      };
      list.appendChild(el);
    });
    return wrap;
  };
  const wrap = render();
  const m = openModal(wrap, { wide: true });
  m.el.classList.add('rv-modal');
  $('.close', wrap).onclick = m.close;
  $('.det', wrap).onclick = () => { m.close(); go('detail', { type: it.type, id: it.id }); };
  $('.add', wrap).onclick = () => { m.close(); openLog(it, { onSaved: () => { rerender(); openReview(meta); } }); };
  const f = $('.rv-item.focus', wrap); if (f) setTimeout(() => f.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
}

const prettyDay = (d) => d === today() ? 'Today' : new Date(d + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: d.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' });

// After a movie finishes: it's already in your diary — just add stars (and a heart / review if you want).
function openAfterWatch(meta, entryId) {
  const e = Store.data.diary.find(x => x.id === entryId);
  if (!e) return;
  const prevRating = (Store.item(e.key) || {}).rating || 0;
  let rating = e.rating || 0, liked = !!e.liked;
  const wrap = h(`<div class="aw">
    <div class="aw-art" style="background-image:url('${TMDB.img(meta.backdrop || meta.poster, 'w780')}')"></div>
    <div class="aw-body">
      <img class="aw-poster" src="${TMDB.img(meta.poster, 'w185')}" alt="">
      <div class="aw-info">
        <div class="eyebrow aw-done">${ICON.checkCircleFill}<span>Logged to your diary</span></div>
        <h3>${esc(meta.title)}</h3>
        <div class="aw-chips">
          <span class="chip on">${ICON.film}${prettyDay(e.date)}</span>
          <button class="chip aw-re ${e.rewatch ? 'on' : ''}" title="Toggle rewatch">${ICON.rewatch}Rewatch</button>
        </div>
      </div>
      <button class="btn small round close">${ICON.x}</button>
    </div>
    <div class="aw-rate">
      <div class="stars-slot"></div>
      <span class="like-toggle ${liked ? 'on' : ''}" title="Like">${liked ? ICON.heartFill : ICON.heart}</span>
      <span class="rating-text rt">${rating ? starsText(rating) : (prevRating ? `Last time ${starsText(prevRating)}` : 'How was it?')}</span>
    </div>
    <div class="aw-review collapsed"><div><textarea class="input review" placeholder="Write a review (optional)">${esc(e.review || '')}</textarea></div></div>
    <div class="aw-foot">
      <button class="btn small ghost aw-undo">${ICON.undo} Remove from diary</button>
      <button class="btn small ghost rv">${ICON.pencil} Review</button>
      <button class="btn primary done" style="margin-left:auto">Done</button>
    </div>
  </div>`);
  const save = () => Store.updateDiary(entryId, { rating, liked, review: $('.review', wrap).value.trim(), rewatch: e.rewatch });
  $('.stars-slot', wrap).appendChild(starsInput(rating, v => { rating = v; $('.rt', wrap).textContent = v ? starsText(v) : 'How was it?'; save(); }, 40));
  const heart = $('.like-toggle', wrap);
  heart.onclick = () => { liked = !liked; heart.classList.toggle('on', liked); heart.innerHTML = liked ? ICON.heartFill : ICON.heart; save(); };
  $('.aw-re', wrap).onclick = (ev) => { e.rewatch = !e.rewatch; ev.currentTarget.classList.toggle('on', e.rewatch); Store.save(); };
  $('.rv', wrap).onclick = () => { const r = $('.aw-review', wrap); r.classList.remove('collapsed'); $('.rv', wrap).remove(); setTimeout(() => $('.review', r).focus(), 220); };
  const m = openModal(wrap, { onClose: () => { if (Store.data.diary.some(x => x.id === entryId)) save(); Recs.cache = null; rerender(); } });
  m.el.classList.add('aw-sheet');
  $('.close', wrap).onclick = m.close;
  $('.done', wrap).onclick = () => { m.close(); toast(`Logged ${meta.title}${rating ? ' · ' + starsText(rating) : ''}`); };
  $('.aw-undo', wrap).onclick = () => {
    const act = (Store.data.activity || []).find(a => a.diaryId === entryId);
    if (act && Store.canUndo(act)) Store.undo(act);
    else { Store.data.diary = Store.data.diary.filter(x => x.id !== entryId); Store.save(); }
    m.close(); toast('Removed from your diary');
  };
}

// One-click log bar for detail pages: date, stars and heart in one row; review is optional.
function logBar(meta, onChange) {
  const key = `${meta.type}:${meta.id}`;
  const el = h(`<section class="log-bar"></section>`);
  let lastLogged = null;
  const paint = () => {
    const it = Store.item(key) || {};
    const prior = Store.data.diary.some(e => e.key === key) || !!it.watched;
    if (lastLogged) {
      const e = Store.data.diary.find(x => x.id === lastLogged);
      if (!e) { lastLogged = null; return paint(); }
      el.className = 'log-bar done';
      el.innerHTML = `<div class="lb-ok">${ICON.checkCircleFill}</div>
        <div class="lb-msg"><b>Logged ${prettyDay(e.date).toLowerCase() === 'today' ? 'today' : 'for ' + prettyDay(e.date)}</b><span>${e.rating ? starsText(e.rating) : 'No rating'}${e.liked ? ' · Liked' : ''}${e.rewatch ? ' · Rewatch' : ''}${e.review ? ' · Reviewed' : ''}</span></div>
        <button class="btn small ghost lb-undo">${ICON.undo} Undo</button>
        <button class="btn small lb-again">${ICON.plus} Log again</button>`;
      $('.lb-undo', el).onclick = () => {
        const act = (Store.data.activity || []).find(a => a.diaryId === lastLogged);
        if (act && Store.canUndo(act)) Store.undo(act); else { Store.data.diary = Store.data.diary.filter(x => x.id !== lastLogged); Store.save(); }
        lastLogged = null; Recs.cache = null; toast('Log undone'); paint(); onChange && onChange();
      };
      $('.lb-again', el).onclick = () => { lastLogged = null; paint(); };
      return;
    }
    let rating = it.rating || 0, liked = !!it.liked, rewatch = prior;
    el.className = 'log-bar';
    el.innerHTML = `<div class="lb-label"><span class="eyebrow">Log a watch</span><span class="lb-hint">${prior ? 'You’ve seen this before' : 'Adds it to your diary'}</span></div>
      <label class="lb-date chip on" title="Change the date">${ICON.film}<span>Today</span><input type="date" value="${today()}" max="${today()}"></label>
      <button class="chip lb-re ${rewatch ? 'on' : ''}" title="Rewatch">${ICON.rewatch}Rewatch</button>
      <div class="lb-stars"></div>
      <span class="like-toggle ${liked ? 'on' : ''}" title="Like">${liked ? ICON.heartFill : ICON.heart}</span>
      <button class="act lb-rv" title="Add a review">${ICON.pencil}</button>
      <button class="btn primary small lb-go">${ICON.check} Log</button>
      <div class="lb-review collapsed"><div><textarea class="input" placeholder="Write a review (optional)"></textarea></div></div>`;
    const date = $('.lb-date input', el);
    date.onchange = () => { $('.lb-date span', el).textContent = prettyDay(date.value || today()); };
    $('.lb-date', el).onclick = (e) => { if (e.target !== date) { try { date.showPicker(); } catch {} } };
    $('.lb-re', el).onclick = (e) => { rewatch = !rewatch; e.currentTarget.classList.toggle('on', rewatch); };
    $('.lb-stars', el).appendChild(starsInput(rating, v => { rating = v; }, 26));
    const heart = $('.like-toggle', el);
    heart.onclick = () => { liked = !liked; heart.classList.toggle('on', liked); heart.innerHTML = liked ? ICON.heartFill : ICON.heart; };
    $('.lb-rv', el).onclick = (e) => { const r = $('.lb-review', el); r.classList.toggle('collapsed'); e.currentTarget.classList.toggle('on'); if (!r.classList.contains('collapsed')) setTimeout(() => $('textarea', r).focus(), 200); };
    $('.lb-go', el).onclick = () => {
      Store.logDiary(meta, { date: date.value || today(), rating, liked, review: $('.lb-review textarea', el).value.trim(), rewatch });
      lastLogged = Store.data.diary[Store.data.diary.length - 1].id;
      Recs.cache = null;
      toast(`Logged ${meta.title}${rating ? ' · ' + starsText(rating) : ''}`);
      paint(); onChange && onChange();
    };
  };
  el.refresh = () => { if (!lastLogged) paint(); };
  paint();
  return el;
}

function openAddToList(meta) {
  const key = `${meta.type}:${meta.id}`;
  const render = () => {
    const wrap = h(`<div>
      <div class="sheet-head"><div><h3>Add to list</h3><div class="muted">${esc(meta.title)}</div></div><button class="btn small round close">${ICON.x}</button></div>
      <div class="stream-list lists"></div>
      <div style="display:flex;gap:10px;margin-top:18px"><input class="input newname" placeholder="New list name…"><button class="btn primary create">Create</button></div>
    </div>`);
    const box = $('.lists', wrap);
    if (!Store.data.lists.length) box.innerHTML = '<div class="dim">No lists yet. Create one below.</div>';
    Store.data.lists.forEach(l => {
      const on = l.keys.includes(key);
      const r = h(`<div class="stream" style="grid-template-columns:1fr auto"><div><b>${esc(l.name)}</b><div class="fn">${l.keys.length} titles</div></div><div class="tag ${on ? 'cached' : ''}">${on ? '✓ Added' : 'Add'}</div></div>`);
      r.onclick = () => {
        if (on) l.keys = l.keys.filter(k => k !== key); else { l.keys.push(key); Store.upsert(meta); }
        Store.save(); m.close(); openAddToList(meta);
      };
      box.appendChild(r);
    });
    return wrap;
  };
  const wrap = render();
  const m = openModal(wrap);
  $('.close', wrap).onclick = m.close;
  const create = () => {
    const name = $('.newname', wrap).value.trim();
    if (!name) return;
    Store.data.lists.push({ id: uid(), name, desc: '', ranked: false, keys: [key], createdAt: Date.now() });
    Store.upsert(meta);
    Store.save(); m.close(); toast(`Added to “${name}”`);
  };
  $('.create', wrap).onclick = create;
  $('.newname', wrap).onkeydown = (e) => { if (e.key === 'Enter') create(); };
}
