// Privacy-friendly event tracking, shared by every page. Sends only an event name, a short detail and
// the page path to /api/ping (see netlify/functions/ping.mjs); a page view also says which site sent the
// visitor (host only) and the size class of the screen (phone, tablet or desktop). No cookies, no
// identifiers, no message text, and nothing is sent when the browser has Do Not Track switched on.
// Errors, Web Vitals and feature timings are sent by obs.js.
(function () {
  function track(event, detail) {
    try {
      if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
      if (!navigator.sendBeacon) return;
      var data = { e: event, d: detail ? String(detail).slice(0, 40) : '', p: location.pathname.slice(0, 40) };
      if (event === 'view') {
        data.w = window.innerWidth < 700 ? 'phone' : window.innerWidth < 1100 ? 'tablet' : 'desktop';
        try {
          var host = document.referrer ? new URL(document.referrer).hostname.toLowerCase() : '';
          if (host && host !== location.hostname) data.r = host.slice(0, 60);
        } catch (e) {}
      }
      var body = JSON.stringify(data);
      navigator.sendBeacon('/api/ping', new Blob([body], { type: 'application/json' }));
    } catch (e) {}
  }
  window.track = track;

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('/files/') === 0) track('download', href.slice(7));
    else if (href.indexOf('mailto:') === 0 && href.indexOf('Document%20request') > -1) track('doc_request');
  });

  track('view', document.documentElement.getAttribute('data-persona') || '');
})();
