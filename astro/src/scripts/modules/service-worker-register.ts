import { isProductionHostMatch, readExpectedSiteHostname } from "../../lib/runtime-host-gating";

document.addEventListener("DOMContentLoaded", () => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const unregisterAll = async (): Promise<void> => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      // Ignore unregistration errors.
    }
  };

  const expectedHostname = readExpectedSiteHostname();
  const shouldRegisterServiceWorker = isProductionHostMatch(
    expectedHostname,
    window.location.hostname,
  );

  if (!shouldRegisterServiceWorker) {
    void unregisterAll();
    return;
  }

  if (!window.isSecureContext) {
    return;
  }

  const swPathAttribute = document.body?.getAttribute("data-sw-path") ?? null;
  const swPath =
    typeof swPathAttribute === "string" && swPathAttribute.length > 0
      ? swPathAttribute
      : "service-worker.js";

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swPath)
      .then((registration) => registration.update().catch(() => undefined))
      .catch(() => {
        // Ignore registration failures.
      });
  });
});
