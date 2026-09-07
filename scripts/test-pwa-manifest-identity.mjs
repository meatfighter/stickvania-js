import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const manifestPath = new URL("../pwa/public/manifest.webmanifest", import.meta.url);

test("Stickvania PWA manifest has a stable game-specific identity", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.id, "stickvania");
    assert.equal(new URL(manifest.id, "https://example.invalid/").pathname, "/stickvania");
});
