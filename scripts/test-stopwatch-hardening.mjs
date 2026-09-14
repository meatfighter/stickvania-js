import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

try {
    const { canStartStopWatch, canStopWatchRun } = await server.ssrLoadModule("/src/stickvania/StopWatchMusicHold.ts");
    const { canSimonActionContinue, cancelSimonAction } = await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");
    const { isPotentialStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStatePreflight.ts");
    const { GAME_STATE_VERSION } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSchema.ts");
    const { isStopWatchRepeatStateValid } = await server.ssrLoadModule("/src/stickvania/persistence/StopWatchRepeatStatePolicy.ts");

    const live = createMainState();
    assert.equal(canSimonActionContinue(live), true);
    assert.equal(canSimonActionContinue(createMainState({ fadeState: 1 })), false);
    assert.equal(canSimonActionContinue(createMainState({ playerPower: 0 })), false);
    assert.equal(canSimonActionContinue(createMainState({ time: 0 })), false);
    assert.equal(canSimonActionContinue(createMainState({ beatStageFlag: true })), false);
    assert.equal(canSimonActionContinue(createMainState({ floorBreaking: true })), false);
    assert.equal(canSimonActionContinue(createMainState({ door: {} })), false);
    assert.equal(canSimonActionContinue(createMainState({ stageIndex: 5, enemyPower: 0 })), false);
    assert.equal(canSimonActionContinue(createMainState({ simon: { dead: 0, hurt: true, flashing: 0, y: 100, onStairs: false } })), false);
    assert.equal(canSimonActionContinue(createMainState({ simon: { dead: 0, hurt: false, flashing: 1, y: 100, onStairs: false } })), false);
    assert.equal(canSimonActionContinue(createMainState({ simon: { dead: 0, hurt: false, flashing: 0, y: 417, onStairs: false } })), false);
    assert.equal(canSimonActionContinue(createMainState({ simon: { dead: 0, hurt: false, flashing: 0, y: -62, onStairs: true } })), false);
    assert.equal(canSimonActionContinue(createMainState({ simon: { dead: 0, hurt: false, flashing: 0, y: 285, onStairs: true } })), false);
    assert.equal(canSimonActionContinue(createMainState({ mode: 1 })), true, "demo recordings retain delayed-action simulation");
    assert.equal(canSimonActionContinue(createMainState({ mode: 8 })), true, "credits recordings retain delayed-action simulation");

    const cancelState = createMainState({
        simon: {
            dead: 0,
            hurt: false,
            flashing: 0,
            y: 100,
            onStairs: false,
            whipping: true,
            throwing: true,
            whipIncrementor: 17,
            whipIndex: 1,
            releasedWhip: true
        }
    });
    cancelSimonAction(cancelState);
    assert.equal(cancelState.simon.whipping, false);
    assert.equal(cancelState.simon.throwing, false);
    assert.equal(cancelState.simon.whipIncrementor, 0);
    assert.equal(cancelState.simon.whipIndex, 0);
    assert.equal(cancelState.simon.releasedWhip, false);
    assert.equal(cancelState.stoppedWeaponThrowRumble, 1);

    const idleCancelState = createMainState({
        simon: { dead: 0, hurt: false, flashing: 0, y: 100, onStairs: false, whipping: false, throwing: false, releasedWhip: true }
    });
    cancelSimonAction(idleCancelState);
    assert.equal(idleCancelState.simon.releasedWhip, true, "cancel helper must not alter the attack latch when there is no active windup");

    assert.equal(canStopWatchRun(live), true);
    assert.equal(canStartStopWatch(live), true);
    assert.equal(canStopWatchRun(createMainState({ timeFrozen: 455 })), true, "an existing valid stopwatch may continue while it owns time");
    assert.equal(canStartStopWatch(createMainState({ timeFrozen: 455 })), false, "a second stopwatch may not start while time is already frozen");
    assert.equal(
        canStartStopWatch(createMainState({ simon: { dead: 0, hurt: true, flashing: 0, y: 100, onStairs: false } })),
        false,
        "hurt Simon may not start a StopWatch"
    );
    assert.equal(canStopWatchRun(createMainState({ mode: 1 })), true, "demo recordings retain stopwatch simulation behavior");
    assert.equal(canStopWatchRun(createMainState({ mode: 8 })), true, "credits recordings retain stopwatch simulation behavior");
    assert.equal(canStopWatchRun(createMainState({ mode: 0 })), false);
    assert.equal(canStopWatchRun(createMainState({ playerPower: 0 })), false);
    assert.equal(canStopWatchRun(createMainState({ simon: null })), false);
    assert.equal(canStopWatchRun(createMainState({ simon: { dead: 1, hurt: false, flashing: 0, y: 100, onStairs: false } })), false);
    assert.equal(canStopWatchRun(createMainState({ beatStageFlag: true })), false);
    assert.equal(canStopWatchRun(createMainState({ floorBreaking: true })), false);
    assert.equal(canStopWatchRun(createMainState({ time: 0 })), false);
    assert.equal(canStopWatchRun(createMainState({ stageIndex: 5, enemyPower: 0 })), false);
    assert.equal(canStopWatchRun(createMainState({ stageIndex: 5, enemyPower: 1 })), true);

    assert.equal(isStopWatchRepeatStateValid({ weaponType: 5, weaponRepeats: 0 }), true);
    assert.equal(isStopWatchRepeatStateValid({ weaponType: 5, weaponRepeats: 1 }), false);
    assert.equal(isStopWatchRepeatStateValid({ weaponType: 5, weaponRepeats: 2 }), false);
    assert.equal(isStopWatchRepeatStateValid({ weaponType: 1, weaponRepeats: 2 }), true);

    assert.equal(isPotentialStickvaniaGameStateSnapshot(createPotentialSave(GAME_STATE_VERSION, "playing")), true);
    assert.equal(
        isPotentialStickvaniaGameStateSnapshot(createPotentialSave(GAME_STATE_VERSION, "paused")),
        false,
        "paused standalone saves must not offer Continue"
    );
    assert.equal(
        isPotentialStickvaniaGameStateSnapshot(createPotentialSave(GAME_STATE_VERSION, "playing", { timeFrozen: 455, time: 0 })),
        false,
        "zero-time stopwatch saves must not offer Continue"
    );
    assert.equal(
        isPotentialStickvaniaGameStateSnapshot(createPotentialSave(GAME_STATE_VERSION, "playing", { timeFrozen: 455, stageIndex: 5, enemyPower: 0 })),
        false,
        "Dracula-terminal stopwatch saves must not offer Continue"
    );
    assert.equal(
        isPotentialStickvaniaGameStateSnapshot(createPotentialSave(GAME_STATE_VERSION, "playing", { weaponType: 5, weaponRepeats: 1 })),
        false,
        "StopWatch Double state must not offer Continue"
    );
    assert.equal(
        isPotentialStickvaniaGameStateSnapshot(createPotentialSave(GAME_STATE_VERSION, "playing", { weaponType: 5, weaponRepeats: 0 })),
        true,
        "StopWatch Single state remains valid"
    );

    const tsHold = read("pwa/src/stickvania/StopWatchMusicHold.ts");
    const javaHold = read("desktop/src/stickvania/StopWatchMusicHold.java");
    const tsActionPolicy = read("pwa/src/stickvania/PlayerActionPolicy.ts");
    const javaActionPolicy = read("desktop/src/stickvania/PlayerActionPolicy.java");
    const tsInput = read("pwa/src/stickvania/StickvaniaInput.ts");
    const javaInput = read("desktop/src/stickvania/StickvaniaInput.java");
    const tsDracula = read("pwa/src/stickvania/Dracula.ts");
    const javaDracula = read("desktop/src/stickvania/Dracula.java");
    const tsSimon = read("pwa/src/stickvania/Simon.ts");
    const javaSimon = read("desktop/src/stickvania/Simon.java");
    const tsStopWatch = read("pwa/src/stickvania/StopWatch.ts");
    const javaStopWatch = read("desktop/src/stickvania/StopWatch.java");
    const tsDropItem = read("pwa/src/stickvania/DropItem.ts");
    const javaDropItem = read("desktop/src/stickvania/DropItem.java");
    const tsOrb = read("pwa/src/stickvania/Orb.ts");
    const javaOrb = read("desktop/src/stickvania/Orb.java");
    const tsDoor = read("pwa/src/stickvania/Door.ts");
    const javaDoor = read("desktop/src/stickvania/Door.java");
    const tsMain = read("pwa/src/stickvania/Main.ts");
    const javaMain = read("desktop/src/stickvania/Main.java");
    const tsStore = read("pwa/src/stickvania/persistence/StickvaniaGameStateStore.ts");
    const tsRepeatPolicy = read("pwa/src/stickvania/persistence/StopWatchRepeatStatePolicy.ts");
    const playerWeaponFiles = [
        ["pwa/src/stickvania/Axe.ts", "desktop/src/stickvania/Axe.java", "Axe"],
        ["pwa/src/stickvania/Boomerang.ts", "desktop/src/stickvania/Boomerang.java", "Boomerang"],
        ["pwa/src/stickvania/Dagger.ts", "desktop/src/stickvania/Dagger.java", "Dagger"],
        ["pwa/src/stickvania/HolyWater.ts", "desktop/src/stickvania/HolyWater.java", "HolyWater"]
    ];
    const allTypeScript = collectSourceTree(resolve(rootDir, "pwa", "src", "stickvania"), ".ts");
    const allJava = collectSourceTree(resolve(rootDir, "desktop", "src", "stickvania"), ".java");

    assert.doesNotMatch(tsHold, /pausedStandalone|requestStopWatchAwareGameplayMusic|currentMusic|isStopWatchActivationInputBlocked/);
    assert.doesNotMatch(
        javaHold,
        /pausedStandalone|pendingStandalone|requestGameplayMusic|findPlayingStandaloneMusic|Music\[\]|isStopWatchActivationInputBlocked/
    );
    assert.match(javaHold, /SoundStore\.get\(\)\.pauseLoop\(\)/);
    assert.match(javaHold, /SoundStore\.get\(\)\.restartLoop\(\)/);
    assert.match(tsHold, /canStartStopWatch[\s\S]*?canSimonActionContinue\(main\)[\s\S]*?canStopWatchRun\(main\)[\s\S]*?main\.timeFrozen == 0/);
    assert.match(
        javaHold,
        /canStartStopWatch[\s\S]*?PlayerActionPolicy\.canSimonActionContinue\(main\)[\s\S]*?canStopWatchRun\(main\)[\s\S]*?main\.timeFrozen == 0/
    );

    // The three-case attack contract: Up+Attack chooses the sub-weapon only when
    // it is currently eligible; otherwise the exact same input becomes a whip.
    assert.match(
        tsMain,
        /const wantsSubWeapon: boolean = keyDownAttack && keyDownUp;\s*let keyDownSubWeapon: boolean = wantsSubWeapon && this\.canUseSubWeapon\(\);\s*let keyDownWhip: boolean = keyDownAttack && \(!wantsSubWeapon \|\| !keyDownSubWeapon\);/
    );
    assert.match(
        javaMain,
        /boolean wantsSubWeapon = keyDownAttack && keyDownUp;\s*boolean keyDownSubWeapon = wantsSubWeapon && canUseSubWeapon\(\);\s*boolean keyDownWhip = keyDownAttack && \(!wantsSubWeapon \|\| !keyDownSubWeapon\);/
    );
    assert.match(tsMain, /whipIncrementor == 20[\s\S]*?if \(this\.simon!\.throwing\)[\s\S]*?this\.throwWeapon\(\)/);
    assert.match(javaMain, /whipIncrementor == 20[\s\S]*?if \(simon\.throwing\)[\s\S]*?throwWeapon\(\)/);
    assert.match(tsMain, /public throwWeapon\(\): void \{\s*if \(!this\.canUseSubWeapon\(\)\) \{\s*return;/);
    assert.match(javaMain, /public void throwWeapon\(\) \{\s*if \(!canUseSubWeapon\(\)\) \{\s*return;/);

    assert.match(tsActionPolicy, /let registeredMain: Main \| null = null/);
    assert.match(javaActionPolicy, /private static Main registeredMain/);
    assert.match(
        tsActionPolicy,
        /fadeState == FADE_DONE[\s\S]*?playerPower > 0[\s\S]*?!simon\.hurt[\s\S]*?simon\.flashing == 0[\s\S]*?STAIR_TOP_TRANSITION_Y[\s\S]*?!main\.beatStageFlag[\s\S]*?!main\.floorBreaking[\s\S]*?main\.time > 0[\s\S]*?main\.door === null[\s\S]*?stageIndex == 5 && main\.enemyPower == 0/
    );
    assert.match(
        javaActionPolicy,
        /fadeState == Main\.FADE_DONE[\s\S]*?playerPower > 0[\s\S]*?!simon\.hurt[\s\S]*?simon\.flashing == 0[\s\S]*?STAIR_TOP_TRANSITION_Y[\s\S]*?!main\.beatStage[\s\S]*?!main\.floorBreaking[\s\S]*?main\.time > 0[\s\S]*?main\.door == null[\s\S]*?stageIndex == 5 && main\.enemyPower == 0/
    );
    assert.match(tsActionPolicy, /canRegisteredSimonActionStart[\s\S]*?return registeredMain === null \|\| canSimonActionContinue\(registeredMain\)/);
    assert.match(javaActionPolicy, /canRegisteredSimonActionStart[\s\S]*?return registeredMain == null \|\| canSimonActionContinue\(registeredMain\)/);
    assert.match(
        tsActionPolicy,
        /if \(simon === null \|\| \(!simon\.whipping && !simon\.throwing\)\)[\s\S]*?return;[\s\S]*?whipping = false;[\s\S]*?throwing = false;[\s\S]*?releasedWhip = false;/
    );
    assert.match(
        javaActionPolicy,
        /if \(simon == null \|\| \(!simon\.whipping && !simon\.throwing\)\)[\s\S]*?return;[\s\S]*?whipping = false;[\s\S]*?throwing = false;[\s\S]*?releasedWhip = false;/
    );
    assert.match(tsActionPolicy, /reconcileRegisteredSimonActionBeforeAttackRead[\s\S]*?!canSimonActionContinue\(main\)[\s\S]*?cancelSimonAction\(main\)/);
    assert.match(javaActionPolicy, /reconcileRegisteredSimonActionBeforeAttackRead[\s\S]*?!canSimonActionContinue\(main\)[\s\S]*?cancelSimonAction\(main\)/);

    // Input reconciliation may cancel an already-running terminal action. Fresh
    // Attack is gated only by generic terminal/control-loss state; hearts,
    // capacity and timeFrozen remain Main.canUseSubWeapon concerns.
    assert.match(tsInput, /public update\(\): void[\s\S]*?readStateInto\(this\.current\);[\s\S]*?reconcileRegisteredSimonActionBeforeAttackRead\(\)/);
    assert.match(
        tsInput,
        /public isAttack\(\): boolean[\s\S]*?reconcileRegisteredSimonActionBeforeAttackRead\(\);[\s\S]*?return this\.current\.attack && canRegisteredSimonActionStart\(\);/
    );
    assert.doesNotMatch(tsInput, /stopWatchAttackReleaseRequired|isStopWatchActivationInputBlocked/);
    assert.match(
        javaInput,
        /public void update\(\)[\s\S]*?current = readState\(\);[\s\S]*?PlayerActionPolicy\.reconcileRegisteredSimonActionBeforeAttackRead\(\)/
    );
    assert.match(
        javaInput,
        /public boolean isAttack\(\)[\s\S]*?PlayerActionPolicy\.reconcileRegisteredSimonActionBeforeAttackRead\(\);[\s\S]*?return current\.attack && PlayerActionPolicy\.canRegisteredSimonActionStart\(\);/
    );
    assert.doesNotMatch(javaInput, /stopWatchAttackReleaseRequired|isStopWatchActivationInputBlocked/);

    assert.match(tsDracula, /this\.main\.requestMusic\(this\.main\.dracula_dead\)/);
    assert.doesNotMatch(tsDracula, /requestStopWatchAwareGameplayMusic/);
    assert.match(javaDracula, /main\.requestMusic\(main\.dracula_dead\)/);
    assert.doesNotMatch(javaDracula, /requestGameplayMusic/);

    assert.match(tsSimon, /constructor\(main: Main\)[\s\S]*?registerPlayerActionMain\(main\)/);
    assert.match(javaSimon, /public Simon\(Main main\)[\s\S]*?PlayerActionPolicy\.registerPlayerActionMain\(main\)/);
    assert.match(tsSimon, /\(this\.whipping \|\| this\.throwing\) && !canSimonActionContinue\(this\.main\)[\s\S]*?cancelSimonAction\(this\.main\)/);
    assert.match(
        javaSimon,
        /\(whipping \|\| throwing\)[\s\S]*?!PlayerActionPolicy\.canSimonActionContinue\(main\)[\s\S]*?PlayerActionPolicy\.cancelSimonAction\(main\)/
    );
    assert.match(tsSimon, /this\.throwing && this\.main\.weaponType == Main\.WEAPON_TYPE_STOP_WATCH && !canStopWatchRun\(this\.main\)/);
    assert.match(javaSimon, /throwing[\s\S]*?main\.weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?!StopWatchMusicHold\.canStopWatchRun\(main\)/);

    assert.match(tsOrb, /cancelSimonAction\(this\.main\);[\s\S]*?this\.main\.beatStage\(\)/);
    assert.match(javaOrb, /PlayerActionPolicy\.cancelSimonAction\(main\);[\s\S]*?main\.beatStage\(\)/);
    assert.match(tsDoor, /cancelSimonAction\(this\.main\);\s*this\.main\.enterNextRegion\(this\)/);
    assert.match(javaDoor, /PlayerActionPolicy\.cancelSimonAction\(main\);\s*main\.enterNextRegion\(this\)/);

    assert.match(tsStopWatch, /if \(!canStartStopWatch\(main\)\)[\s\S]*?this\.lifeTime = 0;[\s\S]*?main\.hearts \+= 5;[\s\S]*?cancelSimonAction\(main\)/);
    assert.match(tsStopWatch, /if \(!canStopWatchRun\(this\.main\)\)[\s\S]*?this\.cancel\(\);/);
    assert.match(tsStopWatch, /weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;/);
    assert.match(
        javaStopWatch,
        /if \(!StopWatchMusicHold\.canStartStopWatch\(main\)\)[\s\S]*?lifeTime = 0;[\s\S]*?main\.hearts \+= 5;[\s\S]*?PlayerActionPolicy\.cancelSimonAction\(main\)/
    );
    assert.match(javaStopWatch, /if \(!StopWatchMusicHold\.canStopWatchRun\(main\)\)[\s\S]*?cancel\(\);/);
    assert.match(javaStopWatch, /weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;/);

    for (const [tsPath, javaPath, className] of playerWeaponFiles) {
        const tsWeapon = read(tsPath);
        const javaWeapon = read(javaPath);
        assert.match(
            tsWeapon,
            /if \(!canSimonActionContinue\(main\)\)[\s\S]*?this\.kill = true;[\s\S]*?main\.camera - 10000[\s\S]*?this\.y = javaFloat\(10000\);[\s\S]*?main\.hearts \+= 1;[\s\S]*?cancelSimonAction\(main\);[\s\S]*?return;/,
            tsPath
        );
        assert.match(
            javaWeapon,
            /if \(!PlayerActionPolicy\.canSimonActionContinue\(main\)\)[\s\S]*?kill = true;[\s\S]*?main\.camera - 10000[\s\S]*?y = 10000;[\s\S]*?main\.hearts\+\+;[\s\S]*?PlayerActionPolicy\.cancelSimonAction\(main\);[\s\S]*?return;/,
            javaPath
        );
        assert.match(tsWeapon, /public override update[\s\S]*?if \(this\.kill\) \{\s*return false;/, tsPath);
        assert.match(javaWeapon, /public boolean update[\s\S]*?if \(kill\) \{\s*return false;/, javaPath);
        assert.equal(
            (allTypeScript.match(new RegExp(`new ${className}\\(`, "g")) ?? []).length,
            1,
            `TypeScript ${className} must keep one player construction path`
        );
        assert.equal((allJava.match(new RegExp(`new ${className}\\(`, "g")) ?? []).length, 1, `Java ${className} must keep one player construction path`);
    }

    assert.match(
        tsDropItem,
        /main\.weaponType == Main\.WEAPON_TYPE_STOP_WATCH && \(type == DropItem\.TYPE_DOUBLE \|\| type == DropItem\.TYPE_TRIPLE\)[\s\S]*?DropItem\.TYPE_LARGE_HEART/
    );
    assert.match(
        javaDropItem,
        /main\.weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?\(type == TYPE_DOUBLE \|\| type == TYPE_TRIPLE\)[\s\S]*?TYPE_LARGE_HEART/
    );
    assert.match(
        tsDropItem,
        /collectWeapon[\s\S]*?simon!\.throwing[\s\S]*?whipIncrementor < 20[\s\S]*?cancelSimonAction\(this\.main\)[\s\S]*?setWeapon\(weaponType\)/
    );
    assert.match(
        javaDropItem,
        /collectWeapon[\s\S]*?simon\.throwing[\s\S]*?whipIncrementor < 20[\s\S]*?PlayerActionPolicy\.cancelSimonAction\(main\)[\s\S]*?setWeapon\(weaponType\)/
    );
    assert.match(tsDropItem, /case DropItem\.TYPE_WHIP:[\s\S]*?cancelSimonAction\(this\.main\);[\s\S]*?this\.main\.advanceWhip\(\)/);
    assert.match(javaDropItem, /case TYPE_WHIP:[\s\S]*?PlayerActionPolicy\.cancelSimonAction\(main\);[\s\S]*?main\.advanceWhip\(\)/);
    assert.match(
        tsDropItem,
        /collectRepeatUpgrade[\s\S]*?WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;[\s\S]*?playSound\(this\.main\.got_double\)[\s\S]*?return;/
    );
    assert.match(
        javaDropItem,
        /collectRepeatUpgrade[\s\S]*?WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;[\s\S]*?playSound\(main\.got_double\)[\s\S]*?return;/
    );
    assert.match(tsDropItem, /if \(weaponRepeats < this\.main\.weaponRepeats\)[\s\S]*?playSound\(this\.main\.got_double\)[\s\S]*?return;/);
    assert.match(javaDropItem, /if \(weaponRepeats < main\.weaponRepeats\)[\s\S]*?playSound\(main\.got_double\)[\s\S]*?return;/);

    assert.equal((allTypeScript.match(/\.setWeaponRepeats\(/g) ?? []).length, 1, "TypeScript repeat mutation must stay centralized through DropItem");
    assert.equal((allJava.match(/\.setWeaponRepeats\(/g) ?? []).length, 1, "Java repeat mutation must stay centralized through DropItem");
    assert.equal((allTypeScript.match(/new StopWatch\(/g) ?? []).length, 1, "TypeScript must keep one normal StopWatch construction path");
    assert.equal((allJava.match(/new StopWatch\(/g) ?? []).length, 1, "Java must keep one normal StopWatch construction path");
    assert.equal((allTypeScript.match(/\.beatStage\(\)/g) ?? []).length, 1, "TypeScript stage completion must remain routed through Orb");
    assert.equal((allJava.match(/\.beatStage\(\)/g) ?? []).length, 1, "Java stage completion must remain routed through Orb");
    const tsDoorTransitionCount = (tsDoor.match(/\.enterNextRegion\(/g) ?? []).length;
    const javaDoorTransitionCount = (javaDoor.match(/\.enterNextRegion\(/g) ?? []).length;

    assert.equal(tsDoorTransitionCount, 2, "TypeScript Door must retain both directional transition paths");
    assert.equal(javaDoorTransitionCount, 2, "Java Door must retain both directional transition paths");
    assert.equal(
        (allTypeScript.match(/\.enterNextRegion\(/g) ?? []).length,
        tsDoorTransitionCount,
        "TypeScript door transitions must remain routed exclusively through Door"
    );
    assert.equal(
        (allJava.match(/\.enterNextRegion\(/g) ?? []).length,
        javaDoorTransitionCount,
        "Java door transitions must remain routed exclusively through Door"
    );

    assert.match(tsMain, /this\.pushWeapon\(new StopWatch\(this\)\);\s*this\.removeHearts\(5\);/);
    assert.match(javaMain, /pushWeapon\(new StopWatch\(this\)\);\s*removeHearts\(5\);/);
    for (const className of ["Axe", "Boomerang", "Dagger", "HolyWater"]) {
        assert.match(tsMain, new RegExp(`this\\.pushWeapon\\(new ${className}\\([\\s\\S]*?this\\.removeHearts\\(1\\);`));
        assert.match(javaMain, new RegExp(`pushWeapon\\(new ${className}\\([\\s\\S]*?removeHearts\\(1\\);`));
    }
    assert.match(tsMain, /if \(this\.weaponType != weaponType\)[\s\S]*?this\.weaponRepeats = Main\.WEAPON_TYPE_NONE;/);
    assert.match(javaMain, /if \(this\.weaponType != weaponType\)[\s\S]*?this\.weaponRepeats = WEAPON_TYPE_NONE;/);
    assert.match(tsMain, /WEAPON_TYPE_STOP_WATCH: number = 5;/);
    assert.match(tsMain, /WEAPON_REPEATS_SINGLE: number = 0;/);
    assert.match(javaMain, /WEAPON_TYPE_STOP_WATCH = 5;/);
    assert.match(javaMain, /WEAPON_REPEATS_SINGLE = 0;/);

    assert.match(tsRepeatPolicy, /WEAPON_TYPE_STOP_WATCH = 5;/);
    assert.match(tsRepeatPolicy, /WEAPON_REPEATS_SINGLE = 0;/);
    assert.equal((tsStore.match(/isStopWatchRepeatStateValid\(/g) ?? []).length, 2);
    assert.match(tsStore, /restoreSnapshot\(main, gc, snapshot\);[\s\S]*?registerPlayerActionMain\(main\);/);

    console.log("Stickvania delayed-action/stopwatch/repeat hardening checks passed.");
} finally {
    await server.close();
}

function createMainState(overrides = {}) {
    return {
        mode: 4,
        fadeState: 0,
        playerPower: 16,
        simon: { dead: 0, hurt: false, flashing: 0, y: 100, onStairs: false },
        beatStageFlag: false,
        floorBreaking: false,
        time: 300,
        stageIndex: 0,
        enemyPower: 16,
        timeFrozen: 0,
        door: null,
        stoppedWeaponThrowRumble: 0,
        stopRumble(effect) {
            if (effect === "weaponThrow") {
                this.stoppedWeaponThrowRumble++;
            }
        },
        ...overrides
    };
}

function createPotentialSave(version, transport, mainFieldOverrides = {}) {
    const mainFields = { mode: 4, ...mainFieldOverrides };
    return {
        version,
        mode: 4,
        things: [],
        stage: { stageIndex: mainFields.stageIndex ?? 0, segments: [] },
        mainFields,
        inputConfigMode: null,
        random: {},
        audio: {
            musicOn: true,
            soundOn: true,
            songs: [],
            currentMusic: { playback: { transport } }
        }
    };
}

function collectSourceTree(directory, extension) {
    let text = "";
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            text += collectSourceTree(path, extension);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
            text += `\n${readFileSync(path, "utf8")}`;
        }
    }
    return text;
}

function read(path) {
    return readFileSync(resolve(rootDir, path), "utf8");
}
