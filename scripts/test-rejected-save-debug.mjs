import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScript, memoryStorage } from "./persistence-test-loader.mjs";

const prefix = "pwa/src/stickvania/";
const control = { fail: null, throwing: false, error: undefined, captureThrows: false, snapshot: null, calls: [] };
globalThis.__rejectedSaveTest = control;
const gate = (name) =>
    `globalThis.__rejectedSaveTest.calls.push(${JSON.stringify(name)}); if(globalThis.__rejectedSaveTest.fail===${JSON.stringify(name)}) {if(globalThis.__rejectedSaveTest.throwing)throw globalThis.__rejectedSaveTest.error; return false;} return true;`;
const mocks = {
    [prefix + "PlayerActionPolicy.ts"]: "export function registerPlayerActionMain() {}",
    [prefix + "StopWatch.ts"]: "export class StopWatch { static recomputeRestoredTimeFrozen() {} }",
    [prefix + "StopWatchMusicHold.ts"]: "export function reconcileStopWatchMusic() {} export function resetStopWatchMusicHold() {}",
    [prefix + "persistence/StickvaniaGameStateSerializer.ts"]: `export class StickvaniaGameStateSerializer {
        createSnapshot(){const c=globalThis.__rejectedSaveTest;if(c.captureThrows)throw Error('capture');return c.snapshot;}
        isSupportedSnapshot(){${gate("structure-and-graph")}}
        isSupportedPresentationResources(){${gate("presentation-resources")}}
        isSupportedSnapshotForLoadedResources(){return true;}
        restoreSnapshot(){}
    }`,
    [prefix + "persistence/GameStateSanity.ts"]: `export function isReasonableStickvaniaGameStateSnapshot(){${gate("values-and-audio")}}`,
    [prefix + "persistence/StopWatchRepeatStatePolicy.ts"]: `export function isStopWatchRepeatStateValid(){${gate("stopwatch-repeat")}}`,
    [prefix + "persistence/AxeKnightShieldStatePolicy.ts"]: `export function isAxeKnightShieldSnapshotStateValid(){${gate("axe-knight-shield")}}`
};
const { StickvaniaGameStateStore } = await loadTypeScript(prefix + "persistence/StickvaniaGameStateStore.ts", mocks);
const { GAME_STATE_STORAGE_KEY, GAME_STATE_VERSION } = await loadTypeScript(prefix + "persistence/GameStateSchema.ts");
const { REJECTED_SAVE_DEBUG_KEY } = await loadTypeScript(prefix + "persistence/RejectedSaveDebug.ts");
const store = new StickvaniaGameStateStore("debug-contract");
const main = { isStateSaveReady: () => true };
const stages = ["structure-and-graph", "values-and-audio", "stopwatch-repeat", "axe-knight-shield", "presentation-resources"];
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const warn = console.warn;

test("outgoing rejected evidence truth table through the real store/writer", () => {
    const storage = memoryStorage();
    let authority = true;
    const install = () => Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    function reset() {
        authority = true;
        install();
        Object.assign(control, {
            fail: null,
            throwing: false,
            error: undefined,
            captureThrows: false,
            calls: [],
            snapshot: { version: GAME_STATE_VERSION, mainFields: {}, things: [], marker: "rejected original" }
        });
        storage.faults.set = false;
        storage.faults.get = false;
        storage.values.clear();
        storage.values.set(GAME_STATE_STORAGE_KEY, "prior canonical bytes");
        storage.clearCalls();
    }
    const save = () => store.save(main, () => authority);
    const debug = () => JSON.parse(storage.values.get(REJECTED_SAVE_DEBUG_KEY));
    console.warn = () => {};
    try {
        assert.notEqual(GAME_STATE_STORAGE_KEY, REJECTED_SAVE_DEBUG_KEY);
        assert.match(REJECTED_SAVE_DEBUG_KEY, /:debug-invalid-save$/);
        for (const stage of stages)
            for (const throwing of [false, true])
                for (const error of [undefined, "non-error", new Error("validator exception")]) {
                    reset();
                    Object.assign(control, { fail: stage, throwing, error });
                    const result = save();
                    assert.equal(result.saved, false);
                    assert.equal(result.reason, "invalid-snapshot");
                    assert.equal(storage.values.get(GAME_STATE_STORAGE_KEY), "prior canonical bytes");
                    assert.deepEqual(storage.calls.set, [REJECTED_SAVE_DEBUG_KEY]);
                    assert.equal(debug().failedStage, stage);
                    assert.equal(debug().failureKind, throwing ? "threw" : "returned-false");
                    assert.equal(debug().snapshotIncluded, true);
                    assert.deepEqual(debug().snapshot, control.snapshot);
                    assert.deepEqual(control.calls, stages.slice(0, stages.indexOf(stage) + 1));
                }
        reset();
        control.fail = stages[0];
        save();
        const retained = storage.values.get(REJECTED_SAVE_DEBUG_KEY);
        control.fail = null;
        storage.clearCalls();
        assert.equal(save().saved, true);
        assert.equal(storage.values.get(REJECTED_SAVE_DEBUG_KEY), retained);
        assert.deepEqual(storage.calls.set, [GAME_STATE_STORAGE_KEY]);
        control.calls = [];
        store.hasValidSave();
        assert.deepEqual(control.calls, stages.slice(0, 4), "load gates equal outgoing prefix");

        reset();
        control.fail = stages[0];
        assert.equal(store.save({ isStateSaveReady: () => false }, () => true).saved, false);
        assert.deepEqual(control.calls, []);
        assert.deepEqual(storage.calls.set, []);
        control.captureThrows = true;
        assert.equal(save().reason, "capture-failed");
        assert.deepEqual(storage.calls.set, []);
        reset();
        authority = false;
        control.fail = stages[0];
        save();
        assert.deepEqual(storage.calls.set, []);
        reset();
        control.fail = stages[0];
        Object.defineProperty(globalThis, "localStorage", {
            configurable: true,
            get() {
                authority = false;
                return storage;
            }
        });
        save();
        assert.deepEqual(storage.calls.set, []);
        reset();
        control.fail = stages[0];
        Object.defineProperty(control.snapshot, "mainFields", {
            enumerable: true,
            get() {
                authority = false;
                return {};
            }
        });
        save();
        assert.deepEqual(storage.calls.set, []);

        for (const bad of [
            NaN,
            Infinity,
            undefined,
            2n,
            () => {},
            Symbol("x"),
            new Date(),
            { toJSON: () => ({ changed: true }) },
            Array(2),
            "x".repeat(270000)
        ]) {
            reset();
            control.fail = stages[0];
            control.snapshot.bad = bad;
            save();
            assert.equal(debug().snapshotIncluded, false);
            assert.ok(storage.values.get(REJECTED_SAVE_DEBUG_KEY).length <= 16384);
        }
        reset();
        control.fail = stages[0];
        control.snapshot.self = control.snapshot;
        save();
        assert.equal(debug().snapshotIncluded, false);
        reset();
        control.fail = stages[0];
        const shared = { x: 1 };
        control.snapshot.shared = [shared, shared];
        save();
        assert.equal(debug().snapshotIncluded, true);
        reset();
        control.fail = stages[0];
        storage.faults.set = true;
        save();
        assert.deepEqual(storage.calls.set, [REJECTED_SAVE_DEBUG_KEY, REJECTED_SAVE_DEBUG_KEY]);
        reset();
        control.fail = stages[0];
        save();
        control.snapshot.marker = "latest";
        save();
        assert.equal(debug().snapshot.marker, "latest");
        assert.equal(storage.values.size, 2);
        for (const failure of ["encoding", "size", "access", "write"]) {
            reset();
            if (failure === "encoding") control.snapshot.self = control.snapshot;
            if (failure === "size") control.snapshot.large = "x".repeat(2000001);
            if (failure === "write") storage.faults.set = true;
            if (failure === "access")
                Object.defineProperty(globalThis, "localStorage", {
                    configurable: true,
                    get() {
                        throw Error("denied");
                    }
                });
            assert.equal(save().saved, false);
            assert.ok(!storage.calls.set.includes(REJECTED_SAVE_DEBUG_KEY));
        }
        for (const raw of [null, "{", "null", "{}", JSON.stringify({ version: GAME_STATE_VERSION - 1 }), JSON.stringify({ version: GAME_STATE_VERSION + 1 })]) {
            reset();
            control.fail = stages[0];
            if (raw === null) storage.values.delete(GAME_STATE_STORAGE_KEY);
            else storage.values.set(GAME_STATE_STORAGE_KEY, raw);
            assert.equal(store.hasValidSave(), false);
            assert.equal(store.restore(main, {}), false);
            assert.deepEqual(storage.calls.set, []);
            assert.deepEqual(storage.calls.remove, []);
        }
        reset();
        control.fail = stages[0];
        Object.defineProperty(control.snapshot, "mainFields", {
            get() {
                throw Error("getter");
            }
        });
        assert.equal(save().reason, "invalid-snapshot");
    } finally {
        console.warn = warn;
        if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
        else delete globalThis.localStorage;
        delete globalThis.__rejectedSaveTest;
    }
});
