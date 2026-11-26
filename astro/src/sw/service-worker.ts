/**
 * Offline-first service worker. Auto-versioned at build time.
 *
 * Strategy:
 * - Online: network-first for same-origin GET requests (fresh data first).
 * - Offline: serve from cache; navigate requests fall back to /offline.html.
 *
 * Served at /service-worker.js by src/pages/service-worker.js.ts, which compiles this file
 * and declares CACHE_VERSION ahead of it. Type-checked against the worker globals by the
 * tsconfig.json beside it.
 */
declare const CACHE_VERSION: string;
declare const self: ServiceWorkerGlobalScope;

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

// Install: precache shell + all pages so offline navigation works immediately.
async function precacheSite(): Promise<void> {
  const cache = await caches.open(PRECACHE_NAME);
  await cache.addAll(PRECACHE_URLS);
  await self.skipWaiting();
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheSite());
});

// Activate: delete old versioned caches and claim all clients.
async function replaceOldCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key !== PRECACHE_NAME && key !== RUNTIME_CACHE_NAME)
      .map(async (key) => caches.delete(key)),
  );
  await self.clients.claim();
}

self.addEventListener("activate", (event) => {
  event.waitUntil(replaceOldCaches());
});

async function matchOfflineFallback(request: Request): Promise<Response | undefined> {
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

async function networkFirst(request: Request): Promise<Response> {
  const runtime = await caches.open(RUNTIME_CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await runtime.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const fallback = await matchOfflineFallback(request);
    if (fallback) return fallback;
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

// Fetch: network-first, same-origin GET only.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

export {};
