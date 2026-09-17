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

function read(path) {
    return readFileSync(resolve(rootDir, path), "utf8");
}

function stack(things = []) {
    return { top: things.length - 1, things: [...things] };
}

function simon(overrides = {}) {
    return {
        dead: 0,
        hurt: false,
        flashing: 0,
        y: 100,
        onStairs: false,
        whipping: false,
        throwing: false,
        whipIncrementor: 0,
        whipIndex: 0,
        releasedWhip: true,
        ...overrides
    };
}

function mainState(overrides = {}) {
    return {
        mode: 4,
        fadeState: 0,
        fade: 0,
        playerPower: 16,
        enemyPower: 16,
        simon: simon(),
        beatStageFlag: false,
        floorBreaking: false,
        time: 300,
        timeIncrementor: 0,
        timeFrozen: 0,
        stageIndex: 0,
        hearts: 10,
        weaponType: 1,
        weaponRepeats: 0,
        door: null,
        regionThingStack: stack(),
        regionStackSwap: stack(),
        stoppedWeaponThrowRumble: 0,
        stopRumble(effect) {
            if (effect === "weaponThrow") this.stoppedWeaponThrowRumble++;
        },
        playSound() {},
        setSimonAlpha() {},
        ...overrides
    };
}

try {
    const { Orb } = await server.ssrLoadModule("/src/stickvania/Orb.ts");
    const {
        canRegisteredSimonActionStart,
        canSimonActionContinue,
        cancelSimonAction,
        registerPlayerActionMain,
        reconcileRegisteredSimonActionBeforeAttackRead
    } = await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");
    const { canStartStopWatch, canStopWatchRun } = await server.ssrLoadModule("/src/stickvania/StopWatchMusicHold.ts");
    const { isStopWatchRepeatStateValid } = await server.ssrLoadModule("/src/stickvania/persistence/StopWatchRepeatStatePolicy.ts");

    const live = mainState();
    assert.equal(canSimonActionContinue(live), true);
    assert.equal(canSimonActionContinue(mainState({ fadeState: 1 })), true, "fade-out is suspended, not invalid");
    assert.equal(canSimonActionContinue(mainState({ fadeState: 2 })), true, "fade-in is suspended, not invalid");
    for (const invalid of [
        { playerPower: 0 },
        { time: 0 },
        { beatStageFlag: true },
        { floorBreaking: true },
        { door: {} },
        { simon: simon({ hurt: true }) },
        { simon: simon({ flashing: 1 }) },
        { simon: simon({ y: 417 }) },
        { simon: simon({ onStairs: true, y: -62 }) },
        { simon: simon({ onStairs: true, y: 285 }) }
    ]) {
        assert.equal(canSimonActionContinue(mainState(invalid)), false);
    }
    assert.equal(canSimonActionContinue(mainState({ mode: 1 })), true, "demo recordings retain delayed-action simulation");
    assert.equal(canSimonActionContinue(mainState({ mode: 8 })), true, "credits recordings retain delayed-action simulation");
    assert.equal(
        canSimonActionContinue(mainState({ stageIndex: 2, floorBreaking: true, time: 0 })),
        true,
        "only the real stage-three brick-break scene bypasses TIME-zero invalidation"
    );
    assert.equal(
        canSimonActionContinue(mainState({ stageIndex: 5, enemyPower: 0 })),
        true,
        "Dracula death presentation is not a generic whip/non-StopWatch terminal state"
    );

    const active = mainState({ simon: simon({ whipping: true, throwing: true, whipIncrementor: 12, whipIndex: 1, releasedWhip: false }) });
    cancelSimonAction(active);
    assert.equal(active.simon.whipping, false);
    assert.equal(active.simon.throwing, false);
    assert.equal(active.simon.whipIncrementor, 0);
    assert.equal(active.simon.whipIndex, 0);
    assert.equal(active.simon.releasedWhip, false);
    assert.equal(active.stoppedWeaponThrowRumble, 1);

    const tally = mainState({ beatStageFlag: true, simon: simon({ whipping: true, throwing: true, whipIncrementor: 12, whipIndex: 1, releasedWhip: false }) });
    registerPlayerActionMain(tally);
    reconcileRegisteredSimonActionBeforeAttackRead();
    assert.equal(tally.simon.whipping, true);
    assert.equal(tally.simon.throwing, true);
    assert.equal(tally.simon.whipIncrementor, 12);
    assert.equal(tally.stoppedWeaponThrowRumble, 0);
    assert.equal(canRegisteredSimonActionStart(), false);

    const timeoutAction = mainState({ time: 0, simon: simon({ whipping: true, throwing: true, whipIncrementor: 19, releasedWhip: false }) });
    registerPlayerActionMain(timeoutAction);
    reconcileRegisteredSimonActionBeforeAttackRead();
    assert.equal(timeoutAction.simon.whipping, false);
    assert.equal(timeoutAction.simon.throwing, false);

    assert.equal(canStopWatchRun(live), true);
    assert.equal(canStartStopWatch(live), true);
    assert.equal(canStopWatchRun(mainState({ timeFrozen: 455 })), true);
    assert.equal(canStartStopWatch(mainState({ timeFrozen: 455 })), false);
    assert.equal(canStopWatchRun(mainState({ beatStageFlag: true })), false);
    assert.equal(canStopWatchRun(mainState({ time: 0 })), false);
    assert.equal(canStopWatchRun(mainState({ simon: simon({ hurt: true }) })), false);
    assert.equal(canStartStopWatch(mainState({ simon: simon({ hurt: true }) })), false);
    assert.equal(canStopWatchRun(mainState({ stageIndex: 2, floorBreaking: true, time: 0 })), true);
    assert.equal(canStartStopWatch(mainState({ stageIndex: 2, floorBreaking: true, time: 0 })), true);

    const hiddenOrb = Object.create(Orb.prototype);
    hiddenOrb.appearDelay = 1;
    const visibleOrb = Object.create(Orb.prototype);
    visibleOrb.appearDelay = 0;
    assert.equal(canStopWatchRun(mainState({ stageIndex: 5, enemyPower: 0, regionThingStack: stack([hiddenOrb]) })), false);
    assert.equal(canStopWatchRun(mainState({ stageIndex: 5, enemyPower: 0, regionThingStack: stack([visibleOrb]) })), true);

    assert.equal(isStopWatchRepeatStateValid({ weaponType: 5, weaponRepeats: 0 }), true);
    assert.equal(isStopWatchRepeatStateValid({ weaponType: 5, weaponRepeats: 1 }), false);
    assert.equal(isStopWatchRepeatStateValid({ weaponType: 5, weaponRepeats: 2 }), false);
    assert.equal(isStopWatchRepeatStateValid({ weaponType: 1, weaponRepeats: 2 }), true);

    const tsPolicy = read("pwa/src/stickvania/PlayerActionPolicy.ts");
    const javaPolicy = read("desktop/src/stickvania/PlayerActionPolicy.java");
    const tsOrb = read("pwa/src/stickvania/Orb.ts");
    const javaOrb = read("desktop/src/stickvania/Orb.java");
    const tsDoor = read("pwa/src/stickvania/Door.ts");
    const javaDoor = read("desktop/src/stickvania/Door.java");
    const tsMain = read("pwa/src/stickvania/Main.ts");
    const javaMain = read("desktop/src/stickvania/Main.java");
    const tsSimon = read("pwa/src/stickvania/Simon.ts");
    const javaSimon = read("desktop/src/stickvania/Simon.java");
    const tsStopWatch = read("pwa/src/stickvania/StopWatch.ts");
    const javaStopWatch = read("desktop/src/stickvania/StopWatch.java");
    const tsDropItem = read("pwa/src/stickvania/DropItem.ts");
    const javaDropItem = read("desktop/src/stickvania/DropItem.java");

    for (const source of [tsPolicy, javaPolicy]) {
        assert.doesNotMatch(source, /canSimonActionContinue[\s\S]*?fadeState[\s\S]*?canRegisteredSimonActionStart/);
    }
    assert.match(tsPolicy, /reconcileRegisteredSimonActionBeforeAttackRead[\s\S]*?if \(main\.beatStageFlag\) \{\s*return;/);
    assert.match(javaPolicy, /reconcileRegisteredSimonActionBeforeAttackRead[\s\S]*?if \(main\.beatStage\) \{\s*return;/);

    assert.doesNotMatch(tsOrb, /cancelSimonAction/);
    assert.doesNotMatch(javaOrb, /cancelSimonAction/);
    assert.match(tsOrb, /playRumble\("orbCollect"\)[\s\S]*?beatStage\(\)/);
    assert.match(javaOrb, /main\.beatStage\(\)/);

    assert.match(tsDoor, /cancelSimonAction\(this\.main\);\s*this\.main\.enterNextRegion\(this\)/);
    assert.match(javaDoor, /PlayerActionPolicy\.cancelSimonAction\(main\);\s*main\.enterNextRegion\(this\)/);

    assert.match(
        tsMain,
        /const wantsSubWeapon: boolean = keyDownAttack && keyDownUp;\s*let keyDownSubWeapon: boolean = wantsSubWeapon && this\.canSelectSubWeapon\(\);\s*let keyDownWhip: boolean = keyDownAttack && \(!wantsSubWeapon \|\| !keyDownSubWeapon\);/
    );
    assert.match(
        javaMain,
        /boolean wantsSubWeapon = keyDownAttack && keyDownUp;\s*boolean keyDownSubWeapon = wantsSubWeapon && canSelectSubWeapon\(\);\s*boolean keyDownWhip = keyDownAttack && \(!wantsSubWeapon \|\| !keyDownSubWeapon\);/
    );
    assert.match(tsMain, /public throwWeapon\(\): void \{\s*if \(!this\.canUseSubWeapon\(\)\) \{\s*return;/);
    assert.match(javaMain, /public void throwWeapon\(\) \{\s*if \(!canUseSubWeapon\(\)\) \{\s*return;/);

    assert.match(tsSimon, /\(this\.whipping \|\| this\.throwing\)[\s\S]*?!canSimonActionContinue\(this\.main\)/);
    assert.match(javaSimon, /\(whipping \|\| throwing\)[\s\S]*?!PlayerActionPolicy\.canSimonActionContinue\(main\)/);
    assert.match(tsSimon, /weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?!canStopWatchRun/);
    assert.match(javaSimon, /weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?!StopWatchMusicHold\.canStopWatchRun/);
    assert.match(tsSimon, /time == 0[\s\S]*?hurt[\s\S]*?playerPower = 0/);
    assert.match(javaSimon, /time == 0[\s\S]*?hurt[\s\S]*?playerPower = 0/);

    assert.match(tsStopWatch, /if \(!canStartStopWatch\(main\)\)[\s\S]*?main\.hearts \+= 5[\s\S]*?cancelSimonAction\(main\)/);
    assert.match(
        javaStopWatch,
        /if \(!StopWatchMusicHold\.canStartStopWatch\(main\)\)[\s\S]*?main\.hearts \+= 5[\s\S]*?PlayerActionPolicy\.cancelSimonAction\(main\)/
    );
    assert.match(tsStopWatch, /if \(!canStopWatchRun\(this\.main\)\)[\s\S]*?this\.cancel\(\)/);
    assert.match(javaStopWatch, /if \(!StopWatchMusicHold\.canStopWatchRun\(main\)\)[\s\S]*?cancel\(\)/);

    assert.match(tsDropItem, /this\.main\.simon!\.throwing[\s\S]*?whipIncrementor < 20[\s\S]*?cancelSimonAction\(this\.main\)/);
    assert.match(javaDropItem, /main\.simon\.throwing[\s\S]*?whipIncrementor < 20[\s\S]*?PlayerActionPolicy\.cancelSimonAction\(main\)/);

    console.log("StopWatch/delayed-action production hardening checks passed.");
} finally {
    await server.close();
}
