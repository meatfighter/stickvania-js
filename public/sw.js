const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `stickvania-pwa-${VERSION}`;
const CACHE_PREFIX = "stickvania-pwa-";
const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.webmanifest"
];

function canUseCacheApi(request) {
    const url = new URL(request.url);
    return request.method === "GET" && (url.protocol === "http:" || url.protocol === "https:");
}

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const { request } = event;
    if (!canUseCacheApi(request)) {
        return;
    }
    if (request.mode === "navigate") {
        event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
        return;
    }
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
