import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pwaRoot = resolve(rootDir, "pwa");
const server = await createServer({
    root: pwaRoot,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

function read(path) {
    return readFileSync(resolve(rootDir, path), "utf8");
}

function createRandom() {
    return {
        calls: 0,
        nextInt(_bound) {
            this.calls++;
            return 0;
        },
        nextBoolean() {
            this.calls++;
            return true;
        }
    };
}

function createMain(overrides = {}) {
    const flags = { hit: false, contact: false };
    const random = createRandom();
    return {
        timeFrozen: 455,
        camera: 0,
        enemyPower: 16,
        boss_1: { id: "boss_1" },
        boss_2: { id: "boss_2" },
        wing_flaps: { id: "wing_flaps" },
        boss_hurt: { id: "boss_hurt" },
        boss_killed_1: { id: "boss_killed_1" },
        boss_killed_2: { id: "boss_killed_2" },
        simon: {
            x: 300,
            y: 128,
            xMin: 0,
            xMax: 512,
            direction: 1
        },
        random,
        flags,
        pushed: [],
        sounds: [],
        rumbles: [],
        requestedSong: null,
        killAllCount: 0,
        hurtSimonCount: 0,
        stoppedSongCount: 0,
        points: 0,
        fireSparksCount: 0,
        intersectsWhip() {
            return this.flags.hit;
        },
        intersectsWeapon() {
            return false;
        },
        intersectsSimon() {
            return this.flags.contact;
        },
        hurtSimon(_power) {
            this.hurtSimonCount++;
        },
        pushThing(thing) {
            this.pushed.push(thing.constructor.name);
        },
        playSound(sound) {
            this.sounds.push(sound);
        },
        playRumble(id) {
            this.rumbles.push(id);
        },
        requestSong(song) {
            this.requestedSong = song;
        },
        killAll() {
            this.killAllCount++;
        },
        stopSong() {
            this.stoppedSongCount++;
        },
        fireSparks() {
            this.fireSparksCount++;
        },
        addPoints(points) {
            this.points += points;
        },
        ...overrides
    };
}

function captureBatClock(boss) {
    return {
        x: boss.x,
        y: boss.y,
        vx: boss.vx,
        vy: boss.vy,
        state: boss.state,
        spriteIndex: boss.spriteIndex,
        spriteIndexIncrementor: boss.spriteIndexIncrementor,
        hoveringMoving: boss.hoveringMoving,
        hoveringPause: boss.hoveringPause,
        spawnDelay: boss.spawnDelay
    };
}

function captureMedusaClock(boss) {
    return {
        x: boss.x,
        y: boss.y,
        vx: boss.vx,
        vy: boss.vy,
        state: boss.state,
        angle: boss.angle,
        spriteIndex: boss.spriteIndex,
        spriteIndexIncrementor: boss.spriteIndexIncrementor,
        hoveringMoving: boss.hoveringMoving,
        hoveringPause: boss.hoveringPause,
        spawnDelay: boss.spawnDelay
    };
}

try {
    const { BatBoss } = await server.ssrLoadModule("/src/stickvania/BatBoss.ts");
    const { MedusaBoss } = await server.ssrLoadModule("/src/stickvania/MedusaBoss.ts");

    // Giant Bat: active AI, animation, spawn clock, position and random stream
    // must all pause for any positive timeFrozen value.
    {
        const main = createMain();
        const boss = new BatBoss(main, 120, 0);
        boss.state = BatBoss.STATE_HOVERING;
        boss.spriteIndex = 1;
        boss.spriteIndexIncrementor = 1;
        boss.hoveringMoving = 7;
        boss.hoveringPause = 3;
        boss.spawnDelay = 0;
        boss.vx = 1;
        boss.vy = 2;
        boss.moveX = () => {
            throw new Error("frozen Giant Bat attempted to move");
        };
        const before = captureBatClock(boss);
        boss.update(null);
        assert.deepEqual(captureBatClock(boss), before);
        assert.deepEqual(main.pushed, []);
        assert.deepEqual(main.sounds, []);
        assert.equal(main.random.calls, 0);
    }

    // ATTACKING physics/movement must freeze too, not only HOVERING AI.
    {
        const main = createMain();
        const boss = new BatBoss(main, 120, 24);
        boss.state = BatBoss.STATE_ATTACKING;
        boss.spawnDelay = 8;
        boss.vx = 2;
        boss.vy = -3;
        boss.applyGravity = () => {
            throw new Error("frozen attacking Giant Bat applied gravity");
        };
        boss.moveX = () => {
            throw new Error("frozen attacking Giant Bat moved");
        };
        const before = captureBatClock(boss);
        boss.update(null);
        assert.deepEqual(captureBatClock(boss), before);
    }

    // Final StopWatch contribution tick is still frozen; thaw occurs on the next
    // region update because StopWatch itself updates later in the weapon pass.
    {
        const main = createMain({ timeFrozen: 1 });
        const boss = new BatBoss(main, 120, 0);
        boss.state = BatBoss.STATE_HOVERING;
        boss.spawnDelay = 4;
        boss.hoveringMoving = 8;
        boss.moveX = () => {
            throw new Error("timeFrozen=1 Giant Bat attempted to move");
        };
        const before = captureBatClock(boss);
        boss.update(null);
        assert.deepEqual(captureBatClock(boss), before);
    }

    // Combat clock remains live while Giant Bat is frozen.
    {
        const main = createMain();
        const boss = new BatBoss(main, 120, 0);
        boss.state = BatBoss.STATE_HOVERING;
        boss.spawnDelay = 10;
        boss.stunned = 1;
        boss.update(null);
        assert.equal(boss.stunned, 0);

        main.flags.hit = true;
        boss.update(null);
        assert.equal(main.enemyPower, 15);
        assert.equal(boss.stunned, 45);
        assert.ok(main.pushed.includes("Spark"));

        main.flags.hit = false;
        main.flags.contact = true;
        boss.update(null);
        assert.equal(main.hurtSimonCount, 1);
    }

    // Death must resolve while frozen.
    {
        const main = createMain({ enemyPower: 1 });
        main.flags.hit = true;
        const boss = new BatBoss(main, 120, 0);
        boss.state = BatBoss.STATE_HOVERING;
        boss.spawnDelay = 10;
        boss.update(null);
        assert.equal(boss.state, BatBoss.STATE_DEAD);
        assert.equal(main.enemyPower, 0);
        assert.equal(main.points, 3000);
        assert.equal(main.stoppedSongCount, 1);
    }

    // Encounter activation remains live under an already-running StopWatch, but
    // the newly active boss does not consume its pending spawn until thaw.
    {
        const main = createMain({ simon: { x: 700, y: 128, xMin: 10, xMax: 900, direction: 1 } });
        const boss = new BatBoss(main, 120, 0);
        boss.update(null);
        assert.equal(boss.state, BatBoss.STATE_HOVERING);
        assert.equal(main.requestedSong, main.boss_1);
        assert.equal(main.killAllCount, 1);
        assert.equal(main.simon.xMin, 388);
        assert.equal(boss.spawnDelay, 0);
        assert.equal(main.random.calls, 2);
        const activationRandomCalls = main.random.calls;

        boss.moveX = () => {
            throw new Error("newly activated frozen Giant Bat attempted to move");
        };
        boss.update(null);
        assert.equal(main.random.calls, activationRandomCalls);
        assert.equal(boss.spawnDelay, 0);
        assert.deepEqual(main.pushed, []);

        main.timeFrozen = 0;
        boss.moveX = () => true;
        boss.update(null);
        assert.equal(boss.spawnDelay, 546);
        assert.equal(main.pushed.filter((name) => name === "Bat").length, 2);
    }

    // Medusa: active animation, bobbing, movement, spawn clock and random stream
    // all pause while combat remains live.
    {
        const main = createMain();
        const boss = new MedusaBoss(main, 120, 64);
        boss.state = MedusaBoss.STATE_HOVERING;
        boss.fadeIn = 91;
        boss.spriteIndex = 1;
        boss.spriteIndexIncrementor = 1;
        boss.hoveringMoving = 7;
        boss.hoveringPause = 3;
        boss.spawnDelay = 0;
        boss.angle = 0.5;
        boss.vx = 1;
        boss.vy = 2;
        boss.moveX = () => {
            throw new Error("frozen Medusa attempted horizontal movement");
        };
        boss.moveY = () => {
            throw new Error("frozen Medusa attempted vertical movement");
        };
        const before = captureMedusaClock(boss);
        boss.update(null);
        assert.deepEqual(captureMedusaClock(boss), before);
        assert.deepEqual(main.pushed, []);
        assert.equal(main.random.calls, 0);
    }

    // Medusa's ATTACKING physics/movement is part of the frozen active clock.
    {
        const main = createMain();
        const boss = new MedusaBoss(main, 120, 64);
        boss.state = MedusaBoss.STATE_ATTACKING;
        boss.fadeIn = 91;
        boss.spawnDelay = 8;
        boss.angle = 0.5;
        boss.vx = 2;
        boss.vy = -3;
        boss.moveY = () => {
            throw new Error("frozen attacking Medusa bobbed vertically");
        };
        boss.applyGravity = () => {
            throw new Error("frozen attacking Medusa applied gravity");
        };
        boss.moveX = () => {
            throw new Error("frozen attacking Medusa moved horizontally");
        };
        const before = captureMedusaClock(boss);
        boss.update(null);
        assert.deepEqual(captureMedusaClock(boss), before);
    }

    {
        const main = createMain({ timeFrozen: 1 });
        const boss = new MedusaBoss(main, 120, 64);
        boss.state = MedusaBoss.STATE_HOVERING;
        boss.fadeIn = 91;
        boss.spawnDelay = 5;
        boss.hoveringMoving = 8;
        boss.moveX = () => {
            throw new Error("timeFrozen=1 Medusa attempted horizontal movement");
        };
        boss.moveY = () => {
            throw new Error("timeFrozen=1 Medusa attempted vertical movement");
        };
        const before = captureMedusaClock(boss);
        boss.update(null);
        assert.deepEqual(captureMedusaClock(boss), before);
    }

    {
        const main = createMain();
        const boss = new MedusaBoss(main, 120, 64);
        boss.state = MedusaBoss.STATE_HOVERING;
        boss.fadeIn = 91;
        boss.spawnDelay = 10;
        boss.stunned = 1;
        boss.update(null);
        assert.equal(boss.stunned, 0);

        main.flags.hit = true;
        boss.update(null);
        assert.equal(main.enemyPower, 15);
        assert.equal(boss.stunned, 45);

        main.flags.hit = false;
        main.flags.contact = true;
        boss.update(null);
        assert.equal(main.hurtSimonCount, 1);
    }

    {
        const main = createMain({ enemyPower: 1 });
        main.flags.hit = true;
        const boss = new MedusaBoss(main, 120, 64);
        boss.state = MedusaBoss.STATE_HOVERING;
        boss.fadeIn = 91;
        boss.spawnDelay = 10;
        boss.update(null);
        assert.equal(boss.state, MedusaBoss.STATE_DEAD);
        assert.equal(main.enemyPower, 0);
        assert.equal(main.points, 3000);
        assert.equal(main.stoppedSongCount, 1);
    }

    // Medusa activation and fade-in are setup/presentation and remain live during
    // the freeze. Once the fade enters HOVERING, active AI stays paused.
    {
        const main = createMain({ simon: { x: 100, y: 128, xMin: 0, xMax: 900, direction: 1 } });
        const boss = new MedusaBoss(main, 120, 64);
        boss.update(null);
        assert.equal(boss.state, MedusaBoss.STATE_FADE_IN);
        assert.equal(main.requestedSong, main.boss_2);
        assert.equal(main.killAllCount, 1);
        assert.equal(main.simon.xMax, 512);
        assert.equal(boss.spawnDelay, 0);
        assert.equal(main.random.calls, 2);

        boss.fadeIn = 90;
        boss.update(null);
        assert.equal(boss.fadeIn, 91);
        assert.equal(boss.state, MedusaBoss.STATE_FADE_IN);
        boss.update(null);
        assert.equal(boss.state, MedusaBoss.STATE_HOVERING);

        const activationRandomCalls = main.random.calls;
        boss.moveX = () => {
            throw new Error("fully visible frozen Medusa attempted horizontal movement");
        };
        boss.moveY = () => {
            throw new Error("fully visible frozen Medusa attempted vertical movement");
        };
        boss.update(null);
        assert.equal(main.random.calls, activationRandomCalls);
        assert.equal(boss.spawnDelay, 0);
        assert.deepEqual(main.pushed, []);

        main.timeFrozen = 0;
        boss.moveX = () => true;
        boss.moveY = () => true;
        boss.update(null);
        assert.equal(boss.spawnDelay, 91);
        assert.equal(main.pushed.filter((name) => name === "Snakes").length, 1);
        assert.notEqual(boss.angle, 0);
    }

    // Structural Java/TypeScript parity guardrails: only the first two bosses
    // receive direct StopWatch gating; representative later-boss hazards retain
    // their independent freeze behavior.
    const tsBatBoss = read("pwa/src/stickvania/BatBoss.ts");
    const javaBatBoss = read("desktop/src/stickvania/BatBoss.java");
    const tsMedusaBoss = read("pwa/src/stickvania/MedusaBoss.ts");
    const javaMedusaBoss = read("desktop/src/stickvania/MedusaBoss.java");

    assert.match(tsBatBoss, /const timeAdvances = this\.main\.timeFrozen == 0/);
    assert.match(javaBatBoss, /boolean timeAdvances = main\.timeFrozen == 0/);
    assert.match(tsMedusaBoss, /const timeAdvances = this\.main\.timeFrozen == 0/);
    assert.match(javaMedusaBoss, /boolean timeAdvances = main\.timeFrozen == 0/);
    assert.match(tsMedusaBoss, /case MedusaBoss\.STATE_FADE_IN:[\s\S]*?this\.fadeIn\+\+/);
    assert.match(javaMedusaBoss, /case STATE_FADE_IN:[\s\S]*?fadeIn\+\+/);

    for (const path of [
        "pwa/src/stickvania/MummyBoss.ts",
        "pwa/src/stickvania/Frankenstein.ts",
        "pwa/src/stickvania/GrimReaper.ts",
        "pwa/src/stickvania/Dracula.ts",
        "desktop/src/stickvania/MummyBoss.java",
        "desktop/src/stickvania/Frankenstein.java",
        "desktop/src/stickvania/GrimReaper.java",
        "desktop/src/stickvania/Dracula.java"
    ]) {
        assert.doesNotMatch(read(path), /\btimeFrozen\b/, `${path} must remain directly immune to the StopWatch`);
    }

    for (const path of [
        "pwa/src/stickvania/Bat.ts",
        "pwa/src/stickvania/Snakes.ts",
        "pwa/src/stickvania/Wrapping.ts",
        "pwa/src/stickvania/Igor.ts",
        "pwa/src/stickvania/Sickle.ts",
        "pwa/src/stickvania/Fireball.ts",
        "pwa/src/stickvania/Ghost.ts",
        "desktop/src/stickvania/Bat.java",
        "desktop/src/stickvania/Snakes.java",
        "desktop/src/stickvania/Wrapping.java",
        "desktop/src/stickvania/Igor.java",
        "desktop/src/stickvania/Sickle.java",
        "desktop/src/stickvania/Fireball.java",
        "desktop/src/stickvania/Ghost.java"
    ]) {
        assert.match(read(path), /timeFrozen\s*==\s*0/, `${path} must retain its independent StopWatch freeze gate`);
    }

    console.log("StopWatch boss freeze checks passed.");
} finally {
    await server.close();
}
