// Reel — Complete your profile: everything that's missing from your history, fixable in place.
// Every answer here feeds recommendations (see Recs.profile()).

const Profile = {
  skips() { return (Store.data.profileSkips = Store.data.profileSkips || {}); },
  skipped(kind, key) { return !!(this.skips()[kind] || {})[key]; },
  skip(kind, key) { const s = this.skips(); (s[kind] = s[kind] || {})[key] = 1; Store.save(); },
  key: (i) => `${i.type}:${i.id}`,
  // The to-do lists, best first.
  tasks() {
    const items = Store.values();
    const watched = items.filter(i => i.watched);
    const byLove = (a, b) => (b.rating || 0) - (a.rating || 0) || (b.liked ? 1 : 0) - (a.liked ? 1 : 0) || String(b.watchedAt || b.lbAdded || '').localeCompare(String(a.watchedAt || a.lbAdded || ''));
    const logged = new Set(Store.data.diary.map(e => e.key));
    const nFav = (t) => Store.data.favorites.filter(k => k.startsWith(t + ':')).length;
    return {
      rate: watched.filter(i => !i.rating && !this.skipped('rate', this.key(i))).sort(byLove),
      heart: watched.filter(i => (i.rating || 0) >= 4 && !i.liked && !this.skipped('heart', this.key(i))).sort(byLove),
      review: watched.filter(i => (i.rating || 0) >= 4.5 && !i.review && !Store.data.diary.some(e => e.key === this.key(i) && e.review) && !this.skipped('review', this.key(i))).sort(byLove),
      date: watched.filter(i => i.type === 'movie' && !i.watchedAt && !logged.has(this.key(i)) && !this.skipped('date', this.key(i))).sort(byLove),
      favorites: (4 - Math.min(4, nFav('movie'))) + (watched.some(i => i.type === 'tv') ? 4 - Math.min(4, nFav('tv')) : 0),
      watched: watched.length,
    };
  },
  // 0–100. Ratings matter most; favorites next; hearts, reviews of your top picks and watch dates round it out.
  score(t = this.tasks()) {
    const W = t.watched || 1;
    const part = (left, total) => total ? 1 - Math.min(1, left / total) : 1;
    const hasTv = Store.values().some(i => i.watched && i.type === 'tv');
    const s = .45 * part(t.rate.length, W) + .2 * part(t.favorites, hasTv ? 8 : 4) + .12 * part(t.heart.length, Math.max(t.heart.length, Store.values().filter(i => (i.rating || 0) >= 4).length))
      + .1 * part(t.review.length, Math.max(t.review.length, Store.values().filter(i => (i.rating || 0) >= 4.5).length)) + .13 * part(t.date.length, Math.max(1, Store.values().filter(i => i.watched && i.type === 'movie').length));
    return t.watched ? Math.round(s * 100) : 0;
  },
};

const PROFILE_TABS = [
  ['rate', 'Rate', 'star', 'Watched but never rated. Stars teach your recommendations the most.'],
  ['favorites', 'Favorites', 'grid', 'Your four favorite films and shows weigh the most in everything Reel suggests.'],
  ['heart', 'Hearts', 'heart', 'Rated 4★ or more, but not liked. Tap the heart on the ones you love.'],
  ['review', 'Reviews', 'pencil', 'Your 4.5★+ titles with no review. A line or two is enough.'],
  ['date', 'Dates', 'film', 'Movies with no watch date. Add one to put them in your diary, calendar and Year in Review.'],
];
const profState = { tab: 'rate' };

Views.complete = async (root, { tab } = {}) => {
  if (tab) profState.tab = tab;
  const page = h(`<div class="page complete-page">
    <div class="cp-head">
      <div class="cp-ring"><svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="52"/><circle class="val" cx="60" cy="60" r="52"/></svg><div class="cp-pct"><b></b><span>complete</span></div></div>
      <div class="cp-intro"><div class="eyebrow">Your profile</div><h1 class="page-title" style="margin:2px 0 8px">Complete your profile</h1>
        <p class="muted">Fill in what’s missing from your history. Everything you add here shapes Home, For You, Mood Match and every other pick.</p></div>
    </div>
    <div class="cp-strength"></div>
    <div class="cp-tabs"></div>
    <div class="cp-desc dim"></div>
    <div class="cp-body"></div>
  </div>`);
  root.appendChild(page);
  const body = $('.cp-body', page);
  const C = 2 * Math.PI * 52;
  const ring = $('.cp-ring .val', page);
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C;

  const paintHead = () => {
    const t = Profile.tasks(), pct = Profile.score(t);
    requestAnimationFrame(() => (ring.style.strokeDashoffset = C * (1 - pct / 100)));
    $('.cp-pct b', page).textContent = `${pct}%`;
    const tabs = $('.cp-tabs', page);
    tabs.innerHTML = '';
    PROFILE_TABS.forEach(([k, label, icon]) => {
      const n = k === 'favorites' ? t.favorites : t[k].length;
      const b = h(`<button class="cp-tab ${k === profState.tab ? 'on' : ''} ${n ? '' : 'clear'}">${ICON[icon] || ''}<span>${label}</span><i>${n ? n.toLocaleString() : ICON.check}</i></button>`);
      b.onclick = () => { profState.tab = k; paintHead(); paintBody(); };
      tabs.appendChild(b);
    });
    $('.cp-desc', page).textContent = PROFILE_TABS.find(x => x[0] === profState.tab)[3];
    return t;
  };

  // A row leaves with a short collapse, then the header numbers update.
  const done = (row) => { row.classList.add('cp-done'); setTimeout(() => { row.remove(); paintHead(); if (!$('.cp-row', body)) paintBody(); }, 320); Recs.cache = null; };

  const paintBody = () => {
    const t = Profile.tasks();
    body.innerHTML = '';
    const tab = profState.tab;
    if (tab === 'favorites') {
      favoritesRow(body);
      const obs = new MutationObserver(() => paintHead());
      obs.observe(body, { childList: true, subtree: true });
      onLeave(() => obs.disconnect());
      return;
    }
    const list = t[tab];
    if (!list.length) {
      body.appendChild(h(`<div class="center-empty glass-empty"><div class="empty-ico">${ICON.checkCircleFill}</div><h3>All done here</h3>${t.watched ? 'Nothing left in this section.' : 'Mark things as watched (or import from Letterboxd) and this fills in.'}</div>`));
      return;
    }
    const grid = h('<div class="cp-list"></div>');
    body.appendChild(grid);
    let shown = 0;
    const more = h(`<button class="btn ghost cp-more">${ICON.chevDown} Show more</button>`);
    const addRows = () => {
      list.slice(shown, shown + 24).forEach((it, i) => grid.appendChild(rowFor(tab, it, i)));
      shown += 24;
      if (shown >= list.length) more.remove(); else { more.innerHTML = `${ICON.chevDown} Show more (${(list.length - shown).toLocaleString()})`; body.appendChild(more); }
    };
    more.onclick = addRows;
    addRows();
  };

  const rowFor = (tab, it, i) => {
    const key = Profile.key(it);
    const row = h(`<div class="cp-row" style="animation-delay:${Math.min(i, 12) * 25}ms">
      <img src="${TMDB.img(it.poster, 'w154')}" alt="">
      <div class="cp-info"><b>${esc(it.title)}</b><span>${[it.year, it.type === 'tv' ? 'TV' : '', it.rating ? starsText(it.rating) : '', it.liked ? '♥' : ''].filter(Boolean).join(' · ')}</span></div>
      <div class="cp-ctl"></div>
      <button class="act cp-skip" title="Skip — don’t ask about this one again">${ICON.x}</button>
    </div>`);
    $('img', row).onclick = $('.cp-info b', row).onclick = () => go('detail', { type: it.type, id: it.id });
    $('.cp-skip', row).onclick = () => { Profile.skip(tab, key); done(row); };
    const ctl = $('.cp-ctl', row);
    withMenu(row, it, row, 'cp-more');
    if (tab === 'rate') {
      ctl.appendChild(starsInput(0, v => { if (!v) return; rateWithUndo(it, v, () => {}); done(row); }, 26));
      const heart = h(`<span class="like-toggle ${it.liked ? 'on' : ''}" title="Like">${it.liked ? ICON.heartFill : ICON.heart}</span>`);
      heart.onclick = () => { const r = Store.toggleLike(it); heart.classList.toggle('on', !!r.liked); heart.innerHTML = r.liked ? ICON.heartFill : ICON.heart; Recs.cache = null; };
      ctl.appendChild(heart);
    }
    if (tab === 'heart') {
      const b = h(`<button class="btn small cp-love">${ICON.heart} Love it</button>`);
      b.onclick = () => { Store.toggleLike(it); b.innerHTML = `${ICON.heartFill} Loved`; b.classList.add('on'); done(row); };
      ctl.appendChild(b);
    }
    if (tab === 'review') {
      const box = h(`<div class="cp-review"><textarea class="input" rows="1" placeholder="What did you think?"></textarea><button class="btn small primary">Save</button></div>`);
      const ta = $('textarea', box);
      ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(160, ta.scrollHeight)}px`; };
      $('button', box).onclick = () => {
        const text = ta.value.trim(); if (!text) return ta.focus();
        Store.upsert(it, { review: text });
        const e = Store.data.diary.filter(d => d.key === key).sort((a, b) => b.date.localeCompare(a.date))[0];
        if (e && !e.review) e.review = text;
        Store.save(); toast('Review saved'); done(row);
      };
      ctl.appendChild(box);
    }
    if (tab === 'date') {
      const box = h(`<div class="cp-date"><input type="date" class="input" max="${today()}"><button class="btn small primary">${ICON.check} Add to diary</button></div>`);
      $('button', box).onclick = () => {
        const d = $('input', box).value; if (!d) { try { $('input', box).showPicker(); } catch {} return; }
        Store.logDiary(it, { date: d, rating: it.rating || 0, liked: !!it.liked, review: '', rewatch: false });
        toast(`Added to your diary · ${prettyDay(d)}`); done(row);
      };
      ctl.appendChild(box);
    }
    return row;
  };

  // Small library → warn that recommendations will be off, with the quickest ways to fix it.
  strengthCard($('.cp-strength', page), { warnOnly: true, here: 'complete' });
  paintHead();
  paintBody();
};

// How well Reel knows your taste — shared by Taste Profile, Complete Your Profile and This or That.
// Below "Good" it reads as a warning: recommendations will be off until you add more.
function strengthCard(container, { warnOnly = false, here = '' } = {}) {
  const st = Recs.strength();
  if (warnOnly && st.score >= 55) return;
  const weak = st.score < 55;
  const C = 2 * Math.PI * 34;
  const el = h(`<section class="ps-card ${weak ? 'weak' : ''}">
    <div class="ps-ring"><svg viewBox="0 0 80 80"><circle class="trk" cx="40" cy="40" r="34"/><circle class="val" cx="40" cy="40" r="34" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg><b>${st.score}</b></div>
    <div class="ps-main">
      <div class="ps-head"><span class="eyebrow">Taste profile strength</span><span class="ps-level">${weak ? `${ICON.info}` : ''}${st.level}</span></div>
      <p>${esc(st.note)}</p>
      <div class="ps-chips"><span><b>${st.rated}</b> rated</span><span><b>${st.liked}</b> liked</span><span><b>${st.favs}</b> favorites</span><span><b>${st.duels}</b> Rank matchups</span><span><b>${st.tot}</b> This or That</span></div>
      <div class="ps-btns"></div>
    </div></section>`);
  const btns = $('.ps-btns', el);
  [['seen', 'eye', 'Seen It', 'tap everything you’ve watched'], ['tot', 'shuffle', 'This or That', 'teach it what you like'], ['rank', 'layers', 'Rank', 'order your favorites'], ['complete', 'checkCircle', 'Complete profile', 'fill in the gaps']]
    .filter(([k]) => k !== here)
    .forEach(([k, icon, label, tip]) => {
      const b = h(`<button class="btn small ${weak && k === 'seen' ? 'primary' : ''}" title="${tip}">${ICON[icon]} ${label}</button>`);
      b.onclick = () => (k === 'complete' ? go('complete') : discGo(k));
      btns.appendChild(b);
    });
  container.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => ($('.val', el).style.strokeDashoffset = C * (1 - st.score / 100))));
  return el;
}

// The little "Complete your profile · 72%" card used in Library and Settings.
function profileNudge(container, compact) {
  const t = Profile.tasks(), pct = Profile.score(t);
  if (!t.watched) return;
  const left = t.rate.length + t.heart.length + t.review.length + t.date.length + t.favorites;
  const el = h(`<button class="profile-nudge ${compact ? 'compact' : ''}">
    <span class="pn-ring" style="--p:${pct}"><b>${pct}%</b></span>
    <span class="pn-txt"><b>${pct >= 100 ? 'Profile complete' : 'Complete your profile'}</b><small>${left ? `${t.rate.length ? `${t.rate.length.toLocaleString()} to rate · ` : ''}${left.toLocaleString()} things to fill in` : 'Everything’s filled in'}</small></span>
    ${ICON.back.replace('<svg', '<svg style="transform:rotate(180deg)"')}
  </button>`);
  el.onclick = () => go('complete');
  container.appendChild(el);
}
