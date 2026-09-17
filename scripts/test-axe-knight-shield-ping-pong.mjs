import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({
    root: resolve(rootDir, "pwa"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

function intersects(a, b) {
    const ax1 = Math.trunc(a.x) + a.rx1;
    const ay1 = Math.trunc(a.y) + a.ry1;
    const ax2 = Math.trunc(a.x) + a.rx2;
    const ay2 = Math.trunc(a.y) + a.ry2;
    const bx1 = Math.trunc(b.x) + b.rx1;
    const by1 = Math.trunc(b.y) + b.ry1;
    const bx2 = Math.trunc(b.x) + b.rx2;
    const by2 = Math.trunc(b.y) + b.ry2;
    return ax2 >= bx1 && ax1 <= bx2 && ay2 >= by1 && ay1 <= by2;
}

try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { AxeKnight } = await server.ssrLoadModule("/src/stickvania/AxeKnight.ts");
    const { Boomerang } = await server.ssrLoadModule("/src/stickvania/Boomerang.ts");

    function createMain(hard = false) {
        const sounds = [];
        const main = {
            playerPower: 16,
            enemyPower: 16,
            camera: 0,
            timeFrozen: 1,
            simon: { x: 60, xMin: -4096, xMax: 4096 },
            weaponsStack: { things: [], top: -1 },
            random: {
                nextInt() {
                    return 0;
                },
                nextBoolean() {
                    return false;
                }
            },
            ching: { id: "ching" },
            stunned: { id: "stunned" },
            killed_4: { id: "killed_4" },
            spinning: { id: "spinning" },
            adjustEnemyHits(value) {
                return hard ? value + 1 : value;
            },
            adjustEnemyCooldown(value) {
                return value;
            },
            adjustEnemyBehaviorDelay(value) {
                return value;
            },
            intersects,
            intersectsWhip() {
                return false;
            },
            intersectsSimon() {
                return false;
            },
            playSound(sound) {
                sounds.push(sound);
            },
            playRumble() {},
            pushThing() {},
            createCandleItem() {
                return null;
            },
            addPoints() {},
            hurtSimon() {},
            isEmpty() {
                return true;
            },
            isSupportive() {
                return true;
            },
            isSolid() {
                return false;
            },
            findPlatform() {
                return null;
            },
            sounds
        };
        return main;
    }

    function createKnight(main, direction, x) {
        const knight = new AxeKnight(main, x, 100);
        knight.displayDirection = direction;
        knight.applyGravity = () => {};
        return knight;
    }

    function createBoomerang(main) {
        const boomerang = Object.create(Boomerang.prototype);
        Object.assign(boomerang, {
            main,
            x: 76,
            y: 112,
            vx: 3,
            vy: 0,
            rx1: 0,
            ry1: 0,
            rx2: 31,
            ry2: 31,
            supported: false,
            intersected: false,
            kill: false,
            G: 0.21,
            direction: Main.RIGHT,
            state: Boomerang.STATE_REFLECTED,
            angle: 0,
            g: Math.abs(Boomerang.G),
            soundDelay: 1,
            shieldBlockedBy: null
        });
        return boomerang;
    }

    for (const testCase of [
        { name: "Normal", hard: false, reflectionsPerKnight: 3 },
        { name: "Hard", hard: true, reflectionsPerKnight: 4 }
    ]) {
        const main = createMain(testCase.hard);
        const leftKnight = createKnight(main, Main.RIGHT, 20);
        const rightKnight = createKnight(main, Main.LEFT, 100);
        const boomerang = createBoomerang(main);
        main.weaponsStack.things = [boomerang];
        main.weaponsStack.top = 0;

        const totalExpectedReflections = testCase.reflectionsPerKnight * 2;
        let observedReflections = 0;
        let expectedTravelSign = 1;

        for (let tick = 0; tick < 300 && observedReflections < totalExpectedReflections; tick++) {
            const leftBefore = leftKnight.shieldReflectionsRemaining;
            const rightBefore = rightKnight.shieldReflectionsRemaining;

            leftKnight.update(null);
            rightKnight.update(null);

            const reflectedByLeft = leftKnight.shieldReflectionsRemaining === leftBefore - 1;
            const reflectedByRight = rightKnight.shieldReflectionsRemaining === rightBefore - 1;
            assert.equal(reflectedByLeft && reflectedByRight, false, `${testCase.name}: one frame cannot consume both shields`);

            if (reflectedByLeft || reflectedByRight) {
                const reflector = reflectedByLeft ? leftKnight : rightKnight;
                const expectedReflector = observedReflections % 2 === 0 ? rightKnight : leftKnight;
                assert.equal(reflector, expectedReflector, `${testCase.name}: reflections must alternate between the two inward-facing shields`);

                expectedTravelSign = reflector === rightKnight ? -1 : 1;
                assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
                assert.equal(Math.sign(boomerang.vx), expectedTravelSign);
                assert.equal(Math.sign(boomerang.g), expectedTravelSign);
                assert.equal(boomerang.shieldBlockedBy, reflector);
                observedReflections++;
            }

            assert.equal(boomerang.update(null), true, `${testCase.name}: Boomerang must remain alive while Simon avoids it`);
            assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
            assert.equal(Math.sign(boomerang.vx), expectedTravelSign);
            assert.equal(Math.sign(boomerang.g), expectedTravelSign);
        }

        assert.equal(observedReflections, totalExpectedReflections, `${testCase.name}: expected full two-knight ping-pong sequence`);
        assert.equal(leftKnight.shieldReflectionsRemaining, 0);
        assert.equal(rightKnight.shieldReflectionsRemaining, 0);
        assert.equal(
            main.sounds.filter((sound) => sound === main.ching).length,
            totalExpectedReflections,
            `${testCase.name}: each reflection must produce exactly one shield sound`
        );

        // An even number of alternating reflections ends on the left knight,
        // sending the Boomerang right. With both shields exhausted, its next
        // encounter with the right knight must be ordinary body damage rather
        // than a ninth/seventh reflection.
        let exhaustedShieldBodyHit = false;
        for (let tick = 0; tick < 100 && !exhaustedShieldBodyHit; tick++) {
            leftKnight.update(null);
            rightKnight.update(null);
            assert.equal(leftKnight.shieldReflectionsRemaining, 0);
            assert.equal(rightKnight.shieldReflectionsRemaining, 0);

            exhaustedShieldBodyHit = rightKnight.hits === testCase.reflectionsPerKnight - 1;
            if (!exhaustedShieldBodyHit) {
                assert.equal(boomerang.update(null), true);
                assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
                assert.equal(Math.sign(boomerang.vx), 1);
                assert.equal(Math.sign(boomerang.g), 1);
            }
        }

        assert.equal(exhaustedShieldBodyHit, true, `${testCase.name}: exhausted right shield must eventually allow body damage`);
        assert.equal(leftKnight.hits, testCase.reflectionsPerKnight);
        assert.equal(rightKnight.hits, testCase.reflectionsPerKnight - 1);
        assert.equal(boomerang.intersected, true);
    }

    console.log("AxeKnight two-knight Boomerang ping-pong tests passed.");
} finally {
    await server.close();
}
