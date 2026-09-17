import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({ root: resolve(rootDir, "pwa"), appType: "custom", logLevel: "silent", server: { middlewareMode: true } });

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
    const { Dagger } = await server.ssrLoadModule("/src/stickvania/Dagger.ts");

    function createMain() {
        return {
            playerPower: 0,
            camera: 0,
            timeFrozen: 1,
            simon: { x: 0, xMin: -4096, xMax: 4096 },
            weaponsStack: { things: [], top: -1 },
            random: { nextInt: () => 0, nextBoolean: () => false },
            ching: {},
            stunned: {},
            killed_4: {},
            adjustEnemyHits: (value) => value,
            adjustEnemyCooldown: (value) => value,
            adjustEnemyBehaviorDelay: (value) => value,
            intersects,
            intersectsWhip: () => false,
            intersectsSimon: () => false,
            playSound() {},
            playRumble() {},
            pushThing() {},
            createCandleItem: () => null,
            addPoints() {},
            hurtSimon() {},
            isEmpty: () => true,
            isSupportive: () => true,
            isSolid: () => false,
            findPlatform: () => null
        };
    }

    function createKnight(main) {
        const knight = new AxeKnight(main, 100, 100);
        knight.displayDirection = Main.LEFT;
        knight.applyGravity = () => {};
        return knight;
    }

    // The shield is passive enemy geometry. An already-live Boomerang does not
    // lose its shield interaction merely because Simon has just died.
    {
        const main = createMain();
        const knight = createKnight(main);
        const boomerang = Object.assign(Object.create(Boomerang.prototype), {
            main,
            x: 89,
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
            state: Boomerang.STATE_FOWARD,
            angle: 0,
            g: Boomerang.G,
            soundDelay: 1,
            shieldBlockedBy: null
        });
        main.weaponsStack.things = [boomerang];
        main.weaponsStack.top = 0;
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 2);
        assert.equal(knight.hits, 3);
        assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
    }

    // Non-Boomerang weapon behavior must remain the same as production before the
    // shield feature: an existing projectile may still resolve against the body.
    {
        const main = createMain();
        const knight = createKnight(main);
        const dagger = Object.assign(Object.create(Dagger.prototype), {
            main,
            x: 100,
            y: 112,
            vx: 0,
            vy: 0,
            rx1: 0,
            ry1: 0,
            rx2: 31,
            ry2: 31,
            supported: false,
            intersected: false,
            kill: false,
            G: 0.21
        });
        main.weaponsStack.things = [dagger];
        main.weaponsStack.top = 0;
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 3);
        assert.equal(knight.hits, 2);
        assert.equal(dagger.intersected, true);
    }

    const tsSource = readFileSync(resolve(rootDir, "pwa/src/stickvania/AxeKnight.ts"), "utf8");
    const javaSource = readFileSync(resolve(rootDir, "desktop/src/stickvania/AxeKnight.java"), "utf8");
    assert.doesNotMatch(tsSource, /playerPower/);
    assert.doesNotMatch(javaSource, /playerPower/);

    console.log("AxeKnight post-death weapon interaction regression passed.");
} finally {
    await server.close();
}
