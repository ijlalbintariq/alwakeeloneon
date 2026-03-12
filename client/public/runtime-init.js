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
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").catch(function () {});
      });
    }
  } catch (_err) {
    // no-op
  }
})();
