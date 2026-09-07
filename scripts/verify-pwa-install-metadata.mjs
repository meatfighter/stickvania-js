import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveConfiguredDistDir } from "./build-utils.mjs";

const distPwaDir = join(resolveConfiguredDistDir(), "pwa");
const manifestPath = join(distPwaDir, "manifest.webmanifest");
const serviceWorkerPath = join(distPwaDir, "sw.js");

assert.ok(existsSync(manifestPath), "Built PWA manifest is missing.");
assert.ok(existsSync(serviceWorkerPath), "Built PWA service worker is missing.");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const serviceWorker = readFileSync(serviceWorkerPath, "utf8");
const installIconVersions = readInstallIconVersions(serviceWorker);
const relocationScopes = [
    "https://example.invalid/stickvania/pwa/",
    "https://example.invalid/stickvania-staging/pwa/",
    "https://example.invalid/foo/bar/baz/pwa/"
];
const identityUrls = new Set();

for (const scopeUrl of relocationScopes) {
    const scope = new URL(manifest.scope, scopeUrl).href;
    const startUrl = new URL(manifest.start_url, scopeUrl);
    const identityUrl = new URL(manifest.id, `${startUrl.origin}/`).href;

    assert.equal(scope, scopeUrl, `Manifest scope must resolve to the current PWA directory for ${scopeUrl}.`);
    assert.equal(startUrl.href, scopeUrl, `Manifest start_url must remain stable and resolve to the current PWA directory for ${scopeUrl}.`);
    assert.equal(identityUrl, `${startUrl.origin}/stickvania`, `Manifest id must resolve to the Stickvania game identity for ${scopeUrl}.`);
    identityUrls.add(identityUrl);

    for (const icon of manifest.icons ?? []) {
        const iconUrl = new URL(icon.src, scopeUrl);
        assert.ok(iconUrl.href.startsWith(scopeUrl), `Manifest icon must resolve inside the current PWA scope: ${icon.src}`);
        const ref = decodeURIComponent(iconUrl.pathname.slice(new URL(scopeUrl).pathname.length)).replace(/^\/+/, "");
        const expectedVersion = contentVersionForPwaRef(ref);
        assert.equal(iconUrl.searchParams.get("v"), expectedVersion, `Manifest icon must use the emitted file's content version: ${icon.src}`);
        assert.equal(installIconVersions[ref], expectedVersion, `Service worker install-icon fingerprint must match emitted bytes: ${ref}`);
    }
}

assert.deepEqual(
    [...identityUrls],
    ["https://example.invalid/stickvania"],
    "Manifest id must remain the same game identity when identical PWA bytes are mounted at different paths."
);
assert.doesNotMatch(serviceWorker, /__INSTALL_ICON_VERSIONS__/);
assert.match(serviceWorker, /requestUrl\.searchParams\.get\("v"\) === installIconVersion/);
assert.match(serviceWorker, /ignoreSearch:\s*true/);

console.log("Verified stable Stickvania PWA install metadata and content-versioned icons.");

function readInstallIconVersions(source) {
    const match = /const INSTALL_ICON_VERSIONS = (\{[\s\S]*?\});/.exec(source);
    assert.ok(match?.[1], "Built service worker must contain INSTALL_ICON_VERSIONS.");
    const versions = JSON.parse(match[1]);
    assert.ok(versions !== null && typeof versions === "object" && !Array.isArray(versions), "INSTALL_ICON_VERSIONS must be an object.");
    return versions;
}

function contentVersionForPwaRef(ref) {
    return createHash("sha256")
        .update(readFileSync(join(distPwaDir, ...ref.split("/"))))
        .digest("hex");
}
