import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withCounterModules } from "./counter-test-utils.mjs";

await withCounterModules(
    {
        "persistence/StateFieldValuePolicy": (s) => s + "\nexport {isMainNumberValid, isThingNumberValid};",
        "persistence/GameStateSanity": (s) => s + "\nexport {isReasonableNumber};"
    },
    async (load) => {
        const { Main } = await load("Main");
        const { Raven } = await load("Raven");
        const { BridgeBat } = await load("BridgeBat");
        const { GrimReaper } = await load("GrimReaper");
        const { configureEnemyArc, clampEnemyArcVelocity } = await load("EnemyArcMotion");
        const f = Math.fround;
        let vectors = 0;
        const javaIndex = process.argv.indexOf("--java-vectors");
        const javaVectors =
            javaIndex < 0
                ? null
                : readFileSync(process.argv[javaIndex + 1], "utf8")
                      .trim()
                      .split(/\r?\n/);
        const bits = (value) => new Int32Array(new Float32Array([value]).buffer)[0];
        for (const y of [0, 32, 200])
            for (const target of [-200, 0, 32, 232, 1e30])
                for (const t of [0, 1e-30, 0.25, 1, 2, 16, 100, 1e20]) {
                    const body = { y, G: 99, vy: 99 };
                    const h = f(Math.abs(f(target - y))),
                        denominator = f(t * t),
                        raw = f(f(2 * h) / denominator);
                    let velocity = Math.min(4, f(Math.sqrt(f(f(2 * raw) * h))));
                    if (target <= y) velocity = f(-velocity);
                    const valid = denominator !== 0 && Number.isFinite(raw) && Number.isFinite(velocity);
                    assert.equal(configureEnemyArc(body, t, target), valid);
                    if (valid) {
                        assert.equal(body.vy, velocity, "launch uses unbounded acceleration");
                        assert.equal(body.G, f(Math.max(-64, Math.min(64, target > y ? f(-raw) : raw))));
                    } else assert.deepEqual(body, { y, G: 0, vy: 0 });
                    if (javaVectors) assert.equal(javaVectors[vectors], `${valid},${bits(body.G)},${bits(body.vy)}`, "Java/TS helper float bits " + vectors);
                    vectors++;
                }
        if (javaVectors) assert.equal(javaVectors.length, vectors);
        const main = Object.assign(Object.create(Main.prototype), {
            simon: { x: 84, y: 224 },
            timeFrozen: 0,
            difficulty: Main.DIFFICULTY_NORMAL,
            mode: Main.MODE_DEMO,
            intersectsWhip: () => false,
            intersectsWeapon: () => false,
            intersectsSimon: () => false,
            getWall: () => 0,
            isEmpty: () => true,
            isSolid: () => false,
            isSupportive: () => false,
            playSound: () => {},
            adjustEnemyBehaviorDelay: (v) => v
        });
        let calls = [];
        main.random = {
            nextInt: (n) => {
                calls.push(n);
                return 0;
            },
            nextBoolean: () => {
                calls.push("bool");
                return true;
            }
        };
        for (const Type of [Raven, BridgeBat]) {
            const singularX = Type === Raven ? 100 : 68;
            const actor = new Type(main, singularX, 32);
            actor.state = Type.STATE_HOVERING;
            actor.delay = 1;
            calls = [];
            actor.update(null);
            assert.equal(actor.applyingGravity, false);
            assert.equal(actor.G, 0);
            assert.equal(actor.vy, 0);
            assert.deepEqual(calls, Type === Raven ? [96, "bool", "bool"] : [96, 5, 5]);
            assert.equal(actor.state, Type.STATE_FLYING);
            actor.update(null);
            assert.equal(actor.y, 32, "horizontal fallback");
            for (const sign of [-1, 1]) {
                Object.assign(actor, { state: Type.STATE_FLYING, applyingGravity: true, x: 100, y: 160, vy: sign * 500, G: sign * 500, targetX: 1000 });
                const oldY = actor.y;
                actor.update(null);
                assert.equal(actor.y - oldY, sign * 32);
                assert.equal(actor.vy, sign * 32);
                main.timeFrozen = 1;
                const before = JSON.stringify(actor, (k, v) => (k === "main" ? undefined : v));
                actor.update(null);
                assert.equal(
                    JSON.stringify(actor, (k, v) => (k === "main" ? undefined : v)),
                    before
                );
                main.timeFrozen = 0;
            }
            Object.assign(actor, { state: Type.STATE_FLYING, applyingGravity: true, x: 100, y: 160, vy: f(0.25), G: f(0.01), targetX: 1000 });
            let y = actor.y,
                v = actor.vy;
            for (let i = 0; i < 10; i++) {
                y = f(y + v);
                v = f(v + actor.G);
                actor.update(null);
                assert.equal(actor.y, y);
                assert.equal(actor.vy, v);
            }
            Object.assign(actor, { state: Type.STATE_FLYING, applyingGravity: true, y: 1, vy: -32, G: 0 });
            actor.update(null);
            assert.equal(actor.y, 0);
            assert.equal(actor.applyingGravity, false);
        }
        for (let delay = 0; delay <= 42; delay++) {
            const actor = new BridgeBat(main, 100, 100);
            actor.state = BridgeBat.STATE_HOVERING;
            actor.delay = delay;
            for (let tick = 1; tick <= Math.max(1, delay); tick++) {
                actor.update(null);
                assert.equal(actor.state, tick === Math.max(1, delay) ? BridgeBat.STATE_FLYING : BridgeBat.STATE_HOVERING);
            }
        }
        const grim = new GrimReaper(main, 64, 100);
        Object.assign(grim, { state: GrimReaper.STATE_THROWING, throwDelay: 1, throwCount: 2, shouldMove: true, sickles: 0, Y: 100 });
        grim.update(null);
        assert.equal(grim.flyTime, 0);
        assert.equal(grim.angleInc, 0);
        const pos = [grim.x, grim.y];
        grim.update(null);
        assert.equal(grim.flyTime, -1);
        assert.deepEqual([grim.x, grim.y], pos);
        assert.equal(grim.state, GrimReaper.STATE_THROWING);
        const policy = await load("persistence/StateFieldValuePolicy"),
            sanity = await load("persistence/GameStateSanity");
        for (const value of [0, 2147483648, Number.MAX_SAFE_INTEGER]) {
            assert.equal(policy.isMainNumberValid("score", value, {}), true);
            assert.equal(sanity.isReasonableNumber(value, "score"), true);
        }
        for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
            assert.equal(policy.isMainNumberValid("score", value, {}), false);
            assert.equal(sanity.isReasonableNumber(value, "score"), false);
        }
        assert.equal(policy.isThingNumberValid("Raven", "targetX", 1e30), true);
        for (const value of [-1000001, 1000001]) assert.equal(policy.isThingNumberValid("Raven", "spriteIndexIncrementor", value), true);
        assert.equal(policy.isThingNumberValid("Raven", "spriteIndexIncrementor", 0.5), false);
        assert.equal(sanity.isReasonableNumber(513, "vy"), false);
        assert.equal(sanity.isReasonableNumber(131073, "x"), false);
        assert.equal(sanity.isReasonableNumber(4097, "rx1"), false);
        assert.equal(clampEnemyArcVelocity(999), 32);
        console.log(`Enemy arc: ${vectors} helper vectors; actual Raven/BridgeBat/Grim updates, all 43 hover delays, freeze and numerical controls passed.`);
    }
);
