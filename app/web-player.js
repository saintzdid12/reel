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
  const close0 = Player.close.bind(Player);
  Player.close = function (...a) {
    const s = this.cur;
    if (s && s.hls) { try { s.hls.destroy(); } catch {} s.hls = null; }
    return close0(...a);
  };
})();

// ---- phones: tap shows/hides the controls (it doesn't pause); double-tap the left/right side to skip 10 s ----
(() => {
  if (typeof Player === 'undefined') return;
  let lastTap = 0, lastX = 0, single = 0;
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('phone') || !Player.cur) return;
    const root = Player.cur.root;
    if (!root.contains(e.target) || e.target.closest('button, input, .scrub, .p-panel, .p-tools, .party-chat, .party-bar')) return;
    e.stopPropagation(); e.preventDefault();
    const now = Date.now(), x = e.clientX, w = innerWidth;
    if (now - lastTap < 300 && Math.abs(x - lastX) < 80) {                   // double-tap: skip
      clearTimeout(single);
      const dir = x < w / 3 ? -10 : x > (w * 2) / 3 ? 10 : 0;
      if (dir && Player.time) { Player.seek(Player.time() + dir); flash(root, dir); }
      lastTap = 0; return;
    }
    lastTap = now; lastX = x;
    single = setTimeout(() => {                                               // single tap: controls on/off
      const idle = root.classList.toggle('idle');
      clearTimeout(Player.cur && Player.cur.idleT);
      if (!idle && Player.cur && !Player.cur.video.paused) Player.cur.idleT = setTimeout(() => root.classList.add('idle'), 3500);
    }, 260);
  }, true);
  function flash(root, dir) {
    let el = root.querySelector('.web-skip');
    if (!el) { el = document.createElement('div'); el.className = 'web-skip'; root.appendChild(el); }
    el.textContent = dir > 0 ? '+10 s' : '−10 s';
    el.className = 'web-skip ' + (dir > 0 ? 'r' : 'l');
    void el.offsetWidth; el.classList.add('show');
  }
})();
