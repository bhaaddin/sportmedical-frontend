/* Wakes the sleeping API while the bundle downloads (speed-api-09). Loaded by <script async src data-api="ORIGIN">,
   which vite.config.ts writes only when the build is given an absolute VITE_API_BASE_URL. One anonymous no-cors ping
   per browser session; the answer is ignored. Nothing here may ever throw. */
(function () {
  try {
    var tag = document.currentScript;
    var api = tag && tag.getAttribute('data-api');
    if (!api) return;
    try {
      if (sessionStorage.getItem('sm-early-wake')) return;
      sessionStorage.setItem('sm-early-wake', '1');
    } catch (e) { /* private mode: ping anyway */ }
    fetch(api + '/health/live', { mode: 'no-cors', cache: 'no-store', credentials: 'omit', keepalive: true }).catch(function () {});
  } catch (e) { /* never disturb the page */ }
})();
