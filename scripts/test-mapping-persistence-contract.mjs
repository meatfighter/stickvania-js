import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScript, memoryStorage } from "./persistence-test-loader.mjs";
const { ButtonMapping } = await loadTypeScript("pwa/src/stickvania/ButtonMapping.ts");

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const s = memoryStorage();
function restoreStorage() {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
}
const save = (mapping, authorized = () => true) => mapping.save(authorized);
function load() {
    return ButtonMapping.load();
}

test("real mapping policy: exact current mapping loads; unusable contents never prevent a later save", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: s });
    try {
        const mapping = new ButtonMapping();
        assert.deepEqual(save(mapping), { saved: true });
        const key = s.calls.set.at(-1),
            current = JSON.parse(s.values.get(key));
        assert.deepEqual(load(), mapping);
        for (const raw of [
            "{",
            "null",
            "[]",
            "{}",
            "42",
            "",
            JSON.stringify({ ...current, version: current.version - 1 }),
            JSON.stringify({ ...current, version: current.version + 1 }),
            JSON.stringify({ ...current, unexpected: true }),
            "x".repeat(4097)
        ]) {
            s.values.set(key, raw);
            s.faults.get = false;
            s.clearCalls();
            assert.deepEqual(load(), new ButtonMapping());
            assert.equal(s.values.get(key), raw);
            assert.deepEqual(s.calls.set, []);
            assert.deepEqual(s.calls.remove, []);
            s.clearCalls();
            s.faults.get = true;
            assert.deepEqual(save(mapping), { saved: true });
            assert.deepEqual(s.calls.get, []);
            assert.deepEqual(s.calls.remove, []);
            assert.deepEqual(s.calls.set, [key]);
            assert.equal(JSON.parse(s.values.get(key)).version, current.version);
        }
    } finally {
        s.faults.get = false;
        restoreStorage();
    }
});

test("real mapping policy: failed persistence keeps session mapping active and leaves game bytes alone", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: s });
    const warn = console.warn;
    console.warn = () => {};
    try {
        s.values.clear();
        s.values.set("other-game-state", "keep-game");
        const mapping = new ButtonMapping();
        assert.equal(save(mapping).saved, true);
        const key = s.calls.set.at(-1),
            previous = s.values.get(key);
        mapping.keyJump = 57;
        const retained = mapping.clone();
        s.faults.set = true;
        assert.deepEqual(save(mapping), { saved: false, reason: "unavailable" });
        assert.equal(mapping.keyJump, 57);
        assert.equal(s.values.get(key), previous);
        assert.equal(s.values.get("other-game-state"), "keep-game");
        const replacement = new ButtonMapping();
        replacement.copyFrom(retained);
        assert.equal(replacement.keyJump, 57, "same-owner runtime recreation uses session value, not storage");
        s.faults.set = false;
        s.clearCalls();
        assert.deepEqual(
            save(mapping, () => false),
            { saved: false, reason: "stale-session" }
        );
        assert.deepEqual(s.calls.set, []);
        assert.deepEqual(s.calls.get, []);
        assert.equal(save(mapping).saved, true);
        assert.equal(load().keyJump, 57);
    } finally {
        s.faults.set = false;
        console.warn = warn;
        restoreStorage();
    }
});

test("NES logical actions round-trip; invalid and duplicate bindings preserve last good mapping", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: s });
    const warn = console.warn;
    console.warn = () => {};
    try {
        s.values.clear();
        s.clearCalls();
        const mapping = new ButtonMapping();
        Object.assign(mapping, { controllerUp: 7, controllerDown: 6, controllerLeft: 3, controllerRight: 0, controllerJump: -2, controllerAttack: -3 });
        assert.equal(save(mapping).saved, true);
        const slot = s.calls.set.at(-1);
        const good = s.values.get(slot);
        assert.equal(JSON.parse(good).version, 8);
        assert.deepEqual(load(), mapping);
        for (const bad of [-6, 64, 0.5, NaN, Infinity, -Infinity, "0", null, -3]) {
            const invalid = mapping.clone();
            invalid.controllerJump = bad;
            assert.equal(save(invalid).saved, false, String(bad));
            assert.equal(s.values.get(slot), good);
        }
        const old = JSON.parse(good);
        old.version--;
        s.values.set(slot, JSON.stringify(old));
        assert.deepEqual(load(), new ButtonMapping());
        assert.equal(save(mapping).saved, true);
        assert.deepEqual(load(), mapping);
        s.faults.set = true;
        mapping.controllerJump = -5;
        assert.equal(save(mapping).saved, false);
        assert.equal(mapping.controllerJump, -5, "failed write changed live mapping");
        assert.equal(s.values.get(slot), good);
    } finally {
        s.faults.set = false;
        console.warn = warn;
        restoreStorage();
    }
});
