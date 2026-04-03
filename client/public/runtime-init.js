(function () {
  try {
    var base = window.location.origin + "/";
    var canonical = document.getElementById("canonical-link");
    if (canonical) canonical.setAttribute("href", base);
    var ogUrl = document.getElementById("og-url-meta");
    if (ogUrl) ogUrl.setAttribute("content", base);
  } catch (_err) {
    // no-op
  }

  try {
    if (!("serviceWorker" in navigator)) return;

    var host = String(window.location.hostname || "").toLowerCase();
    var swAllowedHosts = {
      "alwakeelo.com": true,
      "www.alwakeelo.com": true,
      "alwakeeloneon-1.onrender.com": true,
    };
    var shouldEnableServiceWorker = !!swAllowedHosts[host];

    if (!shouldEnableServiceWorker) {
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        registrations.forEach(function (registration) {
          registration.unregister().catch(function () {});
        });
      }).catch(function () {});

      if ("caches" in window) {
        caches.keys().then(function (keys) {
          keys
            .filter(function (key) { return key.indexOf("al-wakeelo-") === 0; })
            .forEach(function (key) {
              caches.delete(key).catch(function () {});
            });
        }).catch(function () {});
      }
      return;
    }

    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  } catch (_err) {
    // no-op
  }
})();
