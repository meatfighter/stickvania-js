import { rumbleMutationPlugin } from "./rumble-mutation-plugin.mjs";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
const server = await createServer({
    root: fileURLToPath(new URL("../pwa/", import.meta.url)),
    plugins: [rumbleMutationPlugin()],
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});
after(() => server.close());
const load = (name) => server.ssrLoadModule("/src/rumble/" + name + ".ts");
const { RumbleManager } = await load("RumbleManager");
const { sampleRumble } = await load("RumbleTimeline");
const { getRumbleEffect } = await load("RumbleEffects");
const castle = await load("CastleCrumbleTimeline");
const { playPulseOnGamepad } = await load("BrowserHaptics");
const flush = async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
};
function fixture(mode = "immediate") {
    let now = 0,
        next = 0,
        exposed = true,
        silenceResolve = null;
    const timers = new Map(),
        log = [],
        stops = [];
    const f = {
        log,
        stops,
        timers,
        setExposed: (v) => (exposed = v),
        now: () => now,
        async advance(ms) {
            const target = now + ms;
            for (let loops = 0; loops < 10000; loops++) {
                await flush();
                const due = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) {
                    now = target;
                    await flush();
                    if (![...timers.values()].some((t) => t.at <= target)) return;
                    continue;
                }
                now = Math.max(now, due[1].at);
                timers.delete(due[0]);
                due[1].cb();
            }
            throw Error("timer busy loop");
        },
        async stall(ms) {
            now += ms;
            const callbacks = [...timers.values()].filter((t) => t.at <= now);
            timers.clear();
            for (const t of callbacks) t.cb();
            await flush();
        },
        releaseSilence: () => silenceResolve?.()
    };
    f.manager = new RumbleManager(true, {
        now: () => now,
        available: () => true,
        pads: () => (exposed ? [{ index: 0, connected: true }] : []),
        schedule: (cb, delay) => {
            const id = ++next;
            timers.set(id, { cb, at: now + delay });
            return id;
        },
        cancel: (id) => timers.delete(id),
        play: (pad, pulse, current, remaining) => {
            log.push({ at: now, ...pulse, current, remaining });
            if (mode === "never") return new Promise(() => {});
            if (mode === "reject") return Promise.reject(Error("hardware error"));
            return Promise.resolve(mode === "preempted" ? "preempted" : "complete");
        },
        silence: (_pads, current) => {
            stops.push(current);
            return mode === "pending-stop" ? new Promise((r) => (silenceResolve = r)) : Promise.resolve();
        }
    });
    return f;
}
function plain(log) {
    return log.map(({ current, remaining, ...s }) => s);
}
function initCastle() {
    return {
        mode: 7,
        castleCrumbleRumbleTicks: 0,
        castleFallX: 410,
        castleFallY: Math.fround(111),
        castleFallSparkDelay: 45,
        castleFallSparkCount: 8,
        castleFallSparkVisible: false,
        castleFallSparkX: 0,
        castleFallSparkY: 0,
        castleFallDelay: 91
    };
}
// Direct transcription of inspected updateCastleFalls numeric/visual control flow, not a full game runner.
function step(s) {
    if (s.castleFallSparkCount > 0 || s.castleFallY < 220 || s.castleFallDelay > 0) s.castleCrumbleRumbleTicks++;
    if (s.castleFallSparkCount > 0) {
        if (s.castleFallSparkDelay > 0) s.castleFallSparkDelay--;
        else if (s.castleFallSparkVisible) {
            s.castleFallSparkCount--;
            s.castleFallSparkVisible = false;
            s.castleFallSparkDelay = 5;
        } else {
            s.castleFallSparkVisible = true;
            s.castleFallSparkDelay = 10;
            s.castleFallSparkX = 433;
            s.castleFallSparkY = 113;
        }
    } else {
        if (s.castleFallY < 220) s.castleFallY = Math.fround(s.castleFallY + 0.2);
        else if (s.castleFallDelay === 0) return false;
        else s.castleFallDelay--;
        s.castleFallX = 408;
    }
    return true;
}
test("all 814 stable castle states satisfy the exact visual validator", () => {
    const s = initCastle();
    assert(castle.isCastlePresentationValid(s));
    const sparks = [];
    let landing;
    for (let n = 1; n <= 813; n++) {
        const visible = s.castleFallSparkVisible;
        assert(step(s));
        assert(castle.isCastlePresentationValid(s), `tick ${n}`);
        if (!visible && s.castleFallSparkVisible) sparks.push(n);
        if (s.castleFallY >= 220 && landing === undefined) landing = n;
    }
    assert.deepEqual(sparks, [46, 63, 80, 97, 114, 131, 148, 165]);
    assert.equal(landing, 722);
    assert.equal(s.castleCrumbleRumbleTicks, 813);
    assert.equal(step(s), false);
    assert.equal(s.castleCrumbleRumbleTicks, 813);
    assert(castle.isCastlePresentationValid(s));
});
test("castle profile preserves 8+25+1+5 authored pulse groups inside 8130 ms", () => {
    const p = castle.makeCastleCrumblePattern();
    let at = 0;
    const pulses = [];
    for (const s of p) {
        if ("delay" in s) at += s.delay;
        else {
            pulses.push({ at, ...s });
            at += s.duration;
        }
    }
    assert.equal(at, 8130);
    assert.equal(pulses.length, 39);
    assert.equal(pulses[0].at, 460);
    assert.equal(pulses[7].at, 1650);
    assert.equal(pulses[8].at, 1770);
    assert.equal(pulses[33].at, 7220);
    assert.equal(pulses[33].duration, 320);
    assert.equal(pulses.at(-1).at + pulses.at(-1).duration, 8130);
});
test("castle null/fractional/out-of-range and mutually inconsistent states are rejected", () => {
    const s = initCastle();
    for (let i = 0; i < 500; i++) step(s);
    for (const tick of [-1, 0.5, 814, 500000.5, null, NaN]) assert.equal(castle.isCastlePresentationValid({ ...s, castleCrumbleRumbleTicks: tick }), false);
    for (const [key, bad] of Object.entries({ castleFallY: 111, castleFallSparkVisible: true, castleFallSparkCount: 8, castleFallDelay: 0, castleFallX: 900 }))
        assert.equal(castle.isCastlePresentationValid({ ...s, [key]: bad }), false, key);
    assert(castle.isCastlePresentationValid({ mode: 4, castleCrumbleRumbleTicks: 0 }));
});
test("profile boundaries are half-open and offsets never replay an expired pulse", () => {
    const e = getRumbleEffect("playerHurt");
    assert.equal(sampleRumble(e, 27).pulse.duration, 1);
    assert.equal(sampleRumble(e, 28).pulse, null);
    assert.equal(sampleRumble(e, 42).pulse.duration, 36);
    assert(sampleRumble(e, 78).done);
    assert(sampleRumble(e, NaN).done);
});
test("immediate, preempted, rejected and never-settling hardware have identical timelines", async () => {
    let expected;
    for (const mode of ["immediate", "preempted", "reject", "never"]) {
        const f = fixture(mode);
        f.manager.play("playerDeath");
        await f.advance(900);
        if (!expected) expected = plain(f.log);
        else assert.deepEqual(plain(f.log), expected, mode);
        assert.equal(f.timers.size, 0);
    }
    assert.equal(expected.at(-1).at + expected.at(-1).duration, 815);
});
test("no exposed pad does not consume pulse durations; later exposure joins the current phase", async () => {
    const f = fixture();
    f.setExposed(false);
    f.manager.play("playerDeath");
    await f.advance(400);
    assert.equal(f.log.length, 0);
    f.setExposed(true);
    await f.advance(20);
    assert.equal(f.log[0].strong, 0.48);
    assert.equal(f.log[0].at, 420);
    await f.advance(500);
    assert.equal(f.timers.size, 0);
});
test("stopping an absent weapon tap cannot cancel Player Hurt or Death", async () => {
    for (const id of ["playerHurt", "playerDeath"]) {
        const f = fixture();
        f.manager.play(id);
        await f.advance(0);
        const current = f.log[0].current;
        f.manager.stop("weaponThrow");
        assert(current());
        assert.equal(f.stops.length, 0);
        await f.advance(900);
        assert(f.log.length > 1);
    }
});
test("targeted stop recomputes surviving channels without a global reset", async () => {
    const f = fixture();
    f.manager.play("weaponThrow");
    f.manager.play("playerHurt");
    await f.advance(0);
    assert.equal(f.log[0].strong, 1);
    assert.equal(f.log[0].weak, 0.3);
    await f.advance(5);
    f.manager.stop("weaponThrow");
    await f.advance(0);
    assert.equal(f.log.at(-1).strong, 1);
    assert.equal(f.log.at(-1).weak, 0.12);
    assert.equal(f.stops.length, 0);
});
test("player death owns the entire pattern including gaps; suppressed events are not queued", async () => {
    const f = fixture();
    f.manager.play("playerDeath");
    await f.advance(130);
    assert.equal(f.log.at(-1).at + f.log.at(-1).duration, 115);
    f.manager.play("bossFinalHit");
    f.manager.play("fireProjectile");
    await f.advance(55);
    assert.equal(f.log.at(-1).strong, 0.74);
    await f.advance(700);
    assert.equal(f.log.at(-1).at + f.log.at(-1).duration, 815);
    assert.equal(f.timers.size, 0);
});
test("a long JS stall skips expired transient work instead of replaying a backlog", async () => {
    const f = fixture();
    f.manager.play("doorOpen");
    await f.stall(2000);
    assert.equal(f.log.length, 0);
    assert.equal(f.timers.size, 0);
});
test("a scene clock remains at zero through fade-in and follows actual game ticks", async () => {
    const f = fixture();
    let tick = 0;
    f.manager.playScene("castleCrumble", () => (tick === null ? null : tick * 10));
    await f.advance(220);
    assert.equal(f.log.length, 0);
    for (let i = 1; i <= 46; i++) {
        tick = i;
        await f.advance(10);
    }
    assert(f.log.some((x) => x.strong === 0.3));
    const n = f.log.length;
    tick = null;
    await f.advance(30);
    assert.equal(f.log.length, n);
    assert.equal(f.timers.size, 0);
});
test("cold/retained castle Continue at a mid-fall position never restarts its sparks", async () => {
    const f = fixture();
    let tick = 505;
    f.manager.playScene("castleCrumble", () => tick * 10);
    await f.advance(0);
    assert(f.log[0].strong >= 0.28);
    assert.notEqual(f.log[0].weak, 0.72);
    f.manager.setSuspended(true);
    await flush();
    assert.equal(f.timers.size, 0);
    f.manager.setSuspended(false);
    f.manager.playScene("castleCrumble", () => tick * 10);
    await f.advance(0);
    assert.notEqual(f.log.at(-1).weak, 0.72);
    tick = 813;
    await f.advance(20);
    assert.equal(f.timers.size, 0);
});
test("bounded stop completion cannot shift the logical beginning into the future", async () => {
    const f = fixture("pending-stop");
    f.manager.stopAll();
    f.manager.play("playerDeath");
    await f.advance(200);
    assert.equal(f.log.length, 0);
    f.releaseSilence();
    await f.advance(0);
    assert.equal(f.log[0].at, 200);
    assert.equal(f.log[0].strong, 0.74);
});
test("stopAll retires output and no transient resumes merely by unsuspending", async () => {
    const f = fixture();
    f.manager.play("doorOpen");
    await f.advance(0);
    const command = f.log[0];
    assert(command.current());
    f.manager.setSuspended(true);
    assert(!command.current());
    await f.advance(1000);
    f.manager.setSuspended(false);
    await f.advance(1000);
    assert.equal(f.log.length, 1);
    assert.equal(f.timers.size, 0);
});
test("late fallback guards expire with the individual hardware lease", async () => {
    const f = fixture("never");
    f.manager.play("weaponThrow");
    await f.advance(0);
    const c = f.log[0];
    assert(c.current());
    await f.advance(20);
    assert.equal(c.current(), false);
    assert.equal(c.remaining(), 0);
});
test("same-channel replacement retires the old pattern without replay", async () => {
    const f = fixture();
    f.manager.play("weaponThrow");
    await f.advance(5);
    f.manager.play("fireProjectile");
    await f.advance(200);
    assert.equal(f.timers.size, 0);
    assert.equal(f.log.at(-1).at + f.log.at(-1).duration, 135);
});
test("completed silence predicates retire before a later run", async () => {
    const f = fixture();
    f.manager.stopAll();
    const old = f.stops.at(-1);
    assert(old());
    await flush();
    assert(!old());
    f.manager.play("weaponThrow");
    await f.advance(0);
    assert.equal(f.log.length, 1);
    assert(!old());
});
test("replacement stop does not let an earlier completion release the newer barrier", async () => {
    const f = fixture("pending-stop");
    f.manager.stopAll();
    const old = f.stops.at(-1);
    f.manager.stopAll();
    assert(!old());
    const latest = f.stops.at(-1);
    assert(latest());
    f.manager.play("playerDeath");
    await f.advance(100);
    assert.equal(f.log.length, 0);
    f.releaseSilence();
    await f.advance(0);
    assert.equal(f.log.length, 1);
    assert(!latest());
});
test("offset inside a silent phase waits only its remaining interval", async () => {
    const f = fixture();
    f.manager.playFromOffset("playerHurt", 30);
    await f.advance(11);
    assert.equal(f.log.length, 0);
    await f.advance(1);
    assert.equal(f.log[0].at, 12);
    assert.equal(f.log[0].strong, 0.26);
    await f.advance(100);
    assert.equal(f.timers.size, 0);
});
const params = { duration: 20, strong: 0.6, weak: 0.4 };
test("a delayed failure can fall back only for the unexpired remainder", async () => {
    let now = 0;
    const calls = [];
    let reject;
    const a = {
        effects: ["dual-rumble"],
        playEffect: () => new Promise((_, r) => (reject = r)),
        pulse: async (v, d) => {
            calls.push({ v, d });
            return true;
        }
    };
    const p = playPulseOnGamepad(
        { vibrationActuator: a },
        params,
        () => now < 20,
        () => 20 - now
    );
    now = 8;
    reject(Error());
    await p;
    assert.deepEqual(calls, [{ v: 0.6, d: 12 }]);
});
test("an expired lease cannot issue a late positive fallback", async () => {
    let now = 0;
    let reject;
    let calls = 0;
    const a = {
        playEffect: () => new Promise((_, r) => (reject = r)),
        pulse: async () => {
            calls++;
            return true;
        }
    };
    const p = playPulseOnGamepad(
        { vibrationActuator: a },
        params,
        () => now < 20,
        () => 20 - now
    );
    now = 30;
    reject(Error());
    await p;
    assert.equal(calls, 0);
});
test("preempted completion does not trigger another actuator attempt", async () => {
    let calls = 0;
    const result = await playPulseOnGamepad(
        {
            vibrationActuator: {
                playEffect: async () => "preempted",
                pulse: async () => {
                    calls++;
                    return true;
                }
            }
        },
        params,
        () => true,
        () => 20
    );
    assert.equal(result, "vibrationActuator.playEffect: preempted");
    assert.equal(calls, 0);
});
test("non-finite remaining time cannot reach native hardware", async () => {
    let calls = 0;
    await playPulseOnGamepad(
        {
            vibrationActuator: {
                playEffect: async () => {
                    calls++;
                }
            }
        },
        params,
        () => true,
        () => NaN
    );
    assert.equal(calls, 0);
});

test("two pads are independent when one native promise never settles", async () => {
    const f = fixture();
    const seen = [];
    f.manager.ports.pads = () => [{ index: 0 }, { index: 1 }];
    f.manager.ports.play = (pad, pulse) => {
        seen.push({ pad: pad.index, at: f.now(), ...pulse });
        return pad.index === 0 ? new Promise(() => {}) : Promise.resolve();
    };
    f.manager.play("playerHurt");
    await f.advance(100);
    assert.deepEqual(
        seen.filter((x) => x.pad === 0).map(({ pad, ...x }) => x),
        seen.filter((x) => x.pad === 1).map(({ pad, ...x }) => x)
    );
    assert(seen.filter((x) => x.pad === 1).length > 1);
    assert.equal(f.timers.size, 0);
});
test("exposure during a gap, disconnect and reconnect never restart the envelope", async () => {
    const f = fixture();
    f.setExposed(false);
    f.manager.play("playerHurt");
    await f.advance(30);
    f.setExposed(true);
    await f.advance(11);
    assert.equal(f.log.length, 0);
    await f.advance(1);
    assert.equal(f.log[0].at, 42);
    assert.equal(f.log[0].strong, 0.26);
    f.setExposed(false);
    await f.advance(20);
    f.setExposed(true);
    await f.advance(50);
    assert.equal(f.timers.size, 0);
    assert(f.log.every((p) => p.strong === 0.26));
});
test("unsupported actuator does not stall the real logical scheduler", async () => {
    const f = fixture();
    f.manager.ports.play = (pad, pulse, current, remaining) => playPulseOnGamepad(pad, pulse, current, remaining);
    f.manager.play("playerDeath");
    await f.advance(900);
    assert.equal(f.timers.size, 0);
});
test("delayed completion after replacement cannot acquire any later output", async () => {
    const f = fixture();
    const pending = [];
    f.manager.ports.play = (_p, pulse, current) => {
        f.log.push({ at: f.now(), ...pulse, current });
        return new Promise((r) => pending.push(r));
    };
    f.manager.play("playerHurt");
    await f.advance(0);
    const first = f.log[0].current;
    await f.advance(100);
    assert.equal(first(), false);
    for (const done of pending) done();
    await flush();
    assert.equal(f.timers.size, 0);
});
test("potion, door and StopWatch mix by component maxima in one same-turn decision", async () => {
    const f = fixture(),
        ids = ["invincibilityPotion", "doorOpen", "stopwatch"];
    for (const id of ids) f.manager.play(id);
    await f.advance(0);
    const pulses = ids.map((id) => sampleRumble(getRumbleEffect(id), 0).pulse).filter(Boolean);
    assert.equal(f.log.length, 1);
    assert.equal(f.log[0].strong, Math.max(...pulses.map((p) => p.strong)));
    assert.equal(f.log[0].weak, Math.max(...pulses.map((p) => p.weak)));
    f.manager.stopAll();
    await f.advance(10000);
    assert.equal(f.timers.size, 0);
});
test("equal-priority exclusive replacement is latest-wins and death displaces boss", async () => {
    const f = fixture();
    f.manager.play("bossFinalHit");
    await f.advance(30);
    f.manager.play("playerDeath");
    await f.advance(0);
    assert.equal(f.log.at(-1).strong, getRumbleEffect("playerDeath").pattern[0].strong);
    f.manager.play("bossFinalHit");
    await f.advance(900);
    assert.equal(f.log.at(-1).at + f.log.at(-1).duration, 845);
});
test("disabled and unavailable rumble never schedules output or changes user preference", async () => {
    const f = fixture();
    f.manager.setEnabled(false);
    f.manager.play("playerDeath");
    await f.advance(1000);
    assert.equal(f.log.length, 0);
    assert.equal(f.timers.size, 0);
    const unavailable = new RumbleManager(true, { ...f.manager.ports, available: () => false });
    assert.equal(unavailable.isEnabled(), false);
    unavailable.setEnabled(true);
    unavailable.play("playerHurt");
    await f.advance(100);
    assert.equal(f.log.length, 0);
    assert.equal(f.timers.size, 0);
});

test("lower-priority feedback cannot invalidate an active exclusive lease", async () => {
    const f = fixture();
    f.manager.play("playerDeath");
    await f.advance(0);
    const current = f.log[0].current;
    f.manager.play("weaponThrow");
    assert.equal(current(), true, "exclusive lease remains current");
});

test("equal-priority death replacement restarts only the latest accepted pattern", async () => {
    const f = fixture();
    f.manager.play("playerDeath");
    await f.advance(100);
    const old = f.log.at(-1).current;
    f.manager.play("playerDeath");
    assert.equal(old(), false);
    await f.advance(0);
    assert.equal(f.log.at(-1).strong, 0.98);
    await f.advance(900);
    assert.equal(f.log.at(-1).at + f.log.at(-1).duration, 915);
    assert.equal(f.timers.size, 0);
});
