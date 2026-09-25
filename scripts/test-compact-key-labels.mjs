import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Input } from "slick2d-ts";
import { createServer } from "vite";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const game = pkg.name === "jackal-js" ? "jackal" : "stickvania";
assert.ok(pkg.name === "jackal-js" || pkg.name === "stickvania-js");
const rows = JSON.parse(readFileSync(new URL("./fixtures/compact-key-labels.json", import.meta.url), "utf8"));
const expected = new Map(rows.map((r) => [r.code, r.label]));
assert.equal(rows.length, 123);
assert.equal(expected.size, 123);
const server = await createServer({
    root: fileURLToPath(new URL("../pwa/", import.meta.url)),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});
try {
    const { ButtonMapping } = await server.ssrLoadModule(`/src/${game}/ButtonMapping.ts`);
    for (const row of rows) {
        assert.equal(Input[row.constant], row.code, row.constant);
        assert.equal(ButtonMapping.getKeyText(row.code), row.label, row.constant);
    }
    assert.equal(ButtonMapping.getKeyText(Input.KEY_ENTER), "ENTER");
    assert.equal(ButtonMapping.getKeyText(Input.KEY_LALT), "L ALT");
    assert.equal(ButtonMapping.getKeyText(Input.KEY_RALT), "R ALT");
    for (let key = -1; key < 256; key++) {
        const text = ButtonMapping.getKeyText(key);
        assert.equal(text, key === -1 ? "NONE" : (expected.get(key) ?? `KEY ${key}`));
        assert.ok(text.length > 0 && text.length <= 9);
        assert.match(text, /^[A-Z0-9 ]+$/);
        for (const standardLayout of [false, true]) {
            for (const binding of [-5, -4, -3, -2, -1, ...Array.from({ length: 64 }, (_, i) => i)]) {
                const controller = ButtonMapping.getGamepadButtonText(binding, standardLayout);
                if (game === "jackal") {
                    const mapping = new ButtonMapping();
                    mapping.keyGrenade = key;
                    mapping.controllerGrenade = binding;
                    const line = mapping.inputMappingLine("GRENADE", ButtonMapping.ACTION_GRENADE, standardLayout);
                    assert.ok(line.length <= 32, line);
                    assert.ok((1024 - line.length * 32) / 2 >= 0);
                } else {
                    // Pure budget check; actual Main formatter/render coverage is also required below.
                    const line = "ATTACK".padEnd(7, " ") + "= " + text + ", " + controller;
                    assert.ok(line.length <= 32, line);
                    const x = Math.max(64, (640 - line.length * 16) >> 1);
                    assert.ok(x >= 64 && x + line.length * 16 <= 576, line);
                }
            }
        }
    }
    for (const value of [NaN, Infinity, -Infinity, -2, 256, 1.5]) {
        assert.equal(ButtonMapping.getKeyText(value), "UNKNOWN");
    }
    for (let code = 0; code < Input.BROWSER_KEY_CODE_LIMIT; code++) {
        if (Input.isBrowserKeyCodeSupported(code)) assert.ok(expected.has(code), `Missing supported code ${code}`);
    }
    if (game === "stickvania") {
        assert.equal(ButtonMapping.getGamepadButtonText(0), "GP-B1");
        assert.equal(ButtonMapping.getGamepadButtonText(63), "GP-B64");
    }
    if (process.argv[2] === "--java-dump") {
        const lines = readFileSync(process.argv[3], "utf8").trim().split(/\r?\n/);
        assert.equal(lines.length, 257);
        for (const line of lines) {
            const [code, label] = line.split("|");
            assert.equal(ButtonMapping.getKeyText(Number(code)), label, `Java/TS ${code}`);
        }
    }
    console.log(`ok - ${game} compact key labels and row budgets`);
} finally {
    await server.close();
}
