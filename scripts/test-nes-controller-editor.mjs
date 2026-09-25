import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
const game = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).name.replace("-js", "");
const jackal = game === "jackal";
const server = await createServer({
    root: fileURLToPath(new URL("../pwa/", import.meta.url)),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});
try {
    const { ButtonMapping } = await server.ssrLoadModule(`/src/${game}/ButtonMapping.ts`);
    const editor = await server.ssrLoadModule(`/src/${game}/${jackal ? "InputMode" : "InputConfigMode"}.ts`);
    const Mode = editor.InputMode ?? editor.InputConfigMode;
    const fields = ["Up", "Down", "Left", "Right", ...(jackal ? ["Grenade", "Gun", "Start"] : ["Jump", "Attack"])];
    function fixture(mapping = new ButtonMapping(), heldAtEntry = null) {
        const hardware = { buttons: new Set(), directions: new Set(), generation: 1, sequence: 0, valid: true, baselineOnly: false, standard: false };
        if (heldAtEntry !== null) hardware.buttons.add(heldAtEntry);
        let polling = false,
            writes = 0;
        const input = {
            getControllerSampleStatus: () => ({ ...hardware }),
            getControllerConnectionGeneration: () => hardware.generation,
            getControllerCount: () => 1,
            getButtonCount: () => 64,
            isControllerButtonDirectional: (b) => hardware.standard && b >= 12 && b <= 15,
            isControllerUp: () => hardware.directions.has(-2),
            isControllerDown: () => hardware.directions.has(-3),
            isControllerLeft: () => hardware.directions.has(-4),
            isControllerRight: () => hardware.directions.has(-5),
            isButtonPressed: (b) => hardware.buttons.has(b),
            isKeyDown: () => false,
            addKeyListener() {},
            removeKeyListener() {},
            clearKeyPressedRecord() {},
            clearControlPressedRecord() {},
            setAdditionalControllerDirectionAxes() {},
            resetAdditionalControllerDirectionAxisCalibration() {},
            sampleControllersForBaseline() {
                assert.equal(polling, false, "reentrant baseline");
            }
        };
        const main = {
            buttonMapping: mapping,
            playSound() {},
            playSoundAlways() {},
            clearInputPressedRecords() {},
            notifyInputMappingChanged() {
                writes++;
                return { saved: true };
            },
            finishInputConfig() {},
            humanInput: { clearKeyPressedRecord() {} }
        };
        const gc = { getInput: () => input };
        const mode = jackal ? new Mode() : new Mode(main);
        if (jackal) {
            mode.main = main;
            mode.gc = gc;
            mode.buttonMapping = mapping;
            mode.startReading();
        } else mode.init(gc);
        const tick = (key) => {
            hardware.sequence++;
            polling = true;
            mode.inputStarted();
            if (key !== undefined) mode.keyPressed(key, "");
            polling = false;
            mode.update(gc);
        };
        const step = () => (jackal ? mode.nameIndex : mode.stepIndex);
        const draft = () => (jackal ? mode.draftButtonMapping : mode.draft);
        const ready = () => {
            for (let n = 0; n < 40 && (mode.armDelay > 0 || (jackal && mode.state === Mode.STATE_READ_FADE)); n++) tick();
        };
        const release = () => {
            hardware.buttons.clear();
            hardware.directions.clear();
            tick();
            ready();
        };
        const press = (b) => {
            release();
            (b < 0 ? hardware.directions : hardware.buttons).add(b);
            tick();
            if (!jackal) assert.equal(editor.isInputConfigModeSnapshot(mode.createSnapshot()), true);
        };
        ready();
        return { mode, main, gc, hardware, input, tick, step, draft, ready, release, press, writes: () => writes };
    }
    test("real editor reuses committed raw directions at the first prompts", () => {
        const map = new ButtonMapping();
        map.controllerUp = 7;
        map.controllerDown = 6;
        const f = fixture(map);
        f.press(7);
        assert.equal(f.draft().controllerUp, 7);
        if (jackal) assert.equal(f.mode.state, Mode.STATE_READ_FADE);
        else assert.equal(f.step(), 1);
        f.release();
        f.press(6);
        assert.equal(f.draft().controllerDown, 6);
        if (jackal) assert.equal(f.mode.state, Mode.STATE_READ_FADE);
        else assert.equal(f.step(), 2);
    });
    test("real editor accepts logical directions at every destination", () => {
        for (let slot = 0; slot < fields.length; slot++)
            for (const binding of [-2, -3, -4, -5, 0, 6, 7, 12, 15, 63]) {
                const f = fixture();
                for (let i = 0; i < slot; i++) {
                    f.press(30 + i);
                    f.release();
                }
                f.press(binding);
                const d = f.draft();
                assert.equal(d["controller" + fields[slot]], binding, `slot ${slot}, binding ${binding}`);
                if (jackal) assert.equal(f.mode.state, Mode.STATE_READ_FADE);
                else assert.equal(f.step(), slot + 1);
            }
    });
    test("duplicate rejection is atomic and old ownership can be swapped", () => {
        for (const [first, second] of [
            [7, 6],
            [-2, -3]
        ]) {
            const map = new ButtonMapping();
            map.controllerUp = first;
            map.controllerDown = second;
            const f = fixture(map);
            f.press(second);
            assert.equal(f.draft().controllerDown, -1);
            f.release();
            const before = JSON.stringify(f.draft());
            f.press(second);
            assert.equal(f.mode.message, "ALREADY USED");
            assert.equal(JSON.stringify(f.draft()), before);
            assert.equal(f.step(), 1);
            f.press(first);
            assert.equal(f.draft().controllerDown, first);
        }
    });
    test("standard D-pad, diagonal and chord produce one capture with no held spill", () => {
        const f = fixture();
        f.hardware.standard = true;
        f.hardware.directions.add(-2);
        f.hardware.directions.add(-4);
        f.hardware.buttons.add(12);
        f.hardware.buttons.add(7);
        f.tick();
        assert.equal(f.draft().controllerUp, -2);
        f.ready();
        for (let i = 0; i < 12; i++) f.tick();
        assert.equal(f.step(), 1);
        assert.equal(f.draft().controllerDown, -3);
        f.release();
        f.press(7);
        assert.equal(f.draft().controllerDown, 7);
    });
    test("logical action capture respects invalid samples and same-slot replacement", () => {
        const f = fixture();
        for (let i = 0; i < 4; i++) {
            f.press(30 + i);
            f.release();
        }
        f.hardware.directions.add(-2);
        f.hardware.valid = false;
        f.tick();
        assert.equal(f.step(), 4);
        f.hardware.valid = true;
        f.hardware.generation++;
        f.tick();
        assert.equal(f.step(), 4);
        f.tick();
        assert.equal(f.step(), 4);
        f.press(-2);
        assert.equal(f.draft()["controller" + fields[4]], -2);
    });
    test("two identical full remaps commit exactly once each without partial live mutation", () => {
        const map = new ButtonMapping();
        const wanted = [7, 6, 3, 0, -2, -3, -4].slice(0, fields.length);
        for (let cycle = 0; cycle < 2; cycle++) {
            const original = JSON.stringify(map);
            const f = fixture(map);
            wanted.forEach((b, i) => {
                f.press(b);
                if (i < fields.length - 1 || jackal) assert.equal(JSON.stringify(map), original);
                if (i < fields.length - 1) f.release();
            });
            f.ready();
            assert.equal(f.writes(), 1);
            assert.deepEqual(
                fields.map((s) => map["controller" + s]),
                wanted
            );
            for (let i = 0; i < 4; i++) f.tick();
            assert.equal(f.writes(), 1);
        }
    });
    test("original user sequence completes twice through real capture", () => {
        const mapping = new ButtonMapping();
        const wanted = [7, 6, -4, -5, 1, 4, 9].slice(0, fields.length);
        for (let cycle = 0; cycle < 2; cycle++) {
            const f = fixture(mapping);
            for (const binding of wanted) {
                f.press(binding);
                f.ready();
            }
            assert.equal(f.writes(), 1);
            assert.deepEqual(
                fields.map((field) => mapping["controller" + field]),
                wanted
            );
        }
    });
    test("held Change activation stays baselined until a fresh press", () => {
        const f = fixture(new ButtonMapping(), 7);
        for (let i = 0; i < 12; i++) f.tick();
        assert.equal(f.step(), 0);
        f.press(7);
        if (jackal) assert.equal(f.mode.state, Mode.STATE_READ_FADE);
        else assert.equal(f.step(), 1);
    });
    test("final keyboard assignment with a controller chord commits once without reentrant sampling", () => {
        const f = fixture();
        for (let i = 0; i < fields.length - 1; i++) {
            f.press(30 + i);
            f.release();
        }
        f.hardware.buttons.add(9);
        f.tick(30);
        f.ready();
        assert.equal(f.writes(), 1);
        assert.equal(f.mode.assignedKeys.size, 1);
        assert.equal(f.mode.assignedControllerBindings.size, fields.length - 1);
        for (let i = 0; i < 3; i++) f.tick();
        assert.equal(f.writes(), 1);
    });
} finally {
    await server.close();
}
