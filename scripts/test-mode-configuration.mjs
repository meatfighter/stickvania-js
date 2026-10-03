import assert from "node:assert/strict";
import { test } from "node:test";
import { withCounterModules } from "./counter-test-utils.mjs";

// No production transformations or replacement physics.
test("mode alone selects Simon physics and suppresses Hard only for recordings", async () => {
    await withCounterModules({}, async (load) => {
        const { Main } = await load("Main");
        const modes = [
            Main.MODE_TITLE_SCREEN,
            Main.MODE_DEMO,
            Main.MODE_CONTINUE_SCREEN,
            Main.MODE_PLAYING,
            Main.MODE_INTRO,
            Main.MODE_MAP,
            Main.MODE_CASTLE_FALLS,
            Main.MODE_CREDITS,
            Main.MODE_INPUT_CONFIG
        ];
        const main = Object.create(Main.prototype);
        main.random = {
            nextInt() {
                throw new Error("configuration consumed RNG");
            }
        };
        const delay = (base, multiplier, hard) => (hard && base > 0 ? Math.max(1, Math.trunc(Math.fround(base * Math.fround(multiplier)))) : base);
        for (const mode of modes)
            for (const difficulty of [Main.DIFFICULTY_NORMAL, Main.DIFFICULTY_HARD]) {
                const recorded = mode === Main.MODE_DEMO || mode === Main.MODE_CREDITS;
                const hard = difficulty === Main.DIFFICULTY_HARD && !recorded;
                for (let mask = 0; mask < 128; mask++) {
                    Object.assign(main, {
                        mode,
                        difficulty,
                        stageIndex: 2,
                        time: 0,
                        playerPower: mask & 1 ? 0 : 16,
                        door: mask & 2 ? {} : null,
                        beatStageFlag: Boolean(mask & 4),
                        floorBreaking: Boolean(mask & 8),
                        simon: {
                            G: 123,
                            jumpVelocity: 456,
                            vx: 3.25,
                            vy: -1.5,
                            dead: mask & 16 ? 1 : 0,
                            hurt: Boolean(mask & 32),
                            supported: Boolean(mask & 64)
                        }
                    });
                    main.syncSimonPhysicsProfile();
                    assert.equal(main.simon.G, recorded ? Main.GRAVITY : Main.PLAYER_CONTROLLED_GRAVITY);
                    assert.equal(main.simon.jumpVelocity, recorded ? Main.SIMON_JUMP_VELOCITY : Main.PLAYER_CONTROLLED_JUMP_VELOCITY);
                    assert.equal(main.simon.vx, 3.25);
                    assert.equal(main.simon.vy, -1.5);
                    assert.equal(main.difficulty, difficulty);
                    assert.equal(main.adjustEnemyHits(3), hard ? 4 : 3);
                    assert.equal(main.adjustEnemyActiveCap(2), hard ? 3 : 2);
                    for (const power of [1, 2, 3, 16]) assert.equal(main.adjustSimonDamage(power), hard && power < 16 ? power + 1 : power);
                    for (const base of [0, 1, 43, 90, 91, 273]) {
                        assert.equal(main.adjustEnemySpawnDelay(base), delay(base, 0.66, hard));
                        assert.equal(main.adjustEnemyCooldown(base), delay(base, 0.7, hard));
                        assert.equal(main.adjustEnemyBehaviorDelay(base), delay(base, 0.75, hard));
                    }
                }
            }
        main.simon = null;
        assert.doesNotThrow(() => main.syncSimonPhysicsProfile());
    });
});

// Only map geometry and audiovisual side effects are substituted. Main.hurtSimon,
// Simon.update and Thing.applyGravityWithPlatforms/moveX are the real methods.
test("fatal and surviving knockback retain the same gameplay kinematics until landing", async () => {
    await withCounterModules({}, async (load) => {
        const { Main } = await load("Main");
        const { Simon } = await load("Simon");
        const makeMain = (health, airborne = false) => {
            const main = Object.create(Main.prototype);
            Object.assign(main, {
                mode: Main.MODE_PLAYING,
                difficulty: Main.DIFFICULTY_NORMAL,
                stageIndex: 0,
                playerPower: health,
                time: 300,
                beatStageFlag: false,
                floorBreaking: false,
                door: null,
                currentSong: null,
                requestedSong: null,
                playSound() {},
                playRumble() {},
                stopRumble() {},
                requestMusic() {},
                setSimonAlpha() {},
                getWall(_x, y) {
                    return y < 320 ? Main.WALL_EMPTY : Main.WALL_FULL;
                },
                isEmpty(_x, y) {
                    return y < 320;
                },
                isSupportive(_x, y) {
                    return y >= 320;
                },
                isSolid(_x, y) {
                    return y >= 320;
                },
                findPlatform() {
                    return null;
                }
            });
            const simon = new Simon(main);
            Object.assign(simon, {
                x: 384,
                y: airborne ? 200 : 256,
                lastX: 384,
                lastY: airborne ? 200 : 256,
                xMin: 0,
                xMax: 2048,
                direction: Main.RIGHT,
                supported: !airborne,
                hurt: false,
                dead: 0,
                invincible: 0,
                flashing: 0,
                onStairs: false,
                whipping: false,
                throwing: false
            });
            main.simon = simon;
            return main;
        };
        const kinematics = (s) => [s.x, s.y, s.vx, s.vy, s.G, s.jumpVelocity, s.supported];
        for (const airborne of [false, true]) {
            const surviving = makeMain(16, airborne);
            const fatal = makeMain(2, airborne);
            surviving.hurtSimon(2);
            fatal.hurtSimon(2);
            assert.equal(fatal.playerPower, 0);
            assert.equal(fatal.simon.hurt, true);
            let landed = false;
            for (let tick = 0; tick < 300; tick++) {
                for (const main of [surviving, fatal]) {
                    main.syncSimonPhysicsProfile();
                    main.simon.update(null);
                }
                assert.deepEqual(kinematics(fatal.simon), kinematics(surviving.simon));
                if (fatal.simon.dead > 0) {
                    landed = true;
                    break;
                }
            }
            assert.equal(landed, true, "knockback must land within watchdog");
            fatal.syncSimonPhysicsProfile();
            assert.equal(fatal.simon.G, Main.PLAYER_CONTROLLED_GRAVITY, "normal death is not recorded playback");
        }
        const timedOut = makeMain(16, true);
        timedOut.hurtSimon(2);
        timedOut.time = 0;
        const vx = timedOut.simon.vx;
        timedOut.syncSimonPhysicsProfile();
        timedOut.simon.update(null);
        assert.equal(timedOut.playerPower, 0);
        assert.equal(timedOut.simon.vx, vx);
        timedOut.syncSimonPhysicsProfile();
        assert.equal(timedOut.simon.G, Main.PLAYER_CONTROLLED_GRAVITY);
    });
});
