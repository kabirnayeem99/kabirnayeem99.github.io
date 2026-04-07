// @ts-check
/**
 * Registers the generated service worker.
 *
 * Registration is gated to secure contexts (or localhost) to match browser
 * service-worker requirements.
 */
document.addEventListener("DOMContentLoaded", function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  var hostname = window.location.hostname;
  var isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (!window.isSecureContext && !isLocalhost) {
    return;
  }

  var swPathAttribute = document.body ? document.body.getAttribute("data-sw-path") : null;
  var swPath = typeof swPathAttribute === "string" && swPathAttribute.length > 0
    ? swPathAttribute
    : "service-worker.js";

  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register(swPath)
      .then(function (registration) {
        return registration.update().catch(function () {
          // Ignore update probe failures.
        });
      })
      .catch(function () {
        // Ignore registration failures.
      });
  });
});
