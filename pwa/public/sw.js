const VERSION = "__SERVICE_WORKER_VERSION__";
const CACHE_NAME = `stickvania-pwa-${VERSION}`;
const CACHE_PREFIXES = ["stickvania-", "stickvania-pwa-"];
const PRECACHE_URLS = ["./", "./index.html", "./manifest.webmanifest", "./images/icon.png", "./images/icon-192.png", "./images/icon-512.png"];

function canUseCacheApi(request) {
    const url = new URL(request.url);
    return request.method === "GET" && (url.protocol === "http:" || url.protocol === "https:");
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
const PRECACHE_URL_SET = new Set(PRECACHE_CACHE_URLS);

function remember(request, response) {
    if (!response.ok) {
        return Promise.resolve(false);
    }
    const cacheUrl = createCacheUrl(request);
    if (!PRECACHE_URL_SET.has(cacheUrl)) {
        return Promise.resolve(false);
    }
    const copy = response.clone();
    return caches
        .open(CACHE_NAME)
        .then((cache) => cache.put(cacheUrl, copy))
        .then(() => true)
        .catch(() => false);
}

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
            await Promise.all(
                keys.filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)) && key !== CACHE_NAME).map((key) => caches.delete(key))
            );
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
        event.respondWith(
            fetch(request)
                .then((response) => {
                    remember(indexCacheUrl, response);
                    return response;
                })
                .catch(() => caches.match(indexCacheUrl).then((cached) => cached || caches.match(createCacheUrl("./index.html"))))
        );
        return;
    }
    event.respondWith(
        caches.match(createCacheUrl(request)).then((cached) => {
            const networked = fetch(request)
                .then((response) => {
                    remember(request, response);
                    return response;
                })
                .catch(() => cached);
            return cached || networked;
        })
    );
});
