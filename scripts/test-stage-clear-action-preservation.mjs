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

function createStack(initial = []) {
    const values = [...initial];
    return {
        things: values,
        top: values.length - 1,
        push(value) {
            values.push(value);
            this.top = values.length - 1;
        },
        pop() {
            const value = values.length === 0 ? null : values.pop();
            this.top = values.length - 1;
            return value;
        },
        clear() {
            values.length = 0;
            this.top = -1;
        }
    };
}

function createSimon(overrides = {}) {
    return {
        x: 100,
        y: 100,
        lastX: 100,
        lastY: 100,
        xMin: 0,
        xMax: 1000,
        dead: 0,
        hurt: false,
        flashing: 0,
        invincible: 0,
        drankPotion: false,
        onStairs: false,
        rightStairs: false,
        up: false,
        supported: false,
        kneeling: false,
        whipping: true,
        throwing: false,
        whipIncrementor: 25,
        whipIndex: 2,
        whipType: 2,
        releasedWhip: false,
        releasedJump: true,
        releasedKneel: true,
        direction: 1,
        vx: 0,
        vy: 0,
        ry1: 4,
        stand() {},
        walkLeft() {},
        walkRight() {},
        kneel() {},
        update() {
            return true;
        },
        ...overrides
    };
}

function createActionMain(Main, overrides = {}) {
    const main = Object.create(Main.prototype);
    Object.assign(main, {
        mode: Main.MODE_PLAYING,
        fadeState: Main.FADE_DONE,
        fade: 0,
        playerPower: 16,
        enemyPower: 16,
        simon: createSimon(),
        beatStageFlag: false,
        beatStageDelay: 0,
        floorBreaking: false,
        time: 300,
        timeFrozen: 0,
        timeIncrementor: 0,
        stageIndex: 0,
        hearts: 0,
        weaponType: Main.WEAPON_TYPE_BOOMERANG,
        weaponRepeats: Main.WEAPON_REPEATS_SINGLE,
        camera: 0,
        door: null,
        heartbeat: {},
        stoppedWeaponThrowRumble: 0,
        orbCollectRumble: 0,
        weaponsStack: createStack(),
        weaponsStackSwap: createStack(),
        controlInput: {
            isUp() {
                return false;
            },
            isDown() {
                return false;
            },
            isLeft() {
                return false;
            },
            isRight() {
                return false;
            },
            isJump() {
                return false;
            },
            isAttack() {
                return false;
            }
        },
        playSound() {},
        playRumble(effect) {
            if (effect === "orbCollect") this.orbCollectRumble++;
        },
        stopRumble(effect) {
            if (effect === "weaponThrow") this.stoppedWeaponThrowRumble++;
        },
        intersectsSimon() {
            return true;
        },
        beatStage() {
            this.beatStageFlag = true;
        },
        isEmpty() {
            return true;
        },
        isSupportive() {
            return false;
        },
        isSolid() {
            return false;
        },
        findPlatform() {
            return null;
        },
        setSimonAlpha() {},
        syncSimonPhysicsProfile() {},
        ...overrides
    });
    return main;
}

function snapshotAction(simon) {
    return {
        whipping: simon.whipping,
        throwing: simon.throwing,
        whipIncrementor: simon.whipIncrementor,
        whipIndex: simon.whipIndex,
        releasedWhip: simon.releasedWhip
    };
}

function createCaptureContext(main) {
    return {
        main,
        stageSegments: [],
        segmentIndexes: new Map(),
        regionIndexes: new Map(),
        stairsIndexes: new Map(),
        thingIds: new Map(),
        things: []
    };
}

try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { Simon } = await server.ssrLoadModule("/src/stickvania/Simon.ts");
    const { Orb } = await server.ssrLoadModule("/src/stickvania/Orb.ts");
    const { StickvaniaGameStateSerializer } = await server.ssrLoadModule("/src/stickvania/persistence/StickvaniaGameStateSerializer.ts");
    const {
        canRegisteredSimonActionStart,
        canSimonActionContinue,
        registerPlayerActionMain,
        reconcileRegisteredSimonActionBeforeAttackRead
    } = await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");
    const { THING_PERSISTED_STATE_FIELD_NAMES, MAIN_PERSISTED_STATE_FIELD_NAMES } = await server.ssrLoadModule(
        "/src/stickvania/persistence/StateFieldRegistry.generated.ts"
    );

    // Orb collection owns only the stage transition; it must not mutate the exact
    // visible whip/subweapon state captured at contact.
    for (const throwing of [false, true]) {
        const main = createActionMain(Main, {
            simon: createSimon({ throwing, whipIncrementor: throwing ? 12 : 25, whipIndex: throwing ? 1 : 2 })
        });
        const before = snapshotAction(main.simon);
        const orb = new Orb(main, 0, 0, 0);
        orb.fadeIn = 91;
        orb.applyGravity = () => {};

        assert.equal(orb.update(null), false);
        assert.equal(main.beatStageFlag, true);
        assert.equal(main.orbCollectRumble, 1);
        assert.deepEqual(snapshotAction(main.simon), before);
        assert.equal(main.stoppedWeaponThrowRumble, 0);

        registerPlayerActionMain(main);
        assert.equal(canSimonActionContinue(main), false, "stage-clear tally remains non-playable");
        assert.equal(canRegisteredSimonActionStart(), false, "fresh Attack remains blocked during tally");
        for (let i = 0; i < 20; i++) {
            reconcileRegisteredSimonActionBeforeAttackRead();
            assert.deepEqual(snapshotAction(main.simon), before, "tally reconciliation must be pure suspension");
        }
    }

    // Fade is also suspension: otherwise-valid actions remain semantically valid
    // while Main's fade branch prevents simulation from advancing.
    for (const fadeState of [Main.FADE_OUT, Main.FADE_IN]) {
        const main = createActionMain(Main, { fadeState });
        assert.equal(canSimonActionContinue(main), true);
    }

    // Stage-three brick breaking resumes a frozen ordinary whip at the exact next
    // animation tick even though TIME is already zero.
    {
        const main = createActionMain(Main, {
            stageIndex: 2,
            floorBreaking: true,
            time: 0,
            simon: createSimon({ whipIncrementor: 25, whipIndex: 2, throwing: false })
        });
        registerPlayerActionMain(main);
        assert.equal(canSimonActionContinue(main), true);
        main.updateSimon(null);
        assert.equal(main.simon.whipIncrementor, 26);
        assert.equal(main.simon.whipping, true);
    }

    // A pre-frame-20 queued throw resumes, but the current frame-20 resource
    // check suppresses materialization after the tally has drained hearts to zero.
    {
        const main = createActionMain(Main, {
            stageIndex: 2,
            floorBreaking: true,
            time: 0,
            hearts: 0,
            simon: createSimon({ throwing: true, whipIncrementor: 19, whipIndex: 1 })
        });
        registerPlayerActionMain(main);
        main.updateSimon(null);
        assert.equal(main.simon.whipIncrementor, 20);
        assert.equal(main.weaponsStack.top, -1);
        assert.equal(main.hearts, 0);
    }

    // If current gameplay legitimately restores eligibility before frame 20, the
    // same preserved action may materialize exactly one current weapon.
    {
        const main = createActionMain(Main, {
            stageIndex: 2,
            floorBreaking: true,
            time: 0,
            hearts: 1,
            simon: createSimon({ throwing: true, whipIncrementor: 19, whipIndex: 1 })
        });
        registerPlayerActionMain(main);
        main.updateSimon(null);
        assert.equal(main.simon.whipIncrementor, 20);
        assert.equal(main.weaponsStack.top, 0);
        assert.equal(main.hearts, 0);
    }

    // Persistence uses the real serializer field codec and a JSON boundary, not
    // merely field-name assertions. This proves the exact frozen Simon action and
    // stage-clear control fields survive the representation used by localStorage.
    {
        const serializer = new StickvaniaGameStateSerializer();
        const sourceMain = {};
        for (const field of MAIN_PERSISTED_STATE_FIELD_NAMES) sourceMain[field] = null;
        Object.assign(sourceMain, {
            mode: Main.MODE_PLAYING,
            beatStageFlag: true,
            beatStageDelay: 137,
            floorBreaking: false
        });
        const captureContext = createCaptureContext(sourceMain);
        const encodedMain = serializer.captureMainFields(captureContext);
        const decodedMainRecord = JSON.parse(JSON.stringify(encodedMain));
        const restoredMain = {};
        const restoreContext = { main: restoredMain, gc: null, stageSegments: [], thingById: new Map() };
        serializer.restoreMainFields(restoredMain, decodedMainRecord, restoreContext);
        assert.equal(restoredMain.beatStageFlag, true);
        assert.equal(restoredMain.beatStageDelay, 137);
        assert.equal(restoredMain.floorBreaking, false);

        const sourceSimon = Object.create(Simon.prototype);
        for (const field of THING_PERSISTED_STATE_FIELD_NAMES.Simon) sourceSimon[field] = null;
        Object.assign(sourceSimon, {
            whipping: true,
            throwing: true,
            whipIncrementor: 12,
            whipIndex: 1,
            releasedWhip: false
        });
        const thingCaptureContext = createCaptureContext(sourceMain);
        serializer.registerThing(thingCaptureContext, sourceSimon);
        const encodedThing = serializer.captureThing(thingCaptureContext, sourceSimon, 0);
        const decodedThing = JSON.parse(JSON.stringify(encodedThing));
        const restoredSimon = Object.create(Simon.prototype);
        const thingRestoreContext = { main: restoredMain, gc: null, stageSegments: [], thingById: new Map([[0, restoredSimon]]) };
        serializer.restoreThingFields(thingRestoreContext, [decodedThing]);
        assert.deepEqual(snapshotAction(restoredSimon), {
            whipping: true,
            throwing: true,
            whipIncrementor: 12,
            whipIndex: 1,
            releasedWhip: false
        });

        restoredMain.simon = restoredSimon;
        restoredMain.playerPower = 16;
        restoredMain.stageIndex = 0;
        restoredMain.time = 300;
        restoredMain.door = null;
        restoredMain.fadeState = Main.FADE_DONE;
        restoredMain.stopRumble = () => {};
        registerPlayerActionMain(restoredMain);
        reconcileRegisteredSimonActionBeforeAttackRead();
        assert.equal(restoredSimon.whipping, true, "restored tally state must remain suspended rather than cancelled");
        assert.equal(canRegisteredSimonActionStart(), false);
    }

    for (const field of ["whipping", "throwing", "whipIncrementor", "whipIndex", "releasedWhip"]) {
        assert.ok(THING_PERSISTED_STATE_FIELD_NAMES.Simon.includes(field), `Simon.${field} must persist`);
    }
    for (const field of ["beatStageFlag", "beatStageDelay", "floorBreaking"]) {
        assert.ok(MAIN_PERSISTED_STATE_FIELD_NAMES.includes(field), `Main.${field} must persist`);
    }

    const tsOrb = readFileSync(resolve(rootDir, "pwa/src/stickvania/Orb.ts"), "utf8");
    const javaOrb = readFileSync(resolve(rootDir, "desktop/src/stickvania/Orb.java"), "utf8");
    const tsPolicy = readFileSync(resolve(rootDir, "pwa/src/stickvania/PlayerActionPolicy.ts"), "utf8");
    const javaPolicy = readFileSync(resolve(rootDir, "desktop/src/stickvania/PlayerActionPolicy.java"), "utf8");
    const rumbleEffects = readFileSync(resolve(rootDir, "pwa/src/rumble/RumbleEffects.ts"), "utf8");

    assert.doesNotMatch(tsOrb, /cancelSimonAction/);
    assert.doesNotMatch(javaOrb, /cancelSimonAction/);
    assert.match(tsOrb, /beatStage\(\)/);
    assert.match(javaOrb, /beatStage\(\)/);
    assert.match(tsPolicy, /reconcileRegisteredSimonActionBeforeAttackRead[\s\S]*?if \(main\.beatStageFlag\) \{\s*return;/);
    assert.match(javaPolicy, /reconcileRegisteredSimonActionBeforeAttackRead[\s\S]*?if \(main\.beatStage\) \{\s*return;/);
    assert.match(tsPolicy, /canSimonActionContinue[\s\S]*?!main\.beatStageFlag/);
    assert.match(javaPolicy, /canSimonActionContinue[\s\S]*?!main\.beatStage/);
    assert.doesNotMatch(tsPolicy, /canSimonActionContinue[\s\S]*?fadeState[\s\S]*?canRegisteredSimonActionStart/);
    assert.doesNotMatch(javaPolicy, /canSimonActionContinue[\s\S]*?fadeState[\s\S]*?canRegisteredSimonActionStart/);

    // Preserving a queued action cannot leave a long-running rumble behind: the
    // weaponThrow effect is a bounded 45ms pulse and self-completes.
    assert.match(rumbleEffects, /id: "weaponThrow"[\s\S]*?pattern: pulse\(45,/);

    console.log("Stage-clear/fade action-preservation production regressions passed.");
} finally {
    await server.close();
}
