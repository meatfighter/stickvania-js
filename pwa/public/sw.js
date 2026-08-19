const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `stickvania-pwa-${VERSION}`;
const CACHE_PREFIXES = ["stickvania-", "stickvania-pwa-"];
const IGNORED_CACHE_SEARCH_PARAMS = new Set(["v"]);
const PRECACHE_URLS = ["./", "./index.html", "./manifest.webmanifest", "./images/icon.png", "./images/icon-192.png", "./images/icon-512.png"];

function canUseCacheApi(request) {
    const url = new URL(request.url);
    return request.method === "GET" && (url.protocol === "http:" || url.protocol === "https:");
}

function createCacheUrl(requestOrUrl) {
    const url = new URL(typeof requestOrUrl === "string" ? requestOrUrl : requestOrUrl.url, self.registration.scope);
    if (url.origin === self.location.origin) {
        for (const param of IGNORED_CACHE_SEARCH_PARAMS) {
            url.searchParams.delete(param);
        }
    }
    url.hash = "";
    return url.href;
}

self.addEventListener("message", (event) => {
    if (event.data === "skip-waiting") {
        self.skipWaiting();
    }
});

function remember(request, response) {
    if (!response.ok) {
        return;
    }
    const cacheUrl = createCacheUrl(request);
    const copy = response.clone();
    caches
        .open(CACHE_NAME)
        .then((cache) => cache.put(cacheUrl, copy))
        .catch(() => undefined);
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(PRECACHE_URLS.map((url) => createCacheUrl(url)));
            await self.skipWaiting();
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
        event.respondWith(
            fetch(request)
                .then((response) => {
                    remember("./index.html", response);
                    return response;
                })
                .catch(() => caches.match(createCacheUrl("./index.html")))
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
