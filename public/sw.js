// Perşembe Halısaha service worker.
//
// Pages and data always come from the network: they are per-player and change
// constantly (sign-ups, payments, votes), so serving a cached copy would show
// stale or someone else's state. The worker only
//  - caches content-hashed build assets (/_next/static) and public images, so the
//    installed app starts fast, and
//  - shows /offline.html when a page can't be reached at all.
// Bump VERSION to drop every cache on the next visit.

const VERSION = "v1"
const PRECACHE = `precache-${VERSION}`
const RUNTIME = `runtime-${VERSION}`
const OFFLINE_URL = "/offline.html"
const PRECACHE_URLS = [OFFLINE_URL, "/icon.svg", "/icon-192.png"]

// Every deploy adds new hashed chunks, so keep the runtime cache bounded.
const MAX_RUNTIME_ENTRIES = 200

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== PRECACHE && key !== RUNTIME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  // Supabase, Stripe and other third parties are left to the browser.
  if (url.origin !== self.location.origin) return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((response) => response || Response.error())),
    )
    return
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event, request))
    return
  }

  if (/\.(?:png|jpe?g|svg|webp|gif|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, request))
  }
})

// Hashed file names never change content, so a cached copy is always right.
async function cacheFirst(event, request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.status === 200) event.waitUntil(putInRuntimeCache(request, response.clone()))
  return response
}

// Public images keep their names across deploys: serve the cached copy at once
// and refresh it in the background.
async function staleWhileRevalidate(event, request) {
  const cached = await caches.match(request)
  const refresh = fetch(request).then((response) => {
    if (response.status === 200) event.waitUntil(putInRuntimeCache(request, response.clone()))
    return response
  })
  if (cached) {
    event.waitUntil(refresh.catch(() => {}))
    return cached
  }
  return refresh
}

async function putInRuntimeCache(request, response) {
  const cache = await caches.open(RUNTIME)
  await cache.put(request, response)
  const keys = await cache.keys()
  // keys() lists entries oldest first.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_RUNTIME_ENTRIES)).map((key) => cache.delete(key)))
}
