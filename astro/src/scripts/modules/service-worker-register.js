// @ts-check
import {
  isProductionHostMatch,
  readExpectedSiteHostname,
} from "../../lib/runtime-host-gating";

/**
 * Registers the generated service worker.
 *
 * Registration is gated to the canonical production host only.
 */
document.addEventListener("DOMContentLoaded", function () {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  /**
   * @returns {Promise<void>}
   */
  async function unregisterAll() {
    try {
      var registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(function (registration) {
          return registration.unregister();
        })
      );
    } catch (_error) {
      // Ignore unregistration errors.
    }
  }

  var expectedHostname = readExpectedSiteHostname();
  var shouldRegisterServiceWorker = isProductionHostMatch(
    expectedHostname,
    window.location.hostname
  );
  if (!shouldRegisterServiceWorker) {
    void unregisterAll();
    return;
  }

  if (!window.isSecureContext) {
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
