// The one top bar every page on reelwatch.stream uses, so it looks and sits the same everywhere.
// Load it as the first thing in <body>: <script src="/header.js"></script>
(function () {
  var css = 'html{scrollbar-gutter:stable}' +
    '.st{position:sticky;top:0;z-index:50;transition:background .3s cubic-bezier(.25,.8,.25,1),box-shadow .3s}' +
    '.st.on{background:rgba(0,0,0,.62);-webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);box-shadow:0 1px 0 rgba(255,255,255,.1)}' +
    '.st-in{box-sizing:border-box;max-width:1200px;margin:0 auto;padding:0 clamp(18px,5vw,64px);height:68px;display:flex;align-items:center;justify-content:space-between;gap:16px;' +
      'font:16px/1 Inter,-apple-system,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.st-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#f5f5f7;font-weight:700;font-size:18px;letter-spacing:-.02em}' +
    '.st-brand img{width:32px;height:32px;border-radius:8px;display:block}' +
    '.st-nav{display:flex;align-items:center;gap:22px}' +
    '.st-link{text-decoration:none;color:rgba(235,235,245,.68);font-weight:600;font-size:15px;transition:color .2s}' +
    '.st-link:hover,.st-link[aria-current]{color:#f5f5f7}' +
    '.st-get{display:inline-flex;align-items:center;height:38px;padding:0 18px;border-radius:999px;background:rgba(255,255,255,.95);color:#000;text-decoration:none;font-weight:600;font-size:14px;' +
      'box-shadow:inset 0 1px 0 #fff,0 10px 30px rgba(0,0,0,.35);transition:transform .3s cubic-bezier(.2,.9,.25,1.1)}' +
    '.st-get:hover{transform:scale(1.04)}.st-get:active{transform:scale(.96)}' +
    '.st a:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:6px}' +
    '@media (max-width:640px){.st-wide{display:none}.st-nav{gap:18px}}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var path = location.pathname;
  var here = function (p) { return path === p || path.indexOf(p) === 0 ? ' aria-current="page"' : ''; };
  var html = '<header class="st" id="st"><div class="st-in">' +
    '<a class="st-brand" href="/"><img src="/icon.png" alt="">Reel</a>' +
    '<nav class="st-nav" aria-label="Reel">' +
      '<a class="st-link st-wide" href="/#need">What you need</a>' +
      '<a class="st-link st-wide" href="/help/"' + here('/help/') + '>Help</a>' +
      '<a class="st-link" href="/watch/">Open Reel</a>' +
      '<a class="st-get" href="/download/"' + here('/download/') + '>Get Reel</a>' +
    '</nav></div></header>';
  var me = document.currentScript;
  if (me) me.insertAdjacentHTML('beforebegin', html); else document.body.insertAdjacentHTML('afterbegin', html);

  var bar = document.getElementById('st');
  var onScroll = function () { bar.classList.toggle('on', window.scrollY > 10); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
