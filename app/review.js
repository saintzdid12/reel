// Reel — Year in Review: a Wrapped-style recap of a year of watching.

Views.review = async (root, { year } = {}) => {
  const years = [...new Set(Store.data.diary.map(e => e.date.slice(0, 4)).concat(Store.values().filter(i => i.watched && i.watchedAt).map(i => String(i.watchedAt).slice(0, 4))))].filter(y => /^\d{4}$/.test(y)).sort().reverse();
  year = String(year || years[0] || new Date().getFullYear());
  // Everything watched that year: diary entries, plus titles marked watched that year without an entry.
  const entries = Store.data.diary.filter(e => e.date.startsWith(year));
  const keys = new Set(entries.map(e => e.key));
  Store.values().filter(i => i.watched && String(i.watchedAt || '').startsWith(year)).forEach(i => keys.add(`${i.type}:${i.id}`));
  const items = [...keys].map(k => Store.item(k)).filter(Boolean);
  const films = items.filter(i => i.type === 'movie'), shows = items.filter(i => i.type === 'tv');
  const eps = Object.values(Store.data.episodes).reduce((a, s) => a + Object.values(s).filter(e => e.watched && String(e.at || '').startsWith(year)).length, 0);

  const page = h(`<div class="wrapped"><div class="wr-top"><div class="eyebrow">Year in Review</div><div class="wr-years"></div></div><div class="wr-body"></div></div>`);
  root.appendChild(page);
  const ys = $('.wr-years', page);
  years.slice(0, 8).forEach(y => { const b = h(`<button class="${y === year ? 'on' : ''}">${y}</button>`); b.onclick = () => go('review', { year: y }, true); ys.appendChild(b); });
  const body = $('.wr-body', page);
  if (items.length) { const sb = h('<button class="btn small primary wr-share">Share your year</button>'); $('.wr-top', page).appendChild(sb); sb.onclick = () => shareYearCard({ year, items, films, shows, minutes: 0, avg: 0 }, sb); }
  if (!items.length) { body.appendChild(h(`<section class="wr-card"><h1>Nothing logged in ${year}</h1><p class="muted">Watch and rate things this year and your recap builds itself.</p></section>`)); return; }

  const minutes = films.reduce((a, i) => a + (i.runtime || 110), 0) + eps * 45;
  const rated = items.filter(i => i.rating);
  const avg = rated.length ? rated.reduce((a, i) => a + i.rating, 0) / rated.length : 0;
  const byRating = (a, b) => (b.rating || 0) - (a.rating || 0) || (b.liked ? 1 : 0) - (a.liked ? 1 : 0);
  const top = [...items].filter(i => i.poster).sort(byRating).slice(0, 5);
  const g = {};
  items.forEach(i => (i.genres || []).forEach(x => (g[x] = (g[x] || 0) + 1)));
  const topG = Object.entries(g).sort((a, b) => b[1] - a[1]);
  const months = Array.from({ length: 12 }, (_, m) => entries.filter(e => +e.date.slice(5, 7) === m + 1).length);
  const bestM = months.indexOf(Math.max(...months));
  const monthName = (m) => new Date(2000, m, 1).toLocaleString('en-US', { month: 'long' });
  const rewatches = entries.filter(e => e.rewatch).length;
  const oldest = films.filter(i => i.year).sort((a, b) => a.year.localeCompare(b.year))[0];
  const hero = top[0];
  { const sb = $('.wr-share', page); if (sb) sb.onclick = () => shareYearCard({ year, items, films, shows, minutes, avg, top, genre: topG[0] && topG[0][0] }, sb); }

  const card = (html, cls = '') => { const c = h(`<section class="wr-card ${cls}">${html}</section>`); body.appendChild(c); return c; };
  card(`${hero && hero.backdrop ? `<div class="wr-bg" style="background-image:url('${TMDB.img(hero.backdrop, 'w1280')}')"></div>` : ''}
    <div class="wr-in"><div class="eyebrow">Your ${year}</div><h1 class="wr-big">${items.length.toLocaleString()}</h1><p class="wr-lead">titles watched — ${films.length} films${shows.length ? ` and ${shows.length} shows` : ''}${eps ? ` (${eps} episodes)` : ''}.</p>
    <div class="wr-stats"><div><b>${Math.round(minutes / 60).toLocaleString()}</b><span>hours</span></div><div><b>${entries.length}</b><span>diary entries</span></div><div><b>${avg ? avg.toFixed(1) : '–'}</b><span>average rating</span></div><div><b>${items.filter(i => i.liked).length}</b><span>likes</span></div></div></div>`, 'hero-card');

  if (top.length) {
    const c = card(`<div class="eyebrow">Your top ${top.length}</div><h2>The best of your year</h2><div class="wr-top5"></div>`);
    top.forEach((i, n) => {
      const el = h(`<div class="wr-poster" style="animation-delay:${n * 90}ms"><div class="rank">${n + 1}</div><div class="art" style="background-image:url('${TMDB.img(i.poster, 'w342')}')"></div><b>${esc(i.title)}</b><small>${i.rating ? starsText(i.rating) : ''}${i.liked ? ' · ♥' : ''}</small></div>`);
      el.onclick = () => go('detail', { type: i.type, id: i.id });
      $('.wr-top5', c).appendChild(el);
    });
  }
  if (topG.length) {
    const gm = topG[0][1];
    card(`<div class="eyebrow">Your genre</div><h2>You were all about <em>${esc(topG[0][0].toLowerCase())}</em></h2>
      <p class="wr-lead">${Math.round((topG[0][1] / items.length) * 100)}% of everything you watched.</p>
      <div class="wr-bars">${topG.slice(0, 6).map(([n, c]) => `<div class="hbar"><span>${esc(n)}</span><i style="width:${(c / gm) * 100}%"></i><span class="dim">${c}</span></div>`).join('')}</div>`);
  }
  if (entries.length) {
    const mm = Math.max(1, ...months);
    card(`<div class="eyebrow">Your busiest month</div><h2>${monthName(bestM)}</h2><p class="wr-lead">${months[bestM]} titles logged.</p>
      <div class="bars wr-months">${months.map((c, i) => `<div class="b" title="${c}"><i style="height:${(c / mm) * 100}%;${i === bestM ? 'background:#fff' : ''}"></i><span>${'JFMAMJJASOND'[i]}</span></div>`).join('')}</div>`);
  }
  // Director of the year
  const slot = card('<div class="spinner" style="margin:40px auto"></div>');
  try {
    const credits = await Promise.all(films.sort(byRating).slice(0, 20).map(i => TMDB.get(`/movie/${i.id}/credits`).catch(() => null)));
    const d = {};
    credits.filter(Boolean).forEach(c => (c.crew || []).filter(x => x.job === 'Director').forEach(x => { d[x.id] = d[x.id] || { ...x, n: 0 }; d[x.id].n++; }));
    const best = Object.values(d).sort((a, b) => b.n - a.n)[0];
    if (best && best.n >= 2) {
      slot.innerHTML = `<div class="wr-person" data-pid="${best.id}"><div class="face" style="background-image:url('${TMDB.img(best.profile_path, 'w342')}')"></div>
        <div><div class="eyebrow">Director of your year</div><h2>${esc(best.name)}</h2><p class="wr-lead">${best.n} of their films made your year.</p></div></div>`;
      $('.wr-person', slot).onclick = () => go('person', { id: best.id });
    } else slot.remove();
  } catch { slot.remove(); }
  card(`<div class="eyebrow">A few more things</div><h2>Your year, in numbers</h2><div class="wr-facts">
    <div><b>${rewatches}</b><span>rewatches</span></div>
    <div><b>${rated.filter(i => i.rating >= 4.5).length}</b><span>rated 4.5★ or higher</span></div>
    <div><b>${oldest ? oldest.year : '–'}</b><span>oldest film${oldest ? ` · ${esc(oldest.title)}` : ''}</span></div>
    <div><b>${entries.filter(e => e.review).length}</b><span>reviews written</span></div>
  </div>`);
};

// "Share your year": a 1080×1920 image (the size Instagram and TikTok stories use) with your numbers and top five,
// to save or share. Posters come from TMDB; if one can't load the card is drawn without it.
async function shareYearCard(d, btn) {
  if (btn) btn.disabled = true;
  try {
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const load = (src) => new Promise((res) => { if (!src) return res(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
    const top = (d.top || []).slice(0, 5);
    const [bg, ...posters] = await Promise.all([load(top[0] && top[0].backdrop ? TMDB.img(top[0].backdrop, 'w1280') : null), ...top.map((i) => load(TMDB.img(i.poster, 'w342')))]);
    try { await document.fonts.ready; } catch {}
    const F = (w, s) => `${w} ${s}px Inter, "SF Pro Display", -apple-system, "Segoe UI", sans-serif`;
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    if (bg) {
      x.save(); x.filter = 'blur(40px) saturate(1.3) brightness(.55)';
      const s = Math.max(W / bg.width, 1250 / bg.height); x.drawImage(bg, (W - bg.width * s) / 2, -80, bg.width * s, bg.height * s); x.restore();
    }
    const fade = x.createLinearGradient(0, 360, 0, 1250); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, '#000');
    x.fillStyle = fade; x.fillRect(0, 0, W, 1300);
    const name = (typeof Cloud !== 'undefined' && Cloud.profile && (Cloud.profile.display_name || Cloud.profile.username)) || '';
    x.fillStyle = 'rgba(235,235,245,.7)'; x.font = F(600, 40); x.fillText(name ? `${name}’s ${d.year} on Reel` : `My ${d.year} on Reel`, 80, 190);
    x.fillStyle = '#fff'; x.font = F(800, 340); x.fillText(d.items.length.toLocaleString(), 62, 560);
    x.font = F(700, 56); x.fillText(`titles watched`, 80, 650);
    x.fillStyle = 'rgba(235,235,245,.7)'; x.font = F(500, 40);
    x.fillText([`${d.films.length} film${d.films.length === 1 ? '' : 's'}`, d.shows.length ? `${d.shows.length} show${d.shows.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and '), 80, 715);
    // Numbers
    const stats = [[Math.round((d.minutes || 0) / 60).toLocaleString(), 'hours'], [d.avg ? d.avg.toFixed(1) : '–', 'average rating'], [d.genre || '–', 'top genre']];
    stats.forEach(([v, l], i) => {
      const sx = 80 + i * 320; x.fillStyle = '#fff'; x.font = F(800, String(v).length > 7 ? 50 : 80); x.fillText(String(v), sx, 920);
      x.fillStyle = 'rgba(235,235,245,.6)'; x.font = F(500, 34); x.fillText(l, sx, 972);
    });
    // Top five
    if (top.length) {
      x.fillStyle = '#fff'; x.font = F(700, 56); x.fillText('My top ' + top.length, 80, 1170);
      const pw = 164, ph = 246, gap = (W - 160 - pw * 5) / 4;
      top.forEach((it, i) => {
        const px = 80 + i * (pw + gap), py = 1222, im = posters[i];
        x.save(); x.beginPath(); x.roundRect ? x.roundRect(px, py, pw, ph, 16) : x.rect(px, py, pw, ph); x.clip();
        x.fillStyle = '#1c1c1e'; x.fillRect(px, py, pw, ph);
        if (im) x.drawImage(im, px, py, pw, ph);
        x.restore();
        x.fillStyle = 'rgba(235,235,245,.85)'; x.font = F(700, 34); x.fillText(String(i + 1), px, py + ph + 48);
        x.fillStyle = 'rgba(235,235,245,.6)'; x.font = F(500, 26);
        let t = it.title || ''; while (t.length > 3 && x.measureText(t).width > pw - 34) t = t.slice(0, -2); if (t !== it.title) t = t.trim() + '…';
        x.fillText(t, px + 32, py + ph + 46);
      });
    }
    // Footer
    const u = typeof Cloud !== 'undefined' && Cloud.profile && Cloud.profile.username;
    x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(80, 1700, W - 160, 2);
    x.fillStyle = '#fff'; x.font = F(800, 46); x.fillText('Reel', 80, 1790);
    x.fillStyle = 'rgba(235,235,245,.7)'; x.font = F(500, 34); x.textAlign = 'right'; x.fillText(u ? `reelwatch.stream/@${u}` : 'reelwatch.stream', W - 80, 1788); x.textAlign = 'left';

    let blob = null;
    try { blob = await new Promise((r) => c.toBlob(r, 'image/png')); } catch {}
    if (!blob) { // a poster without permission to be copied: draw again without images
      throw new Error('tainted');
    }
    const url = URL.createObjectURL(blob);
    const file = typeof File !== 'undefined' ? new File([blob], `reel-${d.year}.png`, { type: 'image/png' }) : null;
    const sheet = h(`<div class="yc-sheet"><h3>Your ${d.year}</h3><img class="yc-img" src="${url}" alt="Your year on Reel"><div class="btns end"><button class="btn ghost yc-close">Close</button>${file && navigator.canShare && navigator.canShare({ files: [file] }) ? '<button class="btn yc-share">Share</button>' : ''}<a class="btn primary yc-save" href="${url}" download="reel-${d.year}.png">Save image</a></div></div>`);
    const m = openModal(sheet, { onClose: () => setTimeout(() => URL.revokeObjectURL(url), 60000) });
    $('.yc-close', sheet).onclick = m.close;
    const sh = $('.yc-share', sheet); if (sh) sh.onclick = () => navigator.share({ files: [file], title: `My ${d.year} on Reel` }).catch(() => {});
  } catch (err) {
    toast('Couldn’t make your card right now', true);
  } finally { if (btn) btn.disabled = false; }
}
