import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

const server = await createServer({ root: "pwa", appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { ButtonMapping } = await server.ssrLoadModule("/src/stickvania/ButtonMapping.ts");
    const { InputConfigMode } = await server.ssrLoadModule("/src/stickvania/InputConfigMode.ts");
    for (const saved of [true, false]) {
        test(`Reset is quiet; Change and restored completion return to Input/Done, saved=${saved}`, () => {
            // Real Main/editor/render methods without demo recordings or GPU/audio assets.
            const main = Object.assign(Object.create(Main.prototype), {
                titleInputMappingLines: [],
                titleInputMappingCacheDirty: true,
                titleBatSpriteIndexIncrementor: 0,
                titleBatSpriteIndex: 0,
                game_over: { playing: () => false },
                stopSong() {}
            });
            const draws = [];
            let writes = 0;
            let sounds = 0;
            let clears = 0;
            let selectPressed = true;
            const input = {
                addKeyListener() {},
                removeKeyListener() {},
                setAdditionalControllerDirectionAxes() {},
                sampleControllersForBaseline() {},
                getControllerCount: () => 0,
                getControllerSampleStatus: () => ({ valid: true }),
                clearKeyPressedRecord() {},
                clearControlPressedRecord() {}
            };
            const gc = { getInput: () => input };
            const graphics = { setColor() {}, fillRect() {} };
            main.buttonMapping = new ButtonMapping();
            const defaults = main.buttonMapping.clone();
            main.drawString = (text, x, y) => draws.push({ text, x, y });
            main.playSound = () => sounds++;
            main.controlInput = {
                clearPressedState() {
                    clears++;
                },
                isMenuUpPressed: () => false,
                isMenuDownPressed: () => false,
                isMenuSelectPressed: () => selectPressed
            };
            main.setInputMappingChangedHandler(() => {
                writes++;
                return saved ? { saved: true } : { saved: false, reason: "unavailable" };
            });
            const render = () => {
                draws.length = 0;
                main.renderTitleScreen(gc, graphics);
                return draws.map(({ text }) => text);
            };
            const assertInputMenu = (mapping, selectedIndex) => {
                assert.equal(main.titleMenu, Main.TITLE_MENU_INPUT);
                assert.equal(main.titleSelectedIndex, selectedIndex);
                const rows = ["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "ATTACK"].map(
                    (action) => action.padEnd(7, " ") + "= " + mapping.keyboardLabelFor(action) + ", " + mapping.controllerLabelFor(action)
                );
                assert.deepEqual(render(), ["INPUT", ...rows, "CHANGE", "RESET", "DONE", "^"]);
                const option = draws.find(({ text }) => text === ["CHANGE", "RESET", "DONE"][selectedIndex]);
                const cursor = draws.at(-1);
                assert.ok(option);
                assert.equal(cursor.text, "^");
                assert.equal(cursor.y, option.y, "cursor must align with the selected option");
                assert.equal(cursor.x, option.x - 32);
            };

            // Prime the table cache, then require Reset to replace nondefault rows.
            main.setTitleMenu(Main.TITLE_MENU_INPUT, 1);
            main.fade = Main.FADE_DONE;
            main.fadeState = Main.FADE_DONE;
            main.titleBatSteps = 273;
            assertInputMenu(defaults, 1);
            const expectedDefaults = render();
            main.buttonMapping.keyUp = 30;
            main.invalidateTitleInputMappingCache();
            assert.notDeepEqual(render(), expectedDefaults);
            for (let i = 1; i <= 3; i++) {
                main.updateTitleScreen(gc);
                assertInputMenu(defaults, 1);
                assert.equal(writes, i);
                assert.equal(sounds, i);
            }

            // Main owns the actual editor, so completion also retires its reference.
            main.initInputConfig(gc);
            const mode = main.inputConfigMode;
            assert.ok(mode instanceof InputConfigMode);
            for (let tick = 0; tick < InputConfigMode.ARM_DELAY; tick++) mode.update(gc);
            for (const key of [30, 31, 32, 33, 34, 35]) {
                mode.inputStarted();
                mode.keyPressed(key, "");
                mode.keyReleased(key, "");
            }
            const renderCompletion = () => {
                draws.length = 0;
                mode.render(gc, graphics);
                return draws.map(({ text }) => text);
            };
            assert.equal(writes, 4);
            assert.deepEqual(renderCompletion(), [saved ? "SAVED" : "NOT SAVED"]);
            const snapshot = mode.createSnapshot();
            const editedMapping = main.buttonMapping.clone();
            assert.equal(snapshot.doneDelay, InputConfigMode.DONE_DELAY);
            for (let tick = 1; tick < InputConfigMode.DONE_DELAY; tick++) mode.update(gc);
            assert.deepEqual(renderCompletion(), [saved ? "SAVED" : "NOT SAVED"]);
            const clearsBeforeFinish = clears;
            mode.update(gc);
            assert.equal(clears, clearsBeforeFinish + 1, "completion must not reset input twice");
            assert.equal(main.mode, Main.MODE_TITLE_SCREEN);
            assert.equal(main.inputConfigMode, null);
            assertInputMenu(editedMapping, 2);
            assert.equal(writes, 4, "review must not commit the mapping again");

            // Reviewing a table is not an idle root-title/demo transition.
            selectPressed = false;
            main.titleTimeout = 1;
            main.updateTitleScreen(gc);
            assert.equal(main.titleTimeout, 1365);
            assert.equal(main.fadeState, Main.FADE_DONE);
            assertInputMenu(editedMapping, 2);

            // Done remains navigation only; Reset still has table-only feedback.
            main.selectTitleMenuOption();
            assert.equal(main.titleMenu, Main.TITLE_MENU_MAIN);
            assert.equal(main.titleSelectedIndex, 0);
            assert.equal(writes, 4);
            main.setTitleMenu(Main.TITLE_MENU_INPUT, 1);
            main.selectTitleMenuOption();
            assertInputMenu(defaults, 1);
            assert.equal(writes, 5);

            // Restore the completed old draft while defaults are the current authority.
            // A restore must not recommit that draft or use it as the review table.
            main.mode = Main.MODE_INPUT_CONFIG;
            const restored = new InputConfigMode(main);
            main.inputConfigMode = restored;
            restored.restoreSnapshot(gc, snapshot);
            draws.length = 0;
            restored.render(gc, graphics);
            assert.deepEqual(
                draws.map(({ text }) => text),
                ["DONE"]
            );
            assert.deepEqual(main.buttonMapping, defaults);
            restored.resyncInputAfterBrowserResume();
            const clearsBeforeRestoredFinish = clears;
            for (let tick = 0; tick < InputConfigMode.DONE_DELAY; tick++) restored.update(gc);
            assert.equal(clears, clearsBeforeRestoredFinish + 1);
            assert.equal(main.mode, Main.MODE_TITLE_SCREEN);
            assert.equal(main.inputConfigMode, null);
            assertInputMenu(defaults, 2);
            assert.equal(writes, 5, "restore, review, and navigation must not replay persistence");
        });
    }
} finally {
    await server.close();
}
