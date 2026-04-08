/// <reference lib="webworker" />
// @ts-check
/**
 * Generated offline-first service worker.
 *
 * Strategy:
 * - Online: network-first for same-origin GET requests (fresh data first).
 * - Offline: fallback to cached content.
 *
 * Type notes:
 * - Includes WebWorker lib reference for editor + @ts-check type resolution.
 * - Event handlers use explicit JSDoc parameter types for stricter checks.
 */
const PRECACHE_NAME = "person-portfolio-precache-20260408-v6";
const RUNTIME_CACHE_NAME = "person-portfolio-runtime-20260408-v6";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/assets/css/styles.css",
  "/assets/icons/android-chrome-192x192.png",
  "/assets/icons/android-chrome-512x512.png",
  "/assets/icons/apple-touch-icon.png",
  "/assets/icons/favicon-16x16.png",
  "/assets/icons/favicon-32x32.png",
  "/assets/icons/favicon.ico",
  "/site.webmanifest",
];

/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// Install: precache shell/assets so first offline navigation succeeds.
sw.addEventListener("install", /** @param {ExtendableEvent} event */ function (event) {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return sw.skipWaiting();
      })
  );
});

// Activate: clean old caches and take control immediately.
sw.addEventListener("activate", /** @param {ExtendableEvent} event */ function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== PRECACHE_NAME && key !== RUNTIME_CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    }).then(function () {
      return sw.clients.claim();
    })
  );
});

/**
 * @param {Request} request
 * @returns {Promise<Response | undefined>}
 */
async function matchOfflineFallback(request) {
  const runtime = await caches.open(RUNTIME_CACHE_NAME);
  const runtimeMatch = await runtime.match(request);
  if (runtimeMatch) {
    return runtimeMatch;
  }

  const precache = await caches.open(PRECACHE_NAME);
  const precacheMatch = await precache.match(request);
  if (precacheMatch) {
    return precacheMatch;
  }

  if (request.mode === "navigate") {
    return precache.match("/index.html");
  }

  return undefined;
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  const runtime = await caches.open(RUNTIME_CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await runtime.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_error) {
    const fallback = await matchOfflineFallback(request);
    if (fallback) {
      return fallback;
    }

    if (request.mode === "navigate") {
      return new Response(
        "<!doctype html><title>Offline</title><h1>Offline</h1><p>This page is not available offline yet.</p>",
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
      );
    }

    return new Response("", { status: 504, statusText: "Offline" });
  }
}

// Fetch: network-first to keep data fresh while still working offline.
sw.addEventListener("fetch", /** @param {FetchEvent} event */ function (event) {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  // Skip unsupported devtools requests.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) {
    return;
  }

  event.respondWith(networkFirst(request));
});
