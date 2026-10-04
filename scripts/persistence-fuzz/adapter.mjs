/* global document, location */
import { ResourceLoader } from "slick2d-ts";
import { StickvaniaRuntimeLoader } from "/src/app/RuntimeLoader.ts";
import { beginGameAudio, commitGameAudio, releaseGameAudio } from "/src/app/PlaybackSession.ts";
import { StickvaniaGameStateSerializer } from "/src/stickvania/persistence/StickvaniaGameStateSerializer.ts";
import { GAME_STATE_STORAGE_KEY } from "/src/stickvania/persistence/GameStateSchema.ts";
import { REJECTED_SAVE_DEBUG_KEY } from "/src/stickvania/persistence/RejectedSaveDebug.ts";
import { Main } from "/src/stickvania/Main.ts";
import { random } from "./prng.mjs";

export const gameId = "stickvania-js";
export const key = GAME_STATE_STORAGE_KEY;
export const debugKey = REJECTED_SAVE_DEBUG_KEY;
export const serializer = new StickvaniaGameStateSerializer();
export { beginGameAudio, commitGameAudio, releaseGameAudio };
export async function mount(restore, version) {
    ResourceLoader.removeAllResourceLocations();
    ResourceLoader.addResourceLocation(new URL("/", location.href));
    const runtime = await new StickvaniaRuntimeLoader(() => {}).ensurePrepared();
    const store = new runtime.StickvaniaGameStateStore(version);
    runtime.slick.Display.setParent(document.querySelector("#game-host"));
    const main = new runtime.Main();
    const game = new runtime.StickvaniaBufferedGame(main, "crisp");
    const container = new runtime.slick.AppGameContainer(game, 800, 650, false);
    container.setPreserveAudioCacheOnDestroy(true);
    container.setLoopSuspended(true);
    if (restore)
        main.loadingCompleteHandler = (gc) => {
            if (!store.restore(main, gc)) throw new Error("RESTORE_REJECTED");
            return true;
        };
    await container.start();
    await runtime.slick.ResourceLoader.waitForAll();
    return { main, container, game, store, runtime };
}
function stairsPath(start, target) {
    const queue = [[start, []]],
        seen = new Set([start]);
    for (let i = 0; i < queue.length; i++) {
        const [segment, path] = queue[i];
        if (segment === target) return path;
        for (const entry of segment.stairsEntries) {
            const next = entry.connection?.segment;
            if (next && !seen.has(next)) {
                seen.add(next);
                queue.push([next, [...path, entry]]);
            }
        }
    }
    return null;
}
export function seed({ main }, spec) {
    main.stopAllSounds();
    main.setDifficulty(spec.hard ? Main.DIFFICULTY_HARD : Main.DIFFICULTY_NORMAL);
    main.random.setSeed(spec.gameSeed);
    main.createStageForStateRestore(spec.stage);
    main.mode = Main.MODE_PLAYING;
    main.fadeState = Main.FADE_DONE;
    main.fade = 0;
    if (spec.lane === "natural")
        return {
            strategy: "normal-checkpoint-entry",
            x: main.simon.x,
            y: main.simon.y,
            segment: main.stageSegment.stageSegmentIndex,
            region: main.stageSegment.regionIndex
        };
    const rng = random(spec.setupSeed);
    const candidates = [];
    for (const segment of main.stageSegments)
        for (let ri = 0; ri < segment.regions.length; ri++) {
            const region = segment.regions[ri];
            // Checkpointless regions can be reached through their real stair links.
            // Do not fabricate a checkpoint or silently select using validation.
            if (region.checkpoint || (ri === segment.regionIndex && stairsPath(main.stageSegment, segment))) candidates.push({ segment, ri, region });
        }
    if (!candidates.length) throw new Error("SETUP: no coherent region route");
    const target = candidates[rng.int(candidates.length)];
    if (target.region.checkpoint) {
        main.checkpoint = target.region.checkpoint;
        main.restoreCheckpoint();
    } else {
        const path = stairsPath(main.stageSegment, target.segment);
        if (!path) throw new Error("SETUP: checkpointless region has no staircase route");
        for (const entry of path) {
            main.simon.x = entry.x;
            main.followStairsToNextSegment();
        }
    }
    if (main.stageSegment !== target.segment || main.stageSegment.regionIndex !== target.ri)
        throw new Error("SETUP: region ownership differs after the producer route");
    const player = main.simon,
        region = target.region;
    const minimumX = Math.ceil(region.min - player.rx1),
        maximumX = Math.floor(region.max - player.rx2);
    if (maximumX < minimumX) throw new Error("SETUP: region is narrower than Simon's footprint");
    let point = null;
    for (let attempt = 0; attempt < 4096; attempt++) {
        const x = minimumX + rng.int(maximumX - minimumX + 1),
            y = -64 + rng.int(353);
        let free = true;
        for (let dx = player.rx1; dx <= player.rx2; dx += 8)
            for (let dy = player.ry1; dy <= player.ry2; dy += 8) if (main.isSolid(x + dx, y + dy)) free = false;
        if (free) {
            point = { x, y };
            break;
        }
    }
    if (!point) throw new Error("SETUP: no free Simon footprint");
    player.x = Math.fround(point.x);
    player.y = Math.fround(point.y);
    player.lastX = player.x;
    player.lastY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.supported = false;
    player.onStairs = false;
    main.moveCamera();
    return {
        strategy: target.region.checkpoint ? "checkpoint-plus-airborne-placement" : "stairs-plus-airborne-placement",
        x: player.x,
        y: player.y,
        segment: target.segment.stageSegmentIndex,
        region: target.ri,
        camera: main.camera,
        stage: main.stageIndex
    };
}
export function retire(mounted) {
    mounted.main.setInputMappingChangedHandler(null);
    mounted.main.stopAllSounds();
    mounted.container.destroy();
    mounted.runtime.slick.Display.setParent(null);
}
import { isReasonableStickvaniaGameStateSnapshot } from "/src/stickvania/persistence/GameStateSanity.ts";
import { isStopWatchRepeatStateValid } from "/src/stickvania/persistence/StopWatchRepeatStatePolicy.ts";
import { isAxeKnightShieldSnapshotStateValid } from "/src/stickvania/persistence/AxeKnightShieldStatePolicy.ts";
export function validate(main, snapshot) {
    if (!serializer.isSupportedSnapshot(snapshot)) return "structure-and-graph";
    if (!isReasonableStickvaniaGameStateSnapshot(snapshot)) return "values-and-audio";
    if (!isStopWatchRepeatStateValid(snapshot.mainFields)) return "stopwatch-repeat";
    if (!isAxeKnightShieldSnapshotStateValid(snapshot)) return "axe-knight-shield";
    if (!serializer.isSupportedPresentationResources(main, snapshot)) return "presentation-resources";
    return serializer.isSupportedSnapshotForLoadedResources(main, snapshot) ? null : "loaded-resources";
}

import { isPersistedThingFieldValuesValid } from "/src/stickvania/persistence/StateFieldValuePolicy.ts";
/** Reuses the real Thing gate to locate a failing owner; no new acceptance rule. */
export function diagnose(_main, snapshot, stage) {
    const types = new Map(snapshot.things.map((thing) => [thing.id, thing.type]));
    for (let index = 0; index < snapshot.things.length; index++) {
        const thing = snapshot.things[index];
        if (!isPersistedThingFieldValuesValid(thing, types, snapshot.stage?.segments.length ?? 0))
            return { ownerType: thing.type, path: `things[${index}].fields`, ruleCode: "thing-fields" };
    }
    return { ownerType: `mode:${snapshot.mode}`, ruleCode: stage };
}

// Benchmark the former outgoing preflight boundary with the current serializer.
export function validateBaseline(main, snapshot) {
    if (!serializer.isSupportedSnapshot(snapshot)) return "structure-and-graph";
    if (!isReasonableStickvaniaGameStateSnapshot(snapshot)) return "values-and-audio";
    if (!isStopWatchRepeatStateValid(snapshot.mainFields)) return "stopwatch-repeat";
    if (!isAxeKnightShieldSnapshotStateValid(snapshot)) return "axe-knight-shield";
    if (!serializer.isSupportedPresentationResources(main, snapshot)) return "presentation-resources";
    return null;
}

export function observedStratum({ main }) {
    return { stage: main.stageIndex, world: 0, hard: main.difficulty === Main.DIFFICULTY_HARD };
}
