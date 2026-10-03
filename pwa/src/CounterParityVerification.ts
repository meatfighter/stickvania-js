import { isReasonableStickvaniaGameStateSnapshot } from "./stickvania/persistence/GameStateSanity.js";
import { Door } from "./stickvania/Door.js";
import type { StageSegment } from "./stickvania/StageSegment.js";
import { StopWatch } from "./stickvania/StopWatch.js";
import { Bat } from "./stickvania/Bat.js";
import { MedusaHead } from "./stickvania/MedusaHead.js";
import { Dog } from "./stickvania/Dog.js";
import { PROVEN_MAIN_INTEGER_RANGES, PROVEN_THING_INTEGER_RANGES } from "./stickvania/persistence/StateFieldValuePolicy.js";
import { type AppGameContainer } from "slick2d-ts";
import { Main } from "./stickvania/Main.js";
import { type StickvaniaBufferedGame } from "./stickvania/StickvaniaBufferedGame.js";
import { StickvaniaGameStateSerializer } from "./stickvania/persistence/StickvaniaGameStateSerializer.js";
import { StickvaniaGameStateStore } from "./stickvania/persistence/StickvaniaGameStateStore.js";
import { GAME_STATE_STORAGE_KEY } from "./stickvania/persistence/GameStateSchema.js";

type Mounted = { main: Main; container: AppGameContainer; buffered: StickvaniaBufferedGame };
type Harness = {
    mountMain(restore: ((main: Main, container: AppGameContainer) => boolean) | null): Promise<Mounted>;
    destroyMounted(mounted: Mounted | null): void;
    advanceFrames(mounted: Mounted, count: number): void;
    gameplaySnapshot(serializer: StickvaniaGameStateSerializer, main: Main): string;
};
function assert(value: unknown, label: string): asserts value {
    if (!value) throw new Error(label);
}

/** Loaded resources and the real Java-parity frame dispatcher; no replacement gameplay algorithms. */
export async function verifyCounterParity(h: Harness): Promise<void> {
    const serializer = new StickvaniaGameStateSerializer();
    const store = new StickvaniaGameStateStore("counter-parity");
    const cases: string[] = [];
    const times: number[] = [];
    let mounted: Mounted | null = await h.mountMain(null);
    const current = (): Mounted => {
        assert(mounted, "Mounted counter fixture");
        return mounted;
    };
    const beginCredits = (): void => {
        const main = current().main;
        main.stopAllSounds();
        main.requestSong(main.ending);
        main.currentSong = main.ending;
        main.currentMusic = null;
        main.ending.play();
        main.initCredits();
        main.fadeState = Main.FADE_IN;
        main.fade = 22;
        main.fadeReason = Main.FADE_REASON_SHOW_CREDITS;
    };
    const tick = (n = 1): void => h.advanceFrames(current(), n);
    const field = (name: string): number => Number(Reflect.get(current().main, name));
    const render = (): void => {
        const m = current();
        m.main.render(m.container, m.container.getGraphics());
    };
    const check = (label: string): void => {
        const m = current();
        const snapshot = serializer.createSnapshot(m.main, "counter-parity");
        const start = performance.now();
        assert(serializer.isSupportedSnapshot(snapshot), `${label}: integrated snapshot rejected`);
        times.push(performance.now() - start);
        assert(isReasonableStickvaniaGameStateSnapshot(snapshot), `${label}: outer sanity rejected`);
        assert(serializer.isSupportedSnapshotForLoadedResources(m.main, snapshot), `${label}: loaded resources rejected`);
        assert(store.save(m.main, () => true).saved && store.hasValidSave(), `${label}: real store rejected`);
        render();
        cases.push(label);
    };
    const roundtrip = async (label: string): Promise<void> => {
        check(label);
        const saved = localStorage.getItem(GAME_STATE_STORAGE_KEY)!;
        const before = h.gameplaySnapshot(serializer, current().main);
        const savedDifficulty = current().main.difficulty;
        if (current().main.mode === Main.MODE_DEMO || current().main.mode === Main.MODE_CREDITS) {
            const main = current().main;
            assert(main.difficulty === Main.DIFFICULTY_HARD, `${label}: recorded selected difficulty retained`);
            assert(main.simon!.G === Main.GRAVITY && main.simon!.jumpVelocity === Main.SIMON_JUMP_VELOCITY, `${label}: recorded legacy physics`);
            assert(main.adjustEnemyHits(3) === 3 && main.adjustSimonDamage(2) === 2, `${label}: recorded baseline balance`);
        }
        tick(4);
        const after = h.gameplaySnapshot(serializer, current().main);
        h.destroyMounted(mounted);
        mounted = null;
        mounted = await h.mountMain((main, gc) => {
            // Fresh menu preference must not replace the saved run's selection.
            main.difficulty = savedDifficulty === Main.DIFFICULTY_HARD ? Main.DIFFICULTY_NORMAL : Main.DIFFICULTY_HARD;
            return store.restore(main, gc);
        });
        assert(current().main.difficulty === savedDifficulty, `${label}: saved difficulty lost`);
        assert(
            h.gameplaySnapshot(serializer, current().main) === before,
            `${label}: fresh graph differs before render ${firstDifference(JSON.parse(before), JSON.parse(h.gameplaySnapshot(serializer, current().main)))}`
        );
        render();
        assert(h.gameplaySnapshot(serializer, current().main) === before, `${label}: first loaded render mutated state`);
        check(label + ":restored-save");
        tick(4);
        assert(h.gameplaySnapshot(serializer, current().main) === after, `${label}: fresh continuation differs`);
        // Rewind only the test checkpoint, after retiring the control graph.
        localStorage.setItem(GAME_STATE_STORAGE_KEY, saved);
        assert(store.restore(current().main, current().container), `${label}: checkpoint restore`);
    };
    const reject = (label: string, mutate: (snapshot: ReturnType<StickvaniaGameStateSerializer["createSnapshot"]>) => void): void => {
        const snapshot = serializer.createSnapshot(current().main, "counter-parity");
        mutate(snapshot);
        const raw = JSON.stringify(snapshot);
        localStorage.setItem(GAME_STATE_STORAGE_KEY, raw);
        const before = h.gameplaySnapshot(serializer, current().main),
            mapping = JSON.stringify(current().main.buttonMapping);
        for (let i = 0; i < 2; i++) {
            assert(!store.hasValidSave() && !store.restore(current().main, current().container), `${label}: invalid accepted`);
            assert(
                localStorage.getItem(GAME_STATE_STORAGE_KEY) === raw &&
                    h.gameplaySnapshot(serializer, current().main) === before &&
                    JSON.stringify(current().main.buttonMapping) === mapping,
                `${label}: invalid read modified state`
            );
        }
        assert(store.save(current().main, () => true).saved, `${label}: authorized overwrite`);
        cases.push(`reject:${label}`);
    };
    const verifyMainPresentationDomains = async (): Promise<void> => {
        current().main.initTitleScreen();
        current().main.fadeState = Main.FADE_DONE;
        current().main.fade = 0;
        await roundtrip("presentation:title:entry");
        const titleSprites = new Set<number>();
        let titleWrap = false;
        let previous = field("titleBatSpriteIndexIncrementor");
        for (let i = 0; i < 500; i++) {
            tick();
            assert(current().main.mode === Main.MODE_TITLE_SCREEN, "Title control must not exit early");
            const index = field("titleBatSpriteIndex");
            const increment = field("titleBatSpriteIndexIncrementor");
            if (!titleSprites.has(index)) {
                titleSprites.add(index);
                await roundtrip(`presentation:title:sprite:${index}`);
            }
            if (!titleWrap && previous === 8 && increment === 0) {
                titleWrap = true;
                await roundtrip("presentation:title:wrap");
            }
            previous = increment;
        }
        assert(titleSprites.size === 4 && titleWrap && field("titleBatSteps") === 273, "Title complete phase manifest");
        await roundtrip("presentation:title:steps273");
        reject("presentation:title:index999", (s) => {
            s.mainFields.titleBatSpriteIndex = 999;
        });
        reject("presentation:title:demoIndex3", (s) => {
            s.mainFields.demoIndex = 3;
        });

        // Actual title timeout/fade dispatch consumes the globally bounded demoIndex.
        current().main.demoIndex = 2;
        for (const expected of [0, 1, 2]) {
            current().main.initTitleScreen();
            current().main.fadeState = Main.FADE_DONE;
            current().main.fade = 0;
            for (let frame = 0; frame < 1600 && current().main.mode === Main.MODE_TITLE_SCREEN; frame++) tick();
            assert(current().main.mode === Main.MODE_DEMO && current().main.demoIndex === expected, "Real TITLE-to-DEMO rotation");
            await roundtrip(`presentation:title-to-demo:${expected}`);
        }
        current().main.initIntro();
        for (const [name, bounds] of Object.entries(PROVEN_MAIN_INTEGER_RANGES)) {
            assert(bounds, "Declared Main bounds");
            const [lo, hi] = bounds;
            for (const value of [lo - 1, hi + 1, 0.5])
                reject(`presentation:${name}:${value}`, (s) => {
                    s.mainFields[name] = value;
                });
        }
        current().main.fadeState = Main.FADE_IN;
        current().main.fade = 22;
        await roundtrip("presentation:intro:entry");
        const walk = new Set<number>();
        const bats = new Set<number>();
        let walkWrap = false;
        let batWrap = false;
        let lastWalk = field("introWalkSpriteIndexIncrementor");
        let lastBat = field("gateBatSpriteIndexIncrementor");
        let count = 0;
        while (current().main.mode === Main.MODE_INTRO) {
            tick();
            assert(++count < 1000, "Intro must finish through real fade/checkpoint dispatch");
            if (current().main.mode !== Main.MODE_INTRO) break;
            walk.add(field("introWalkSpriteIndex"));
            bats.add(field("gateBatSpriteIndex"));
            const w = field("introWalkSpriteIndexIncrementor");
            const b = field("gateBatSpriteIndexIncrementor");
            if (!walkWrap && lastWalk === 15 && w === 0) {
                walkWrap = true;
                await roundtrip("presentation:intro:walk-wrap");
            }
            if (!batWrap && lastBat === 9 && b === 0) {
                batWrap = true;
                await roundtrip("presentation:intro:bat-wrap");
            }
            lastWalk = w;
            lastBat = b;
        }
        assert(walk.size === 4 && bats.size === 2 && walkWrap && batWrap, "Intro sprite/wrap manifest");
        assert(current().main.mode === Main.MODE_PLAYING, "Intro reaches actual gameplay");
        await roundtrip("presentation:intro:next-gameplay");
    };
    const verifyClockDispatch = async (): Promise<void> => {
        for (const activeMode of [Main.MODE_PLAYING, Main.MODE_DEMO])
            for (const start of [0, 1, 89, 90])
                for (const branch of ["normal", "dead", "floor", "frozen", "fade", "flashing", "door", "last-death"]) {
                    h.destroyMounted(mounted);
                    mounted = null;
                    mounted = await h.mountMain(null);
                    const main = current().main;
                    if (activeMode === Main.MODE_DEMO) main.initDemo();
                    else {
                        main.createStageForStateRestore(branch === "floor" ? 2 : 0);
                        main.mode = Main.MODE_PLAYING;
                    }
                    main.fadeState = Main.FADE_DONE;
                    main.fade = 0;
                    main.floorBreaking = false;
                    main.players = 3;
                    assert(main.simon, "Clock dispatcher Simon");
                    main.simon.flashing = 0;
                    tick();
                    if (branch === "dead" || branch === "last-death") {
                        main.hurtSimon(16);
                        main.simon.flashing = 0;
                    }
                    if (branch === "last-death") main.simon.dead = 473;
                    if (branch === "floor") main.floorBreaking = true;
                    if (branch === "frozen") {
                        main.weaponType = Main.WEAPON_TYPE_STOP_WATCH;
                        main.weaponRepeats = Main.WEAPON_REPEATS_SINGLE;
                        const watch = new StopWatch(main);
                        main.weaponsStack.push(watch);
                        assert(main.timeFrozen > 0, "Real watch active");
                    }
                    if (branch === "fade") {
                        main.fadeState = Main.FADE_IN;
                        main.fade = 10;
                    }
                    if (branch === "flashing") main.simon.flashing = 10;
                    if (branch === "door") {
                        const region = (Reflect.get(main, "stageSegments") as StageSegment[])
                            .flatMap((segment) => segment.regions)
                            .find((region) => region.checkpoint !== null && region.thingStack.things.some((thing) => thing instanceof Door && thing.active));
                        assert(region?.checkpoint, "Loaded Door source checkpoint");
                        Reflect.set(main, "checkpoint", region.checkpoint);
                        main.restoreCheckpoint();
                        main.fadeState = Main.FADE_DONE;
                        main.fade = 0;
                        const door = main.regionThingStack.things
                            .slice(0, main.regionThingStack.top + 1)
                            .find((thing) => thing instanceof Door && thing.active);
                        assert(door instanceof Door, "Loaded active Door");
                        Object.assign(main.simon, {
                            x: door.x - 24,
                            y: door.y + 32,
                            lastX: door.x - 24,
                            lastY: door.y + 32,
                            onStairs: false,
                            supported: true,
                            invincible: 1000
                        });
                        tick();
                        assert(main.door === door && door.state === Door.STATE_SCROLL_1, "Real Door entry commits destination and source history");
                    }
                    main.timeIncrementor = start;
                    tick(); // Includes input preflight and Main's consuming expression atomically.
                    const expected = branch === "normal" ? (start === 90 ? 0 : start + 1) : start;
                    assert(main.timeIncrementor === expected, `clock dispatcher:${activeMode}:${branch}:${start}`);
                    const label = `dispatch:${activeMode}:${branch}:${start}`;
                    check(label);
                    if (start === 90) await roundtrip(label + ":restore");
                }
    };
    const verifyModeRestore = async (): Promise<void> => {
        for (const difficulty of [Main.DIFFICULTY_NORMAL, Main.DIFFICULTY_HARD]) {
            const prepare = (): void => {
                const main = current().main;
                main.stopAllSounds();
                main.mode = Main.MODE_PLAYING;
                main.difficulty = difficulty;
                main.createStageForStateRestore(0);
                Object.assign(main, { fadeState: Main.FADE_DONE, fade: 0, playerPower: 16, time: 300, timeIncrementor: 0, players: 3 });
                main.syncSimonPhysicsProfile();
                for (let i = 0; i < 300 && !current().main.simon!.supported; i++) tick();
                assert(current().main.simon!.supported, "Loaded starting floor reached");
                current().main.simon!.invincible = 0;
            };
            prepare();
            current().main.hurtSimon(16);
            await roundtrip(`mode:${difficulty}:fatal-hit`);
            tick(5);
            await roundtrip(`mode:${difficulty}:mid-knockback`);
            for (let i = 0; i < 300 && current().main.simon!.dead === 0; i++) tick();
            assert(current().main.simon!.dead > 0, "Fatal knockback reaches grounded death");
            await roundtrip(`mode:${difficulty}:grounded-death`);
            prepare();
            current().main.hurtSimon(2);
            current().main.time = 0;
            tick();
            assert(current().main.playerPower === 0, "Loaded hurt trajectory becomes lethal at TIME zero");
            await roundtrip(`mode:${difficulty}:timeout-while-hurt`);
            current().main.restoreCheckpoint();
            await roundtrip(`mode:${difficulty}:checkpoint`);
        }
    };
    try {
        await verifyModeRestore();
        current().main.difficulty = Main.DIFFICULTY_HARD;
        await verifyMainPresentationDomains();
        await verifyClockDispatch();
        for (const stage of [0, 3])
            for (const players of [0, 1, 98, 99]) {
                const main = current().main;
                main.createStageForStateRestore(stage);
                main.mode = Main.MODE_PLAYING;
                main.players = players;
                main.fade = 22;
                main.fadeState = Main.FADE_IN;
                main.initMapScreen();
                assert(main.players === players + 1, "MAP compensating increment");
                await roundtrip(`MAP:${stage}:${players}:entrance`);
                reject("MAP101", (s) => {
                    s.mainFields.players = 101;
                });
                const walkImages = new Set<number>(),
                    batImages = new Set<number>();
                let walkWrap = false,
                    batWrap = false,
                    lastWalk = field("introWalkSpriteIndexIncrementor"),
                    lastBat = field("gateBatSpriteIndexIncrementor");
                let animation = false,
                    wait = false,
                    exit = false;
                for (let frame = 0; frame < 3000 && current().main.mode === Main.MODE_MAP; frame++) {
                    tick();
                    walkImages.add(field("introWalkSpriteIndex"));
                    batImages.add(field("gateBatSpriteIndex"));
                    const w = field("introWalkSpriteIndexIncrementor"),
                        b = field("gateBatSpriteIndexIncrementor");
                    walkWrap ||= lastWalk === 15 && w === 0;
                    batWrap ||= lastBat === 9 && b === 0;
                    lastWalk = w;
                    lastBat = b;
                    if (!animation && field("introSimonX") > 256) {
                        animation = true;
                        check(`MAP:${stage}:${players}:animation`);
                    }
                    if (!wait && field("introSimonX") === 576) {
                        wait = true;
                        await roundtrip(`MAP:${stage}:${players}:wait`);
                    }
                    if (!exit && current().main.fadeState === Main.FADE_OUT) {
                        exit = true;
                        check(`MAP:${stage}:${players}:exit`);
                    }
                }
                assert(walkImages.size === 4 && batImages.size === 2 && walkWrap && batWrap, "MAP presentation phase manifest");
                cases.push(`presentation:MAP:${stage}:${players}:wraps`);
                assert(animation && wait && exit && current().main.mode === Main.MODE_PLAYING, "MAP phase coverage and actual handoff");
                assert(current().main.players === players && current().main.stageIndex === stage + 1, "MAP must preserve effective lives");
                await roundtrip(`MAP:${stage}:${players}:next-stage`);
                reject("PLAYING100", (s) => {
                    s.mainFields.players = 100;
                });
                reject("checkpoint-target", (s) => {
                    assert(s.stage, "Stage");
                    const target = s.things.find((t) => t.id === s.stage!.checkpoint);
                    assert(target, "Checkpoint");
                    target.fields.stageSegmentIndex = 99;
                });
            }
        for (const blocked of ["dead", "floor"]) {
            const main = current().main;
            main.createStageForStateRestore(blocked === "floor" ? 2 : 0);
            main.mode = Main.MODE_PLAYING;
            main.fadeState = Main.FADE_DONE;
            main.fade = 0;
            main.players = 3;
            if (blocked === "dead") main.hurtSimon(16);
            else main.floorBreaking = true;
            assert(main.simon, "Clock Simon");
            main.simon.flashing = 0;
            main.timeIncrementor = 90;
            const time = main.time;
            tick(2);
            // PlayerActionPolicy compensates Main's historical ++ in PLAYING.
            assert(main.timeIncrementor === 90 && main.time === time, `${blocked}: existing input preflight freezes clock`);
            check(`clock:${blocked}:preflight-compensation`);
            await roundtrip(`clock:${blocked}:retained-90`);
            reject(`clock:${blocked}:invalid-active-92`, (s) => {
                s.mainFields.timeIncrementor = 92;
            });
            if (blocked === "dead") {
                for (let i = 0; i < 700 && current().main.playerPower === 0; i++) tick();
                assert(current().main.playerPower === 16 && current().main.players === 2, "Actual respawn completes");
                assert(current().main.timeIncrementor === 0, "Simon.reset resets post-death clock");
                await roundtrip("clock:respawn-reset");
            }
        }
        {
            const main = current().main;
            beginCredits();
            main.fadeState = Main.FADE_DONE;
            main.fade = 0;
            main.hurtSimon(16);
            main.timeIncrementor = 90;
            const time = main.time;
            tick();
            assert(main.timeIncrementor === 91 && main.time === time, "Credits bypasses input countdown compensation: 91");
            tick();
            assert(Number(main.timeIncrementor) === 92 && main.time === time, "Credits clock: 92");
            await roundtrip("clock:credits-death:92");
            current().main.initTitleScreen();
            current().main.fadeState = Main.FADE_DONE;
            current().main.fade = 0;
            assert(current().main.timeIncrementor === 92, "Title retains the inactive credits clock");
            await roundtrip("clock:post-credits-title:92");
            current().main.initDemo();
            assert(current().main.timeIncrementor === 0, "Real demo setup resets the clock before active simulation");
            await roundtrip("clock:post-credits-demo:reset");
            current().main.createStageForStateRestore(0);
            current().main.mode = Main.MODE_PLAYING;
            current().main.floorBreaking = false;
            current().main.fadeState = Main.FADE_DONE;
            current().main.fade = 0;
            current().main.timeIncrementor = 90;
            const normalTime = current().main.time;
            tick();
            assert(current().main.timeIncrementor === 0 && current().main.time === normalTime - 1, "Ordinary 91-tick cadence");
            check("clock:ordinary-rollover");
        }
        // All actual recording bytes, including each terminal sentinel. Frame dispatcher
        // also exercises the actual enemies and Simon animation writers during playback.
        current().main.difficulty = Main.DIFFICULTY_HARD;
        current().main.initDemo();
        current().main.fade = 0;
        current().main.fadeState = Main.FADE_DONE;
        const controls = current().main.controlInput;
        assert(controls, "Early demo input");
        const readAny = controls.isAnyNonDirectionalPressed;
        try {
            controls.isAnyNonDirectionalPressed = () => true;
            tick();
        } finally {
            controls.isAnyNonDirectionalPressed = readAny;
        }
        assert(
            current().main.fadeState === Main.FADE_OUT && current().main.fadeReason === Main.FADE_REASON_SHOW_TITLE_SCREEN && field("recordingIndex") === 0,
            "Human input exits demo before consuming a byte"
        );
        await roundtrip("demo:early-human-exit");
        Reflect.set(current().main, "demoIndex", 2);
        for (let index = 0; index < 3; index++) {
            current().main.initDemo();
            current().main.fade = 0;
            current().main.fadeState = Main.FADE_DONE;
            assert(field("demoIndex") === index, "Demo order");
            await roundtrip(`demo:${index}:entry`);
            for (let i = 0; i < 6000 && field("recordingIndex") < 2730; i++) tick();
            assert(field("recordingIndex") === 2730, `Demo ${index} consumes 2730 actual bytes`);
            await roundtrip(`demo:${index}:2730`);
            reject("demo-cursor2731", (s) => {
                s.mainFields.recordingIndex = 2731;
            });
            reject("demo-index3", (s) => {
                s.mainFields.demoIndex = 3;
            });
            tick();
            assert(current().main.fadeReason === Main.FADE_REASON_SHOW_TITLE_SCREEN, "Demo completion fades to title");
        }
        beginCredits();
        current().main.fade = 0;
        current().main.fadeState = Main.FADE_DONE;
        for (let index = 0; index < 12; index++) {
            assert(field("creditsIndex") === index && field("recordingIndex") === 0, `Credits ${index} entry`);
            await roundtrip(`credits:${index}:entry`);
            for (let i = 0; i < 3000 && field("recordingIndex") < 728; i++) tick();
            assert(field("recordingIndex") === 728, `Credits ${index} consumes 728 actual bytes`);
            await roundtrip(`credits:${index}:728`);
            reject("credits-cursor729", (s) => {
                s.mainFields.recordingIndex = 729;
            });
            for (let i = 0; i < 3000 && field("creditsIndex") === index; i++) tick();
        }
        assert(field("creditsIndex") === 12 && field("recordingIndex") === 728 && Reflect.get(current().main, "creditsPresents"), "Final credits sentinel");
        await roundtrip("credits:12:presents");
        reject("final-credits-cursor727", (s) => {
            s.mainFields.recordingIndex = 727;
        });
        for (let i = 0; i < 4000 && current().main.mode === Main.MODE_CREDITS; i++) tick();
        assert(current().main.mode === Main.MODE_TITLE_SCREEN, "Actual credits fade to title");
        check("credits:title");
        beginCredits();
        assert(field("creditsIndex") === 0 && field("recordingIndex") === 0, "Credits reentry resets sentinels");
        check("credits:reentry");
        for (const ctor of [Bat, MedusaHead, Dog]) {
            const main = current().main;
            main.createStageForStateRestore(0);
            main.mode = Main.MODE_PLAYING;
            main.fade = 0;
            main.fadeState = Main.FADE_DONE;
            tick();
            assert(main.simon, "Actor Simon");
            const actor = ctor === Dog ? new Dog(main, main.simon.x + 80, 256) : new ctor(main, main.simon.x + 80, 128, Main.RIGHT);
            main.pushThing(actor);
            const states = new Set<number>(ctor === Dog ? [0] : []),
                images = new Set<number>();
            for (let i = 0; i < 120; i++) {
                main.timeFrozen = i >= 30 && i < 40 ? 1 : 0;
                const before = [Reflect.get(actor, "spriteIndex"), Reflect.get(actor, "spriteDelay"), Reflect.get(actor, "spriteIndexIncrementor")];
                assert(actor.update(current().container), `${ctor.name}: live animation`);
                if (main.timeFrozen)
                    assert(
                        JSON.stringify(before) ===
                            JSON.stringify([
                                Reflect.get(actor, "spriteIndex"),
                                Reflect.get(actor, "spriteDelay"),
                                Reflect.get(actor, "spriteIndexIncrementor")
                            ]),
                        `${ctor.name}: frozen animation`
                    );
                actor.render(current().container, current().container.getGraphics());
                states.add(Number(Reflect.get(actor, "state")));
                images.add(Number(Reflect.get(actor, "spriteIndex")));
            }
            main.timeFrozen = 0;
            assert(images.size === (ctor === Bat ? 4 : ctor === MedusaHead ? 2 : 3), `${ctor.name}: every image`);
            if (ctor === Dog) {
                // Seed a ledge boundary, then let the real support check enter JUMPING.
                actor.x = 128;
                actor.y = 100;
                actor.vy = 0;
                actor.supported = false;
                actor.update(current().container);
                states.add(Number(Reflect.get(actor, "state")));
                assert(states.has(0) && states.has(1) && states.has(2), "Dog rest/run/jump census");
                check("Dog:actual-ledge-jump");
                for (let i = 0; i < 240 && Reflect.get(actor, "state") === 2; i++) actor.update(current().container);
                assert(Reflect.get(actor, "state") === 1, "Dog actual landing returns to RUNNING");
            }
            check(`actor:${ctor.name}:animation`);
            const type = ctor.name as "Bat" | "MedusaHead" | "Dog";
            for (const [name, [low, high]] of Object.entries(PROVEN_THING_INTEGER_RANGES[type]!))
                for (const bad of [low - 1, high + 1, 0.5]) {
                    reject(`${type}.${name}:${bad}`, (snapshot) => {
                        const target = snapshot.things.find((t) => t.type === type);
                        assert(target, "Captured actor");
                        target.fields[name] = bad;
                    });
                }
            await roundtrip(`actor:${type}:loaded-restore`);
            const captured = serializer.createSnapshot(current().main, "counter-parity");
            assert(
                captured.things.some((t) => t.type === type),
                "Actor remains captured after restore"
            );
            const stack = current().main.regionThingStack;
            const retiring = stack.things.slice(0, stack.top + 1).find((t) => t instanceof ctor);
            assert(retiring, "Active restored actor");
            retiring.kill = true;
            tick();
            const remaining = current().main.regionThingStack;
            assert(!remaining.things.slice(0, remaining.top + 1).includes(retiring), "Actual kill branch retires the actor");
            check(`actor:${type}:retired`);
            cases.push(`actor:${type}:states:${[...states]}`);
        }
        for (const whipType of [0, 1, 2])
            for (const stance of ["standing", "kneeling", "stairs-up", "stairs-down"])
                for (const throwing of [false, true]) {
                    const main = current().main;
                    main.createStageForStateRestore(0);
                    main.mode = Main.MODE_PLAYING;
                    main.fade = 0;
                    main.fadeState = Main.FADE_DONE;
                    main.time = 300;
                    assert(main.simon && main.controlInput, "Whip fixture");
                    const simon = main.simon;
                    simon.whipType = whipType;
                    simon.whipping = true;
                    simon.throwing = throwing;
                    simon.onStairs = stance.startsWith("stairs");
                    simon.up = stance === "stairs-up";
                    simon.kneeling = stance === "kneeling";
                    simon.y = 160;
                    simon.x = 128;
                    main.weaponType = Main.WEAPON_TYPE_DAGGER;
                    main.hearts = 99;
                    const update = Reflect.get(main, "updateSimon") as (gc: AppGameContainer) => void;
                    for (let i = 0; i < 45; i++) {
                        update.call(main, current().container);
                        simon.render(current().container, current().container.getGraphics());
                    }
                    assert(simon.whipIncrementor === 45 && !simon.whipping, "Retained completion45");
                    assert(main.hearts === (throwing ? 98 : 99), "Actual weapon spending stays independent of displayed digits");
                    check(`Simon:${whipType}:${stance}:throw=${throwing}:45`);
                }
        for (const [name, [low, high]] of Object.entries(PROVEN_THING_INTEGER_RANGES.Simon!))
            for (const bad of [low - 1, high + 1, 0.5]) {
                reject(`Simon.${name}:${bad}`, (snapshot) => {
                    const simon = snapshot.things.find((t) => t.type === "Simon");
                    assert(simon, "Captured Simon");
                    simon.fields[name] = bad;
                });
            }
        await roundtrip("Simon:retained45:loaded-restore");
        const required = [
            "presentation:title:entry",
            "presentation:title:steps273",
            "presentation:title:wrap",
            "presentation:intro:entry",
            "presentation:intro:walk-wrap",
            "presentation:intro:bat-wrap",
            "presentation:intro:next-gameplay",
            "clock:post-credits-title:92",
            "clock:post-credits-demo:reset",
            "clock:credits-death:92"
        ];
        for (const index of [0, 1, 2]) required.push(`presentation:title-to-demo:${index}`);
        for (const index of [0, 1, 2, 3]) required.push(`presentation:title:sprite:${index}`);
        for (const mode of [Main.MODE_PLAYING, Main.MODE_DEMO])
            for (const branch of ["normal", "dead", "floor", "frozen", "fade", "flashing", "door", "last-death"])
                for (const start of [0, 1, 89, 90]) required.push(`dispatch:${mode}:${branch}:${start}`);
        for (const stage of [0, 3]) for (const players of [0, 1, 98, 99]) required.push(`presentation:MAP:${stage}:${players}:wraps`);
        for (const label of required) assert(cases.includes(label), `Missing closure case ${label}`);
        Reflect.set(window, "counterParityEvidence", {
            required,
            cases,
            validationMilliseconds: times,
            schema: serializer.createSnapshot(current().main, "counter-parity").version
        });
    } finally {
        h.destroyMounted(mounted);
        store.clear(() => true);
    }
}

function firstDifference(a: unknown, b: unknown, path = ""): string {
    if (JSON.stringify(a) === JSON.stringify(b)) return "";
    if (a && b && typeof a === "object" && typeof b === "object") {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const diff = firstDifference(Reflect.get(a, k), Reflect.get(b, k), `${path}.${k}`);
            if (diff) return diff;
        }
    }
    return `${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`;
}
