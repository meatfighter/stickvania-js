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

try {
    const { DropItem } = await server.ssrLoadModule("/src/stickvania/DropItem.ts");
    const { Axe } = await server.ssrLoadModule("/src/stickvania/Axe.ts");
    const { Boomerang } = await server.ssrLoadModule("/src/stickvania/Boomerang.ts");
    const { Dagger } = await server.ssrLoadModule("/src/stickvania/Dagger.ts");
    const { HolyWater } = await server.ssrLoadModule("/src/stickvania/HolyWater.ts");
    const { StopWatch } = await server.ssrLoadModule("/src/stickvania/StopWatch.ts");
    const {
        canRegisteredSimonActionStart,
        canSimonActionContinue,
        cancelSimonAction,
        registerPlayerActionMain,
        reconcileRegisteredSimonActionBeforeAttackRead
    } = await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");

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

    const live = createActionMain();
    assert.equal(canSimonActionContinue(live), true);
    for (const invalid of [
        { fadeState: 1 },
        { playerPower: 0 },
        { time: 0 },
        { beatStageFlag: true },
        { floorBreaking: true },
        { door: {} },
        { stageIndex: 5, enemyPower: 0 },
        { simon: createSimon({ hurt: true }) },
        { simon: createSimon({ flashing: 1 }) },
        { simon: createSimon({ y: 417 }) },
        { simon: createSimon({ onStairs: true, y: -62 }) },
        { simon: createSimon({ onStairs: true, y: 285 }) }
    ]) {
        assert.equal(canSimonActionContinue(createActionMain(invalid)), false);
    }

    // Generic Attack gating deliberately ignores hearts, weapon capacity, weapon
    // type, and timeFrozen. An active StopWatch therefore still lets Main apply
    // scenario 3 and turn unavailable Up+Attack into a normal whip.
    const liveStopWatchInput = createActionMain({ timeFrozen: 455, weaponType: 5, hearts: 0, weaponRepeats: 0 });
    registerPlayerActionMain(liveStopWatchInput);
    assert.equal(canRegisteredSimonActionStart(), true);
    liveStopWatchInput.time = 0;
    assert.equal(canRegisteredSimonActionStart(), false, "terminal time state must block a fresh Attack entirely");

    const cancelMain = createActionMain({
        simon: createSimon({ whipping: true, throwing: true, whipIncrementor: 19, whipIndex: 1, releasedWhip: true })
    });
    cancelSimonAction(cancelMain);
    assert.equal(cancelMain.simon.whipping, false);
    assert.equal(cancelMain.simon.throwing, false);
    assert.equal(cancelMain.simon.whipIncrementor, 0);
    assert.equal(cancelMain.simon.whipIndex, 0);
    assert.equal(cancelMain.simon.releasedWhip, false);
    assert.equal(cancelMain.stoppedRumbleCount, 1);

    const idleCancelMain = createActionMain({ simon: createSimon({ releasedWhip: true }) });
    cancelSimonAction(idleCancelMain);
    assert.equal(idleCancelMain.simon.releasedWhip, true);
    assert.equal(idleCancelMain.stoppedRumbleCount, 0);

    // Frame-start/pre-Attack reconciliation covers paths where Main returns
    // before Simon.update(), including pit/death/hurt, stairs, and active fades.
    const registeredStairTimeout = createActionMain({
        time: 0,
        simon: createSimon({ onStairs: true, whipping: true, throwing: false, whipIncrementor: 19, whipIndex: 1, releasedWhip: false })
    });
    registerPlayerActionMain(registeredStairTimeout);
    reconcileRegisteredSimonActionBeforeAttackRead();
    assert.equal(registeredStairTimeout.simon.whipping, false);
    assert.equal(registeredStairTimeout.simon.whipIncrementor, 0);
    assert.equal(registeredStairTimeout.simon.releasedWhip, false);

    const registeredStairTransition = createActionMain({
        simon: createSimon({ onStairs: true, y: -62, whipping: true, throwing: true, whipIncrementor: 19, releasedWhip: false })
    });
    registerPlayerActionMain(registeredStairTransition);
    reconcileRegisteredSimonActionBeforeAttackRead();
    assert.equal(registeredStairTransition.simon.whipping, false);
    assert.equal(registeredStairTransition.simon.throwing, false);

    const registeredPitThrow = createActionMain({
        simon: createSimon({ y: 417, whipping: true, throwing: true, whipIncrementor: 12, releasedWhip: false })
    });
    registerPlayerActionMain(registeredPitThrow);
    reconcileRegisteredSimonActionBeforeAttackRead();
    assert.equal(registeredPitThrow.simon.whipping, false);
    assert.equal(registeredPitThrow.simon.throwing, false);

    const registeredFadeThrow = createActionMain({
        fadeState: 1,
        simon: createSimon({ whipping: true, throwing: true, whipIncrementor: 12, releasedWhip: false })
    });
    registerPlayerActionMain(registeredFadeThrow);
    reconcileRegisteredSimonActionBeforeAttackRead();
    assert.equal(registeredFadeThrow.simon.whipping, false);
    assert.equal(registeredFadeThrow.simon.throwing, false);

    const registeredIdleTerminal = createActionMain({ time: 0, simon: createSimon({ releasedWhip: true }) });
    registerPlayerActionMain(registeredIdleTerminal);
    reconcileRegisteredSimonActionBeforeAttackRead();
    assert.equal(registeredIdleTerminal.simon.releasedWhip, true, "reconciliation must not alter the latch when no action is active");
    assert.equal(canRegisteredSimonActionStart(), false);

    // Exact timeout/invincibility-style frame-20 race: the ordinary Main heart
    // debit still follows construction, so rejected constructors pre-refund one
    // heart, move offscreen immediately, stay inert, cancel the windup, and emit
    // no constructor sound.
    for (const [Weapon, args] of [
        [Axe, [0, 0, 1]],
        [Boomerang, [0, 0, 1]],
        [Dagger, [0, 0, 1]],
        [HolyWater, [0, 0, 1]]
    ]) {
        const main = createActionMain({
            time: 0,
            hearts: 7,
            simon: createSimon({ whipping: true, throwing: true, whipIncrementor: 20, whipIndex: 2, releasedWhip: false })
        });
        const weapon = new Weapon(main, ...args);
        assert.equal(weapon.kill, true, `${Weapon.name} must reject terminal-state materialization`);
        assert.ok(weapon.x < main.camera - 96 || weapon.y > 352, `${Weapon.name} rejected object must be non-colliding before the weapon pass`);
        assert.equal(main.hearts, 8, `${Weapon.name} must pre-refund the imminent one-heart debit`);
        main.hearts--;
        assert.equal(main.hearts, 7, `${Weapon.name} rejection must be heart-neutral after Main's debit`);
        assert.equal(main.simon.whipping, false, `${Weapon.name} rejection must cancel the queued animation`);
        assert.equal(main.simon.throwing, false, `${Weapon.name} rejection must cancel the queued throw`);
        assert.equal(weapon.update(null), false, `${Weapon.name} rejected object must self-remove before gameplay`);
        assert.equal(main.soundCount, 0, `${Weapon.name} rejected construction must not emit sound`);
    }

    const validDaggerMain = createActionMain({ hearts: 7 });
    const validDagger = new Dagger(validDaggerMain, 0, 0, 1);
    assert.equal(validDagger.kill, false);
    assert.equal(validDaggerMain.hearts, 7);
    assert.equal(validDaggerMain.soundCount, 1);

    // Corrupt/debug repeat state can reach a second StopWatch constructor even
    // though normal Single capacity cannot. The constructor is the final barrier.
    const secondWatchMain = createActionMain({
        hearts: 12,
        timeFrozen: 455,
        weaponType: 5,
        simon: createSimon({ whipping: true, throwing: true, whipIncrementor: 20, whipIndex: 2, releasedWhip: false })
    });
    const rejectedWatch = new StopWatch(secondWatchMain);
    assert.equal(rejectedWatch.lifeTime, 0);
    assert.equal(secondWatchMain.hearts, 17);
    secondWatchMain.hearts -= 5;
    assert.equal(secondWatchMain.hearts, 12);
    assert.equal(secondWatchMain.simon.whipping, false);
    assert.equal(secondWatchMain.simon.throwing, false);

    // A different weapon collected before frame 20 cancels the queued throw so
    // it cannot morph into the newly equipped weapon.
    const switchMain = createRepeatMain(3, 0);
    switchMain.simon = createSimon({ whipping: true, throwing: true, whipIncrementor: 12, releasedWhip: false });
    switchMain.stopRumble = () => {};
    const axePickup = new DropItem(switchMain, 0, 0, DropItem.TYPE_AXE);
    axePickup.collectWeapon(1);
    assert.equal(switchMain.weaponType, 1);
    assert.equal(switchMain.simon.whipping, false);
    assert.equal(switchMain.simon.throwing, false);

    const sameWeaponMain = createRepeatMain(3, 0);
    sameWeaponMain.simon = createSimon({ whipping: true, throwing: true, whipIncrementor: 12, releasedWhip: false });
    sameWeaponMain.stopRumble = () => {};
    const daggerPickup = new DropItem(sameWeaponMain, 0, 0, DropItem.TYPE_DAGGER);
    daggerPickup.collectWeapon(3);
    assert.equal(sameWeaponMain.simon.whipping, true, "collecting the same equipped weapon must not cancel the queued throw");
    assert.equal(sameWeaponMain.simon.throwing, true);

    // Thing restoration can bypass Simon's constructor, so Continue must
    // re-register the live Main before resumed input processing.
    const storeSource = readFileSync(resolve(rootDir, "pwa/src/stickvania/persistence/StickvaniaGameStateStore.ts"), "utf8");
    assert.match(storeSource, /restoreSnapshot\(main, gc, snapshot\);[\s\S]*?registerPlayerActionMain\(main\);/);

    console.log("Stickvania stopwatch repeat/delayed-action runtime checks passed.");
} finally {
    await server.close();
}

function createSimon(overrides = {}) {
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

function createActionMain(overrides = {}) {
    return {
        mode: 4,
        fadeState: 0,
        playerPower: 16,
        simon: createSimon(),
        beatStageFlag: false,
        floorBreaking: false,
        time: 300,
        stageIndex: 0,
        enemyPower: 16,
        timeFrozen: 0,
        door: null,
        weaponType: 1,
        weaponRepeats: 0,
        repeatsFlashing: 0,
        camera: 0,
        hearts: 5,
        soundCount: 0,
        stoppedRumbleCount: 0,
        currentSong: null,
        requestedSong: null,
        boss_1: null,
        boss_2: null,
        ending: null,
        stage_1_1: null,
        stage_1_2: null,
        stage_2_1: null,
        stage_3_1: null,
        stage_4_1: null,
        stage_4_2: null,
        stage_5_1: null,
        stage_6_1: null,
        stage_6_2: null,
        playSound() {
            this.soundCount++;
        },
        stopRumble(effect) {
            if (effect === "weaponThrow") {
                this.stoppedRumbleCount++;
            }
        },
        ...overrides
    };
}

function createRepeatMain(weaponType, weaponRepeats) {
    return {
        weaponType,
        weaponRepeats,
        repeatsFlashing: 0,
        got_double: {},
        soundCount: 0,
        setRepeatCount: 0,
        simon: createSimon(),
        playSound() {
            this.soundCount++;
        },
        setWeaponRepeats(value) {
            this.setRepeatCount++;
            this.soundCount++;
            this.weaponRepeats = value;
            this.repeatsFlashing = 45;
        },
        setWeapon(value) {
            if (this.weaponType !== value) {
                this.weaponType = value;
                this.weaponRepeats = 0;
            }
        }
    };
}
