import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { withCounterModules, replace } from "./counter-test-utils.mjs";

const expectedRanges = {
    titleBatSpriteIndex: [0, 3],
    titleBatSpriteIndexIncrementor: [0, 8],
    titleBatSteps: [0, 273],
    introWalkSpriteIndex: [0, 3],
    introWalkSpriteIndexIncrementor: [0, 15],
    gateBatSpriteIndex: [0, 1],
    gateBatSpriteIndexIncrementor: [0, 9],
    demoIndex: [0, 2]
};

async function fixture(run, transforms = {}) {
    await withCounterModules({ JavaMath: (s) => s + "\nexport {ResourceLoader};", ...transforms }, async (load) => {
        const { Main } = await load("Main");
        const fields = await load("persistence/StateFieldRegistry.generated");
        const policy = await load("persistence/StateFieldValuePolicy");
        const modes = await load("persistence/GameStatePolicy");
        const { ResourceLoader } = await load("JavaMath");
        const previous = ResourceLoader.getResourceAsStream;
        let main;
        try {
            ResourceLoader.getResourceAsStream = (ref) => new Uint8Array(readFileSync(new URL("../pwa/public/" + ref, import.meta.url)));
            main = new Main();
        } finally {
            ResourceLoader.getResourceAsStream = previous;
        }
        const captureFields = () => Object.fromEntries(fields.MAIN_PERSISTED_STATE_FIELD_NAMES.map((k) => [k, main[k]]));
        await run({ Main, main, fields, policy, modes, captureFields });
    });
}

test("Main index table is explicit, complete for this pass, numeric and endpoint-safe", async () => {
    await fixture(({ Main, main, fields, policy, captureFields }) => {
        assert.deepEqual(policy.PROVEN_MAIN_INTEGER_RANGES, expectedRanges);
        main.mode = Main.MODE_TITLE_SCREEN;
        const base = captureFields();
        assert.equal(policy.isPersistedMainFieldValuesValid(base), true);
        for (const [key, [lo, hi]] of Object.entries(expectedRanges)) {
            assert.ok(fields.MAIN_PERSISTED_STATE_FIELD_NAMES.includes(key));
            assert.ok(!policy.MAIN_BOOLEAN_PERSISTED_STATE_FIELDS.has(key));
            for (const mode of [Main.MODE_TITLE_SCREEN, Main.MODE_INTRO, Main.MODE_MAP, Main.MODE_PLAYING]) {
                for (const n of [lo, hi]) assert.equal(policy.isPersistedMainFieldValuesValid({ ...base, mode, [key]: n }), true, `${key}:endpoint`);
                for (const n of [lo - 1, hi + 1, 0.5, NaN, Infinity])
                    assert.equal(policy.isPersistedMainFieldValuesValid({ ...base, mode, [key]: n }), false, `${key}:invalid`);
            }
        }
    });
});

test("clock policy separates active domain from retained inactive values", async () => {
    await fixture(({ Main, main, policy, modes, captureFields }) => {
        // This cross-mode clock test must begin with a reachable castle phase.
        main.initCastleFalls();
        Object.assign(main, {
            stageIndex: 5,
            beatStageFlag: true,
            beatStageDelay: 0,
            playerPower: 16,
            time: 0,
            hearts: 0,
            fadeState: Main.FADE_IN,
            fade: 22,
            fadeReason: Main.FADE_REASON_SHOW_CASTLE_FALLS
        });
        const base = captureFields();
        for (const mode of [0, 1, 2, 4, 5, 6, 7, 8, 10]) {
            const active = mode === Main.MODE_PLAYING || mode === Main.MODE_DEMO;
            for (const n of [0, 1, 89, 90, 91, 92, 1000001, 2147483647]) {
                const expected = !active || n <= 90;
                assert.equal(modes.isCountdownSnapshotValueValid(mode, n), expected);
                const f = { ...base, mode, timeIncrementor: n, demoIndex: 0, creditsIndex: 0, creditsPresents: false, recordingIndex: 0 };
                if (mode === Main.MODE_CREDITS)
                    Object.assign(f, { stageIndex: 0, fadeState: Main.FADE_DONE, fade: 0, fadeReason: Main.FADE_REASON_SHOW_CREDITS });
                assert.equal(policy.isPersistedMainFieldValuesValid(f), expected, `integrated:${mode}:${n}`);
            }
            for (const n of [-1, 0.5, NaN, Infinity, 2147483648]) assert.equal(modes.isCountdownSnapshotValueValid(mode, n), false);
        }
    });
});

test("actual TITLE, INTRO and MAP animation writers remain in their persisted domains", async () => {
    await fixture(({ Main, main, policy, captureFields }) => {
        // Node resource/input/audio boundaries only. Actual animation methods and image indexing remain.
        const blank = { draw() {} };
        main.symbols = Array(256).fill(blank);
        main.clearInputPressedRecords = () => {};
        main.stopSong = () => {};
        main.game_over = { playing: () => false };
        main.createStage = () => {};
        main.requestMusic = () => {};
        main.controlInput = { isMenuUpPressed: () => false, isMenuDownPressed: () => false, isMenuSelectPressed: () => false };
        main.titleImage = blank;
        main.titleBats = Array(3).fill(blank);
        main.gates = main.clouds = main.simonBack = blank;
        main.gateBats = Array(2).fill(blank);
        main.simonWalking = Array.from({ length: 2 }, () => Array(3).fill(blank));
        main.castleMaps = Array(2).fill(blank);
        main.renderTitleMainMenu = () => {}; // Not a menu-layout test.
        const g = { setColor() {}, fillRect() {} };
        main.initTitleScreen();
        main.fadeState = Main.FADE_DONE;
        main.fade = 0;
        const seen = new Set();
        for (let n = 0; n < 500; n++) {
            main.updateTitleScreen({});
            assert.equal(policy.isPersistedMainFieldValuesValid(captureFields()), true, "title producer");
            seen.add(main.titleBatSpriteIndex);
            main.renderTitleScreen({}, g);
        }
        assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
        assert.equal(main.titleBatSteps, 273);
        main.initIntro();
        main.fadeState = Main.FADE_DONE;
        main.fade = 0;
        for (let n = 0; n < 637; n++) {
            main.updateIntro({});
            assert.equal(policy.isPersistedMainFieldValuesValid(captureFields()), true, "intro producer");
            main.renderIntro({}, g);
        }
        main.initMapScreen();
        main.fadeState = Main.FADE_DONE;
        main.fade = 0;
        let count = 0;
        while (main.fadeState !== Main.FADE_OUT) {
            main.updateMapScreen({});
            assert.equal(policy.isPersistedMainFieldValuesValid(captureFields()), true, "map producer");
            main.renderMapScreen({}, g);
            assert.ok(++count < 2500);
        }
    });
});

async function rangeProbe(mutation = (s) => s) {
    await fixture(
        ({ Main, policy, captureFields }) => {
            const base = { ...captureFields(), mode: Main.MODE_TITLE_SCREEN };
            for (const [key, [lo, hi]] of Object.entries(expectedRanges)) {
                for (const n of [lo, hi]) assert.equal(policy.isPersistedMainFieldValuesValid({ ...base, [key]: n }), true, `Main endpoint ${key}`);
                for (const n of [lo - 1, hi + 1, 0.5])
                    assert.equal(policy.isPersistedMainFieldValuesValid({ ...base, [key]: n }), false, `Main invalid ${key}`);
            }
        },
        { "persistence/StateFieldValuePolicy": mutation }
    );
}
test("each Main presentation range defeats widened and narrowed mutants", async () => {
    await rangeProbe();
    for (const [key, [lo, hi]] of Object.entries(expectedRanges))
        for (const altered of [hi - 1, hi + 1])
            await assert.rejects(
                rangeProbe((s) => replace(s, `${key}: [${lo}, ${hi}]`, `${key}: [${lo}, ${altered}]`)),
                (e) => e.code === "ERR_ASSERTION" && /Main (endpoint|invalid)/.test(e.message)
            );
    await rangeProbe();
});
