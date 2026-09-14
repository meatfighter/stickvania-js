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

function createStack(initial = []) {
    const values = [...initial];
    return {
        top: values.length - 1,
        things: values,
        pop() {
            const value = values.length === 0 ? null : values.pop();
            this.top = values.length - 1;
            return value;
        },
        push(value) {
            values.push(value);
            this.top = values.length - 1;
        }
    };
}

function createMain(Main, registerPlayerActionMain, prepareRegisteredCountdownTimer, overrides = {}) {
    const main = Object.create(Main.prototype);
    const twang = { id: "twang" };
    Object.assign(main, {
        currentSong: null,
        requestedSong: null,
        currentMusic: null,
        mode: Main.MODE_PLAYING,
        fadeState: Main.FADE_DONE,
        fade: 0,
        fadeReason: 0,
        beatStageFlag: false,
        beatStageDelay: 0,
        floorBreaking: false,
        playerPower: 16,
        enemyPower: 16,
        time: 100,
        timeIncrementor: 0,
        timeFrozen: 0,
        hearts: 0,
        score: 0,
        simon: { dead: 0, flashing: 0 },
        door: null,
        repeatsFlashing: 0,
        killAllFlag: false,
        regionThingStack: createStack(),
        regionStackSwap: createStack(),
        weaponsStack: createStack(),
        weaponsStackSwap: createStack(),
        platforms: [],
        twang,
        playedSounds: [],
        timeoutDamage: [],
        syncSimonPhysicsProfile() {},
        updateSimon() {},
        moveCamera() {},
        playSound(sound) {
            this.playedSounds.push(sound);
        },
        hurtSimon(power) {
            this.timeoutDamage.push(power);
        },
        addPoints(points) {
            this.score += points;
        },
        ...overrides
    });
    registerPlayerActionMain(main);
    main.controlInput = {
        update() {
            prepareRegisteredCountdownTimer();
        }
    };
    return main;
}

function updateFrame(main) {
    main.updateFrame(null);
}

function twangCount(main) {
    return main.playedSounds.filter((sound) => sound === main.twang).length;
}

try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { prepareRegisteredCountdownTimer, registerPlayerActionMain } = await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");
    const makeMain = (overrides = {}) => createMain(Main, registerPlayerActionMain, prepareRegisteredCountdownTimer, overrides);

    // Normal gameplay advances the fractional countdown phase.
    {
        const main = makeMain({ time: 100, timeIncrementor: 47 });
        updateFrame(main);
        assert.equal(main.time, 100);
        assert.equal(main.timeIncrementor, 48);
        assert.equal(twangCount(main), 0);
    }

    // StopWatch freezes both the visible TIME and the hidden fractional phase,
    // including a phase sitting immediately before rollover.
    {
        const main = makeMain({ time: 18, timeIncrementor: 90, timeFrozen: 455 });
        for (let i = 0; i < 20; i++) {
            updateFrame(main);
        }
        assert.equal(main.time, 18);
        assert.equal(main.timeIncrementor, 90);
        assert.equal(twangCount(main), 0);
    }

    // The final StopWatch contribution is still frozen during the timer pass.
    // A weapon update releases it later in the same frame; the low-time tone and
    // decrement occur only on the following frame from the exact held phase.
    {
        const main = makeMain({ time: 30, timeIncrementor: 90, timeFrozen: 1 });
        main.weaponsStack = createStack([
            {
                update() {
                    main.timeFrozen = 0;
                    return false;
                }
            }
        ]);
        updateFrame(main);
        assert.equal(main.time, 30);
        assert.equal(main.timeIncrementor, 90);
        assert.equal(main.timeFrozen, 0);
        assert.equal(twangCount(main), 0);

        updateFrame(main);
        assert.equal(main.time, 29);
        assert.equal(main.timeIncrementor, 0);
        assert.equal(twangCount(main), 1);
    }

    // Boundary contract: warn when the new visible TIME is 30..1. TIME zero is
    // terminal and deliberately receives no extra low-time twang.
    for (const { from, to, warnings, timeout } of [
        { from: 32, to: 31, warnings: 0, timeout: 0 },
        { from: 31, to: 30, warnings: 1, timeout: 0 },
        { from: 30, to: 29, warnings: 1, timeout: 0 },
        { from: 2, to: 1, warnings: 1, timeout: 0 },
        { from: 1, to: 0, warnings: 0, timeout: 1 }
    ]) {
        const main = makeMain({ time: from, timeIncrementor: 90 });
        updateFrame(main);
        assert.equal(main.time, to, `${from} -> ${to} TIME`);
        assert.equal(main.timeIncrementor, 0, `${from} -> ${to} phase`);
        assert.equal(twangCount(main), warnings, `${from} -> ${to} warning count`);
        assert.equal(main.timeoutDamage.length, timeout, `${from} -> ${to} timeout count`);
        if (timeout !== 0) {
            assert.deepEqual(main.timeoutDamage, [16]);
        }
    }

    // One full low-time run proves there is exactly one cue for each resulting
    // TIME value 30..1: thirty cues total, followed by silent timeout at zero.
    {
        const main = makeMain({ time: 31, timeIncrementor: 90 });
        let updates = 0;
        while (main.time > 0 && updates < 4000) {
            updateFrame(main);
            updates++;
        }
        assert.equal(main.time, 0);
        assert.equal(twangCount(main), 30);
        assert.deepEqual(main.timeoutDamage, [16]);
    }

    // Restoring/entering an already-low TIME value is state, not an event. No cue
    // occurs until the next actual decrement.
    {
        const main = makeMain({ time: 30, timeIncrementor: 0 });
        updateFrame(main);
        assert.equal(main.time, 30);
        assert.equal(main.timeIncrementor, 1);
        assert.equal(twangCount(main), 0);
    }

    // Merely equipping StopWatch does not freeze TIME. Only a live contribution
    // to timeFrozen owns the time freeze.
    {
        const main = makeMain({
            weaponType: Main.WEAPON_TYPE_STOP_WATCH,
            timeFrozen: 0,
            time: 31,
            timeIncrementor: 90
        });
        updateFrame(main);
        assert.equal(main.time, 30);
        assert.equal(main.timeIncrementor, 0);
        assert.equal(twangCount(main), 1);
    }

    // Main evaluates the countdown after input preflight but before updateSimon.
    // If this fixed step enters low time and updateSimon starts StopWatch later in
    // the same step, the final pre-freeze decrement/cue happens exactly once.
    {
        const main = makeMain({ time: 31, timeIncrementor: 90 });
        main.updateSimon = () => {
            main.timeFrozen = 455;
        };
        updateFrame(main);
        assert.equal(main.time, 30);
        assert.equal(main.timeIncrementor, 0);
        assert.equal(main.timeFrozen, 455);
        assert.equal(twangCount(main), 1);

        updateFrame(main);
        assert.equal(main.time, 30);
        assert.equal(main.timeIncrementor, 0);
        assert.equal(twangCount(main), 1);
    }

    // Fade-in's zero boundary changes to FADE_DONE and continues into gameplay in
    // the same frame, so the preflight must treat that exact state as eligible.
    {
        const main = makeMain({ fadeState: Main.FADE_IN, fade: 0, time: 31, timeIncrementor: 90 });
        updateFrame(main);
        assert.equal(main.fadeState, Main.FADE_DONE);
        assert.equal(main.time, 30);
        assert.equal(twangCount(main), 1);
    }

    // A still-running fade returns before the timer; no phase compensation or cue
    // may leak into a frame that never reaches Main's countdown expression.
    {
        const main = makeMain({ fadeState: Main.FADE_IN, fade: 1, time: 31, timeIncrementor: 90, playerPower: 0 });
        updateFrame(main);
        assert.equal(main.fade, 0);
        assert.equal(main.time, 31);
        assert.equal(main.timeIncrementor, 90);
        assert.equal(twangCount(main), 0);
    }

    // Main's historical expression increments the phase before checking these two
    // guards. PlayerActionPolicy performs a one-tick pre-compensation so the
    // stable phase does not advance or cross 91 in dead/floor-breaking frames.
    for (const overrides of [{ playerPower: 0 }, { floorBreaking: true }]) {
        for (const phase of [0, 90]) {
            const main = makeMain({ time: 18, timeIncrementor: phase, ...overrides });
            for (let i = 0; i < 5; i++) {
                updateFrame(main);
            }
            assert.equal(main.time, 18);
            assert.equal(main.timeIncrementor, phase);
            assert.equal(twangCount(main), 0);
        }
    }

    // Stage-clear conversion returns before the ordinary timer. It retains its
    // existing independent every-five-units tally rule rather than gaining the
    // gameplay warning on every decrement.
    {
        const main = makeMain({ beatStageFlag: true, beatStageDelay: 0, playerPower: 16, time: 30, timeIncrementor: 90 });
        updateFrame(main);
        assert.equal(main.time, 29);
        assert.equal(main.timeIncrementor, 90);
        assert.equal(main.score, 10);
        assert.equal(twangCount(main), 0);
    }

    const tsMain = readFileSync(resolve(rootDir, "pwa/src/stickvania/Main.ts"), "utf8");
    const javaMain = readFileSync(resolve(rootDir, "desktop/src/stickvania/Main.java"), "utf8");
    const tsPolicy = readFileSync(resolve(rootDir, "pwa/src/stickvania/PlayerActionPolicy.ts"), "utf8");
    const javaPolicy = readFileSync(resolve(rootDir, "desktop/src/stickvania/PlayerActionPolicy.java"), "utf8");
    const tsInput = readFileSync(resolve(rootDir, "pwa/src/stickvania/StickvaniaInput.ts"), "utf8");
    const javaInput = readFileSync(resolve(rootDir, "desktop/src/stickvania/StickvaniaInput.java"), "utf8");

    // The compensation policy is intentionally paired with this historical Main
    // operand order. If Main is ever reordered, this test forces a joint audit.
    assert.match(
        tsMain,
        /this\.timeFrozen == 0\s*&&\s*\+\+this\.timeIncrementor == 91\s*&&\s*this\.playerPower > 0\s*&&\s*!this\.floorBreaking/
    );
    assert.match(
        javaMain,
        /timeFrozen == 0\s*&&\s*\+\+timeIncrementor == 91\s*&&\s*playerPower > 0\s*&&\s*!floorBreaking/
    );
    assert.match(tsPolicy, /main\.playerPower <= 0 \|\| main\.floorBreaking[\s\S]*?main\.timeIncrementor--/);
    assert.match(javaPolicy, /main\.playerPower <= 0 \|\| main\.floorBreaking[\s\S]*?main\.timeIncrementor--/);
    assert.match(tsPolicy, /main\.timeIncrementor == 90 && main\.time > 1 && main\.time <= 31[\s\S]*?main\.playSound\(main\.twang\)/);
    assert.match(javaPolicy, /main\.timeIncrementor == 90 && main\.time > 1 && main\.time <= 31[\s\S]*?main\.playSound\(main\.twang\)/);
    assert.match(tsInput, /prepareRegisteredCountdownTimer\(\);[\s\S]*?reconcileRegisteredSimonActionBeforeAttackRead\(\);/);
    assert.match(javaInput, /PlayerActionPolicy\.prepareRegisteredCountdownTimer\(\);[\s\S]*?PlayerActionPolicy\.reconcileRegisteredSimonActionBeforeAttackRead\(\);/);

    console.log("StopWatch countdown freeze, timer-phase, and low-time warning checks passed.");
} finally {
    await server.close();
}
