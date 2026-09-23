import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

const server = await createServer({ root: "pwa", appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { ButtonMapping } = await server.ssrLoadModule("/src/stickvania/ButtonMapping.ts");
    const { InputConfigMode } = await server.ssrLoadModule("/src/stickvania/InputConfigMode.ts");
    for (const saved of [true, false]) {
        test(`Input Reset refreshes only table; Change keeps timed result, saved=${saved}`, () => {
            // Keep the actual menu/editor methods without loading demo recordings or GPU/audio assets.
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
            main.drawString = (text) => draws.push(text);
            main.playSound = () => sounds++;
            main.controlInput = { clearPressedState() {}, isMenuUpPressed: () => false, isMenuDownPressed: () => false, isMenuSelectPressed: () => true };
            main.setInputMappingChangedHandler(() => {
                writes++;
                return { saved };
            });
            main.setTitleMenu(Main.TITLE_MENU_INPUT, 1);
            main.fade = Main.FADE_DONE;
            main.titleBatSteps = 273;
            const render = () => {
                draws.length = 0;
                main.renderTitleScreen(gc, graphics);
                return [...draws];
            };
            const expected = render();
            assert.deepEqual(expected.slice(-4), ["CHANGE", "RESET", "DONE", "^"]);
            assert.equal(expected[0], "INPUT");
            assert.equal(expected.length, 11);
            main.buttonMapping.keyUp = 30;
            main.invalidateTitleInputMappingCache();
            assert.notDeepEqual(render(), expected);
            for (let i = 1; i <= 3; i++) {
                main.updateTitleScreen(gc);
                assert.deepEqual(render(), expected);
                assert.equal(main.buttonMapping.keyUp, new ButtonMapping().keyUp);
                assert.equal(main.titleSelectedIndex, 1);
                assert.equal(main.titleMenu, Main.TITLE_MENU_INPUT);
                assert.equal(writes, i);
                assert.equal(sounds, i);
            }
            const mode = new InputConfigMode(main);
            mode.init(gc);
            for (let tick = 0; tick < InputConfigMode.ARM_DELAY; tick++) mode.update(gc);
            for (const key of [30, 31, 32, 33, 34, 35]) {
                mode.inputStarted();
                mode.keyPressed(key, "");
                mode.keyReleased(key, "");
            }
            const renderCompletion = () => {
                draws.length = 0;
                mode.render(gc, graphics);
                return [...draws];
            };
            assert.equal(writes, 4);
            assert.deepEqual(renderCompletion(), [saved ? "SAVED" : "NOT SAVED"]);
            const snapshot = mode.createSnapshot();
            assert.equal(snapshot.doneDelay, InputConfigMode.DONE_DELAY);
            for (let tick = 1; tick < InputConfigMode.DONE_DELAY; tick++) mode.update(gc);
            assert.deepEqual(renderCompletion(), [saved ? "SAVED" : "NOT SAVED"]);
            mode.update(gc);
            assert.equal(main.titleMenu, Main.TITLE_MENU_MAIN);
            main.setTitleMenu(Main.TITLE_MENU_INPUT, 1);
            main.selectTitleMenuOption();
            assert.deepEqual(render(), expected);
            const restored = new InputConfigMode(main);
            restored.restoreSnapshot(gc, snapshot);
            draws.length = 0;
            restored.render(gc, graphics);
            assert.deepEqual(draws, ["DONE"]);
            restored.resyncInputAfterBrowserResume();
            for (let tick = 0; tick < InputConfigMode.DONE_DELAY; tick++) restored.update(gc);
            main.setTitleMenu(Main.TITLE_MENU_INPUT, 1);
            assert.deepEqual(render(), expected);
            assert.equal(writes, 5, "restore and navigation must not replay persistence");
        });
    }
} finally {
    await server.close();
}
