// Reel Cloud — screens: sign-in, the account panel in Settings, Friends, a friend's profile, friends on a title page,
// and the "From your friends" row on Home.

const DISCORD_SVG = '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.5 19.5 0 0 0-4.9 1.5C.6 9.1-.3 13.7.1 18.2A19.8 19.8 0 0 0 6.1 21l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6zM8.3 15.5c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm7.4 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z"/></svg>';
const MAIL_SVG = '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 7.2L4 7.3V17h16V7.3zM5.2 7 12 11.1 18.8 7z"/></svg>';
const SYNC_SVG = '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a8 8 0 0 1 7.4 5H17v2h6V5h-2v2.3A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8zm8 8a8 8 0 0 1-15.4 3H7v-2H1v6h2v-2.3A10 10 0 0 0 22 12z"/></svg>';
const PARTY_SVG = '<svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l1 2H8l1-2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v9h16V7zm6 1.5 5 3-5 3z"/></svg>';

function timeAgo(t) {
  const s = Math.max(1, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
const fname = (p) => (p && (p.display_name || p.username)) || 'Someone';
const sharedMeta = (r) => ({ type: r.type, id: r.tmdb_id, title: r.title, year: r.year, poster: r.poster });

// ---------------- Sign in ----------------
const AccountUI = {
  // Sign a Fire TV / Android TV in to this account: type the code the TV shows.
  linkTv() {
    const wrap = h(`<div class="tvl-sheet">
      <div class="tvl-ico"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 14.5zM6 6v8h12V6zM8 18.5h8V20H8z"/></svg></div>
      <h3>Link a TV</h3>
      <p class="muted">Open Reel on your Fire TV and choose <b>Sign in</b>. Type the code it shows:</p>
      <input class="input tvl-code" maxlength="6" placeholder="ABC123" autocomplete="off" spellcheck="false">
      <div class="acct-err"></div>
      <div class="tvl-btns"><button class="btn ghost no">Cancel</button><button class="btn primary go">Link TV</button></div></div>`);
    const m = openModal(wrap);
    const inp = $('.tvl-code', wrap), err = $('.acct-err', wrap), go = $('.go', wrap);
    setTimeout(() => inp.focus(), 50);
    inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); err.textContent = ''; };
    $('.no', wrap).onclick = m.close;
    const run = async () => {
      const code = inp.value.trim();
      if (code.length !== 6) { err.textContent = 'Type the 6-character code shown on your TV.'; return; }
      go.disabled = true; go.textContent = 'Linking…';
      try {
        const { data, error } = await Cloud.sb.functions.invoke('tv-link', { body: { code } });
        let msg = data && data.error;
        if (error && !msg) { try { msg = (await error.context.json()).error; } catch { msg = 'Couldn’t reach Reel’s servers. Try again.'; } }
        if (msg) throw new Error(msg);
        m.close(); toast('TV linked — it’s signing in now');
      } catch (e) { err.textContent = cleanErr(e); go.disabled = false; go.textContent = 'Link TV'; }
    };
    go.onclick = run; inp.onkeydown = (e) => { if (e.key === 'Enter') run(); };
  },
  signIn(reason, mode) {
    if (!Cloud.sb) return toast('Reel account isn’t available right now', true);
    const wrap = h(`<div class="acct-sheet">
      <div class="acct-logo"><img src="icon.png" alt=""></div>
      <h3>Sign in to Reel</h3>
      <p class="muted">${esc(reason || 'Keep your ratings, diary and lists in sync on every PC, add friends, and watch together.')}</p>
      <div class="acct-step one">
        <button class="btn discord-btn dc">${DISCORD_SVG} Continue with Discord</button>
        <div class="acct-or"><span>or use a Reel username</span></div>
        <div class="acct-seg"><button type="button" data-t="in" class="on">Sign in</button><button type="button" data-t="up">Create account</button></div>
        <form class="acct-form" autocomplete="off" novalidate>
          <label class="acct-f"><span>Username</span><div class="at-field"><i>@</i><input class="input un" maxlength="24" spellcheck="false" autocomplete="username" placeholder="yourname"></div></label>
          <label class="acct-f"><span>Password</span><input class="input pw" type="password" autocomplete="current-password" placeholder="At least 8 characters"></label>
          <label class="acct-f up-only" hidden><span>Confirm password</span><input class="input pw2" type="password" autocomplete="new-password"></label>
          <div class="acct-err" role="alert"></div>
          <button class="btn primary acct-go" type="submit">Sign in</button>
          <div class="acct-hint up-only" hidden>Letters, numbers, dots and underscores. There’s no email, so pick a password you’ll remember — you can change it later in Settings.</div>
        </form>
      </div>
      <div class="acct-step wait" hidden><div class="spinner"></div><b class="wt">Finish signing in in your browser</b><span class="muted ws">Reel opens your browser to Discord. Approve it there and you’ll land back here.</span><button class="btn ghost small cancel">Cancel</button></div>
      <div class="acct-fine">Your keys, debrid login and Live TV stay on this PC.</div>
    </div>`);
    const m = openModal(wrap);
    const show = (cls) => $$('.acct-step', wrap).forEach(s => (s.hidden = !s.classList.contains(cls)));
    const done = () => { if (Cloud.on) { m.close(); toast(`Signed in as ${fname(Cloud.profile)}`); off(); } };
    const off = Cloud.watch(done);
    const onDone = (e) => { if (e.detail && e.detail.error) { show('one'); } };
    document.addEventListener('reel:signin-done', onDone);
    const close0 = m.close; m.close = () => { off(); document.removeEventListener('reel:signin-done', onDone); close0(); };
    $('.dc', wrap).onclick = async () => {
      show('wait');
      try { await Cloud.signInDiscord(); } catch (e) { show('one'); toast(cleanErr(e), true); }
    };
    $('.cancel', wrap).onclick = () => show('one');
    // Username + password
    const form = $('.acct-form', wrap), err = $('.acct-err', wrap), go = $('.acct-go', wrap);
    let tab = 'in';
    const setTab = (t) => {
      tab = t;
      $$('.acct-seg button', wrap).forEach(b => b.classList.toggle('on', b.dataset.t === t));
      $$('.up-only', wrap).forEach(x => (x.hidden = t !== 'up'));
      go.textContent = t === 'up' ? 'Create account' : 'Sign in';
      $('.pw', wrap).autocomplete = t === 'up' ? 'new-password' : 'current-password';
      err.textContent = '';
    };
    $$('.acct-seg button', wrap).forEach(b => (b.onclick = () => { setTab(b.dataset.t); $('.un', wrap).focus(); }));
    $('.un', wrap).oninput = (e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''); if (v !== e.target.value) e.target.value = v; };
    form.onsubmit = async (e) => {
      e.preventDefault();
      err.textContent = '';
      const un = $('.un', wrap).value.trim().toLowerCase(), pw = $('.pw', wrap).value, pw2 = $('.pw2', wrap).value;
      if (!/^[a-z0-9_.]{2,24}$/.test(un)) { err.textContent = 'Usernames are 2–24 letters, numbers, dots or underscores.'; return $('.un', wrap).focus(); }
      if (pw.length < 8) { err.textContent = 'Passwords need at least 8 characters.'; return $('.pw', wrap).focus(); }
      if (tab === 'up' && pw !== pw2) { err.textContent = 'The two passwords don’t match.'; return $('.pw2', wrap).focus(); }
      go.disabled = true; const label = go.textContent; go.innerHTML = '<span class="spinner sm"></span>';
      try {
        if (tab === 'up') await Cloud.signUpPassword(un, pw); else await Cloud.signInPassword(un, pw);
      } catch (ex) { err.textContent = cleanErr(ex); go.disabled = false; go.textContent = label; }
    };
    setTab(mode === 'up' ? 'up' : 'in');
    setTimeout(() => $('.un', wrap).focus(), 60);
  },

  editProfile() {
    const p = Cloud.profile || {};
    const wrap = h(`<div class="acct-edit"><h3>Your profile</h3>
      <div class="acct-edit-av">${Cloud.avatar(p, 64)}<div class="muted" style="font-size:13px">Your picture comes from Discord.</div></div>
      <div class="field"><span class="lbl">Favorite 4</span><div class="fav4 small">${(p.fav4 || []).length ? p.fav4.map(f => `<div class="f4" style="background-image:url('${TMDB.img(f.poster, 'w154')}')" title="${esc(f.title)}"></div>`).join('') : '<span class="hint" style="margin:0">None yet</span>'}</div><span class="hint">These are your Library favorites — change them in Library.</span></div>
      <label class="field"><span class="lbl">Display name</span><input class="input dn" maxlength="40" value="${esc(p.display_name || '')}"></label>
      <label class="field"><span class="lbl">Username</span><div class="at-field"><span>@</span><input class="input un" maxlength="24" value="${esc(p.username || '')}" spellcheck="false"></div><span class="hint">Friends add you with this. Letters, numbers, dots and underscores.</span></label>
      <label class="field"><span class="lbl">Bio</span><textarea class="input bio" maxlength="300" rows="3" placeholder="Favorite genres, hot takes…">${esc(p.bio || '')}</textarea></label>
      <div class="err"></div>
      <div class="btns" style="justify-content:flex-end"><button class="btn ghost no">Cancel</button><button class="btn primary yes">Save</button></div></div>`);
    const m = openModal(wrap);
    $('.no', wrap).onclick = m.close;
    $('.yes', wrap).onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        await Cloud.updateProfile({ display_name: $('.dn', wrap).value.trim(), username: $('.un', wrap).value.trim().toLowerCase().replace(/^@/, ''), bio: $('.bio', wrap).value.trim() });
        m.close(); toast('Profile saved');
      } catch (ex) { $('.err', wrap).textContent = cleanErr(ex); e.currentTarget.disabled = false; }
    };
  },

  // Settings → Reel account
  panel(slot) {
    const paint = async () => {
      if (!slot.isConnected) { off(); document.removeEventListener('reel:sync-status', paintSync); return; }
      slot.innerHTML = '';
      if (!Cloud.on) {
        const el = h(`<div class="panel acct-panel out"><div class="acct-hero"><div class="acct-glyph">${ICON.people}</div><div>
          <h3>Reel account</h3><p>Sign in to keep your library, friends, watch parties and debrid key with you on every computer.</p></div></div>
          <div class="btns"><button class="btn discord-btn">${DISCORD_SVG} Sign in with Discord</button><button class="btn un-in">Sign in with a username</button><button class="btn ghost un-up">Create an account</button></div></div>`);
        $('.discord-btn', el).onclick = () => this.signIn();
        $('.un-in', el).onclick = () => this.signIn(null, 'in');
        $('.un-up', el).onclick = () => this.signIn(null, 'up');
        slot.appendChild(el);
        return;
      }
      const p = Cloud.profile || {};
      const el = h(`<div class="panel acct-panel in">
        <div class="acct-me">${Cloud.avatar(p, 56)}<div class="acct-names"><b>${esc(fname(p))}</b><span>@${esc(p.username || '')} · ${Cloud.kind === 'discord' ? 'Signed in with Discord' : 'Username & password'}</span></div>
          ${Cloud.kind === 'password' ? '<button class="btn small ghost pwd">Change password</button>' : ''}<button class="btn small ghost edit">Edit profile</button><button class="btn small ghost tvlink">Link a TV</button></div>
        <div class="acct-sync"><span class="sync-dot"></span><span class="sync-txt"></span><button class="btn small ghost now">${SYNC_SVG} Sync now</button></div>
        <label class="check"><input type="checkbox" class="sh-lib"> Friends can see my ratings, reviews and watchlist</label>
        <label class="check"><input type="checkbox" class="sh-act"> Friends can see what I’m watching and my activity</label>
        <div class="acct-devs"><div class="acct-sub">Devices</div><div class="dev-list"><div class="muted" style="font-size:13px">Loading…</div></div></div>
        <div class="btns acct-btns"><button class="btn small ghost others">Sign out other devices</button><button class="btn small ghost out">Sign out</button><button class="btn small danger del">Delete account…</button></div>
      </div>`);
      slot.appendChild(el);
      $('.edit', el).onclick = () => this.editProfile();
      const pb = $('.pwd', el); if (pb) pb.onclick = () => this.changePassword();
      const tl = $('.tvlink', el); if (tl) tl.onclick = () => this.linkTv();
      $('.now', el).onclick = () => Sync.pushNow();
      const lib = $('.sh-lib', el), act = $('.sh-act', el);
      lib.checked = p.share_library !== false; act.checked = p.share_activity !== false;
      lib.onchange = () => Cloud.updateProfile({ share_library: lib.checked }).then(() => toast('Saved')).catch(e => toast(cleanErr(e), true));
      act.onchange = () => Cloud.updateProfile({ share_activity: act.checked }).then(() => toast('Saved')).catch(e => toast(cleanErr(e), true));
      $('.out', el).onclick = () => Cloud.signOut(false);
      $('.others', el).onclick = async () => { if (!(await confirmSheet('Sign out other devices?', 'Every other PC signed in to your account is signed out. This one stays signed in.', 'Sign out others'))) return; try { await Cloud.signOutOthers(); toast('Other devices signed out'); } catch (e) { toast(cleanErr(e), true); } };
      $('.del', el).onclick = () => this.deleteFlow();
      paintSync();
      Cloud.devices().then(list => {
        const box = $('.dev-list', el); if (!box) return;
        box.innerHTML = '';
        list.forEach(d => {
          const me = d.id === Cloud.cfg.device.id;
          const r = h(`<div class="dev"><span class="dev-ic"><svg class="ic" viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6z"/></svg></span><div><b>${esc(d.name || 'PC')}${me ? ' <em>This PC</em>' : ''}</b><span>${esc(d.platform === 'windows' ? 'Windows' : d.platform || '')} · Reel ${esc(d.version || '')} · ${me ? 'now' : timeAgo(d.last_seen)}</span></div>${me ? '' : '<button class="btn small ghost round fg" title="Remove from this list">' + ICON.x + '</button>'}</div>`);
          const fg = $('.fg', r); if (fg) fg.onclick = async () => { await Cloud.forgetDevice(d.id); r.remove(); };
          box.appendChild(r);
        });
      });
    };
    const paintSync = () => {
      const t = slot.querySelector('.sync-txt'), dot = slot.querySelector('.sync-dot');
      if (!t) return;
      const s = Sync.status;
      dot.className = 'sync-dot ' + s;
      t.textContent = s === 'syncing' ? 'Syncing…' : s === 'ok' ? `Library synced · ${timeAgo(Sync.lastAt)}` : s === 'offline' ? 'Offline — changes sync when you’re back online' : s === 'error' ? `Sync problem — ${Sync.err || 'will retry'}` : 'Starting…';
    };
    const off = Cloud.watch(paint);
    document.addEventListener('reel:sync-status', paintSync);
    paint();
  },
  changePassword() {
    const wrap = h(`<div class="acct-edit"><h3>Change password</h3>
      <label class="field"><span class="lbl">New password</span><input class="input p1" type="password" autocomplete="new-password" placeholder="At least 8 characters"></label>
      <label class="field"><span class="lbl">Confirm new password</span><input class="input p2" type="password" autocomplete="new-password"></label>
      <div class="err"></div>
      <div class="btns" style="justify-content:flex-end"><button class="btn ghost no">Cancel</button><button class="btn primary yes">Save password</button></div></div>`);
    const m = openModal(wrap);
    setTimeout(() => $('.p1', wrap).focus(), 50);
    $('.no', wrap).onclick = m.close;
    $('.yes', wrap).onclick = async (e) => {
      const p1 = $('.p1', wrap).value, p2 = $('.p2', wrap).value, er = $('.err', wrap);
      if (p1.length < 8) { er.textContent = 'Passwords need at least 8 characters.'; return; }
      if (p1 !== p2) { er.textContent = 'The two passwords don’t match.'; return; }
      e.currentTarget.disabled = true;
      try { await Cloud.changePassword(p1); m.close(); toast('Password changed'); } catch (ex) { er.textContent = cleanErr(ex); e.currentTarget.disabled = false; }
    };
  },
  async deleteFlow() {
    if (!(await confirmSheet('Delete your Reel account?', 'Your account, synced library copy, friends, activity and profile are permanently erased from the cloud. Your library on this PC stays.', 'Continue', true))) return;
    const wrap = h(`<div><h3>Are you absolutely sure?</h3><p class="muted" style="line-height:1.5">This can’t be undone. Type <b>DELETE</b> to confirm.</p><input class="input conf" placeholder="DELETE" style="margin-top:8px">
      <div class="btns" style="justify-content:flex-end;margin-top:20px"><button class="btn ghost no">Cancel</button><button class="btn danger-solid yes" disabled>Delete account</button></div></div>`);
    const m = openModal(wrap);
    const inp = $('.conf', wrap), yes = $('.yes', wrap);
    inp.oninput = () => (yes.disabled = inp.value.trim().toUpperCase() !== 'DELETE');
    $('.no', wrap).onclick = m.close;
    yes.onclick = async () => { yes.disabled = true; try { await Cloud.deleteAccount(); m.close(); toast('Account deleted'); } catch (e) { toast(cleanErr(e), true); yes.disabled = false; } };
  },
};

// ---------------- Friends page ----------------
const SocialUI = {
  feedLine(a) {
    const stars = a.rating ? ` <span class="fd-st">${starsText(a.rating).slice(2)}★</span>` : '';
    const what = `<b class="fd-t">${esc(a.title || '')}</b>`;
    switch (a.kind) {
      case 'watched': return `${a.rewatch ? 'rewatched' : 'watched'} ${what}${stars}`;
      case 'rated': return `rated ${what}${stars}`;
      case 'liked': return `liked ${what}`;
      case 'reviewed': return `reviewed ${what}${stars}`;
      case 'watchlist': return `wants to watch ${what}`;
      case 'party': return `started a watch party for ${what}`;
      default: return what;
    }
  },
  feedItem(a) {
    const [type, id] = String(a.key || '').split(':');
    const el = h(`<div class="fd-item">
      <button class="fd-who">${Cloud.avatar(a.who, 36)}</button>
      <div class="fd-body"><div class="fd-line"><b class="fd-name">${esc(fname(a.who))}</b> ${this.feedLine(a)}</div>
        ${a.body ? `<p class="fd-rev">${esc(a.body)}</p>` : ''}
        <div class="fd-time">${timeAgo(a.created_at)}${a.kind === 'party' && a.party && Date.now() - new Date(a.created_at) < 6 * 3600e3 ? ' · <button class="link join">Join the party</button>' : ''}</div></div>
      ${a.poster ? `<button class="fd-poster" style="background-image:url('${TMDB.img(a.poster, 'w154')}')"></button>` : ''}
    </div>`);
    $('.fd-who', el).onclick = () => go('friend', { id: a.user_id });
    const po = $('.fd-poster', el); if (po && type && id) po.onclick = () => go('detail', { type, id: +id });
    const j = $('.join', el); if (j) j.onclick = () => Party.join(a.party);
    return el;
  },
  friendCard(f, playing) {
    const pl = playing && playing.playing;
    const el = h(`<button class="fr-card">${Cloud.avatar(f, 44)}<div class="fr-names"><b>${esc(fname(f))}</b><span>${pl ? `<i class="live-dot"></i>Watching ${esc(pl.title || '')}${pl.season ? ` · S${pl.season}E${pl.episode}` : ''}` : '@' + esc(f.username)}</span></div>
      ${pl && pl.party ? `<span class="btn small primary join">Join</span>` : ''}</button>`);
    el.onclick = (e) => { if (e.target.closest('.join')) { e.stopPropagation(); return Party.join(pl.party); } go('friend', { id: f.id }); };
    return el;
  },
};

Views.friends = async (root) => {
  const page = h('<div class="page friends-page"></div>');
  root.appendChild(page);
  if (!Cloud.on) {
    page.appendChild(h(`<div class="fr-empty glass-empty"><div class="empty-ico">${ICON.people}</div><h3>Watch with your friends</h3>
      <p>Sign in to add friends, see what they’re rating and watching, and start watch parties that stay in sync.</p>
      <div class="btns" style="justify-content:center"><button class="btn discord-btn">${DISCORD_SVG} Sign in with Discord</button><button class="btn un-in">Use a username</button></div></div>`));
    $('.discord-btn', page).onclick = () => AccountUI.signIn();
    $('.un-in', page).onclick = () => AccountUI.signIn(null, 'in');
    const off = Cloud.watch(() => { if (Cloud.on && page.isConnected) { off(); rerender(); } });
    onLeave(off);
    return;
  }
  const p = Cloud.profile || {};
  page.appendChild(h(`<div class="fr-head">
    <div class="fr-me">${Cloud.avatar(p, 64)}<div><h1 class="page-title" style="margin:0">Friends</h1><div class="muted">You’re <button class="link copy-un">@${esc(p.username || '')}</button> — share it so friends can add you</div></div></div>
    <div class="fr-tools">
      <button class="btn small my-prof">${Cloud.avatar(p, 20)} My profile</button>
      <form class="fr-add" autocomplete="off"><span>@</span><input placeholder="Add a friend by username" spellcheck="false"><button class="btn small primary" type="submit">${ICON.plus} Add</button></form>
      <form class="fr-join" autocomplete="off"><input placeholder="Party code" maxlength="10" spellcheck="false" aria-label="Watch party code"><button class="btn small" type="submit">${PARTY_SVG} Join</button></form>
    </div></div>`));
  $('.my-prof', page).onclick = () => go('friend', { id: Cloud.user.id });
  $('.copy-un', page).onclick = () => { navigator.clipboard.writeText(p.username || ''); toast('Username copied'); };
  $('.fr-add', page).onsubmit = async (e) => {
    e.preventDefault();
    const inp = $('.fr-add input', page), v = inp.value.trim(); if (!v) return;
    try { const r = await Social.add(v); toast(r.accepted ? `You and ${fname(r.p)} are now friends` : `Friend request sent to ${fname(r.p)}`); inp.value = ''; paint(); }
    catch (ex) { toast(cleanErr(ex), true); }
  };
  $('.fr-join', page).onsubmit = (e) => { e.preventDefault(); const v = $('.fr-join input', page).value.trim(); if (v) Party.join(v); };
  const body = h('<div class="fr-body"><div class="fr-col side"></div><div class="fr-col main"></div></div>');
  page.appendChild(body);
  const side = $('.side', body), main = $('.main', body);
  const paint = async () => {
    await Social.refresh().catch(() => {});
    if (!page.isConnected) return;
    side.innerHTML = ''; main.innerHTML = '';
    if (Social.incoming.length) {
      const s = h('<section class="fr-sec"><h3 class="fr-h">Friend requests</h3></section>');
      Social.incoming.forEach(f => {
        const r = h(`<div class="fr-req">${Cloud.avatar(f, 40)}<div class="fr-names"><b>${esc(fname(f))}</b><span>@${esc(f.username)}</span></div><button class="btn small primary ok">Accept</button><button class="btn small ghost round no" title="Decline">${ICON.x}</button></div>`);
        $('.ok', r).onclick = async () => { await Social.accept(f.id); toast(`You and ${fname(f)} are now friends`); paint(); };
        $('.no', r).onclick = async () => { await Social.remove(f.id); paint(); };
        s.appendChild(r);
      });
      side.appendChild(s);
    }
    const now = await Social.nowPlaying().catch(() => []);
    const byUser = new Map(now.map(x => [x.user_id, x]));
    const fs = h(`<section class="fr-sec"><h3 class="fr-h">Your friends <span>${Social.friends.length || ''}</span></h3><div class="fr-list"></div></section>`);
    const list = $('.fr-list', fs);
    [...Social.friends].sort((a, b) => (byUser.has(b.id) ? 1 : 0) - (byUser.has(a.id) ? 1 : 0)).forEach(f => list.appendChild(SocialUI.friendCard(f, byUser.get(f.id))));
    if (!Social.friends.length) list.appendChild(h('<div class="fr-hint">No friends yet. Add someone by their Reel username above — they’ll get a request.</div>'));
    side.appendChild(fs);
    if (Social.outgoing.length) {
      const s = h('<section class="fr-sec"><h3 class="fr-h">Sent requests</h3></section>');
      Social.outgoing.forEach(f => { const r = h(`<div class="fr-req">${Cloud.avatar(f, 32)}<div class="fr-names"><b>${esc(fname(f))}</b><span>Waiting…</span></div><button class="btn small ghost">Cancel</button></div>`); $('.btn', r).onclick = async () => { await Social.remove(f.id); paint(); }; s.appendChild(r); });
      side.appendChild(s);
    }
    const feedSec = h('<section class="fr-sec"><h3 class="fr-h">Activity</h3><div class="fd-list"></div></section>');
    main.appendChild(feedSec);
    const feed = await Social.feed(60).catch(() => []);
    const fl = $('.fd-list', feedSec);
    if (!feed.length) fl.appendChild(h(`<div class="fr-hint">${Social.friends.length ? 'Nothing yet — when friends watch, rate or review something it shows up here.' : 'Add friends to see what they’re watching and rating.'}</div>`));
    feed.forEach(a => fl.appendChild(SocialUI.feedItem(a)));
  };
  paint();
  const onF = () => { if (page.isConnected) paint(); };
  const t = setInterval(onF, 60e3);
  onLeave(() => clearInterval(t));
};

// ---------------- Profiles (yours and your friends') ----------------
// What a profile shows — the same for everyone: favorites, diary, reviews and a few stats. Your own profile
// shows exactly what your friends see.
Views.friend = async (root, { id }) => {
  const page = h('<div class="page friend-page"></div>');
  root.appendChild(page);
  if (!Cloud.on) return go('friends', {}, true);
  const isMe = id === Cloud.user.id;
  await Social.ensure();
  let f = isMe ? Cloud.profile : Social.byId(id);
  if (!f) { const { data } = await Cloud.sb.from('profiles').select('*').eq('id', id).maybeSingle(); f = data; }
  if (!f) { page.appendChild(h(`<div class="center-empty glass-empty"><h3>Profile not found</h3></div>`)); return; }
  if (isMe) { try { await Sync.pushNow(); } catch {} }
  const isFriend = isMe || Social.friends.some(x => x.id === id);
  const lib = isFriend ? await Social.library(id).catch(() => []) : [];
  const watched = lib.filter(r => r.watched || r.last_ep), rated = lib.filter(r => r.rating);
  const films = watched.filter(r => r.type !== 'tv'), shows = watched.filter(r => r.type === 'tv');
  const year = String(new Date().getFullYear());
  const thisYear = watched.filter(r => String(r.watched_at || '').startsWith(year)).length;
  const avg = rated.length ? rated.reduce((a, r) => a + r.rating, 0) / rated.length : 0;
  const reviews = lib.filter(r => r.review);
  const m = isMe ? { pct: null } : Social.match(lib);
  const playing = !isMe && isFriend ? (await Social.nowPlaying().catch(() => [])).find(x => x.user_id === id) : null;
  const head = h(`<section class="fp-head">
    ${Cloud.avatar(f, 96)}
    <div class="fp-names"><h1>${esc(fname(f))}</h1><div class="muted">@${esc(f.username)}${isMe ? ' · this is how friends see you' : ''}</div>${f.bio ? `<p class="fp-bio">${esc(f.bio)}</p>` : ''}
      ${playing ? `<div class="fp-now"><i class="live-dot"></i>Watching <b>${esc(playing.playing.title || '')}</b>${playing.playing.party ? ' <button class="btn small primary join">Join the party</button>' : ''}</div>` : ''}</div>
    <div class="fp-stats">
      <div><b>${films.length.toLocaleString()}</b><span>Films</span></div>
      <div><b>${shows.length.toLocaleString()}</b><span>Shows</span></div>
      <div><b>${thisYear.toLocaleString()}</b><span>This year</span></div>
      <div><b>${avg ? avg.toFixed(2) : '–'}</b><span>Average rating</span></div>
      ${isMe ? `<div><b>${reviews.length.toLocaleString()}</b><span>Reviews</span></div>` : `<div class="match"><b>${m.pct != null ? m.pct + '%' : '–'}</b><span>${m.pct != null ? `Taste match · ${m.n} in common` : 'Taste match'}</span></div>`}
    </div>
    <div class="fp-acts">${isMe ? '<button class="btn small ghost ed">Edit profile</button>' : isFriend ? '<button class="btn small ghost rm">Remove friend</button>' : '<button class="btn small primary add">Add friend</button>'}</div>
  </section>`);
  page.appendChild(head);
  const j = $('.join', head); if (j) j.onclick = () => Party.join(playing.playing.party);
  const ed = $('.ed', head); if (ed) ed.onclick = () => { AccountUI.editProfile(); const off = Cloud.watch(() => { off(); if (page.isConnected) rerender(); }); };
  const rm = $('.rm', head); if (rm) rm.onclick = async () => { if (!(await confirmSheet(`Remove ${fname(f)}?`, 'You’ll stop seeing each other’s ratings and activity.', 'Remove', true))) return; await Social.remove(id); go('friends', {}, true); };
  const ad = $('.add', head); if (ad) ad.onclick = async () => { try { await Social.add(f.username); toast('Friend request sent'); ad.remove(); } catch (e) { toast(cleanErr(e), true); } };
  if (!isFriend) { page.appendChild(h(`<div class="fr-hint" style="margin-top:20px">Once you’re friends you’ll see ${esc(fname(f))}’s favorites, diary and reviews here.</div>`)); return; }
  if (isMe && Cloud.profile && Cloud.profile.share_library === false) page.appendChild(h(`<div class="fr-hint" style="margin-top:16px">Your library is hidden from friends right now — turn on “Friends can see my ratings…” in Settings to share it.</div>`));
  const rows = h('<div class="rows"></div>'); page.appendChild(rows);
  // Favorites
  if ((f.fav4 || []).length) {
    // Favorite films and favorite shows, side by side (each up to four).
    const s4 = h('<section class="row fp-favs"><div class="fp-fav-cols"></div></section>');
    const group = (title, list) => {
      if (!list.length) return;
      const col = h(`<div class="fp-fav-col"><h2 class="row-title">${title}</h2><div class="fav4"></div></div>`);
      list.forEach(x => { const [type, tid] = x.key.split(':'); const c = h(`<button class="f4" style="background-image:url('${TMDB.img(x.poster, 'w342')}')" title="${esc(x.title)}${x.year ? ` (${esc(x.year)})` : ''}"></button>`); c.onclick = () => go('detail', { type, id: +tid }); $('.fav4', col).appendChild(c); });
      $('.fp-fav-cols', s4).appendChild(col);
    };
    group('Favorite films', f.fav4.filter(x => !String(x.key).startsWith('tv:')));
    group('Favorite shows', f.fav4.filter(x => String(x.key).startsWith('tv:')));
    rows.appendChild(s4);
  } else if (isMe) rows.appendChild(h(`<section class="row fp-favs"><h2 class="row-title">Favorites</h2><div class="fr-hint" style="padding:0 var(--gutter)">Pick up to four films and four shows in Library → Favorites and they’ll show here.</div></section>`));
  // Diary — most recent film watches with the date and rating
  const diary = films.filter(r => r.poster).sort((a, b) => String(b.watched_at || '').localeCompare(String(a.watched_at || ''))).slice(0, 30);
  if (diary.length) {
    const fmt = (d) => { const x = d ? new Date(String(d).slice(0, 10) + 'T12:00') : null; return x && !isNaN(x) ? x.toLocaleDateString([], x.getFullYear() === new Date().getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }) : ''; };
    rows.appendChild(row('Diary', diary, (r) => posterCard(sharedMeta(r), { sub: [fmt(r.watched_at), r.rating ? starsText(r.rating) : '', r.liked ? '♥' : ''].filter(Boolean).join(' · ') || (r.year || '') }), 'most recent first'));
  }
  // Shows — where they are in each one ("S2 · E5"), most recently watched first
  const showRow = shows.filter(r => r.poster).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || ''))).slice(0, 30);
  if (showRow.length) {
    const ep = (r) => { const m = String(r.last_ep || '').match(/^(\d+):(\d+)$/); return m ? `S${m[1]} · E${m[2]}` : ''; };
    rows.appendChild(row('Shows', showRow, (r) => posterCard(sharedMeta(r), { sub: [ep(r) || (r.watched ? 'Watched' : ''), r.rating ? starsText(r.rating) : '', r.liked ? '♥' : ''].filter(Boolean).join(' · ') || (r.year || '') }), 'what they’re watching'));
  }
  // Reviews
  const revs = reviews.sort((a, b) => String(b.watched_at || '').localeCompare(String(a.watched_at || ''))).slice(0, 12);
  if (revs.length) {
    const s = h('<section class="row"><h2 class="row-title">Reviews</h2><div class="fp-revs"></div></section>');
    const when = (d) => { const x = d ? new Date(String(d).slice(0, 10) + 'T12:00') : null; return x && !isNaN(x) ? x.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : ''; };
    revs.forEach(r => {
      const long = reviewPlain(r.review).length > 260;
      const c = h(`<article class="fp-rev">
        <div class="fp-rev-p" style="background-image:url('${TMDB.img(r.poster, 'w154')}')"></div>
        <div class="fp-rev-body">
          <div class="fp-rev-head"><b>${esc(r.title)}</b>${r.year ? `<span>${esc(r.year)}</span>` : ''}</div>
          <div class="fp-rev-meta">${r.rating ? `<span class="rating-text">${starsText(r.rating)}</span>` : ''}${r.liked ? `<span class="rv-heart">${ICON.heartFill}</span>` : ''}${when(r.watched_at) ? `<span>${esc(when(r.watched_at))}</span>` : ''}</div>
          <div class="rv-text">${reviewHtml(r.review, 260)}</div>
          ${long ? '<button class="fp-rev-more">Read more</button>' : ''}
        </div></article>`);
      $('.fp-rev-p', c).onclick = $('.fp-rev-head b', c).onclick = () => go('detail', { type: r.type, id: r.tmdb_id });
      const more = $('.fp-rev-more', c);
      if (more) more.onclick = () => {
        const wrap = h(`<div class="fp-rev-full"><div class="sheet-head"><img src="${TMDB.img(r.poster, 'w154')}" alt=""><div><div class="eyebrow">${esc(fname(f))}’s review</div><h3>${esc(r.title)} <span class="dim">${esc(r.year || '')}</span></h3><div class="fp-rev-meta">${r.rating ? `<span class="rating-text">${starsText(r.rating)}</span>` : ''}${when(r.watched_at) ? `<span>${esc(when(r.watched_at))}</span>` : ''}</div></div><button class="btn small round close">${ICON.x}</button></div><div class="rv-text">${reviewHtml(r.review)}</div></div>`);
        const md = openModal(wrap); $('.close', wrap).onclick = md.close;
      };
      $('.fp-revs', s).appendChild(c);
    });
    rows.appendChild(s);
  }
  if (!diary.length && !showRow.length && !revs.length) rows.appendChild(h(`<div class="fr-hint" style="margin-top:12px">${isMe ? 'Nothing shared yet — rate or log a few films and they’ll show up here.' : `${esc(fname(f))} hasn’t shared anything yet.`}</div>`));
};


// ---------------- Friends on a title page ----------------
SocialUI.detailStrip = async (container, meta) => {
  if (!Cloud.on) return;
  const key = `${meta.type}:${meta.id}`;
  const slot = h('<section class="fr-strip" hidden></section>');
  container.appendChild(slot);
  const list = await Social.forTitle(key).catch(() => []);
  if (!slot.isConnected) return;
  const priv = !!(Store.item(key) || {}).private;
  if (!list.length && !priv) return;
  slot.hidden = false;
  slot.innerHTML = `<div class="frs-head"><span class="eyebrow">${list.length ? `Friends · ${list.length}` : 'Friends'}</span><button class="link vis">${priv ? 'Hidden from friends · Show' : 'Hide this from friends'}</button></div><div class="frs-list"></div>`;
  const box = $('.frs-list', slot);
  list.forEach(r => {
    const el = h(`<button class="frs-item">${Cloud.avatar(r.who, 34)}<div><b>${esc(fname(r.who))}</b><span>${[r.rating ? `<em class="fd-st">${starsText(r.rating).slice(2)}★</em>` : '', r.liked ? ICON.heartFill : '', !r.rating && r.watched ? 'Watched' : '', !r.watched && r.watchlist ? 'Wants to watch' : ''].filter(Boolean).join(' ')}</span>${r.review ? `<p>${esc(reviewPlain(r.review))}</p>` : ''}</div></button>`);
    el.onclick = () => go('friend', { id: r.user_id });
    box.appendChild(el);
  });
  $('.vis', slot).onclick = () => {
    const it = Store.item(key);
    if (!it) { Store.upsert(meta, { private: true }); } else { it.private = !it.private; Store.data.rev++; Store.save(); }
    toast((Store.item(key) || {}).private ? 'Hidden from friends' : 'Visible to friends');
    slot.remove(); SocialUI.detailStrip(container, meta);
  };
};

// ---------------- Home: from your friends ----------------
SocialUI.homeRow = (rows) => {
  if (!Cloud.on) return;
  const slot = h('<div></div>');
  rows.appendChild(slot);
  (async () => {
    const feed = await Social.feed(60).catch(() => []);
    const seen = new Set(), items = [];
    for (const a of feed) {
      if (!a.poster || !a.key || seen.has(a.key) || a.kind === 'party') continue;
      seen.add(a.key);
      const [type, id] = a.key.split(':');
      items.push({ a, m: { type, id: +id, title: a.title, year: a.year, poster: a.poster } });
      if (items.length >= 20) break;
    }
    if (!items.length || !slot.isConnected) return;
    const r = row('From your friends', items, ({ a, m }) => {
      const c = posterCard(m, { sub: `${fname(a.who).split(' ')[0]}${a.rating ? ' · ' + starsText(a.rating).slice(2) + '★' : a.kind === 'liked' ? ' ♥' : a.kind === 'watchlist' ? ' wants to watch' : ''}` });
      $('.art', c).insertAdjacentHTML('beforeend', `<span class="fr-badge">${Cloud.avatar(a.who, 26)}</span>`);
      return c;
    }, 'what they’re watching and rating');
    slot.appendChild(r);
    if (typeof enhanceShelf === 'function') enhanceShelf($('.shelf', r));
  })();
};

// Nav: the Friends button shows a dot when someone sent you a request.
function paintFriendsNav() {
  const b = document.querySelector('#nav [data-go="friends"]');
  if (!b) return;
  b.classList.toggle('has-dot', Cloud.on && Social.incoming.length > 0);
  b.title = Cloud.on ? (Social.incoming.length ? `Friends · ${Social.incoming.length} request${Social.incoming.length > 1 ? 's' : ''}` : 'Friends') : 'Friends & watch parties';
}
document.addEventListener('reel:friends', paintFriendsNav);
document.addEventListener('reel:cloud', paintFriendsNav);


// ---------------- Notifications (the bell) ----------------
// Friend requests, accepted requests and friends' watch parties. Seen state is per PC.
const BELL_SVG = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1z"/></svg>';
const Notify = {
  local: [], parties: [], seenParty: new Set(), t: null,
  seen() { try { return +localStorage.getItem('reel:notesSeen') || 0; } catch { return 0; } },
  markSeen() { try { localStorage.setItem('reel:notesSeen', String(Date.now())); } catch {} this.paint(); },
  add(n) { if (this.local.some(x => x.id === n.id)) return; this.local.unshift(n); this.local = this.local.slice(0, 30); this.paint(); },
  items() {
    const req = Social.incoming.map(p => ({ id: 'req:' + p.id, kind: 'request', who: p, at: Date.now() - 1 }));
    return [...req, ...this.parties, ...this.local].sort((a, b) => b.at - a.at);
  },
  unread() { const s = this.seen(); return this.items().filter(n => n.kind === 'request' || n.at > s).length; },
  start() { if (this.t && this.uid === Cloud.user.id) return this.paint(); this.stop(); this.uid = Cloud.user.id; this.poll(); this.t = setInterval(() => this.poll(), 60e3); },
  stop() { clearInterval(this.t); this.t = null; this.uid = null; this.parties = []; this.local = []; this.paint(); },
  async poll() {
    if (!Cloud.on) return;
    await Social.ensure();
    if (!Social.friends.length) { this.parties = []; return this.paint(); }
    const since = new Date(Date.now() - 6 * 3600e3).toISOString();
    const { data } = await Cloud.sb.from('activity').select('*').eq('kind', 'party').gt('created_at', since).in('user_id', Social.friends.map(f => f.id)).order('created_at', { ascending: false }).limit(10);
    const list = (data || []).map(a => ({ id: 'party:' + a.party, kind: 'party', who: Social.byId(a.user_id), title: a.title, poster: a.poster, code: a.party, at: new Date(a.created_at).getTime() })).filter(n => n.who);
    const first = !this.polled; this.polled = true;
    for (const n of list) {
      if (this.seenParty.has(n.code)) continue;
      this.seenParty.add(n.code);
      // New parties show up in the bell (with a badge) — never as a pop-up.
    }
    this.parties = list;
    this.paint();
  },
  paint() {
    const b = document.querySelector('#nav .nt-nav'); if (!b) return;
    b.hidden = !Cloud.on;
    const n = Cloud.on ? this.unread() : 0;
    b.classList.toggle('has-count', n > 0);
    b.dataset.count = n > 9 ? '9+' : String(n);
    b.title = n ? `Notifications · ${n} new` : 'Notifications';
  },
  line(n) {
    const who = `<b>${esc(fname(n.who))}</b>`;
    if (n.kind === 'request') return `${who} sent you a friend request`;
    if (n.kind === 'accepted') return `${who} accepted your friend request`;
    if (n.kind === 'party') return `${who} started a watch party for <b>${esc(n.title || '')}</b>`;
    return '';
  },
  open(anchor) {
    document.querySelectorAll('.nt-pop').forEach(x => x.remove());
    const seen = this.seen();
    const pop = h(`<div class="nt-pop"><div class="nt-head"><b>Notifications</b></div><div class="nt-list"></div></div>`);
    const list = $('.nt-list', pop), items = this.items();
    if (!items.length) list.appendChild(h('<div class="nt-empty">You’re all caught up.</div>'));
    items.forEach(n => {
      const r = h(`<div class="nt-item ${n.at > seen || n.kind === 'request' ? 'new' : ''}">${Cloud.avatar(n.who, 36)}<div class="nt-body"><div class="nt-line">${this.line(n)}</div><div class="nt-time">${n.kind === 'request' ? 'Waiting for you' : timeAgo(n.at)}</div></div><div class="nt-acts"></div></div>`);
      const acts = $('.nt-acts', r);
      if (n.kind === 'request') {
        const ok = h('<button class="btn small primary">Accept</button>'), no = h(`<button class="btn small ghost round" title="Decline">${ICON.x}</button>`);
        ok.onclick = async () => { await Social.accept(n.who.id); toast(`You and ${fname(n.who)} are now friends`); pop.remove(); };
        no.onclick = async () => { await Social.remove(n.who.id); r.remove(); this.paint(); };
        acts.append(ok, no);
      } else if (n.kind === 'party') {
        const j = h('<button class="btn small primary">Join</button>'); j.onclick = () => { pop.remove(); Party.join(n.code); }; acts.append(j);
      } else {
        r.classList.add('click'); r.onclick = () => { pop.remove(); go('friend', { id: n.who.id }); };
      }
      list.appendChild(r);
    });
    document.body.appendChild(pop);
    const a = anchor.getBoundingClientRect();
    pop.style.top = `${a.bottom + 10}px`;
    pop.style.left = `${Math.max(12, Math.min(innerWidth - pop.offsetWidth - 12, a.right - pop.offsetWidth + 20))}px`;
    this.markSeen();
    const away = (e) => { if (!pop.contains(e.target) && !anchor.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', away, true); } };
    setTimeout(() => document.addEventListener('mousedown', away, true));
  },
};
(function bell() {
  const fr = document.querySelector('#nav [data-go="friends"]');
  if (!fr) return;
  const b = h(`<button class="icon-btn nt-nav" title="Notifications" hidden>${BELL_SVG}</button>`);
  b.onclick = () => (document.querySelector('.nt-pop') ? document.querySelector('.nt-pop').remove() : Notify.open(b));
  const st = document.querySelector('#nav .nav-cluster [data-go=settings]');
  if (st) st.parentNode.insertBefore(b, st); else fr.parentNode.insertBefore(b, fr);
})();
document.addEventListener('reel:friends', () => Notify.paint());
document.addEventListener('reel:cloud', () => { if (Cloud.on) Notify.start(); else Notify.stop(); });
