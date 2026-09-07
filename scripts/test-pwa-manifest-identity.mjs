import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const manifestPath = new URL("../pwa/public/manifest.webmanifest", import.meta.url);

test("Stickvania PWA manifest has stable identity and install metadata", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.id, "/stickvania");
    assert.equal(new URL(manifest.id, "https://example.invalid/").pathname, "/stickvania");
    assert.equal(manifest.start_url, "./");

    assert.ok(manifest.icons.length >= 4);
    assert.ok(manifest.icons.every((icon) => !icon.src.includes("%CACHE_VERSION%")));
    assert.ok(manifest.icons.every((icon) => /\?v=%ASSET_VERSION\([^)]+\)%$/.test(icon.src)));

    const regularIcons = manifest.icons.filter((icon) => icon.purpose === "any");
    assert.equal(regularIcons.length, 3);

    const maskableIcons = manifest.icons.filter((icon) => icon.purpose === "maskable");
    assert.equal(maskableIcons.length, 1);
    assert.equal(maskableIcons[0].src, "images/icon-maskable.svg?v=%ASSET_VERSION(images/icon-maskable.svg)%");
    assert.equal(maskableIcons[0].sizes, "any");
    assert.equal(maskableIcons[0].type, "image/svg+xml");
});
