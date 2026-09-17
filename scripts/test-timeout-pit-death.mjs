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

function createSound() {
    return {
        playCount: 0,
        play() {
            this.playCount++;
        }
    };
}

function createMusic() {
    return {
        playCount: 0,
        stopCount: 0,
        play() {
            this.playCount++;
        },
        stop() {
            this.stopCount++;
        }
    };
}

function createSong() {
    return {
        playCount: 0,
        stopCount: 0,
        update() {},
        play() {
            this.playCount++;
        },
        stop() {
            this.stopCount++;
        }
    };
}

function createMain(Main, Simon, overrides = {}) {
    const main = Object.create(Main.prototype);
    const hurtSound = createSound();
    const pitSound = createSound();
    const deathMusic = createMusic();
    Object.assign(main, {
        mode: Main.MODE_PLAYING,
        fadeState: Main.FADE_DONE,
        fade: 0,
        beatStageFlag: false,
        floorBreaking: false,
        playerPower: 16,
        enemyPower: 16,
        difficulty: Main.DIFFICULTY_NORMAL,
        time: 1,
        timeIncrementor: 90,
        timeFrozen: 0,
        door: null,
        camera: 0,
        hearts: 0,
        weaponsStack: { top: -1, things: [] },
        simon_hurt: hurtSound,
        simon_in_pit: pitSound,
        simon_killed: deathMusic,
        currentSong: null,
        requestedSong: null,
        currentMusic: null,
        alpha: 1,
        rumbles: [],
        syncSimonPhysicsProfile() {},
        adjustSimonDamage(power) {
            return power;
        },
        playSound(sound) {
            sound.play();
        },
        playRumble(effect) {
            this.rumbles.push(effect);
        },
        stopRumble() {},
        setSimonAlpha(alpha) {
            this.alpha = alpha;
        },
        getWall() {
            return Main.WALL_EMPTY;
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
        ...overrides
    });

    const simon = new Simon(main);
    Object.assign(simon, {
        x: 100,
        y: 100,
        lastX: 100,
        lastY: 100,
        xMin: 0,
        xMax: 1000,
        direction: Main.RIGHT,
        jumpVelocity: -5.25,
        vx: 0,
        vy: 0,
        supported: false,
        hurt: false,
        invincible: 0,
        drankPotion: false,
        onStairs: false,
        dead: 0,
        whipping: false,
        throwing: false,
        flashing: 0
    });
    main.simon = simon;
    main.hurtSound = hurtSound;
    main.pitSound = pitSound;
    main.deathMusic = deathMusic;
    return main;
}

function countdownRollover(main) {
    if (main.timeFrozen == 0 && ++main.timeIncrementor == 91 && main.playerPower > 0 && !main.floorBreaking) {
        main.timeIncrementor = 0;
        main.time--;
        if (main.time <= 0) {
            main.time = 0;
            main.hurtSimon(16);
        }
    }
}

function modelLegacyMainPitBranch(main) {
    if (main.simon.y > 416 && !main.floorBreaking) {
        if (main.playerPower > 0) {
            main.playSound(main.simon_in_pit);
            main.requestMusic(main.simon_killed);
        }
        main.playerPower = 0;
        main.simon.dead++;
    }
}

try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { Simon } = await server.ssrLoadModule("/src/stickvania/Simon.ts");
    const { prepareRegisteredCountdownTimer, prepareRegisteredPitDeathPresentation, registerPlayerActionMain } =
        await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");

    // Ordinary enemy damage still respects temporary invincibility. Timeout is
    // special only because countdown preflight removes protection on the exact
    // 1 -> 0 rollover.
    {
        const main = createMain(Main, Simon, { time: 20, timeIncrementor: 0, playerPower: 12 });
        main.simon.invincible = 100;
        main.hurtSimon(2);
        assert.equal(main.playerPower, 12);
        assert.equal(main.hurtSound.playCount, 0);
    }

    // Potion/post-hit invincibility cannot extend life beyond TIME 0. Preflight
    // normalizes protection, then the historical lethal hurt path supplies the
    // familiar grounded knockback and hurt sound exactly once.
    {
        const main = createMain(Main, Simon);
        main.simon.invincible = 728;
        main.simon.drankPotion = true;
        main.simon.supported = true;
        registerPlayerActionMain(main);
        prepareRegisteredCountdownTimer();
        assert.equal(main.simon.invincible, 0);
        assert.equal(main.simon.drankPotion, false);
        assert.equal(main.alpha, 1);
        countdownRollover(main);
        assert.equal(main.time, 0);
        assert.equal(main.playerPower, 0);
        assert.equal(main.simon.hurt, true);
        assert.equal(main.simon.vy, main.simon.jumpVelocity);
        assert.equal(main.simon.vx, -2);
        assert.equal(main.hurtSound.playCount, 1);
        assert.deepEqual(main.rumbles, ["playerDeath"]);
    }

    // Timeout while already hurt must make the existing trajectory lethal without
    // replaying hurt SFX or replacing vx/vy.
    {
        const main = createMain(Main, Simon, { playerPower: 7 });
        main.simon.hurt = true;
        main.simon.vx = 1.25;
        main.simon.vy = -3.5;
        main.simon.applyGravityWithPlatforms = () => {};
        registerPlayerActionMain(main);
        prepareRegisteredCountdownTimer();
        countdownRollover(main);
        assert.equal(main.time, 0);
        assert.equal(main.playerPower, 7, "ordinary hurt gate should still reject the direct timeout hit");
        main.simon.update(null);
        assert.equal(main.playerPower, 0);
        assert.equal(main.simon.hurt, true);
        assert.equal(main.simon.vx, 1.25);
        assert.equal(main.simon.vy, -3.5);
        assert.equal(main.hurtSound.playCount, 0);
        assert.deepEqual(main.rumbles, ["playerDeath"]);
    }

    // Timeout on stairs first removes temporary protection, then the existing
    // lethal hurt mechanics detach Simon from the stairs and start airborne death.
    {
        const main = createMain(Main, Simon);
        main.simon.onStairs = true;
        main.simon.supported = false;
        main.simon.invincible = 182;
        registerPlayerActionMain(main);
        prepareRegisteredCountdownTimer();
        countdownRollover(main);
        assert.equal(main.playerPower, 0);
        assert.equal(main.simon.onStairs, false);
        assert.equal(main.simon.hurt, true);
        assert.equal(main.simon.vy, -1);
    }

    // A normal fall crosses y=416 in Simon.update, then first pit presentation
    // happens at the next fixed tick's input preflight immediately before Main's
    // existing below-pit branch increments dead.
    {
        const stageSong = createSong();
        const main = createMain(Main, Simon, { currentSong: stageSong, requestedSong: stageSong });
        main.simon.y = 415;
        main.simon.applyGravityWithPlatforms = () => {
            main.simon.y = 417;
        };
        main.simon.update(null);
        assert.equal(main.playerPower, 16, "gravity crossing itself does not own pit presentation");
        assert.equal(main.pitSound.playCount, 0);
        assert.equal(main.deathMusic.playCount, 0);

        registerPlayerActionMain(main);
        prepareRegisteredPitDeathPresentation();
        assert.equal(main.playerPower, 0);
        assert.equal(main.pitSound.playCount, 1);
        assert.equal(main.deathMusic.playCount, 1);
        assert.equal(stageSong.stopCount, 1);
        assert.equal(main.currentSong, null);
        modelLegacyMainPitBranch(main);
        assert.equal(main.simon.dead, 1);
        assert.equal(main.pitSound.playCount, 1);
        assert.equal(main.deathMusic.playCount, 1);

        // Checkpoint restoration requests the same stage Song, but death music has
        // cleared currentSong, so Main's normal ownership comparison restarts it.
        main.requestedSong = stageSong;
        if (main.currentSong != main.requestedSong && main.mode == Main.MODE_PLAYING) {
            if (main.currentSong != null) main.currentSong.stop();
            main.currentSong = main.requestedSong;
            main.currentMusic = null;
            main.currentSong.play();
        }
        assert.equal(stageSong.playCount, 1, "next life must restart the stage Song from its first part");
    }

    // Lethal hurt into a pit uses the same one-shot preflight even though health
    // reached zero before crossing the boundary.
    {
        const stageSong = createSong();
        const main = createMain(Main, Simon, { playerPower: 0, currentSong: stageSong, requestedSong: stageSong });
        main.simon.hurt = true;
        main.simon.y = 415;
        main.simon.vx = 1;
        main.simon.vy = 2;
        main.simon.applyGravityWithPlatforms = () => {
            main.simon.y = 417;
        };
        main.simon.update(null);
        assert.equal(main.pitSound.playCount, 0);
        registerPlayerActionMain(main);
        prepareRegisteredPitDeathPresentation();
        assert.equal(main.pitSound.playCount, 1);
        assert.equal(main.deathMusic.playCount, 1);
        assert.equal(stageSong.stopCount, 1);
        modelLegacyMainPitBranch(main);
        assert.equal(main.simon.dead, 1);
    }

    // Regression discovered by the restore audit: a cold-restored lethal
    // trajectory may begin already below the pit boundary with health 0/dead 0.
    // Preflight must start pit SFX/death music before Main's health guard returns.
    {
        const stageSong = createSong();
        const main = createMain(Main, Simon, { playerPower: 0, currentSong: stageSong, requestedSong: stageSong });
        main.simon.hurt = true;
        main.simon.y = 417;
        registerPlayerActionMain(main);
        prepareRegisteredPitDeathPresentation();
        assert.equal(main.pitSound.playCount, 1);
        assert.equal(main.deathMusic.playCount, 1);
        assert.equal(stageSong.stopCount, 1);
        assert.equal(main.currentSong, null);
        assert.equal(main.simon.dead, 0);
        modelLegacyMainPitBranch(main);
        assert.equal(main.simon.dead, 1);
        assert.equal(main.pitSound.playCount, 1);
    }

    // Potion-protected pit entry is unconditional and normalizes presentation
    // before Main advances the death counter.
    {
        const main = createMain(Main, Simon);
        main.simon.y = 417;
        main.simon.invincible = 728;
        main.simon.drankPotion = true;
        main.alpha = 0.25;
        registerPlayerActionMain(main);
        prepareRegisteredPitDeathPresentation();
        assert.equal(main.playerPower, 0);
        assert.equal(main.simon.invincible, 0);
        assert.equal(main.simon.drankPotion, false);
        assert.equal(main.alpha, 1);
        assert.equal(main.pitSound.playCount, 1);
        assert.equal(main.deathMusic.playCount, 1);
        modelLegacyMainPitBranch(main);
        assert.equal(main.simon.dead, 1);
    }

    // The scripted stage-three floor-breaking exemption remains authoritative.
    {
        const main = createMain(Main, Simon, { stageIndex: 2, floorBreaking: true, time: 0 });
        main.simon.y = 417;
        registerPlayerActionMain(main);
        prepareRegisteredPitDeathPresentation();
        assert.equal(main.playerPower, 16);
        assert.equal(main.pitSound.playCount, 0);
        assert.equal(main.deathMusic.playCount, 0);
    }

    // Recorded/cinematic modes are intentionally left to historical control flow;
    // this new preflight is only for real user gameplay.
    for (const mode of [Main.MODE_DEMO, Main.MODE_CREDITS]) {
        const main = createMain(Main, Simon, { mode });
        main.simon.y = 417;
        registerPlayerActionMain(main);
        prepareRegisteredPitDeathPresentation();
        assert.equal(main.playerPower, 16);
        assert.equal(main.pitSound.playCount, 0);
    }

    // Pit preflight must not mutate a state already in its death presentation.
    {
        const main = createMain(Main, Simon, { playerPower: 0 });
        main.simon.y = 417;
        main.simon.dead = 1;
        registerPlayerActionMain(main);
        prepareRegisteredPitDeathPresentation();
        assert.equal(main.pitSound.playCount, 0);
        assert.equal(main.deathMusic.playCount, 0);
    }

    // StopWatch still prevents the countdown phase itself; timeout semantics do
    // not run until the actual 1 -> 0 decrement can occur.
    {
        const main = createMain(Main, Simon, { timeFrozen: 455 });
        main.simon.invincible = 728;
        registerPlayerActionMain(main);
        prepareRegisteredCountdownTimer();
        countdownRollover(main);
        assert.equal(main.time, 1);
        assert.equal(main.simon.invincible, 728);
        main.timeFrozen = 0;
        prepareRegisteredCountdownTimer();
        countdownRollover(main);
        assert.equal(main.time, 0);
        assert.equal(main.playerPower, 0);
    }

    const tsMain = readFileSync(resolve(rootDir, "pwa/src/stickvania/Main.ts"), "utf8");
    const javaMain = readFileSync(resolve(rootDir, "desktop/src/stickvania/Main.java"), "utf8");
    const tsPolicy = readFileSync(resolve(rootDir, "pwa/src/stickvania/PlayerActionPolicy.ts"), "utf8");
    const javaPolicy = readFileSync(resolve(rootDir, "desktop/src/stickvania/PlayerActionPolicy.java"), "utf8");
    const tsInput = readFileSync(resolve(rootDir, "pwa/src/stickvania/StickvaniaInput.ts"), "utf8");
    const javaInput = readFileSync(resolve(rootDir, "desktop/src/stickvania/StickvaniaInput.java"), "utf8");
    const tsSimon = readFileSync(resolve(rootDir, "pwa/src/stickvania/Simon.ts"), "utf8");
    const javaSimon = readFileSync(resolve(rootDir, "desktop/src/stickvania/Simon.java"), "utf8");

    // Main's timer order/death delay remain intentionally unchanged; the semantic
    // correction is layered around the existing lethal call rather than weakening
    // ordinary hurtSimon protection.
    assert.match(tsMain, /timeFrozen == 0[\s\S]*?\+\+this\.timeIncrementor == 91[\s\S]*?this\.hurtSimon\(16\)/);
    assert.match(javaMain, /timeFrozen == 0[\s\S]*?\+\+timeIncrementor == 91[\s\S]*?hurtSimon\(16\)/);
    assert.match(tsMain, /this\.simon!\.dead > 473[\s\S]*?FADE_REASON_SHOW_CONTINUE_SCREEN[\s\S]*?FADE_REASON_RESTORE_CHECKPOINT/);
    assert.match(javaMain, /simon\.dead > 473[\s\S]*?FADE_REASON_SHOW_CONTINUE_SCREEN[\s\S]*?FADE_REASON_RESTORE_CHECKPOINT/);

    for (const source of [tsPolicy, javaPolicy]) {
        assert.match(source, /timeIncrementor == 90[\s\S]*?time == 1[\s\S]*?!.*hurt[\s\S]*?invincible > 0/);
        assert.match(
            source,
            /prepareRegisteredPitDeathPresentation[\s\S]*?MODE_PLAYING[\s\S]*?dead != 0[\s\S]*?y <= 416[\s\S]*?simon_in_pit[\s\S]*?simon_killed/
        );
    }
    assert.match(tsInput, /prepareRegisteredPitDeathPresentation\(\);[\s\S]*?prepareRegisteredCountdownTimer\(\)/);
    assert.match(javaInput, /prepareRegisteredPitDeathPresentation\(\);[\s\S]*?prepareRegisteredCountdownTimer\(\)/);
    for (const source of [tsSimon, javaSimon]) {
        assert.match(source, /time == 0[\s\S]*?playerPower > 0[\s\S]*?hurt[\s\S]*?!.*floorBreaking/);
        assert.doesNotMatch(source, /simon_in_pit|prepareRegisteredPitDeathPresentation/);
    }

    console.log("Timeout/pit-death/audio-restart production regressions passed.");
} finally {
    await server.close();
}
