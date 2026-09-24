import assert from "node:assert/strict";
import { createServer } from "vite";
import { resolve } from "node:path";
const server = await createServer({ root: resolve("pwa"), appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
    const load = (n) => server.ssrLoadModule(`/src/stickvania/${n}.ts`);
    const { Main } = await load("Main"),
        { Simon } = await load("Simon"),
        { Orb } = await load("Orb"),
        { Spikes } = await load("Spikes"),
        { SmallHeart } = await load("SmallHeart"),
        { Dagger } = await load("Dagger"),
        { StopWatch } = await load("StopWatch"),
        { ThingStack } = await load("ThingStack");
    const pose = (s) => JSON.stringify([s.whipping, s.throwing, s.whipIncrementor, s.whipIndex, s.releasedWhip]);
    function fixture() {
        const m = Object.create(Main.prototype);
        Object.assign(m, {
            mode: Main.MODE_PLAYING,
            fadeState: Main.FADE_DONE,
            fade: 0,
            playerPower: 16,
            enemyPower: 0,
            players: 2,
            score: 0,
            difficulty: Main.DIFFICULTY_NORMAL,
            beatStageFlag: false,
            beatStageDelay: 0,
            floorBreaking: false,
            time: 300,
            timeIncrementor: 0,
            timeFrozen: 0,
            stageIndex: 0,
            hearts: 5,
            weaponType: Main.WEAPON_TYPE_DAGGER,
            weaponRepeats: Main.WEAPON_REPEATS_SINGLE,
            camera: 0,
            door: null,
            repeatsFlashing: 0,
            killAllFlag: false,
            platforms: [],
            currentSong: null,
            requestedSong: null,
            currentMusic: null,
            regionThingStack: new ThingStack(),
            regionStackSwap: new ThingStack(),
            weaponsStack: new ThingStack(),
            weaponsStackSwap: new ThingStack(),
            controlInput: {
                update() {},
                isUp: () => false,
                isDown: () => false,
                isLeft: () => false,
                isRight: () => false,
                isJump: () => false,
                isAttack: () => false
            },
            effects: [],
            playSound(s) {
                this.effects.push(s);
            },
            playRumble(s) {
                this.effects.push(s);
            },
            stopRumble() {},
            requestMusic(s) {
                this.effects.push(s);
            },
            simon_hurt: "hurt",
            stage_cleared: "clear",
            heartbeat: "heart",
            bleep: "pickup",
            threw_dagger: "dagger",
            isEmpty: () => true,
            isSolid: () => false,
            isSupportive: () => false,
            findPlatform: () => null,
            getWall: () => Main.WALL_EMPTY,
            moveCamera() {},
            setSimonAlpha() {}
        });
        m.simon = new Simon(m);
        Object.assign(m.simon, {
            x: 100,
            y: 100,
            lastX: 100,
            lastY: 100,
            xMin: 0,
            xMax: 1000,
            direction: Main.RIGHT,
            whipping: true,
            whipIndex: 2,
            whipIncrementor: 25,
            releasedWhip: false,
            whipType: 2
        });
        return m;
    }
    function orb(m) {
        const o = new Orb(m, 120, 110, 0);
        o.fadeIn = 91;
        return o;
    }
    const failures = [];
    function check(name, fn) {
        try {
            fn();
            console.log("PASS " + name);
        } catch (e) {
            failures.push(name + ": " + e.stack);
        }
    }
    for (const kind of ["hazard", "pickup", "whip", "weapon", "watch"])
        check("Orb then " + kind, () => {
            const m = fixture();
            const o = orb(m);
            let before;
            const update = o.update;
            o.update = function (gc) {
                const alive = update.call(this, gc);
                before = pose(m.simon);
                return alive;
            };
            const dagger = new Dagger(m, 120, 110, Main.RIGHT);
            if (kind === "weapon") m.weaponsStack.push(dagger);
            let target;
            if (kind === "hazard") target = new Spikes(m, 120, 110, 0);
            else if (kind === "pickup") target = new SmallHeart(m, 120, 110);
            else if (kind === "whip" || kind === "weapon")
                target = {
                    hit: false,
                    update() {
                        this.hit = kind === "whip" ? m.intersectsWhip(0, 0, 500, 400) : m.intersectsWeapon(0, 0, 500, 400);
                        return true;
                    }
                };
            else {
                m.weaponType = Main.WEAPON_TYPE_STOP_WATCH;
                const watch = new StopWatch(m);
                assert.equal(m.timeFrozen, 455);
                m.weaponsStack.push(watch);
                target = {
                    update() {
                        return true;
                    }
                };
            }
            m.regionThingStack.push(target);
            m.regionThingStack.push(o);
            m.effects = [];
            m.updateFrame({});
            assert.equal(m.beatStageFlag, true);
            assert.equal(m.playerPower, 16);
            assert.equal(m.simon.hurt, false);
            assert.equal(m.hearts, 5);
            assert.equal(pose(m.simon), before, "frozen pose changed after Orb");
            assert.ok(!m.effects.includes("hurt") && !m.effects.includes("pickup"));
            assert.ok(m.regionThingStack.things.includes(target), "post-Orb target was consumed");
            if (kind === "whip" || kind === "weapon") assert.equal(target.hit, false, "acquired new attack hit");
            if (kind === "weapon") assert.equal(dagger.intersected, false);
            if (kind === "watch") {
                assert.equal(m.timeFrozen, 0);
                assert.equal(m.weaponsStack.top, -1, "weapon pass skipped cleanup");
            }
        });
    check("Direct post-Orb damage is a complete no-op", () => {
        const m = fixture();
        m.beatStage();
        m.simon.G = 99;
        const before = JSON.stringify([m.playerPower, m.simon, m.effects], (k, v) => (k === "main" ? undefined : v));
        m.hurtSimon(4);
        assert.equal(
            JSON.stringify([m.playerPower, m.simon, m.effects], (k, v) => (k === "main" ? undefined : v)),
            before
        );
    });
    check("Pre-Orb hazard and pickup remain live after boss defeat", () => {
        let m = fixture();
        assert.equal(m.enemyPower, 0);
        new Spikes(m, 120, 110, 0).update({});
        assert.equal(m.playerPower, 0);
        m = fixture();
        assert.equal(new SmallHeart(m, 120, 110).update({}), false);
        assert.equal(m.hearts, 6);
    });
    check("Pre-Orb TIME still kills", () => {
        const m = fixture();
        m.time = 1;
        m.timeIncrementor = 90;
        m.updateFrame({});
        assert.equal(m.playerPower, 0);
        assert.equal(m.time, 0);
    });
    check("Ordinary same-tick hurt retains the damaging whip and existing weapon", () => {
        const m = fixture();
        m.hurtSimon(4);
        assert.equal(m.simon.hurt, true);
        assert.equal(m.intersectsWhip(0, 0, 500, 400), true);
        m.weaponsStack.push(new Dagger(fixture(), 120, 110, Main.RIGHT));
        assert.equal(m.intersectsWeapon(0, 0, 500, 400), true);
    });
    check("Normal stage-three tally resumes collision ownership", () => {
        const m = fixture();
        m.stageIndex = 2;
        m.beatStage();
        m.time = 0;
        m.hearts = 0;
        for (let i = 0; i < 456; i++) m.updateFrame({});
        assert.equal(m.beatStageFlag, false);
        assert.equal(m.floorBreaking, true);
        assert.equal(m.intersectsSimon(0, 0, 500, 400), true);
        assert.equal(m.intersectsWhip(0, 0, 500, 400), true);
    });
    assert.equal(failures.length, 0, failures.join("\n"));
} finally {
    await server.close();
}
