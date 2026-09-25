import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageName = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).name;
const game = packageName === "jackal-js" ? "jackal" : packageName === "stickvania-js" ? "stickvania" : null;
assert.ok(game, "This test belongs in Jackal or Stickvania");

await test("NES controller mapping profile contract", async (t) => {
    const server = await createServer({
        configFile: false,
        root: fileURLToPath(new URL("../pwa/", import.meta.url)),
        server: { middlewareMode: true },
        appType: "custom",
        logLevel: "error"
    });
    try {
        const profile = await server.ssrLoadModule(`/src/${game}/NesInputProfile.ts`);
        const { ButtonMapping } = await server.ssrLoadModule(`/src/${game}/ButtonMapping.ts`);
        const { Input } = await import("slick2d-ts");
        const count = profile.INPUTS.length;
        const values = (mapping) => profile.INPUTS.map((row) => mapping[row.controller]);
        const snapshot = (mapping) => JSON.stringify(profile.INPUTS.map((row) => [mapping[row.key], mapping[row.controller]]));
        const apply = (mapping, bindings) => {
            const draft = mapping.clone();
            const used = new Set();
            bindings.forEach((binding, step) => assert.equal(profile.assignController(draft, step, binding, used), true));
            profile.copyInto(draft, mapping);
            return used;
        };

        await t.test("active virtual slots and domain", () => {
            assert.deepEqual(
                profile.INPUTS.map((row) => row.control),
                game === "jackal" ? ["UP", "DOWN", "LEFT", "RIGHT", "A", "B", "START"] : ["UP", "DOWN", "LEFT", "RIGHT", "A", "B"]
            );
            assert.equal(profile.RAW_BUTTON_LIMIT, Input.BROWSER_CONTROLLER_BUTTON_LIMIT);
            for (const value of [-5, -4, -3, -2, -1, 0, 12, 15, 63]) {
                assert.equal(profile.isControllerBinding(value), true);
                assert.equal(ButtonMapping.isValidControllerBinding(value), true);
            }
            for (const value of [-6, 64, 0.5, NaN, Infinity, -Infinity, "0", null, undefined, {}, []]) {
                assert.equal(profile.isControllerBinding(value), false);
                assert.equal(ButtonMapping.isValidControllerBinding(value), false);
            }
        });

        await t.test("every controller binding is legal at every active destination", () => {
            const candidates = [-2, -3, -4, -5, ...Array.from({ length: 64 }, (_, i) => i)];
            for (let step = 0; step < count; step++) {
                for (const binding of candidates) {
                    const draft = new ButtonMapping();
                    const used = new Set();
                    assert.equal(profile.assignController(draft, step, binding, used), true);
                    assert.equal(draft[profile.INPUTS[step].controller], binding);
                    assert.equal(values(draft).filter((value) => value === binding).length, 1);
                    assert.deepEqual([...used], [binding]);
                }
            }
            // Raw 12..15 are legal encoded raw bindings on nonstandard hardware;
            // canonical hardware capture is tested separately, not in this helper.
        });

        await t.test("two identical full remaps and a swap", () => {
            const mapping = new ButtonMapping();
            const wanted = [7, 6, 3, 0, -2, -3, -4].slice(0, count);
            apply(mapping, wanted);
            assert.deepEqual(values(mapping), wanted);
            apply(mapping, wanted);
            assert.deepEqual(values(mapping), wanted);
            const swapped = [6, 7, 0, 3, -3, -2, -5].slice(0, count);
            apply(mapping, swapped);
            assert.deepEqual(values(mapping), swapped);
        });

        await t.test("current-cycle duplicate rejection is atomic", () => {
            for (const binding of [7, -2]) {
                const draft = new ButtonMapping();
                const used = new Set();
                assert.equal(profile.assignController(draft, 0, binding, used), true);
                const before = snapshot(draft);
                assert.equal(profile.assignController(draft, 1, binding, used), false);
                assert.equal(snapshot(draft), before);
                assert.deepEqual([...used], [binding]);
            }
        });

        await t.test("moving an old binding clears its stale owner", () => {
            const draft = new ButtonMapping();
            draft.controllerUp = 7;
            draft.controllerDown = 6;
            const used = new Set();
            assert.equal(profile.assignController(draft, 0, 6, used), true);
            assert.equal(draft.controllerUp, 6);
            assert.equal(draft.controllerDown, -1);
            assert.equal(profile.assignController(draft, 1, 7, used), true);
            assert.equal(draft.controllerDown, 7);
        });

        await t.test("keyboard-completed slot may surrender an old controller binding", () => {
            const draft = new ButtonMapping();
            const keys = new Set();
            const controls = new Set();
            draft.controllerUp = -2;
            assert.equal(profile.assignKey(draft, 0, 30, keys), true);
            assert.equal(profile.assignController(draft, 4, -2, controls), true);
            assert.equal(draft.controllerUp, -1);
            assert.equal(draft[profile.INPUTS[4].controller], -2);
            assert.equal(draft.keyUp, 30);
        });

        await t.test("no partial mutation of committed map or hidden Stickvania Start", () => {
            const committed = new ButtonMapping();
            const before = snapshot(committed);
            const draft = committed.clone();
            assert.equal(profile.assignController(draft, 0, 7, new Set()), true);
            assert.equal(snapshot(committed), before);
            if (game === "stickvania") {
                assert.equal(Object.hasOwn(draft, "controllerStart"), false);
                assert.throws(() => profile.assignController(draft, 6, 9, new Set()), RangeError);
            }
        });
    } finally {
        await server.close();
    }
});
