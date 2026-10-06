import { invokeObservedRestore } from "./failure-protocol.mjs";
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
export async function mount(restore, version, probe) {
    ResourceLoader.removeAllResourceLocations();
    ResourceLoader.addResourceLocation(new URL("/", location.href));
    probe.stage = "runtime-prepare";
    const runtime = await new StickvaniaRuntimeLoader(() => {}).ensurePrepared();
    probe.restoreWitness.resourcesPrepared = true;
    probe.stage = "runtime-mount";
    const store = new runtime.StickvaniaGameStateStore(version);
    runtime.slick.Display.setParent(document.querySelector("#game-host"));
    const main = new runtime.Main();
    const game = new runtime.StickvaniaBufferedGame(main, "crisp");
    const container = new runtime.slick.AppGameContainer(game, 800, 650, false);
    container.setPreserveAudioCacheOnDestroy(true);
    container.setLoopSuspended(true);
    if (restore)
        main.loadingCompleteHandler = (gc) => {
            probe.stage = "restore";
            probe.restoreWitness.expectedBytesVerified = typeof probe.expectedText === "string" && localStorage.getItem(key) === probe.expectedText;
            if (!probe.restoreWitness.expectedBytesVerified) throw new Error("Restore input bytes do not match this document's expected slot");
            if (!invokeObservedRestore(store, main, gc, probe.restoreWitness)) throw new Error("RESTORE_REJECTED");
            return true;
        };
    await container.start();
    await runtime.slick.ResourceLoader.waitForAll();
    return { main, container, game, store, runtime };
}
/** Search complete region ownership history: stairs retain the destination's last region. */
function routeTo(main, targetSegment, targetRegion) {
    const segments = main.stageSegments;
    const initial = { segment: main.stageSegment.stageSegmentIndex, owners: segments.map((segment) => segment.regionIndex), path: [] };
    const queue = [initial],
        seen = new Set();
    for (let cursor = 0; cursor < queue.length; cursor++) {
        const state = queue[cursor],
            key = `${state.segment}:${state.owners.join(",")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (state.segment === targetSegment && state.owners[state.segment] === targetRegion) return state.path;
        if (seen.size > 10000) throw new Error("SETUP: topology history search budget exceeded");
        const segment = segments[state.segment],
            region = segment.regions[state.owners[state.segment]];
        for (const [entryIndex, entry] of segment.stairsEntries.entries()) {
            if (!entry.connection || entry.x < region.min || entry.x > region.max) continue;
            queue.push({
                segment: entry.connection.segment.stageSegmentIndex,
                owners: [...state.owners],
                path: [...state.path, { kind: "stairs", segment: state.segment, region: state.owners[state.segment], entryIndex }]
            });
        }
        for (const candidate of segments)
            for (let ri = 0; ri < candidate.regions.length; ri++) {
                if (!candidate.regions[ri].checkpoint) continue;
                const owners = [...state.owners];
                owners[candidate.stageSegmentIndex] = ri;
                queue.push({
                    segment: candidate.stageSegmentIndex,
                    owners,
                    path: [...state.path, { kind: "checkpoint", segment: candidate.stageSegmentIndex, region: ri }]
                });
            }
    }
    return null;
}
function oldStairsReachable(start, target) {
    const queue = [start],
        seen = new Set();
    for (const segment of queue) {
        if (segment === target) return true;
        if (seen.has(segment)) continue;
        seen.add(segment);
        for (const entry of segment.stairsEntries) if (entry.connection && !seen.has(entry.connection.segment)) queue.push(entry.connection.segment);
    }
    return false;
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
    const topology = main.stageSegments.flatMap((segment) =>
        segment.regions.map((region, index) => ({
            stage: spec.stage,
            hard: spec.hard,
            segment: segment.stageSegmentIndex,
            region: index,
            checkpoint: Boolean(region.checkpoint),
            initialOwner: segment.regionIndex,
            direction: segment.direction,
            min: region.min,
            max: region.max,
            oldEligible: Boolean(region.checkpoint || (index === segment.regionIndex && oldStairsReachable(main.stageSegment, segment))),
            stairs: segment.stairsEntries.map((entry) => ({
                x: entry.x,
                y: entry.y,
                to: entry.connection?.segment.stageSegmentIndex,
                direction: entry.direction
            })),
            doors: region.thingStack.things
                .slice(0, region.thingStack.top + 1)
                .filter((thing) => thing?.constructor.name === "Door")
                .map((door) => ({ x: door.x, y: door.y, direction: door.direction, active: door.active }))
        }))
    );
    const rng = random(spec.setupSeed);
    const candidates = [];
    for (const segment of main.stageSegments)
        for (let ri = 0; ri < segment.regions.length; ri++) {
            const region = segment.regions[ri];
            // Checkpointless regions can be reached through their real stair links.
            // Do not fabricate a checkpoint or silently select using validation.
            if (region.max === region.min) continue; // Explicit zero-width sentinel, retained in census below.
            const path = routeTo(main, segment.stageSegmentIndex, ri);
            if (!path) throw new Error(`SETUP: missing topology recipe for ${segment.stageSegmentIndex}:${ri}`);
            candidates.push({ segment, ri, region, path });
        }
    if (!candidates.length) throw new Error("SETUP: no coherent region route");
    const target = spec.targetRegion
        ? candidates.find((candidate) => candidate.segment.stageSegmentIndex === spec.targetRegion.segment && candidate.ri === spec.targetRegion.region)
        : candidates[rng.int(candidates.length)];
    if (!target) throw new Error(`SETUP: requested region absent ${JSON.stringify(spec.targetRegion)}`);
    for (const edge of target.path) {
        if (edge.kind === "checkpoint") {
            main.checkpoint = main.stageSegments[edge.segment].regions[edge.region].checkpoint;
            main.restoreCheckpoint();
        } else {
            if (main.stageSegment.stageSegmentIndex !== edge.segment || main.stageSegment.regionIndex !== edge.region)
                throw new Error("SETUP: stale stair route ownership");
            const entry = main.stageSegment.stairsEntries[edge.entryIndex];
            main.simon.x = entry.x;
            main.followStairsToNextSegment();
        }
    }
    if (main.stageSegment !== target.segment || main.stageSegment.regionIndex !== target.ri)
        throw new Error("SETUP: region ownership differs after the producer route");
    const ownedRegion = main.stageSegment.regions[main.stageSegment.regionIndex];
    if (
        main.map !== main.stageSegment.map ||
        main.walls !== main.stageSegment.walls ||
        main.platforms !== ownedRegion.platforms ||
        main.simon.xMin !== ownedRegion.min ||
        main.simon.xMax !== ownedRegion.max ||
        main.stage !== ownedRegion.stageNumber ||
        !main.checkpoint
    )
        throw new Error(`SETUP: topology roots disagree after ${JSON.stringify(target.path)}`);
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
        const samples = (low, high) => [...new Set([low, high, ...Array.from({ length: Math.ceil((high - low) / 8) }, (_, i) => low + 8 * i)])];
        for (const dx of samples(player.rx1, player.rx2)) for (const dy of samples(player.ry1, player.ry2)) if (main.isSolid(x + dx, y + dy)) free = false;
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
        topology,
        route: target.path,
        excludedSentinels: topology
            .filter((row) => row.min === row.max)
            .map((row) => ({
                segment: row.segment,
                region: row.region,
                reason: "zero-width terminal map partition; no player footprint or active entry door"
            })),
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

// Benchmark substitution of only the extra resource preflight in the CURRENT stack.
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

export { captureContext, transitionProjection } from "./transitions.mjs";
export function instrument({ main }, observer) {
    observer.actor(main.simon, true);
    observer.input(main.controlInput);
    for (const stack of [main.regionThingStack, main.weaponsStack, main.oldThingStack]) {
        if (!stack) continue;
        for (let i = 0; i <= stack.top; i++) if (stack.things[i] !== main.simon) observer.actor(stack.things[i]);
    }
}
