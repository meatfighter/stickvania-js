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

try {
    const { DropItem } = await server.ssrLoadModule("/src/stickvania/DropItem.ts");
    const { StickvaniaInput } = await server.ssrLoadModule("/src/stickvania/StickvaniaInput.ts");
    const { isStopWatchActivationInputBlocked, reconcileStopWatchMusic, resetStopWatchMusicHold } = await server.ssrLoadModule(
        "/src/stickvania/StopWatchMusicHold.ts"
    );

    const stopwatchMain = createRepeatMain(5, 0);
    assert.equal(new DropItem(stopwatchMain, 0, 0, DropItem.TYPE_DOUBLE).type, DropItem.TYPE_LARGE_HEART);
    assert.equal(new DropItem(stopwatchMain, 0, 0, DropItem.TYPE_TRIPLE).type, DropItem.TYPE_LARGE_HEART);

    const axeMain = createRepeatMain(1, 0);
    assert.equal(new DropItem(axeMain, 0, 0, DropItem.TYPE_DOUBLE).type, DropItem.TYPE_DOUBLE);
    assert.equal(new DropItem(axeMain, 0, 0, DropItem.TYPE_TRIPLE).type, DropItem.TYPE_TRIPLE);

    const fakeCollectionMain = createRepeatMain(1, 0);
    const preexistingDouble = new DropItem(fakeCollectionMain, 0, 0, DropItem.TYPE_DOUBLE);
    fakeCollectionMain.weaponType = 5;
    fakeCollectionMain.weaponRepeats = 2;
    fakeCollectionMain.repeatsFlashing = 45;
    preexistingDouble.collectRepeatUpgrade(1);
    assert.equal(fakeCollectionMain.weaponRepeats, 0);
    assert.equal(fakeCollectionMain.repeatsFlashing, 0);
    assert.equal(fakeCollectionMain.soundCount, 1);
    assert.equal(fakeCollectionMain.setRepeatCount, 0);

    const staleDoubleMain = createRepeatMain(1, 2);
    const staleDouble = new DropItem(staleDoubleMain, 0, 0, DropItem.TYPE_DOUBLE);
    staleDouble.collectRepeatUpgrade(1);
    assert.equal(staleDoubleMain.weaponRepeats, 2, "a stale Double must not downgrade Triple");
    assert.equal(staleDoubleMain.soundCount, 1);
    assert.equal(staleDoubleMain.setRepeatCount, 0);

    const normalUpgradeMain = createRepeatMain(1, 1);
    const triple = new DropItem(normalUpgradeMain, 0, 0, DropItem.TYPE_TRIPLE);
    triple.collectRepeatUpgrade(2);
    assert.equal(normalUpgradeMain.weaponRepeats, 2);
    assert.equal(normalUpgradeMain.repeatsFlashing, 45);
    assert.equal(normalUpgradeMain.setRepeatCount, 1);

    resetStopWatchMusicHold();
    const holdMain = createHoldMain();
    reconcileStopWatchMusic(holdMain);
    assert.equal(isStopWatchActivationInputBlocked(), true);

    const input = Object.create(StickvaniaInput.prototype);
    input.current = { attack: true, up: true };
    input.stopWatchAttackReleaseRequired = false;
    assert.equal(input.isAttack(), false, "Up+Attack must be suppressed while the current StopWatch is active");

    holdMain.timeFrozen = 0;
    reconcileStopWatchMusic(holdMain);
    assert.equal(isStopWatchActivationInputBlocked(), false);
    assert.equal(input.isAttack(), false, "holding Attack through expiry must not auto-chain another StopWatch");

    input.current = { attack: false, up: true };
    assert.equal(input.isAttack(), false);
    input.current = { attack: true, up: true };
    assert.equal(input.isAttack(), true, "a fresh Attack press after release may activate StopWatch again");

    resetStopWatchMusicHold();
    holdMain.timeFrozen = 455;
    holdMain.weaponType = 5;
    reconcileStopWatchMusic(holdMain);
    holdMain.weaponType = 1;
    assert.equal(isStopWatchActivationInputBlocked(), false, "an active watch must not block another equipped weapon's Up+Attack");
    input.current = { attack: true, up: true };
    input.stopWatchAttackReleaseRequired = false;
    assert.equal(input.isAttack(), true, "another equipped weapon keeps its normal Up+Attack input while a watch runs");

    console.log("Stickvania stopwatch repeat runtime checks passed.");
} finally {
    await server.close();
}

function createRepeatMain(weaponType, weaponRepeats) {
    return {
        weaponType,
        weaponRepeats,
        repeatsFlashing: 0,
        got_double: {},
        soundCount: 0,
        setRepeatCount: 0,
        playSound() {
            this.soundCount++;
        },
        setWeaponRepeats(value) {
            this.setRepeatCount++;
            this.soundCount++;
            this.weaponRepeats = value;
            this.repeatsFlashing = 45;
        }
    };
}

function createHoldMain() {
    return {
        mode: 4,
        playerPower: 16,
        simon: { dead: 0 },
        beatStageFlag: false,
        floorBreaking: false,
        time: 300,
        stageIndex: 0,
        enemyPower: 16,
        timeFrozen: 455,
        weaponType: 5,
        currentSong: null,
        requestedSong: null
    };
}
