// Counts a visit to this page (and clicks on download buttons marked data-count). No cookies, nothing personal:
// just "one more view of the download page today".
(function () {
  var SB = 'https://tsuyeypohzfcjikuuknh.supabase.co/rest/v1/rpc/count_view', KEY = 'sb_publishable_mc8VFdYKE_sMALLgRGsZhw_QqkJPlTm';
  function count(page) {
    try {
      fetch(SB, { method: 'POST', keepalive: true, headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_page: page }) }).catch(function () {});
    } catch (e) {}
  }
  window.reelCount = count;
  var page = document.currentScript && document.currentScript.getAttribute('data-page');
  if (page && !/^(localhost|127\.)/.test(location.hostname)) count(page);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-count]');
    if (a && !/^(localhost|127\.)/.test(location.hostname)) count(a.getAttribute('data-count'));
  });
})();
