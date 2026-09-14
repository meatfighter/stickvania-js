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
    const { isPotentialStickvaniaGameStateSnapshot } = await server.ssrLoadModule("/src/stickvania/persistence/GameStatePreflight.ts");
    const { GAME_STATE_VERSION } = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSchema.ts");
    const { isStopWatchRepeatStateValid } = await server.ssrLoadModule("/src/stickvania/persistence/StopWatchRepeatStatePolicy.ts");

    const live = createMainState();
    assert.equal(canStopWatchRun(live), true);
    assert.equal(canStartStopWatch(live), true);
    assert.equal(
        canStopWatchRun(createMainState({ timeFrozen: 455 })),
        true,
        "an existing valid stopwatch may continue while it owns time"
    );
    assert.equal(canStartStopWatch(createMainState({ timeFrozen: 455 })), false, "a second stopwatch may not start while time is already frozen");
    assert.equal(canStopWatchRun(createMainState({ mode: 1 })), true, "demo recordings retain stopwatch simulation behavior");
    assert.equal(canStopWatchRun(createMainState({ mode: 8 })), true, "credits recordings retain stopwatch simulation behavior");
    assert.equal(canStopWatchRun(createMainState({ mode: 0 })), false);
    assert.equal(canStopWatchRun(createMainState({ playerPower: 0 })), false);
    assert.equal(canStopWatchRun(createMainState({ simon: null })), false);
    assert.equal(canStopWatchRun(createMainState({ simon: { dead: 1 } })), false);
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
    const tsDracula = read("pwa/src/stickvania/Dracula.ts");
    const javaDracula = read("desktop/src/stickvania/Dracula.java");
    const tsSimon = read("pwa/src/stickvania/Simon.ts");
    const javaSimon = read("desktop/src/stickvania/Simon.java");
    const tsStopWatch = read("pwa/src/stickvania/StopWatch.ts");
    const javaStopWatch = read("desktop/src/stickvania/StopWatch.java");
    const tsDropItem = read("pwa/src/stickvania/DropItem.ts");
    const javaDropItem = read("desktop/src/stickvania/DropItem.java");
    const tsMain = read("pwa/src/stickvania/Main.ts");
    const javaMain = read("desktop/src/stickvania/Main.java");
    const tsStore = read("pwa/src/stickvania/persistence/StickvaniaGameStateStore.ts");
    const tsRepeatPolicy = read("pwa/src/stickvania/persistence/StopWatchRepeatStatePolicy.ts");
    const allTypeScript = collectSourceTree(resolve(rootDir, "pwa", "src", "stickvania"), ".ts");
    const allJava = collectSourceTree(resolve(rootDir, "desktop", "src", "stickvania"), ".java");

    assert.doesNotMatch(tsHold, /pausedStandalone|requestStopWatchAwareGameplayMusic|currentMusic/);
    assert.doesNotMatch(javaHold, /pausedStandalone|pendingStandalone|requestGameplayMusic|findPlayingStandaloneMusic|Music\[\]/);
    assert.match(javaHold, /SoundStore\.get\(\)\.pauseLoop\(\)/);
    assert.match(javaHold, /SoundStore\.get\(\)\.restartLoop\(\)/);
    assert.match(tsHold, /canStartStopWatch[\s\S]*?canStopWatchRun\(main\) && main\.timeFrozen == 0/);
    assert.match(javaHold, /canStartStopWatch[\s\S]*?canStopWatchRun\(main\) && main\.timeFrozen == 0/);

    assert.match(tsDracula, /this\.main\.requestMusic\(this\.main\.dracula_dead\)/);
    assert.doesNotMatch(tsDracula, /requestStopWatchAwareGameplayMusic/);
    assert.match(javaDracula, /main\.requestMusic\(main\.dracula_dead\)/);
    assert.doesNotMatch(javaDracula, /requestGameplayMusic/);

    assert.match(tsSimon, /this\.throwing\s*&&\s*this\.main\.weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?!canStopWatchRun\(this\.main\)/);
    assert.match(tsSimon, /this\.throwing = false;\s*this\.whipping = false;\s*this\.whipIncrementor = 0;\s*this\.whipIndex = 0;/);
    assert.match(javaSimon, /throwing\s*&&\s*main\.weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?!StopWatchMusicHold\.canStopWatchRun\(main\)/);
    assert.match(javaSimon, /throwing = false;\s*whipping = false;\s*whipIncrementor = 0;\s*whipIndex = 0;/);

    assert.match(tsStopWatch, /if \(!canStartStopWatch\(main\)\)[\s\S]*?this\.lifeTime = 0;[\s\S]*?main\.hearts \+= 5;/);
    assert.match(tsStopWatch, /if \(!canStopWatchRun\(this\.main\)\)[\s\S]*?this\.cancel\(\);/);
    assert.match(
        tsStopWatch,
        /weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;/
    );
    assert.match(javaStopWatch, /if \(!StopWatchMusicHold\.canStartStopWatch\(main\)\)[\s\S]*?lifeTime = 0;[\s\S]*?main\.hearts \+= 5;/);
    assert.match(javaStopWatch, /if \(!StopWatchMusicHold\.canStopWatchRun\(main\)\)[\s\S]*?cancel\(\);/);
    assert.match(
        javaStopWatch,
        /weaponType == Main\.WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;/
    );

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
        /collectRepeatUpgrade[\s\S]*?WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;[\s\S]*?playSound\(this\.main\.got_double\)[\s\S]*?return;/
    );
    assert.match(
        javaDropItem,
        /collectRepeatUpgrade[\s\S]*?WEAPON_TYPE_STOP_WATCH[\s\S]*?weaponRepeats = Main\.WEAPON_REPEATS_SINGLE;[\s\S]*?repeatsFlashing = 0;[\s\S]*?playSound\(main\.got_double\)[\s\S]*?return;/
    );

    assert.equal((allTypeScript.match(/\.setWeaponRepeats\(/g) ?? []).length, 1, "TypeScript repeat mutation must stay centralized through DropItem");
    assert.equal((allJava.match(/\.setWeaponRepeats\(/g) ?? []).length, 1, "Java repeat mutation must stay centralized through DropItem");
    assert.equal((allTypeScript.match(/new StopWatch\(/g) ?? []).length, 1, "TypeScript must keep one normal StopWatch construction path");
    assert.equal((allJava.match(/new StopWatch\(/g) ?? []).length, 1, "Java must keep one normal StopWatch construction path");

    assert.match(tsMain, /this\.pushWeapon\(new StopWatch\(this\)\);\s*this\.removeHearts\(5\);/);
    assert.match(javaMain, /pushWeapon\(new StopWatch\(this\)\);\s*removeHearts\(5\);/);
    assert.match(tsMain, /if \(this\.weaponType != weaponType\)[\s\S]*?this\.weaponRepeats = Main\.WEAPON_TYPE_NONE;/);
    assert.match(javaMain, /if \(this\.weaponType != weaponType\)[\s\S]*?this\.weaponRepeats = WEAPON_TYPE_NONE;/);
    assert.match(tsMain, /WEAPON_TYPE_STOP_WATCH: number = 5;/);
    assert.match(tsMain, /WEAPON_REPEATS_SINGLE: number = 0;/);
    assert.match(javaMain, /WEAPON_TYPE_STOP_WATCH = 5;/);
    assert.match(javaMain, /WEAPON_REPEATS_SINGLE = 0;/);

    assert.match(tsRepeatPolicy, /WEAPON_TYPE_STOP_WATCH = 5;/);
    assert.match(tsRepeatPolicy, /WEAPON_REPEATS_SINGLE = 0;/);
    assert.equal((tsStore.match(/isStopWatchRepeatStateValid\(/g) ?? []).length, 2);

    console.log("Stickvania stopwatch cinematic/audio/timeout/repeat hardening checks passed.");
} finally {
    await server.close();
}

function createMainState(overrides = {}) {
    return {
        mode: 4,
        playerPower: 16,
        simon: { dead: 0 },
        beatStageFlag: false,
        floorBreaking: false,
        time: 300,
        stageIndex: 0,
        enemyPower: 16,
        timeFrozen: 0,
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
