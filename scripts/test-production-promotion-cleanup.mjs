import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
    return readFileSync(resolve(rootDir, path), "utf8");
}

function collectFiles(directory) {
    const result = [];
    for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) result.push(...collectFiles(path));
        else result.push(path);
    }
    return result;
}

const harnessPath = resolve(rootDir, "pwa/src/stickvania/AxeKnightShieldPlaytestMain.ts");
assert.equal(existsSync(harnessPath), false, "production must not contain the playtest Main subclass");

const loader = read("pwa/src/app/RuntimeLoader.ts");
assert.match(loader, /import\("\.\.\/stickvania\/Main\.js"\)/);
assert.match(loader, /Main:\s*mainModule\.Main/);
assert.doesNotMatch(loader, /AxeKnightShieldPlaytestMain|axeKnightTest/);

const packageJson = read("package.json");
assert.doesNotMatch(packageJson, /verify:axe-knight-shield|qualify:axe-knight-shield/);
assert.match(packageJson, /test:axe-knight-shield/);
assert.match(packageJson, /test:gameplay-transition-hardening/);

const productionSources = [
    ...collectFiles(resolve(rootDir, "pwa/src")),
    ...collectFiles(resolve(rootDir, "desktop/src"))
].filter((path) => /\.(?:ts|java)$/.test(path));
const combined = productionSources.map((path) => readFileSync(path, "utf8")).join("\n");
assert.doesNotMatch(combined, /axeKnightTest|axeShieldDebug|PLAYTEST_AXE_KNIGHT|PLAYTEST_SIMON|mountCreditsRecordingForPlaytest/);
assert.doesNotMatch(combined, /AxeKnightShieldPlaytestMain/);

console.log("Production promotion cleanup guardrails passed.");
