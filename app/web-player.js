// Reel on the web — playback. Reuses Reel's own player (same controls, subtitles, watch parties). Real-Debrid
// streams arrive as HLS (H.264 + AAC, converted on Real-Debrid's servers): Safari/iPhone plays that natively,
// other browsers through hls.js. Nothing is converted in the browser.
(() => {
  if (typeof Player === 'undefined') return;
  const load0 = Player.load.bind(Player);
  Player.load = function (t, play = true) {
    const s = this.cur; if (!s) return;
    s.needTx = false;                                   // never try the PC's converter
    if (!s.info || !s.info.hls) return load0(t, play);
    const v = s.video, url = s.info.directUrl;
    s.root.classList.add('buffering');
    if (s.hls) { try { s.hls.destroy(); } catch {} s.hls = null; }
    const native = v.canPlayType('application/vnd.apple.mpegurl');
    if (native) v.src = url;
    else if (window.Hls && Hls.isSupported()) {
      // Real-Debrid converts as it goes: the first piece can be empty for a moment and pieces far ahead may not be
      // ready yet, so retry patiently instead of failing.
      const hls = s.hls = new Hls({ enableWorker: true, startFragPrefetch: true, fragLoadingMaxRetry: 12, fragLoadingRetryDelay: 1500, fragLoadingMaxRetryTimeout: 8000, manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4, backBufferLength: 90 });
      let recovers = 0;
      hls.on(Hls.Events.ERROR, (_e, d) => {
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR && recovers++ < 6) hls.startLoad();
        else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && recovers++ < 6) hls.recoverMediaError();
        else if (this.cur === s) this.fail && this.fail('This stream stopped loading. Try another version.');
      });
      hls.loadSource(url);
      hls.attachMedia(v);
    } else { v.src = url; }
    if (t) v.addEventListener('loadedmetadata', () => { try { v.currentTime = t; } catch {} }, { once: true });
    if (play) v.play().catch(() => {});                 // a phone may want a tap first; the play button is there
    this.subsFollow && this.subsFollow(t);
  };
  // While a finger is dragging the progress bar, don't let playback repaint it under the finger.
  const paint0 = Player.paint && Player.paint.bind(Player);
  if (paint0) Player.paint = function (...a) { if (this.cur && this.cur.dragging) return; return paint0(...a); };
  const close0 = Player.close.bind(Player);
  Player.close = function (...a) {
    const s = this.cur;
    if (s && s.hls) { try { s.hls.destroy(); } catch {} s.hls = null; }
    return close0(...a);
  };
})();

// ---- phones: tap shows/hides the controls (it doesn't pause); double-tap the left/right side to skip 10 s ----
// A finger tap also sends a pretend mouse-move, which the player treats as "show the controls". So the state that
// counts is the one at the moment the finger touched down; otherwise the tap would show and hide them at once.
(() => {
  if (typeof Player === 'undefined') return;
  const isPhone = () => document.body.classList.contains('phone');
  let lastTap = 0, lastX = 0, single = 0, downIdle = false;
  const CONTROL = 'button, input, .scrub, .p-panel, .p-tools, .party-chat, .party-bar, .pause-info a';
  const show = (s) => {
    s.root.classList.remove('idle'); clearTimeout(s.idleT);
    s.idleT = setTimeout(() => { if (Player.cur === s && !s.video.paused && !Player.panel()) s.root.classList.add('idle'); }, 3500);
  };
  document.addEventListener('pointerdown', (e) => {
    const s = Player.cur;
    if (s && isPhone() && s.root.contains(e.target)) downIdle = s.root.classList.contains('idle');
  }, true);
  document.addEventListener('click', (e) => {
    const s = Player.cur;
    if (!s || !isPhone() || !s.root.contains(e.target)) return;
    if (e.target.closest(CONTROL)) {
      // Controls hidden: the first tap only brings them back, it doesn't press an invisible button.
      if (downIdle && e.target.closest('.chrome, .p-center, .p-top, .p-bottom')) { e.stopPropagation(); e.preventDefault(); show(s); }
      else show(s);
      return;
    }
    e.stopPropagation(); e.preventDefault();
    const now = Date.now(), x = e.clientX, w = innerWidth;
    if (now - lastTap < 300 && Math.abs(x - lastX) < 80) {                   // double-tap: skip
      clearTimeout(single);
      const dir = x < w / 3 ? -10 : x > (w * 2) / 3 ? 10 : 0;
      if (dir) { Player.skip ? Player.skip(dir) : Player.seek(Player.time() + dir); flash(s.root, dir); show(s); }
      lastTap = 0; return;
    }
    lastTap = now; lastX = x;
    const wasIdle = downIdle;
    single = setTimeout(() => {                                               // single tap: controls on/off
      if (Player.cur !== s) return;
      if (wasIdle) show(s);
      else { clearTimeout(s.idleT); s.root.classList.add('idle'); }
    }, 260);
  }, true);
  function flash(root, dir) {
    let el = root.querySelector('.web-skip');
    if (!el) { el = document.createElement('div'); el.className = 'web-skip'; root.appendChild(el); }
    el.textContent = dir > 0 ? '+10 s' : '−10 s';
    el.className = 'web-skip ' + (dir > 0 ? 'r' : 'l');
    void el.offsetWidth; el.classList.add('show');
  }

  // Drag along the progress bar with a finger (the computer version only knows clicks).
  document.addEventListener('pointerdown', (e) => {
    const s = Player.cur, bar = e.target.closest && e.target.closest('.player .scrub');
    if (!s || !bar || e.pointerType === 'mouse') return;
    e.preventDefault(); e.stopPropagation();
    const ht = bar.querySelector('.hover-time'), cur = bar.querySelector('.cur'), knob = bar.querySelector('.knob');
    const at = (ev) => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)); };
    let f = at(e);
    const paint = () => {
      const pct = (f * 100).toFixed(2) + '%';
      if (cur) cur.style.width = pct; if (knob) knob.style.left = pct;
      if (ht) { ht.textContent = fmtTime(f * Player.duration()); ht.style.left = pct; }
    };
    s.dragging = true; bar.classList.add('dragging'); show(s); clearTimeout(s.idleT); paint();
    try { bar.setPointerCapture(e.pointerId); } catch {}
    const move = (ev) => { f = at(ev); paint(); };
    const up = () => {
      bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
      bar.classList.remove('dragging'); s.dragging = false;
      Player.seek(f * Player.duration()); show(s);
    };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  }, true);
  // Stop the computer's click-to-seek from firing again after a drag.
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.player .scrub') && isPhone()) { e.stopPropagation(); } }, true);
})();

// ---- phones: turning sideways during a video goes full screen ----
// Android allows it as the phone turns; iPhone only on a tap, so there a "Tap for full screen" button appears
// (it opens the iPhone's own video player, which also turns with the phone).
(() => {
  if (typeof Player === 'undefined') return;
  const land = window.matchMedia('(orientation: landscape)');
  const isPhone = () => document.body.classList.contains('phone') || window.matchMedia('(pointer: coarse)').matches;
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const hint = () => {
    const s = Player.cur; if (!s) return null;
    let el = s.root.querySelector('.web-fs-hint');
    if (!el) {
      el = h(`<button class="web-fs-hint">${ICON.full.replace('<svg', '<svg class="ic"')}<span>Tap for full screen</span></button>`);
      el.onclick = (e) => { e.stopPropagation(); el.classList.remove('show'); window.reel.fullscreen(); };
      s.root.appendChild(el);
    }
    return el;
  };
  const onTurn = async () => {
    if (!Player.cur || !isPhone()) return;
    const el = Player.cur.root.querySelector('.web-fs-hint');
    if (!land.matches) { if (el) el.classList.remove('show'); return; }
    if (isFs()) return;
    let ok = false;
    if (document.documentElement.requestFullscreen) { try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); ok = true; } catch {} }
    if (!ok) { const b = hint(); if (b) { b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 7000); } }
  };
  if (land.addEventListener) land.addEventListener('change', onTurn); else land.addListener(onTurn);
})();
