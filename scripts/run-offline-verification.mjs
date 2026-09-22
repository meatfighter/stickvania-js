import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { cleanupBrowser, launchBrowser, waitForExpression } from "./browser-test-utils.mjs";
import { resolveConfiguredDistDir } from "./build-utils.mjs";

const root = resolve(join(resolveConfiguredDistDir(), "pwa"));
if (!existsSync(join(root, "index.html"))) throw new Error("Built PWA is missing. Run npm run build before verify:browser.");
const port = 5199;
const baseUrl = `http://127.0.0.1:${port}/`;
const mime = {
    ".css": "text/css",
    ".html": "text/html",
    ".js": "text/javascript",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".png": "image/png",
    ".ogg": "audio/ogg",
    ".txt": "text/plain"
};
const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", baseUrl);
    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const path = resolve(root, normalize(requested));
    if (path !== root && !path.startsWith(`${root}/`) && !path.startsWith(`${root}\\`)) {
        response.writeHead(403).end();
        return;
    }
    if (!existsSync(path) || !statSync(path).isFile()) {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, { "Content-Type": mime[extname(path)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    createReadStream(path).pipe(response);
});
await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", resolveListen);
});
let browser = null;
try {
    browser = await launchBrowser(baseUrl, process.cwd(), "stickvania-offline-");
    await waitForExpression(browser.page, 'navigator.serviceWorker?.controller !== null && document.querySelector("#new-game-button") !== null', 30_000);
    // Reload under the active worker so every preloaded byte belongs to its cache.
    await browser.page.call("Page.enable");
    await browser.page.call("Page.reload", { ignoreCache: true });
    await waitForExpression(browser.page, "window.__gameResourcesPrepared === true", 120_000);
    await browser.page.call("Network.enable");
    await browser.page.call("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await browser.page.call("Page.enable");
    await browser.page.call("Page.reload", { ignoreCache: true });
    await waitForExpression(browser.page, 'document.querySelector("#new-game-button") !== null', 30_000);
    await waitForExpression(browser.page, "window.__gameResourcesPrepared === true", 120_000);
    await browser.page.call("Runtime.evaluate", { expression: 'document.querySelector("#new-game-button").click()', userGesture: true });
    await waitForExpression(browser.page, 'document.querySelector("canvas") !== null', 30_000);
    console.log("Stickvania production PWA prepared all resources and entered the game while offline.");
} finally {
    if (browser !== null) {
        try {
            await browser.page.call("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
        } catch {
            // Browser may already be shutting down.
        }
    }
    await cleanupBrowser(browser);
    await new Promise((resolveClose) => server.close(resolveClose));
}
