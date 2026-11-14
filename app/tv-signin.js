// Reel TV — signing in. Two ways, side by side on one screen:
//   • Link with a code: the TV shows a short code; type it into Reel on your computer (Settings → Account → Link a device).
//   • Username & password: for Reel accounts made with a username (typed with the TV keyboard).
// Either way, your library and debrid key come with the account.
(() => {
  if (typeof AccountUI === 'undefined' || typeof Cloud === 'undefined') return;
  const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I mix-ups
  const rand = (n, set) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => set[b % set.length]).join('');
  const ICO = {
    discord: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.3 5.3A16.6 16.6 0 0 0 15.2 4l-.5 1a15.3 15.3 0 0 0-5.4 0L8.8 4a16.5 16.5 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.7 16.7a16.7 16.7 0 0 0 5 2.5l1.1-1.7c-.6-.2-1.2-.5-1.7-.9l.4-.3a11.9 11.9 0 0 0 11 0l.4.3c-.5.4-1.1.7-1.7.9l1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.3-.7-8.1-3-11.4zM8.7 14.4c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 14.5zM6 6v8h12V6zM3 18.5h18v1.5H3z"/></svg>',
    user: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9m0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5"/></svg>',
  };

  async function newCode() {
    for (let i = 0; i < 5; i++) {
      const code = rand(6, ABC), secret = rand(40, ABC + 'abcdefghijkmnpqrstuvwxyz');
      const { data, error } = await Cloud.sb.rpc('tv_link_create', { p_code: code, p_secret: secret });
      if (error) throw new Error('Can’t reach Reel’s servers. Check the TV’s internet connection.');
      if (data) return { code, secret, at: Date.now() };
    }
    throw new Error('Couldn’t make a code. Try again.');
  }

  // After signing in, Reel sets itself up (your library and streaming service arrive, setup finishes) and that
  // would flash a few screens. A calm cover sits on top until Home is actually on screen.
  function cover() {
    let el = document.querySelector('.tv-cover');
    if (!el) {
      el = h('<div class="tv-cover"><img src="icon.png" alt=""><b>Signing in…</b><span>Bringing over your library</span><div class="spinner sm"></div></div>');
      document.body.appendChild(el);
    }
    const t0 = Date.now();
    const done = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); if (window.tvFocus) setTimeout(() => window.tvFocus.start(), 120); };
    const check = () => {
      const home = typeof route !== 'undefined' && route.name === 'home' && document.querySelector('#view .hero, #view .rows .card');
      if (home || Date.now() - t0 > 20000) return setTimeout(done, home ? 500 : 0);
      if (typeof route !== 'undefined' && route.name === 'setup' && typeof Setup !== 'undefined' && Setup.done && typeof go === 'function') go('home', {}, true);
      setTimeout(check, 250);
    };
    check();
  }

  AccountUI.signIn = async function () {
    if (!Cloud.sb) return toast('Can’t reach Reel’s servers right now', true);
    const wrap = h(`<div class="tv-auth">
      <div class="ta-head"><img src="icon.png" alt=""><div><h2>Sign in to Reel</h2><p>Your library, ratings and streaming setup come with your account.</p></div></div>
      <div class="ta-cols">
        <section class="ta-card ta-link">
          <div class="ta-label">${ICO.link}<span>Link from your computer</span></div>
          <div class="ta-code"><span class="spinner sm"></span></div>
          <ol><li>Open <b>Reel</b> on your computer</li><li>Go to <b>Settings → Account → Link a device</b></li><li>Type this code</li></ol>
          <div class="ta-wait"><span class="spinner sm"></span><span>Waiting for your computer…</span></div>
        </section>
        <div class="ta-or"><span>or</span></div>
        <section class="ta-card ta-pass">
          ${window.REEL_WEB ? '<button class="btn ta-discord">' + ICO.discord + '<span>Continue with Discord</span></button><div class="ta-mini-or"><span>or use your username</span></div>' : ''}
          <div class="ta-label">${ICO.user}<span>Use your username</span></div>
          <label class="ta-field"><span>Username</span><input class="input ta-u" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="yourname"></label>
          <label class="ta-field"><span>Password</span><input class="input ta-p" type="password" autocomplete="current-password" placeholder="••••••••"></label>
          <div class="ta-err"></div>
          <button class="btn primary ta-go">Sign in</button>
          ${window.REEL_WEB ? '' : '<p class="ta-note">Signed up with Discord? Use the code instead.</p>'}
        </section>
      </div>
      <button class="btn close ta-cancel">Cancel</button>
    </div>`);
    let stopped = false;
    const m = openModal(wrap, { wide: true, onClose: () => { stopped = true; } });
    const back = wrap.closest('.modal-back'); if (back) back.classList.add('tv-auth-back');
    $('.ta-cancel', wrap).onclick = () => m.close();

    // Username & password
    const u = $('.ta-u', wrap), p = $('.ta-p', wrap), go = $('.ta-go', wrap), err = $('.ta-err', wrap);
    const submit = async () => {
      const name = u.value.trim(), pass = p.value;
      if (!name || !pass) { err.textContent = !name ? 'Type your username.' : 'Type your password.'; return; }
      err.textContent = ''; go.disabled = true; go.textContent = 'Signing in…';
      try {
        await Cloud.signInPassword(name, pass);
        stopped = true; cover(); m.close();
      } catch (e) { err.textContent = cleanErr(e); go.disabled = false; go.textContent = 'Sign in'; }
    };
    go.onclick = submit;
    const dc = $('.ta-discord', wrap);
    if (dc) dc.onclick = async () => { dc.disabled = true; $('span', dc).textContent = 'Opening Discord…'; try { await Cloud.signInDiscord(); } catch (e) { err.textContent = cleanErr(e); dc.disabled = false; $('span', dc).textContent = 'Continue with Discord'; } };
    // The TV keyboard's Enter: username → password → sign in.
    u.addEventListener('keydown', (e) => { if (e.key === 'Enter' && u.value.trim()) (window.tvFocus ? window.tvFocus.focus(p) : p.focus()); });
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' && p.value) submit(); });
    setTimeout(() => window.tvFocus && window.tvFocus.focus(u), 80);

    // Link with a code: a code now, a fresh one every 14 minutes, checked every 3 s.
    let link;
    const paint = () => { $('.ta-code', wrap).textContent = link.code; };
    try { link = await newCode(); paint(); } catch (e) { $('.ta-wait', wrap).textContent = cleanErr(e); return; }
    while (!stopped) {
      await new Promise((r) => setTimeout(r, 3000));
      if (stopped) break;
      try {
        if (Date.now() - link.at > 14 * 60e3) { link = await newCode(); paint(); continue; }
        const { data: tokenHash } = await Cloud.sb.rpc('tv_link_take', { p_code: link.code, p_secret: link.secret });
        if (!tokenHash) continue;
        $('.ta-wait span:last-child', wrap).textContent = 'Signing in…';
        const { error } = await Cloud.sb.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
        if (error) throw error;
        stopped = true; cover(); m.close();
        return;
      } catch (e) { $('.ta-wait span:last-child', wrap).textContent = cleanErr(e); }
    }
  };
})();

// TV start-up: the start screen (see build-www.mjs) stays until Reel knows whether you're signed in and the first
// real screen has settled: Home for you, or the sign-in screen — never one flashing before the other.
(() => {
  const boot = document.querySelector('.tv-boot');
  if (!boot) return;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const routeName = () => (typeof route !== 'undefined' ? route.name : '');
  (async () => {
    const t0 = Date.now(), late = () => Date.now() - t0 > 9000;
    while (!late() && !(typeof Cloud !== 'undefined' && Cloud.sb)) await wait(100);
    try {
      const { data } = await Cloud.sb.auth.getSession();
      // Signed in: wait for your account to load, and (first time on this TV) for your streaming service to arrive.
      if (data && data.session) while (!late() && (!Cloud.user || routeName() === 'setup')) await wait(150);
    } catch {}
    // Then a beat for the screen to draw.
    let last = routeName(), since = Date.now();
    while (!late()) { await wait(150); if (routeName() !== last) { last = routeName(); since = Date.now(); } if (last && Date.now() - since > 450 && document.querySelector('#view > *')) break; }
    boot.classList.add('out');
    setTimeout(() => boot.remove(), 400);
    if (window.tvFocus) setTimeout(() => window.tvFocus.start(), 120);
  })();
})();
