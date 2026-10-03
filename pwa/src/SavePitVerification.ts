import { Raven } from "./stickvania/Raven.js";
import { BridgeBat } from "./stickvania/BridgeBat.js";
import { configureEnemyArc } from "./stickvania/EnemyArcMotion.js";
import { DropItem } from "./stickvania/DropItem.js";
import { verifyAuthority } from "./AuthorityVerification.js";
import type { StageSegment } from "./stickvania/StageSegment.js";
import { JavaRandom, Music, Sys } from "slick2d-ts";
import { Main } from "./stickvania/Main.js";
import { StopWatch } from "./stickvania/StopWatch.js";
import { WhiteSkeleton } from "./stickvania/WhiteSkeleton.js";
import { Dog } from "./stickvania/Dog.js";
import { Door } from "./stickvania/Door.js";
import { Dracula } from "./stickvania/Dracula.js";
import { Orb } from "./stickvania/Orb.js";
import { AxeKnight } from "./stickvania/AxeKnight.js";
import { Boomerang } from "./stickvania/Boomerang.js";
import { BoomerangAxe } from "./stickvania/BoomerangAxe.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";
import { REJECTED_SAVE_DEBUG_KEY } from "./stickvania/persistence/RejectedSaveDebug.js";
import type { Harness } from "./RumbleCastleVerification.js";

function check(value: unknown, label: string): asserts value {
    if (!value) throw Error(label);
}

/** Real loaded game/engine producers. This module is excluded from release entry points. */
export async function verifySavePit(h: Harness): Promise<void> {
    let mounted: Awaited<ReturnType<Harness["mountMain"]>> | null = await h.mountMain(null);
    const store = new StickvaniaGameStateStore("save-pit-verification");
    const serializer = new StickvaniaGameStateSerializer();
    const records: Array<{ label: string; bytes: string; saveMilliseconds: number }> = [];
    const live = () => {
        check(mounted, "mounted");
        return mounted;
    };
    const m = () => live().main;
    const tick = () => h.advanceFrames(live(), 1);
    function save(label: string): void {
        const before = h.gameplaySnapshot(serializer, m());
        const started = performance.now();
        check(store.save(m(), () => true).saved, `save ${label}`);
        const saveMilliseconds = performance.now() - started;
        check(h.gameplaySnapshot(serializer, m()) === before, `save does not simulate ${label}`);
        records.push({ label, bytes: localStorage.getItem(GAME_STATE_STORAGE_KEY)!, saveMilliseconds });
    }
    async function restore(): Promise<void> {
        h.destroyMounted(mounted);
        mounted = null;
        mounted = await h.mountMain((main, gc) => store.restore(main, gc));
        check(store.hasValidSave(), "cold save available");
    }
    function stage(index: number): void {
        m().stopAllSounds();
        m().createStageForStateRestore(index);
        Object.assign(m(), { mode: Main.MODE_PLAYING, fadeState: Main.FADE_DONE, fade: 0, playerPower: 16, time: 300, hearts: 50 });
        check(m().simon, "Simon");
        m().simon!.invincible = 1000;
    }
    try {
        // Conditional edge fixtures in a fully loaded world. Save through the real store,
        // then destroy the world and Continue into separately loaded resources.
        for (const Type of [Raven, BridgeBat]) {
            stage(0);
            m().simon!.invincible = 0;
            m().simon!.whipping = false;
            save(Type.name + "-sentinel");
            const sentinel = localStorage.getItem(GAME_STATE_STORAGE_KEY);
            const actor = new Type(m(), m().simon!.x + 100, 160);
            Object.assign(actor, { state: Type.STATE_FLYING, spriteIndex: 0, applyingGravity: true, targetX: actor.x + 1000 });
            check(configureEnemyArc(actor, 1, 360), "finite short arc");
            m().regionThingStack.push(actor);
            for (let i = 0; i < 3; i++) {
                actor.update(live().container);
                check(Math.abs(actor.vy) <= 32 && Math.abs(actor.G) <= 64, "local cap " + Type.name);
                save(Type.name + "-edge-" + i);
            }
            m().weaponType = Main.WEAPON_TYPE_STOP_WATCH;
            const freezingWatch = new StopWatch(m());
            check(freezingWatch.lifeTime === 455, "enemy freeze uses valid watch");
            m().weaponsStack.push(freezingWatch);
            const frozen = [actor.x, actor.y, actor.vy, Reflect.get(actor, "state"), Reflect.get(actor, "delay")];
            actor.update(live().container);
            check(
                JSON.stringify(frozen) === JSON.stringify([actor.x, actor.y, actor.vy, Reflect.get(actor, "state"), Reflect.get(actor, "delay")]),
                "watch freezes actual enemy update"
            );
            save(Type.name + "-frozen-edge");
            m().weaponsStack.clear();
            check(Number(freezingWatch.lifeTime) === 0 && m().timeFrozen === 0, "watch cancellation after enemy freeze");
            check(localStorage.getItem(GAME_STATE_STORAGE_KEY) !== sentinel, "actual sentinel replaced");
            check(store.hasValidSave(), "Continue accepts capped enemy");
            await restore();
            tick();
            save(Type.name + "-edge-continued");
            // Select a deterministic target through the real loaded caller, retaining RNG draws.
            for (const t of [0, 0.25, 1, 16]) {
                stage(0);
                m().simon!.invincible = 0;
                let seed = 0;
                for (; ; seed++) {
                    const probe = new JavaRandom(seed);
                    probe.nextInt(96);
                    if (Type === Raven ? probe.nextBoolean() : probe.nextInt(5) < 3) break;
                }
                m().random = new JavaRandom(seed);
                const x = Type === Raven ? m().simon!.x + 16 + t : m().simon!.x - 16 - t / 2;
                const selected = new Type(m(), x, 160);
                Object.assign(selected, { state: Type.STATE_HOVERING, delay: 1, spriteIndex: 0 });
                m().regionThingStack.push(selected);
                selected.update(live().container);
                check(Reflect.get(selected, "state") === Type.STATE_FLYING, "loaded target selected");
                check(Number.isFinite(selected.G) && Number.isFinite(selected.vy), "loaded target finite");
                if (t === 0) check(!Reflect.get(selected, "applyingGravity") && selected.G === 0 && selected.vy === 0, "loaded singular fallback");
                save(Type.name + "-target-" + t);
                selected.update(live().container);
                save(Type.name + "-target-flight-" + t);
            }
            stage(0);
            const floor = new Type(m(), 96, 128);
            Object.assign(floor, { state: Type.STATE_FLYING, spriteIndex: 0, applyingGravity: true, targetX: 1000, vy: 32, G: 64 });
            m().regionThingStack.push(floor);
            for (let i = 0; i < 12; i++) floor.update(live().container);
            check(Type === Raven ? floor.supported : floor.y === 303, "loaded platform/boundary stop " + Type.name);
            save(Type.name + "-floor-stop");
            const source = Reflect.get(m(), "stageSegment") as StageSegment;
            const exit = source.stairsEntries.find((e) => e.connection !== null);
            check(exit, "connected loaded stairs");
            m().simon!.x = exit.x;
            m().followStairsToNextSegment();
            check(!m().regionThingStack.things.includes(floor), "enemy retained outside active region");
            save(Type.name + "-retained-history");
            await restore();
            tick();
            save(Type.name + "-retained-continued");
        }
        for (const swap of [false, true]) {
            stage(0);
            m().simon!.invincible = 0;
            m().weaponType = Main.WEAPON_TYPE_STOP_WATCH;
            m().requestSong(m().stage_1_1);
            tick();
            const watch = new StopWatch(m());
            check(watch.lifeTime === 455 && m().timeFrozen === 455, "valid conditional title watch");
            (swap ? m().weaponsStackSwap : m().weaponsStack).push(watch);
            save("title-watch-" + swap);
            m().fadeState = Main.FADE_OUT;
            m().fade = 22;
            m().fadeReason = Main.FADE_REASON_SHOW_TITLE_SCREEN;
            tick();
            check(Number(watch.lifeTime) === 0 && m().timeFrozen === 0, "actual watch discarded at title fade");
            check(m().weaponsStack.top === -1 && m().weaponsStackSwap.top === -1, "both title stacks empty");
            check(m().currentSong === null && m().requestedSong === null, "old song cannot resume");
            save("title-watch-retired-" + swap);
            await restore();
            tick();
            save("title-watch-continued-" + swap);
        }
        stage(0);
        save("numeric-domain-baseline");
        for (const text of ["corrupt", JSON.stringify({ ...JSON.parse(localStorage.getItem(GAME_STATE_STORAGE_KEY)!), version: 26 })]) {
            localStorage.setItem(GAME_STATE_STORAGE_KEY, text);
            check(!store.hasValidSave() && localStorage.getItem(GAME_STATE_STORAGE_KEY) === text, "old/corrupt nonwriting miss");
            save("authorized-replacement");
            check(store.hasValidSave() && localStorage.getItem(GAME_STATE_STORAGE_KEY) !== text, "authorized replacement current slot");
        }
        m().score = 2_147_483_648;
        Reflect.set(m(), "titleBatAngle", 1e20);
        const retained = new Raven(m(), 100, 100);
        Reflect.set(retained, "targetX", 1e20);
        Reflect.set(retained, "spriteIndexIncrementor", -1_000_001);
        m().regionThingStack.push(retained);
        save("relaxed-numeric-domain");
        await restore();
        check(m().score === 2_147_483_648 && Reflect.get(m(), "titleBatAngle") === 1e20, "large values restored exactly");
        tick();
        save("relaxed-numeric-continued");
        // Keep independent fixture groups in separate loaded worlds. Title-watch
        // retirement deliberately leaves ownerless audio completion pending until
        // an outer poll; that history is not part of the following stairs fixtures.
        h.destroyMounted(mounted);
        mounted = null;
        mounted = await h.mountMain(null);
        // Every shipped boss creates the Orb at xMin + 240, y=96. Exercise
        // its unchanged gravity against each loaded boss region's actual walls.
        const bossTypes = new Set(["BatBoss", "MedusaBoss", "MummyBoss", "Frankenstein", "GrimReaper", "Dracula"]);
        const supportedBosses = new Set<string>();
        for (let index = 0; index < 6; index++) {
            stage(index);
            for (const segment of Reflect.get(m(), "stageSegments") as StageSegment[])
                for (const region of segment.regions) {
                    const boss = region.thingStack.things.find((t) => t && bossTypes.has(t.constructor.name));
                    if (!boss) continue;
                    m().walls = segment.walls;
                    m().map = segment.map;
                    m().mapWidth = segment.mapWidth;
                    m().simon!.x = region.min;
                    m().simon!.y = 0;
                    const orb = new Orb(m(), region.min + 240, 96, 0);
                    for (let tick = 0; tick < 2200; tick++) check(orb.update(live().container), "uncollected Orb remains progression-owned");
                    check(orb.supported && orb.y < 352 && orb.vy === 0, `shipped Orb landing ${boss.constructor.name}`);
                    supportedBosses.add(boss.constructor.name);
                }
        }
        check(supportedBosses.size === bossTypes.size, "all six shipped boss Orb columns checked");
        stage(0);
        check(m().visibleWhipCount === 0, "new stage has no active whip upgrades");
        const pickup = new DropItem(m(), m().simon!.x + 96, 160, DropItem.TYPE_WHIP);
        m().regionThingStack.push(pickup);
        m().whipCreated();
        save("whip-before-stairs");
        const sourceSegment = Reflect.get(m(), "stageSegment") as StageSegment;
        const stairs = sourceSegment.stairsEntries.find((e) => e.connection !== null);
        check(stairs?.connection, "loaded connected stairs");
        m().simon!.x = stairs.x;
        m().followStairsToNextSegment();
        check(m().visibleWhipCount === 0, "stairs destination counts its own pickups");
        save("whip-away-stairs");
        const returnEntry = (Reflect.get(m(), "stageSegment") as StageSegment).stairsEntries.find((e) => e.connection?.segment === sourceSegment);
        check(returnEntry, "loaded return stairs");
        m().simon!.x = returnEntry.x;
        m().followStairsToNextSegment();
        check(m().visibleWhipCount === 1, "retained pickup counted on stairs return");
        save("whip-return-stairs");
        await restore();
        check(m().visibleWhipCount === 1, "cold restore preserves retained pickup count");
        m().restoreCheckpoint();
        save("whip-checkpoint-recount");
        for (const boundary of ["collection", "pit", "timeout"]) {
            stage(0);
            const p = new DropItem(m(), m().simon!.x + 96, 160, DropItem.TYPE_WHIP);
            m().regionThingStack.push(p);
            m().whipCreated();
            if (boundary === "collection") {
                p.x = m().simon!.x;
                p.y = m().simon!.y;
            }
            if (boundary === "pit") {
                p.y = 353;
                p.vy = 1;
            }
            if (boundary === "timeout") p.lifeTime = 1;
            tick();
            check(m().visibleWhipCount === 0, "dispatcher retires whip " + boundary);
            save("whip-" + boundary);
            await restore();
            tick();
            save("whip-" + boundary + "-continued");
        }
        stage(0);
        m().requestSong(m().stage_1_2);
        tick();
        m().stopSong();
        save("ownerless-ended-pending");
        await restore();
        check(m().stage_1_2.getIntroForState()!.getTransportState() === "ended-pending", "cold restore preserves ownerless completion before poll");
        const beforeOwnerlessPoll = h.gameplaySnapshot(serializer, m());
        Music.poll(0);
        check(m().stage_1_2.getIntroForState()!.getTransportState() === "stopped", "zero-delta outer poll consumes ownerless completion");
        check(m().currentSong === null && m().requestedSong === null && m().currentMusic === null, "completion does not reacquire an owner");
        check(h.gameplaySnapshot(serializer, m()) === beforeOwnerlessPoll, "ownerless completion poll performs no game tick");
        tick();
        save("ownerless-completion-continued");
        stage(0);
        m().requestSong(m().stage_1_2);
        tick();
        let intro = m().currentSong!.getIntroForState()!;
        check(intro.getTransportState() === "playing", "real intro starts");
        intro.stop();
        check(intro.getTransportState() === "ended-pending", "real completion pending");
        save("intro-ended-pending");
        const goodBytes = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        const previousMusic = m().currentMusic;
        m().currentMusic = intro;
        check(!store.save(m(), () => true).saved, "unexpected Song part as standalone rejected during validation");
        const aliasEvidence = JSON.parse(localStorage.getItem(REJECTED_SAVE_DEBUG_KEY)!);
        check(aliasEvidence.failedStage === "structure-and-graph" && aliasEvidence.snapshotIncluded, "alias reaches diagnostic validation boundary");
        check(localStorage.getItem(GAME_STATE_STORAGE_KEY) === goodBytes, "alias leaves canonical save unchanged");
        m().currentMusic = previousMusic;

        Music.poll(0);
        check(intro.getTransportState() === "stopped", "poll consumes completion");
        Reflect.set(m(), "nextFrameTime", Sys.getTime() + 1000);
        const before = h.gameplaySnapshot(serializer, m());
        m().update(live().container, 0);
        check(h.gameplaySnapshot(serializer, m()) === before, "zero inner Main ticks");
        save("intro-consumed-zero-inner-ticks");
        await restore();
        intro = m().currentSong!.getIntroForState()!;
        const loop = m().currentSong!.getLoopForState()!;
        check(intro.getTransportState() === "stopped" && loop.getTransportState() === "stopped", "faithful silent gap restore");
        let starts = 0;
        const original = loop.loop;
        loop.loop = function (pitch?: number, volume?: number) {
            starts++;
            if (pitch === undefined || volume === undefined) original.call(this, 1, 1);
            else original.call(this, pitch, volume);
        };
        tick();
        tick();
        check(starts === 1 && intro.getTransportState() === "stopped", "one loop start and no intro replay");
        loop.loop = original;
        save("intro-loop-running");

        m().weaponType = Main.WEAPON_TYPE_STOP_WATCH;
        m().weaponRepeats = Main.WEAPON_REPEATS_SINGLE;
        const watch = new StopWatch(m());
        m().weaponsStack.push(watch);
        tick();
        check(loop.getTransportState() === "paused", "watch pauses old song");
        m().requestSong(m().stage_1_1);
        m().weaponsStack.clear();
        check(m().timeFrozen === 0 && loop.getTransportState() === "paused", "final watch cancellation retains paused old song");
        save("pending-replacement-old-paused");
        await restore();
        check(m().currentSong!.getLoopForState()!.getTransportState() === "paused", "old song remains silent through restore");
        tick();
        check(m().currentSong === m().stage_1_1 && m().currentSong!.getLoopForState()!.getTransportState() === "playing", "normal tick promotes replacement");
        save("replacement-promoted");
        const expiring = new StopWatch(m());
        m().weaponsStack.push(expiring);
        while (expiring.lifeTime > 1) expiring.update(live().container);
        m().requestSong(m().stage_1_2);
        expiring.update(live().container);
        check(m().timeFrozen === 0 && m().currentSong!.getLoopForState()!.getTransportState() === "paused", "final expiry publishes paused replacement");
        save("pending-replacement-watch-expired");
        await restore();
        check(m().currentSong!.getLoopForState()!.getTransportState() === "paused", "expired watch restore remains silent");
        tick();
        save("expired-watch-replacement-promoted");
        const canonical = localStorage.getItem(GAME_STATE_STORAGE_KEY);
        const rejectedActor = new WhiteSkeleton(m(), 100, 100);
        rejectedActor.vy = 513;
        m().regionThingStack.push(rejectedActor);
        const diagnosticStart = performance.now();
        check(!store.save(m(), () => true).saved, "real captured numeric failure rejected");
        const diagnosticMilliseconds = performance.now() - diagnosticStart;
        check(localStorage.getItem(GAME_STATE_STORAGE_KEY) === canonical, "real diagnostic preserves canonical bytes");
        const diagnostic = JSON.parse(localStorage.getItem(REJECTED_SAVE_DEBUG_KEY)!);
        check(diagnostic.failedStage === "values-and-audio" && diagnostic.snapshotIncluded, "real rejected capture retained exactly");
        check(
            diagnostic.snapshot.things.some((t: { fields: { vy: number } }) => t.fields.vy === 513),
            "exact rejected velocity retained"
        );
        Reflect.set(window, "savePitDiagnosticTiming", { diagnosticMilliseconds, characters: localStorage.getItem(REJECTED_SAVE_DEBUG_KEY)!.length });

        for (const Actor of [WhiteSkeleton, Dog]) {
            stage(5);
            m().requestSong(m().stage_6_1);
            tick();
            // Below the shipped floor: actual unsupported gravity, no physics stub.
            const actor = new Actor(m(), m().simon!.x + 96, 330);
            if (actor instanceof Dog) Reflect.set(actor, "state", 2);
            m().regionThingStack.push(actor);
            let retired = false;
            for (let i = 0; i < 2200; i++) {
                tick();
                const active = [m().regionThingStack, m().regionStackSwap].some((stack) => stack.things.slice(0, stack.top + 1).includes(actor));
                if (!active) retired = true;
                if (retired) check(!active, "retired pit actor never reactivated");
                if (i === 100 || i === 2199) save(`${Actor.name}-pit-history-${i}`);
            }
            check(retired && actor.y < 400, `${Actor.name} ordinary dispatcher retirement`);
            await restore();
            tick();
            save(`${Actor.name}-pit-cold-continuation`);
        }
        stage(0);
        m().requestSong(m().stage_1_1);
        tick();
        const knight = new AxeKnight(m(), 240, 352);
        knight.vy = 1;
        Reflect.set(knight, "hasAxe", false);
        const axe = new BoomerangAxe(m(), 240, 160, Main.RIGHT, knight);
        const boomerang = new Boomerang(m(), 240, 352, Main.RIGHT);
        check(boomerang.reflectFromAxeKnight(knight, -1), "real reflected lock");
        m().regionThingStack.push(knight);
        m().regionThingStack.push(axe);
        m().weaponsStack.push(boomerang);
        // Run the actor boundary before weapon dispatch to capture the finite
        // dead-owner graph, then let ordinary weapon processing release its lock.
        check(!knight.update(live().container) && knight.dead, "pit knight terminal");
        const active = m()
            .regionThingStack.things.slice(0, m().regionThingStack.top + 1)
            .filter((t) => t !== knight);
        m().regionThingStack.clear();
        for (const actor of active) m().regionThingStack.push(actor!);
        save("pit-knight-dead-owner-reflected-lock");
        await restore();
        const restoredAxe = m().regionThingStack.things.find((t) => t instanceof BoomerangAxe);
        check(restoredAxe instanceof BoomerangAxe, "in-flight axe restored");
        const owner = Reflect.get(restoredAxe, "axeKnight") as AxeKnight;
        check(owner.dead, "retained typed owner dead after restore");
        const random = JSON.stringify(m().random.getState());
        const delay = Reflect.get(owner, "throwDelay");
        owner.axeGone();
        check(JSON.stringify(m().random.getState()) === random && Reflect.get(owner, "throwDelay") === delay, "late callback consumes no RNG or cooldown");
        tick();
        const restoredBoomerang = m().weaponsStack.things.find((t) => t instanceof Boomerang);
        check(!(restoredBoomerang instanceof Boomerang) || restoredBoomerang.shieldBlockedBy === null, "normal dispatch clears dead shield owner");
        for (let i = 0; i < 700; i++) tick();
        check(
            !m()
                .regionThingStack.things.slice(0, m().regionThingStack.top + 1)
                .includes(restoredAxe),
            "finite in-flight axe retires"
        );
        check(owner.dead && Reflect.get(owner, "throwDelay") === delay, "completion never resurrects owner");
        save("pit-knight-projectile-complete");

        stage(2);
        const floorSegment = (Reflect.get(m(), "stageSegments") as StageSegment[])[2];
        Reflect.set(m(), "checkpoint", floorSegment.regions.find((region) => region.checkpoint !== null)!.checkpoint);
        m().restoreCheckpoint();
        m().fade = 0;
        m().fadeState = Main.FADE_DONE;
        m().time = 3;
        m().hearts = 2;
        m().beatStage();
        check(m().currentMusic === m().stage_cleared, "real stage-three clear cue");
        save("stage-three-clear-cue");
        m().stage_cleared.stop();
        Music.poll(0);
        save("stage-three-clear-cue-stopped");
        await restore();
        let floor = false;
        let outgoing = false;
        for (let i = 0; i < 2500 && m().mode !== Main.MODE_MAP; i++) {
            tick();
            check(store.save(m(), () => true).saved, `every stage-three published tick ${i}`);
            check(
                m().simon!.G === Main.PLAYER_CONTROLLED_GRAVITY && m().simon!.jumpVelocity === Main.PLAYER_CONTROLLED_JUMP_VELOCITY,
                "Stage 3 tally/floor/fade keeps gameplay profile"
            );
            if (m().floorBreaking) check(m().time === 0, "Stage 3 floor keeps TIME zero");
            if (m().floorBreaking && !floor) {
                floor = true;
                save("stage-three-real-floor-constructor");
                m().weaponType = Main.WEAPON_TYPE_STOP_WATCH;
                m().hearts = 5;
                m().throwWeapon();
                check(m().timeFrozen === 455, "real Stage 3 floor permits Watch");
                save("stage-three-floor-watch");
                await restore();
            }
            if (m().fadeState === Main.FADE_OUT && !outgoing) {
                outgoing = true;
                save("stage-three-floor-terminal-fade");
                await restore();
            }
        }
        check(floor && outgoing && m().mode === Main.MODE_MAP, "actual tally floor map sequence");
        save("stage-three-map");

        for (const stageIndex of [0, 1, 5]) {
            stage(stageIndex);
            if (stageIndex === 5) {
                const skeleton = new WhiteSkeleton(m(), m().simon!.x + 96, 330);
                m().regionThingStack.push(skeleton);
                for (let i = 0; i < 2200; i++) tick();
                check(skeleton.y < 400, "earlier same-stage pit retired");
                save("stage-six-earlier-pit");
            }
            const routes: Array<{ segment: number; region: number; x: number; direction: number }> = [];
            (Reflect.get(m(), "stageSegments") as StageSegment[]).forEach((segment, segmentIndex) =>
                segment.regions.forEach((region, regionIndex) => {
                    for (const thing of region.thingStack.things.slice(0, region.thingStack.top + 1)) {
                        if (thing instanceof Door && thing.active)
                            routes.push({ segment: segmentIndex, region: regionIndex, x: thing.x, direction: thing.direction });
                    }
                })
            );
            check(routes.length > 0, "shipped doors discovered");
            for (const route of routes) {
                const cp = (Reflect.get(m(), "stageSegments") as StageSegment[])[route.segment].regions[route.region].checkpoint;
                if (cp !== null) {
                    Reflect.set(m(), "checkpoint", cp);
                    m().restoreCheckpoint();
                } else {
                    for (let hop = 0; (Reflect.get(m(), "stageSegment") as StageSegment).stageSegmentIndex !== route.segment && hop < 5; hop++) {
                        const current = Reflect.get(m(), "stageSegment") as StageSegment;
                        const entry = current.stairsEntries.find((e) => e.connection && e.connection.segment.stageSegmentIndex > current.stageSegmentIndex);
                        check(entry?.connection, "shipped staircase into door segment");
                        m().simon!.x = entry.x;
                        m().followStairsToNextSegment();
                    }
                    check((Reflect.get(m(), "stageSegment") as StageSegment).regionIndex === route.region, "stairs establish door source region");
                }
                m().fadeState = Main.FADE_DONE;
                m().fade = 0;
                const door = m()
                    .regionThingStack.things.slice(0, m().regionThingStack.top + 1)
                    .find((t) => t instanceof Door && t.x === route.x && t.direction === route.direction);
                check(door instanceof Door, "loaded door root");
                if ((stageIndex === 1 && route.segment === 2) || (stageIndex === 5 && route.segment === 1)) {
                    m().requestSong(m().boss_1);
                    tick();
                    m().weaponType = Main.WEAPON_TYPE_STOP_WATCH;
                    m().weaponRepeats = Main.WEAPON_REPEATS_SINGLE;
                    m().weaponsStack.push(new StopWatch(m()));
                    check(m().timeFrozen > 0 && m().currentSong!.getIntroForState()!.getTransportState() === "paused", "door source watch holds old song");
                }
                Object.assign(m().simon!, {
                    x: door.x - 24,
                    y: door.y + 32,
                    lastX: door.x - 24,
                    lastY: door.y + 32,
                    onStairs: false,
                    supported: true,
                    invincible: 1000
                });
                if (stageIndex === 0 && route === routes[0]) {
                    const pickup = new DropItem(m(), door.x - 128, 160, DropItem.TYPE_WHIP);
                    m().regionThingStack.push(pickup);
                    m().whipCreated();
                    check(m().visibleWhipCount === 1, "source pickup live at same-tick door entry");
                }
                const label = `door-${stageIndex}-${route.segment}-${route.region}-${route.direction}`;
                save(`${label}-before`);
                tick();
                check(m().door !== null, `actual door collision ${label}`);
                const destination = (Reflect.get(m(), "stageSegment") as StageSegment).regions[(Reflect.get(m(), "stageSegment") as StageSegment).regionIndex];
                check(m().platforms === destination.platforms, "destination platform root committed");
                const destinationWhips = [m().regionThingStack, m().regionStackSwap]
                    .flatMap((stack) => stack.things.slice(0, stack.top + 1))
                    .filter((t) => t instanceof DropItem && t.type === DropItem.TYPE_WHIP).length;
                check(m().visibleWhipCount === destinationWhips, "same-tick Door destination pickup authority");
                const sourcePlatforms = (Reflect.get(m(), "stageSegment") as StageSegment).regions[route.region]!.platforms;
                check(Reflect.get(m(), "getPresentationPlatforms").call(m()) === sourcePlatforms, "door presents source platforms");
                let draws = 0;
                const originals = sourcePlatforms.map((p) => p.render);
                sourcePlatforms.forEach((p, i) => {
                    p.render = function (gc, g) {
                        draws++;
                        originals[i]!.call(this, gc, g);
                    };
                });
                try {
                    m().render(live().container, live().container.getGraphics());
                } finally {
                    sourcePlatforms.forEach((p, i) => (p.render = originals[i]!));
                }
                check(draws === sourcePlatforms.length, "actual Main render draws all source platforms");
                save(`${label}-entry`);
                await restore();
                let phase = -1;
                for (let i = 0; i < 700 && m().door !== null; i++) {
                    const next = m().door!.state;
                    if (next !== phase) {
                        phase = next;
                        save(`${label}-phase-${phase}`);
                        await restore();
                    }
                    tick();
                }
                check(m().door === null, `door completed ${label}`);
                save(`${label}-complete`);
                tick();
                save(`${label}-next-tick`);
            }
            if (stageIndex === 5) {
                // Select the shipped boss checkpoint while retaining this stage's
                // earlier pit/door history; final damage uses real whip geometry.
                let bossRoute: { segment: number; region: number } | null = null;
                (Reflect.get(m(), "stageSegments") as StageSegment[]).forEach((segment, si) =>
                    segment.regions.forEach((region, ri) => {
                        if (region.thingStack.things.some((t) => t instanceof Dracula)) bossRoute = { segment: si, region: ri };
                    })
                );
                check(bossRoute, "shipped Dracula route");
                const route = bossRoute as { segment: number; region: number };
                const bossSegment = (Reflect.get(m(), "stageSegments") as StageSegment[])[route.segment];
                for (let hop = 0; Reflect.get(m(), "stageSegment") !== bossSegment && hop < 5; hop++) {
                    const current = Reflect.get(m(), "stageSegment") as StageSegment;
                    const entry = current.stairsEntries.find((e) => e.connection && e.connection.segment.stageSegmentIndex > current.stageSegmentIndex);
                    check(entry?.connection, "linked forward staircase to boss");
                    m().simon!.x = entry.x;
                    m().followStairsToNextSegment();
                    save(`stage-six-boss-stair-${hop}`);
                }
                check(Reflect.get(m(), "stageSegment") === bossSegment, "actual final stairs reach boss segment");
                m().fadeState = Main.FADE_DONE;
                m().fade = 0;
                m().simon!.onStairs = false;
                const boss = m().regionThingStack.things.find((t) => t instanceof Dracula);
                check(boss instanceof Dracula, "active Dracula");
                Reflect.set(boss, "hits", 1);
                Reflect.set(boss, "state", Dracula.STATE_FIRING);
                Reflect.set(boss, "firingDelay", 10);
                Reflect.set(boss, "stunned", 0);
                Object.assign(m().simon!, {
                    x: boss.x - 64,
                    y: boss.y - 32,
                    direction: Main.RIGHT,
                    whipping: true,
                    whipIndex: 2,
                    whipIncrementor: 21,
                    whipType: 2,
                    invincible: 1000
                });
                boss.update(live().container);
                check(Reflect.get(boss, "hits") === 0, "actual Dracula final whip hit");
                save("dracula-final-hit");
                let cue = false;
                for (let i = 0; i < 2000; i++) {
                    tick();
                    if (m().currentMusic === m().dracula_dead && !cue) {
                        cue = true;
                        save("dracula-death-cue");
                        await restore();
                    }
                    const orb = m()
                        .regionThingStack.things.slice(0, m().regionThingStack.top + 1)
                        .find((t) => t instanceof Orb);
                    if (orb instanceof Orb) {
                        save("dracula-hidden-orb");
                        break;
                    }
                }
                check(cue, "real death branch requested death cue");
                let orb = m().regionThingStack.things.find((t) => t instanceof Orb);
                check(orb instanceof Orb, "real death creates Orb");
                while (orb.appearDelay > 0 || orb.fadeIn < 91) tick();
                save("dracula-visible-orb");
                m().weaponType = Main.WEAPON_TYPE_STOP_WATCH;
                m().hearts = 5;
                m().throwWeapon();
                check(m().timeFrozen === 455, "visible final Orb permits Watch");
                save("dracula-visible-orb-watch");
                await restore();
                orb = m().regionThingStack.things.find((t) => t instanceof Orb);
                check(orb instanceof Orb, "restored visible Orb");
                Object.assign(m().simon!, { x: orb.x, y: orb.y, hurt: false, dead: 0 });
                tick();
                check(m().beatStageFlag, "real Orb collection");
                save("dracula-orb-pending-ending");
                await restore();
                let castle = false;
                for (let i = 0; i < 10000 && m().mode !== Main.MODE_CREDITS; i++) {
                    tick();
                    if (m().mode === Main.MODE_CASTLE_FALLS && !castle) {
                        castle = true;
                        save("dracula-castle");
                        await restore();
                    }
                }
                check(castle && m().mode === Main.MODE_CREDITS, "real tally castle credits progression");
                save("dracula-credits");
            }
        }
        verifyAuthority(records);
        Reflect.set(window, "savePitEvidence", records);
    } finally {
        h.destroyMounted(mounted);
    }
}
