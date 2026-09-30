import { withCounterModules } from "./counter-test-utils.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
async function load(name) {
    const src = readFileSync(new URL("../pwa/src/stickvania/persistence/" + name + ".ts", import.meta.url), "utf8");
    return import(
        "data:text/javascript;base64," +
            Buffer.from(ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText).toString(
                "base64"
            )
    );
}
const { FLOOR_BREAK_CELLS, isFloorBreakSnapshotValid: floor, isFloorBreakerFieldsValid: fields } = await load("FloorBreakStatePolicy");
const { isStairExitResourceValid: stairs } = await load("StairExitResourcePolicy");
const stack = (things = []) => ({ $stack: { capacity: 16, things } });
function terminal() {
    const walls = Array.from({ length: 11 }, () => Array(161).fill(1));
    for (const [x, y] of FLOOR_BREAK_CELLS) walls[y][x] = 0;
    return {
        mainFields: { mode: 4, stageIndex: 2, fadeState: 1, fadeReason: 2, beatStageFlag: false, floorBreaking: false },
        things: [],
        stage: {
            stageIndex: 2,
            currentSegmentIndex: 2,
            regionThingStack: stack(),
            regionStackSwap: stack(),
            segments: [{}, {}, { stageSegmentIndex: 2, mapWidth: 160, walls }]
        }
    };
}
test("all twenty floor removals and both active stacks are independently required", () => {
    const good = terminal();
    assert.equal(FLOOR_BREAK_CELLS.length, 20);
    assert(floor(good));
    for (const [x, y] of FLOOR_BREAK_CELLS) {
        const s = terminal();
        s.stage.segments[2].walls[y][x] = 1;
        assert(!floor(s), `${x},${y}`);
    }
    for (const mutate of [
        (s) => (s.stage.currentSegmentIndex = 1),
        (s) => (s.stage.segments[2].mapWidth = 159),
        (s) => (s.stage.segments[2].walls[6] = null),
        (s) => (s.stage.regionThingStack = stack([9])),
        (s) => (s.things = [{ id: 0 }, { id: 0 }])
    ]) {
        const s = terminal();
        mutate(s);
        assert(!floor(s));
    }
    for (const name of ["regionThingStack", "regionStackSwap"]) {
        const s = terminal();
        s.things = [{ id: 0, type: "FloorBreaker", fields: { X: 143, breakDelay: 23, delay: 0 } }];
        s.stage[name] = stack([0]);
        assert(!floor(s));
        s.stage[name] = stack();
        assert(floor(s), "Inactive historical reference permitted");
    }
    for (const mode of [1, 4, 8]) {
        const s = terminal();
        s.mainFields.mode = mode;
        s.mainFields.playerPower = 3;
        s.mainFields.hearts = 9;
        s.things = [{ id: 0, type: "BrickFragment" }];
        s.stage.regionThingStack = stack([0]);
        const before = JSON.stringify(s);
        assert(floor(s));
        assert.equal(JSON.stringify(s), before);
    }
});
test("FloorBreaker counters cannot skip terminal equality, including dormant references", () => {
    const good = { X: 159, breakDelay: 91, delay: 1 };
    assert(fields(good));
    for (const bad of [
        { X: 143.5 },
        { X: 142 },
        { X: 160 },
        { X: NaN },
        { X: Infinity },
        { breakDelay: 92 },
        { breakDelay: -1 },
        { breakDelay: 0.5 },
        { delay: 0 },
        { delay: 2 },
        { delay: 0.5 }
    ]) {
        const f = { ...good, ...bad };
        assert(!fields(f));
        const s = terminal();
        s.mainFields.fadeState = 0;
        s.things = [{ id: 0, type: "FloorBreaker", fields: f }];
        assert(!floor(s));
    }
    assert(fields({ X: 143, breakDelay: 23, delay: 0 }));
});
function stair(tile = 47, row = 0) {
    const grid = Array.from({ length: 11 }, () => Array(20).fill(32));
    grid[row][8] = tile;
    const slope = tile === 47 || tile === 82 ? 1 : -1;
    const s = {
        mainFields: { mode: 4, fadeState: 1, fadeReason: 0 },
        stage: { stageIndex: 0, currentSegmentIndex: 0, simon: 0 },
        things: [
            {
                id: 0,
                type: "Simon",
                fields: { onStairs: true, hurt: false, x: 8 * 32 - 15 + (row === 0 ? slope : -slope), y: row === 0 ? -62 : 285, up: row === 0 }
            }
        ]
    };
    return { s, loaded: [[{ stage: grid }]], grid };
}
test("resource-selected stair boundary uses exact last-step samples for all four tile kinds", () => {
    for (const tile of [47, 92, 76, 82])
        for (const row of [0, 10])
            for (const fraction of [0, 0.25, -0.25]) {
                const { s, loaded } = stair(tile, row);
                s.things[0].fields.x = Math.fround(s.things[0].fields.x + fraction);
                const before = JSON.stringify(s);
                assert(stairs(s, loaded), `${tile}/${row}/${fraction}`);
                assert.equal(JSON.stringify(s), before);
            }
    for (const mutate of [
        (s) => (s.things[0].fields.x = 1000),
        (s) => (s.things[0].fields.up = false),
        (s) => (s.things[0].fields.y = -63),
        (s) => (s.things[0].fields.y = 285),
        (s) => (s.things[0].fields.onStairs = false),
        (s) => (s.stage.currentSegmentIndex = 1)
    ]) {
        const { s, loaded } = stair();
        mutate(s);
        assert(!stairs(s, loaded));
    }
    const { s, loaded, grid } = stair();
    assert(!stairs(s, null));
    grid[0][8] = 32;
    assert(!stairs(s, loaded));
    // Descending requires both foot samples; the next column can leave a tile.
    const bottom = stair(47, 10);
    bottom.s.things[0].fields.x = 224;
    assert(!stairs(bottom.s, bottom.loaded));
    // Equal truncated float32 distances retain the first column-major entry.
    const tie = stair();
    tie.grid[10][9] = 92;
    tie.s.things[0].fields.x = 237;
    assert(stairs(tie.s, tie.loaded), "First-entry tie picks the matching top exit");
    tie.s.things[0].fields.x = Math.fround(237.25);
    assert(!stairs(tie.s, tie.loaded), "Truncation now selects the nearer bottom exit");
});

test("actual FloorBreaker update cannot reach its terminal equality from fractional X", async () => {
    await withCounterModules({}, async (load) => {
        const { FloorBreaker } = await load("FloorBreaker");
        const removed = [];
        const main = {
            walls: Array.from({ length: 11 }, () => Array(161).fill(0)),
            removeBlock(x, y) {
                removed.push([x, y]);
            },
            pushThing() {},
            playSound() {},
            playRumble() {},
            floorBreaking: true
        };
        const breaker = new FloorBreaker(main);
        Object.assign(breaker, { X: 143.5, breakDelay: 0 });
        for (let i = 0; i < 5000; i++) assert.equal(breaker.update({}), true);
        assert(removed.length > 100);
        assert(removed.every(([x]) => !Number.isInteger(x)));
        assert.equal(main.floorBreaking, true);
        assert(!fields(breaker), "Reader rejects the actual noncompleting counter witness");
    });
});
