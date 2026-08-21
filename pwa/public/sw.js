const VERSION = "__SERVICE_WORKER_VERSION__";
const SCOPE_CACHE_ID = encodeURIComponent(new URL(self.registration.scope).pathname);
const CACHE_PREFIX = `stickvania-pwa-${SCOPE_CACHE_ID}-`;
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const PRECACHE_URLS = ["./", "./index.html", "./manifest.webmanifest", "./images/icon.png", "./images/icon-192.png", "./images/icon-512.png"];

function canUseCacheApi(request) {
    const url = new URL(request.url);
    return (
        request.method === "GET" &&
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.origin === self.location.origin &&
        url.href.startsWith(self.registration.scope)
    );
}

function createCacheUrl(requestOrUrl) {
    const url = new URL(typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url, self.registration.scope);
    if (url.origin === self.location.origin && !url.searchParams.has("v")) {
        url.searchParams.set("v", VERSION);
    }
    url.hash = "";
    return url.href;
}

function createNavigationIndexCacheUrl(request) {
    const indexUrl = new URL("./index.html", self.registration.scope);
    const requestUrl = new URL(request.url);
    if (requestUrl.origin === self.location.origin && requestUrl.searchParams.has("v")) {
        indexUrl.searchParams.set("v", requestUrl.searchParams.get("v"));
    }
    return createCacheUrl(indexUrl.href);
}

const PRECACHE_CACHE_URLS = PRECACHE_URLS.map((url) => createCacheUrl(url));

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(PRECACHE_CACHE_URLS);
        })()
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
            await self.clients.claim();
        })()
    );
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (!canUseCacheApi(request)) {
        return;
    }
    if (request.mode === "navigate") {
        const indexCacheUrl = createNavigationIndexCacheUrl(request);
        event.respondWith(fetch(request).catch(() => caches.match(indexCacheUrl).then((cached) => cached || caches.match(createCacheUrl("./index.html")))));
        return;
    }
    event.respondWith(
        caches.match(createCacheUrl(request)).then((cached) => {
            const networked = fetch(request).catch(() => cached);
            return cached || networked;
        })
    );
});
