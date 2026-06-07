import { computeLegacyBuildTimestamp } from "../lib/build-timestamp";

export function GET(): Response {
  const { iso } = computeLegacyBuildTimestamp();
  const version = iso.replace(/\D/g, "").slice(0, 14);

  const content = `/// <reference lib="webworker" />
// @ts-check
/**
 * Offline-first service worker. Auto-versioned at build time.
 *
 * Strategy:
 * - Online: network-first for same-origin GET requests (fresh data first).
 * - Offline: serve from cache; navigate requests fall back to /offline.html.
 */

const CACHE_VERSION = "${version}";
const PRECACHE_NAME = "person-portfolio-precache-" + CACHE_VERSION;
const RUNTIME_CACHE_NAME = "person-portfolio-runtime-" + CACHE_VERSION;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/stats.html",
  "/work.html",
  "/project.html",
  "/blog.html",
  "/ar.html",
  "/ar/stats.html",
  "/ar/work.html",
  "/ar/project.html",
  "/ar/blog.html",
  "/bn.html",
  "/bn/stats.html",
  "/bn/work.html",
  "/bn/project.html",
  "/bn/blog.html",
  "/ur.html",
  "/ur/stats.html",
  "/ur/work.html",
  "/ur/project.html",
  "/ur/blog.html",
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

// Install: precache shell + all pages so offline navigation works immediately.
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

// Activate: delete old versioned caches and claim all clients.
sw.addEventListener("activate", /** @param {ExtendableEvent} event */ function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== PRECACHE_NAME && key !== RUNTIME_CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
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
  if (runtimeMatch) return runtimeMatch;

  const precache = await caches.open(PRECACHE_NAME);
  const precacheMatch = await precache.match(request);
  if (precacheMatch) return precacheMatch;

  if (request.mode === "navigate") {
    return precache.match("/offline.html");
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
  } catch (_err) {
    const fallback = await matchOfflineFallback(request);
    if (fallback) return fallback;
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

// Fetch: network-first, same-origin GET only.
sw.addEventListener("fetch", /** @param {FetchEvent} event */ function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  const url = new URL(request.url);
  if (url.origin !== sw.location.origin) return;
  event.respondWith(networkFirst(request));
});
`;

  return new Response(content, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
    },
  });
}
