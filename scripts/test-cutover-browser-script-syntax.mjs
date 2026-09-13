import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const supplemental = [
    ["verify:fullscreen", "scripts/run-fullscreen-qualification.mjs"],
    ["verify:fullscreen-timeout", "scripts/run-fullscreen-timeout-qualification.mjs"],
    ["verify:fullscreen-reentry", "scripts/run-fullscreen-reentry-qualification.mjs"],
    ["verify:fullscreen-settings", "scripts/run-fullscreen-settings-qualification.mjs"],
    ["verify:production-browser", "scripts/run-production-browser-qualification.mjs"],
    ["verify:activation-races", "scripts/run-activation-race-qualification.mjs"],
    ["verify:audio-interruption", "scripts/run-audio-interruption-qualification.mjs"],
    ["verify:lifecycle-events", "scripts/run-lifecycle-event-qualification.mjs"],
    ["verify:ownership-transfer", "scripts/run-ownership-transfer-qualification.mjs"],
    ["verify:persistence-failure", "scripts/run-persistence-failure-qualification.mjs"],
    ["verify:lifecycle-stress", "scripts/run-lifecycle-stress-qualification.mjs"]
];
const unrelatedBrowserSuites = supplemental.slice(4).map(([, path]) => path);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const suiteRunner = readFileSync("scripts/run-browser-qualification-suite.mjs", "utf8");

test("cutover browser qualification scripts are valid JavaScript", () => {
    for (const [, path] of supplemental) {
        const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
        assert.equal(result.status, 0, `${path} failed node --check:\n${result.stderr || result.stdout}`);
    }
    const suiteCheck = spawnSync(process.execPath, ["--check", "scripts/run-browser-qualification-suite.mjs"], { encoding: "utf8" });
    assert.equal(suiteCheck.status, 0, `browser suite runner failed node --check:\n${suiteCheck.stderr || suiteCheck.stdout}`);
});

test("qualify:browsers rebuilds and tests the exact fresh Stickvania PWA", () => {
    for (const [name, path] of supplemental) {
        assert.equal(packageJson.scripts?.[name], `node ${path}`, `${name} must invoke its audited browser qualifier`);
    }
    assert.equal(packageJson.scripts?.["qualify:browsers"], "node scripts/run-browser-qualification-suite.mjs");
    assert.match(suiteRunner, /runNpmScript\("build:pwa"\)/);
    assert.match(suiteRunner, /resolve\("\.release-components", "pwa", "pwa"\)/);
    assert.match(suiteRunner, /PWA_ROOT:\s*pwaRoot/);

    const expectedOrder = supplemental.map(([name]) => `"${name}"`);
    let previous = -1;
    for (const token of expectedOrder) {
        const index = suiteRunner.indexOf(token);
        assert.ok(index > previous, `${token} is missing or out of order in the browser qualification suite`);
        previous = index;
    }
    assert.ok(
        suiteRunner.indexOf('runNpmScript("build:pwa")') < suiteRunner.indexOf("for (const script of qualificationScripts)"),
        "fresh PWA build must happen before browser qualification"
    );
});

test("unrelated browser qualifiers explicitly disable the default-on Fullscreen preference", () => {
    for (const path of unrelatedBrowserSuites) {
        const source = readFileSync(path, "utf8");
        assert.match(source, /async function disableFullscreenIfAvailable\(page\)/, `${path} must define the audited Fullscreen-OFF helper`);
        const occurrences = source.match(/disableFullscreenIfAvailable\s*\(/g) ?? [];
        assert.ok(occurrences.length >= 2, `${path} defines the helper but never calls it before exercising its original non-fullscreen contract`);
    }
});
