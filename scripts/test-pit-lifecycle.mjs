import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({ root: resolve("pwa"), appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
    const names = ["WhiteSkeleton", "Dog", "RedSkeleton", "AxeKnight", "SmallHeart", "DropItem"];
    const classes = Object.fromEntries(await Promise.all(names.map(async (name) => [name, (await server.ssrLoadModule(`/src/stickvania/${name}.ts`))[name]])));
    function world() {
        const calls = { random: 0, effects: 0, whip: 0 };
        return {
            calls,
            camera: 0,
            timeFrozen: 0,
            weaponType: 0,
            playerPower: 16,
            simon: { x: 100, y: 100, xMin: -10000, xMax: 10000 },
            weaponsStack: { top: -1, things: [] },
            random: {
                nextInt: () => {
                    calls.random++;
                    return 1;
                },
                nextBoolean: () => {
                    calls.random++;
                    return false;
                },
                nextFloat: () => {
                    calls.random++;
                    return 0.5;
                }
            },
            adjustEnemyCooldown: (x) => x,
            adjustEnemyBehaviorDelay: (x) => x,
            adjustEnemyHits: (x) => x,
            intersectsSimon: () => false,
            intersectsWhip: () => false,
            intersectsWeapon: () => false,
            isEmpty: () => true,
            isSupportive: () => false,
            isSolid: () => false,
            getWall: () => 0,
            pushThing: () => {
                calls.effects++;
            },
            addPoints: () => {
                calls.effects++;
            },
            playSound: () => {
                calls.effects++;
            },
            playRumble() {},
            whipDestroyed: () => {
                calls.whip++;
            }
        };
    }
    for (const name of names) {
        const main = world();
        const actor = new classes[name](main, 100, 353, 15);
        actor.vy = name === "SmallHeart" ? 0 : 1;
        actor.kill = true;
        main.timeFrozen = 1;
        const random = main.calls.random;
        assert.equal(actor.update(null), false, `${name}: below-pit entry precedes freeze/combat`);
        assert.equal(main.calls.random, random);
        assert.equal(main.calls.effects, 0);
        if (name === "AxeKnight") {
            assert.equal(actor.dead, true);
            const state = [actor.hasAxe, actor.throwDelay];
            actor.axeGone();
            assert.deepEqual([actor.hasAxe, actor.throwDelay], state);
            assert.equal(main.calls.random, random);
        }
        if (name === "DropItem") assert.equal(main.calls.whip, 1);
    }
    for (const name of names) {
        const main = world();
        const actor = new classes[name](main, 100, 352, 15);
        if (name === "Dog") actor.state = 2;
        actor.vy = name === "SmallHeart" ? 0 : 1;
        assert.equal(actor.update(null), false, `${name}: first downward crossing retires`);
        assert.ok(actor.y > 352);
        if (name === "SmallHeart") {
            assert.equal(actor.vy, 0);
            assert.equal(actor.lifeTime, 728);
        }
    }
    for (const name of ["WhiteSkeleton", "Dog"]) {
        const main = world();
        const actor = new classes[name](main, 100, 0);
        if (name === "Dog") actor.state = 2;
        let active = [actor];
        let retired = null;
        for (let tick = 0; tick < 2200; tick++) {
            active = active.filter((thing) => thing.update(null));
            if (active.length === 0 && retired === null) retired = { tick, y: actor.y, vy: actor.vy, calls: { ...main.calls } };
        }
        assert.ok(retired && retired.tick < 200, `${name}: unsupported fall terminates`);
        assert.equal(actor.y, retired.y);
        assert.equal(actor.vy, retired.vy);
        assert.deepEqual(main.calls, retired.calls);
    }
    for (const name of names.filter((name) => name !== "SmallHeart")) {
        const main = world();
        main.timeFrozen = 1;
        const actor = new classes[name](main, 100, 352, 8);
        actor.vy = 0;
        assert.equal(actor.update(null), true, `${name}: boundary is strictly greater`);
        actor.y = 353;
        actor.vy = -1;
        assert.equal(actor.update(null), true, `${name}: upward entry is preserved`);
        actor.y = 352;
        actor.vy = 1;
        main.timeFrozen = 0;
        if (name === "Dog") actor.state = 2;
        assert.equal(actor.update(null), false, `${name}: unfreeze crossing`);
    }
    for (const type of [8, 15])
        for (const disappears of [false, true]) {
            const main = world();
            const item = new classes.DropItem(main, 100, 352, type);
            item.disappears = disappears;
            item.vy = 1;
            item.lifeTime = 1;
            assert.equal(item.update(null), false);
            assert.equal(main.calls.whip, type === 15 ? 1 : 0, "pit and timeout cannot double-count");
            assert.equal(item.lifeTime, 1, "pit retirement precedes expiry");
        }
    for (const disappears of [false, true]) {
        const main = world();
        const item = new classes.DropItem(main, 100, 100, 15);
        item.lifeTime = 1;
        item.disappears = disappears;
        assert.equal(item.update(null), !disappears);
        assert.equal(main.calls.whip, disappears ? 1 : 0);
    }
    {
        const main = world();
        const heart = new classes.SmallHeart(main, 100, 351);
        assert.equal(heart.update(null), true);
        assert.equal(heart.lifeTime, 728);
        assert.equal(heart.update(null), true);
        assert.equal(heart.y, 352);
        assert.equal(heart.update(null), false);
        assert.equal(heart.vy, 0);
        const landed = new classes.SmallHeart(main, 100, 100);
        main.isSupportive = () => true;
        landed.lifeTime = 2;
        assert.equal(landed.update(null), true);
        assert.equal(landed.lifeTime, 1);
        assert.equal(landed.update(null), false);
    }
    console.log("Pit lifecycle entry, crossing, frozen combat ordering, callback and 2200-tick fall checks passed.");
} finally {
    await server.close();
}
