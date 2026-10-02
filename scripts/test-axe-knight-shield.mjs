import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    const { Axe } = await server.ssrLoadModule("/src/stickvania/Axe.ts");
    const { Boomerang } = await server.ssrLoadModule("/src/stickvania/Boomerang.ts");
    const { BoomerangAxe } = await server.ssrLoadModule("/src/stickvania/BoomerangAxe.ts");
    const { Dagger } = await server.ssrLoadModule("/src/stickvania/Dagger.ts");
    const { HolyWater } = await server.ssrLoadModule("/src/stickvania/HolyWater.ts");
    const { THING_PERSISTED_STATE_FIELD_NAMES } = await server.ssrLoadModule("/src/stickvania/persistence/StateFieldRegistry.generated.ts");
    const { GAME_STATE_VERSION, GAME_STATE_STORAGE_KEY } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSchema.ts");

    function createMain(hard = false) {
        const sounds = [];
        const rumbles = [];
        const pushed = [];
        const points = [];
        const main = {
            playerPower: 16,
            enemyPower: 16,
            camera: 0,
            timeFrozen: 1,
            simon: { x: 0, xMin: -4096, xMax: 4096 },
            weaponsStack: { things: [], top: -1 },
            catchSimon: false,
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
                return main.catchSimon;
            },
            playSound(sound) {
                sounds.push(sound);
            },
            playRumble(effect) {
                rumbles.push(effect);
            },
            pushThing(thing) {
                pushed.push(thing);
            },
            createCandleItem() {
                return null;
            },
            addPoints(value) {
                points.push(value);
            },
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
            sounds,
            rumbles,
            pushed,
            points
        };
        return main;
    }

    function createKnight(main, direction = Main.LEFT, x = 100, y = 100) {
        const knight = new AxeKnight(main, x, y);
        knight.displayDirection = direction;
        knight.applyGravity = () => {};
        return knight;
    }

    function createBoomerang(
        main,
        { direction = Main.RIGHT, state = Boomerang.STATE_FOWARD, vx = 3, x = 76, y = 112, angle = 0, g = null, shieldBlockedBy = null } = {}
    ) {
        const boomerang = Object.create(Boomerang.prototype);
        Object.assign(boomerang, {
            main,
            x,
            y,
            vx,
            vy: 0,
            rx1: 0,
            ry1: 0,
            rx2: 31,
            ry2: 31,
            supported: false,
            intersected: false,
            kill: false,
            G: 0.21,
            direction,
            state,
            angle,
            g: g ?? (direction === Main.RIGHT ? Boomerang.G : -Boomerang.G),
            soundDelay: 1,
            shieldBlockedBy
        });
        return boomerang;
    }

    function createGenericWeapon(prototype = Object.prototype, x = 90, y = 112) {
        return Object.assign(Object.create(prototype), {
            x,
            y,
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
    }

    function setWeapons(main, weapons) {
        main.weaponsStack.things = [...weapons];
        main.weaponsStack.top = weapons.length - 1;
    }

    assert.equal(GAME_STATE_VERSION, 25);
    assert.match(GAME_STATE_STORAGE_KEY, /:game-state$/);
    assert.ok(THING_PERSISTED_STATE_FIELD_NAMES.AxeKnight.includes("shieldReflectionsRemaining"));
    for (const field of ["state", "vx", "g", "direction", "shieldBlockedBy"]) {
        assert.ok(THING_PERSISTED_STATE_FIELD_NAMES.Boomerang.includes(field), `Boomerang.${field} must persist`);
    }

    const tsAxeKnight = readFileSync(resolve(rootDir, "pwa/src/stickvania/AxeKnight.ts"), "utf8");
    const javaAxeKnight = readFileSync(resolve(rootDir, "desktop/src/stickvania/AxeKnight.java"), "utf8");
    const tsBoomerang = readFileSync(resolve(rootDir, "pwa/src/stickvania/Boomerang.ts"), "utf8");
    const javaBoomerang = readFileSync(resolve(rootDir, "desktop/src/stickvania/Boomerang.java"), "utf8");

    for (const source of [tsAxeKnight, javaAxeKnight]) {
        assert.match(source, /SHIELD_BOOMERANG_RADIUS[^\n]*13/);
        assert.match(source, /SHIELD_LEFT_X[^\n]*5/);
        assert.match(source, /SHIELD_RIGHT_X[^\n]*42/);
        assert.match(source, /SHIELD_TOP[^\n]*0/);
        assert.match(source, /SHIELD_BOTTOM[^\n]*63/);
        assert.match(source, /shieldReflectionsRemaining/);
        assert.match(source, /tryReflectBoomerang/);
        assert.match(source, /isBoomerangProtectedOnShieldApproach/);
        assert.match(source, /getShieldContactForBoomerang/);
        assert.match(source, /intersectsDamageWeapon/);
    }
    for (const source of [tsBoomerang, javaBoomerang]) {
        assert.match(source, /STATE_REFLECTED[^\n]*3/);
        assert.match(source, /shieldBlockedBy/);
        assert.match(source, /getActualHorizontalVelocity/);
        assert.match(source, /reflectFromAxeKnight/);
        assert.match(source, /refreshShieldBlock/);
    }
    assert.doesNotMatch(tsBoomerang, /axeShieldDebug|console\.debug/);
    assert.match(javaBoomerang, /Math\.abs\(vx\) \+ Math\.abs\(g\)/);

    // Body and shield durability follow the same Normal/Hard adjustment.
    {
        const normal = createKnight(createMain(false));
        const hard = createKnight(createMain(true));
        assert.equal(normal.hits, 3);
        assert.equal(normal.shieldReflectionsRemaining, 3);
        assert.equal(hard.hits, 4);
        assert.equal(hard.shieldReflectionsRemaining, 4);
    }

    // Ordinary, never-shielded Boomerangs retain the original one-turn state machine.
    for (const testCase of [
        { direction: Main.RIGHT, x: 447, vx: 3, returnSign: -1 },
        { direction: Main.LEFT, x: 33, vx: -3, returnSign: 1 }
    ]) {
        const main = createMain();
        const boomerang = createBoomerang(main, { direction: testCase.direction, x: testCase.x, vx: testCase.vx });
        boomerang.update(null);
        assert.equal(boomerang.state, Boomerang.STATE_REVERSING);
        for (let i = 0; i < 80 && boomerang.state === Boomerang.STATE_REVERSING; i++) {
            boomerang.update(null);
        }
        assert.equal(boomerang.state, Boomerang.STATE_REVERSE);
        assert.equal(Math.sign(boomerang.getActualHorizontalVelocity()), testCase.returnSign);
        main.catchSimon = true;
        assert.equal(boomerang.update(null), false);
    }

    // Full-speed shield reflection works symmetrically and preserves launch direction.
    for (const testCase of [
        { facing: Main.LEFT, direction: Main.RIGHT, x: 76, vx: 3, sign: -1 },
        { facing: Main.RIGHT, direction: Main.LEFT, x: 126, vx: -3, sign: 1 }
    ]) {
        const main = createMain();
        const knight = createKnight(main, testCase.facing);
        const boomerang = createBoomerang(main, testCase);
        setWeapons(main, [boomerang]);
        knight.update(null);
        assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
        assert.equal(boomerang.direction, testCase.direction);
        assert.equal(Math.sign(boomerang.vx), testCase.sign);
        assert.equal(Math.sign(boomerang.g), testCase.sign);
        assert.equal(boomerang.shieldBlockedBy, knight);
        assert.equal(knight.shieldReflectionsRemaining, 2);
        assert.equal(main.sounds.filter((sound) => sound === main.ching).length, 1);
        assert.deepEqual(main.rumbles, ["weaponImpactLight"]);
    }

    // The broad 32x32 body box overlaps before the radius-13 shield circle.
    {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        const boomerang = createBoomerang(main, { x: 70 });
        setWeapons(main, [boomerang]);
        assert.equal(intersects(boomerang, knight), true);
        knight.update(null);
        assert.equal(knight.hits, 3);
        assert.equal(knight.shieldReflectionsRemaining, 3);
        boomerang.update(null);
        knight.update(null);
        assert.equal(knight.hits, 3);
        boomerang.update(null);
        knight.update(null);
        assert.equal(knight.hits, 3);
        assert.equal(knight.shieldReflectionsRemaining, 2);
        assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
    }

    // Full-height endpoints are inclusive; one pixel outside is ordinary body damage.
    for (const [tangentY, outsideY] of [
        [71, 70],
        [160, 161]
    ]) {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        const tangent = createBoomerang(main, { x: 89, y: tangentY });
        setWeapons(main, [tangent]);
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 2);
        assert.equal(knight.hits, 3);

        const main2 = createMain();
        const knight2 = createKnight(main2, Main.LEFT);
        const outside = createBoomerang(main2, { x: 89, y: outsideY });
        setWeapons(main2, [outside]);
        knight2.update(null);
        assert.equal(knight2.shieldReflectionsRemaining, 3);
        assert.equal(knight2.hits, 2);
        assert.equal(outside.intersected, true);
    }

    // Slow, returning and exact-zero contacts preserve magnitude and accelerate outward.
    for (const testCase of [
        { facing: Main.LEFT, direction: Main.RIGHT, x: 76, vx: 1.2, sign: -1 },
        { facing: Main.RIGHT, direction: Main.LEFT, x: 126, vx: -1.2, sign: 1 },
        { facing: Main.LEFT, direction: Main.RIGHT, x: 89, vx: 0, sign: -1 },
        { facing: Main.RIGHT, direction: Main.LEFT, x: 113, vx: -0, sign: 1 }
    ]) {
        const main = createMain();
        const knight = createKnight(main, testCase.facing);
        const boomerang = createBoomerang(main, {
            direction: testCase.direction,
            state: Boomerang.STATE_REVERSING,
            x: testCase.x,
            vx: testCase.vx
        });
        setWeapons(main, [boomerang]);
        knight.update(null);
        assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
        const impactMagnitude = Math.abs(boomerang.vx);
        assert.equal(Math.sign(boomerang.g), testCase.sign);
        boomerang.shieldBlockedBy = null;
        boomerang.update(null);
        assert.equal(Math.sign(boomerang.vx), testCase.sign);
        assert.ok(Math.abs(boomerang.vx) >= impactMagnitude);
        assert.ok(Math.abs(boomerang.vx) <= 3);
    }

    // Reflected flight has no autonomous turnaround, even across old range thresholds.
    {
        const main = createMain();
        const boomerang = createBoomerang(main, {
            state: Boomerang.STATE_REFLECTED,
            x: 440,
            vx: 2.5,
            g: Math.abs(Boomerang.G),
            shieldBlockedBy: null
        });
        for (let i = 0; i < 20; i++) {
            const alive = boomerang.update(null);
            if (!alive) break;
            assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
            assert.ok(boomerang.vx > 0);
        }
    }

    // A second shield may redirect a fully separated reflected Boomerang.
    {
        const main = createMain();
        const second = createKnight(main, Main.RIGHT, 100, 100);
        const boomerang = createBoomerang(main, {
            direction: Main.RIGHT,
            state: Boomerang.STATE_REFLECTED,
            x: 126,
            vx: -2,
            g: -Math.abs(Boomerang.G),
            shieldBlockedBy: null
        });
        setWeapons(main, [boomerang]);
        second.update(null);
        assert.equal(boomerang.state, Boomerang.STATE_REFLECTED);
        assert.ok(boomerang.vx > 0);
        assert.ok(boomerang.g > 0);
        assert.equal(boomerang.shieldBlockedBy, second);
    }

    // Contact ownership clears only on separation/dead/kill and prevents duplicate charges.
    {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        const boomerang = createBoomerang(main, { x: 89 });
        setWeapons(main, [boomerang]);
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 2);
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 2);
        boomerang.x = 0;
        boomerang.update(null);
        assert.equal(boomerang.shieldBlockedBy, null);

        boomerang.shieldBlockedBy = knight;
        knight.dead = true;
        boomerang.update(null);
        assert.equal(boomerang.shieldBlockedBy, null);

        knight.dead = false;
        knight.kill = true;
        boomerang.shieldBlockedBy = knight;
        boomerang.update(null);
        assert.equal(boomerang.shieldBlockedBy, null);
    }

    // Rear/away contacts bypass the shield and damage the body.
    {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        const rear = createBoomerang(main, { x: 110, vx: -3 });
        setWeapons(main, [rear]);
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 3);
        assert.equal(knight.hits, 2);
        assert.equal(rear.intersected, true);
    }

    // The passive shield stays active while the body is stunned.
    {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        knight.stunned = 20;
        const boomerang = createBoomerang(main, { x: 89 });
        setWeapons(main, [boomerang]);
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 2);
        assert.equal(knight.hits, 3);
        assert.equal(knight.stunned, 19);
    }

    // Final shield charge reflects; the following Boomerang may damage the body.
    {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        knight.shieldReflectionsRemaining = 1;
        const finalCharge = createBoomerang(main, { x: 89 });
        setWeapons(main, [finalCharge]);
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 0);
        assert.equal(knight.hits, 3);

        const later = createBoomerang(main, { x: 89 });
        setWeapons(main, [later]);
        knight.update(null);
        assert.equal(knight.hits, 2);
        assert.equal(later.intersected, true);
    }

    // Non-Boomerang player weapons remain ordinary body hits; enemy BoomerangAxe is not shield-special.
    for (const prototype of [Axe.prototype, Dagger.prototype, HolyWater.prototype, BoomerangAxe.prototype]) {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        const weapon = createGenericWeapon(prototype);
        setWeapons(main, [weapon]);
        knight.update(null);
        assert.equal(knight.shieldReflectionsRemaining, 3);
        assert.equal(knight.hits, 2);
        assert.equal(weapon.intersected, true);
    }

    // Reflected projectile can still be caught by Simon.
    {
        const main = createMain();
        const boomerang = createBoomerang(main, {
            state: Boomerang.STATE_REFLECTED,
            vx: -2,
            g: -Math.abs(Boomerang.G),
            shieldBlockedBy: null
        });
        main.catchSimon = true;
        assert.equal(boomerang.update(null), false);
    }

    // Exhausted-shield body death keeps the ordinary 500-point/death path.
    {
        const main = createMain();
        const knight = createKnight(main, Main.LEFT);
        knight.shieldReflectionsRemaining = 0;
        knight.hits = 1;
        const weapon = createGenericWeapon(Dagger.prototype);
        setWeapons(main, [weapon]);
        assert.equal(knight.update(null), false);
        assert.equal(knight.dead, true);
        assert.deepEqual(main.points, [500]);
        assert.equal(main.sounds.includes(main.killed_4), true);
    }

    console.log("AxeKnight shield/reflected-Boomerang production regressions passed.");
} finally {
    await server.close();
}
