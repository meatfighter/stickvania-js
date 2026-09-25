import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ResourceLoader } from "slick2d-ts";
import { createServer } from "vite";
const server = await createServer({
    root: fileURLToPath(new URL("../pwa/", import.meta.url)),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});
try {
    for (const [name, count] of [
        ["demo", 3],
        ["ending", 12]
    ])
        for (let i = 1; i <= count; i++) {
            const ref = `recordings/${name}_${i}.dat`;
            ResourceLoader.registerResource(ref, readFileSync(new URL("../pwa/public/" + ref, import.meta.url)));
        }
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { Simon } = await server.ssrLoadModule("/src/stickvania/Simon.ts");
    const { StickvaniaInput } = await server.ssrLoadModule("/src/stickvania/StickvaniaInput.ts");
    const { registerPlayerActionMain } = await server.ssrLoadModule("/src/stickvania/PlayerActionPolicy.ts");
    function fixture() {
        const main = new Main();
        main.simon = new Simon(main);
        Object.assign(main, {
            mode: Main.MODE_PLAYING,
            fadeState: Main.FADE_DONE,
            playerPower: 16,
            time: 300,
            door: null,
            beatStageFlag: false,
            floorBreaking: false
        });
        Object.assign(main.simon, { x: 100, y: 100, dead: 0, hurt: false, flashing: 0, onStairs: false });
        registerPlayerActionMain(main);
        const held = new Set();
        const state = { sequence: 1, valid: true, baselineOnly: false };
        let generation = 1;
        Object.assign(main.buttonMapping, {
            controllerUp: 7,
            controllerDown: 6,
            controllerLeft: 3,
            controllerRight: 0,
            controllerJump: -2,
            controllerAttack: -3
        });
        const input = {
            getControllerSampleStatus: () => state,
            getControllerConnectionGeneration: () => generation,
            getControllerCount: () => 1,
            getButtonCount: () => 17,
            isControllerUp: () => held.has(-2),
            isControllerDown: () => held.has(-3),
            isControllerLeft: () => held.has(-4),
            isControllerRight: () => held.has(-5),
            isControllerButtonDirectional: (b) => b >= 12 && b <= 15,
            isButtonPressed: (b) => held.has(b),
            isKeyDown: () => false,
            sampleControllersForBaseline() {},
            setAdditionalControllerDirectionAxes() {}
        };
        const control = new StickvaniaInput(input, main.buttonMapping);
        main.controlInput = control;
        const tick = () => {
            state.sequence++;
            control.update();
        };
        return { main, control, held, state, tick, replace: () => generation++ };
    }
    test("logical Jump/Attack drive actions and menu selection, not virtual movement", () => {
        const f = fixture();
        for (const [b, read, move] of [
            [-2, "isJump", "isUp"],
            [-3, "isAttack", "isDown"]
        ]) {
            f.held.add(b);
            f.tick();
            assert.equal(f.control[read](), true);
            assert.equal(f.control[move](), false);
            assert.equal(f.control.isMenuSelectPressed(), true);
            assert.equal(f.control.isMenuUpPressed(), false);
            assert.equal(f.control.isMenuDownPressed(), false);
            f.tick();
            assert.equal(f.control.isMenuSelectPressed(), false);
            f.held.clear();
            f.tick();
            f.held.add(b);
            f.tick();
            assert.equal(f.control.isMenuSelectPressed(), true);
            f.held.clear();
            f.tick();
        }
    });
    test("resume/replacement held logical actions remain quarantined until release", () => {
        for (const [b, read] of [
            [-2, "isJump"],
            [-3, "isAttack"]
        ]) {
            const f = fixture();
            f.held.add(b);
            f.control.clearPressedState();
            f.tick();
            assert.equal(f.control[read](), false);
            assert.equal(f.control.isMenuSelectPressed(), false);
            f.held.clear();
            f.tick();
            f.held.add(b);
            f.tick();
            assert.equal(f.control[read](), true);
            f.replace();
            f.tick();
            assert.equal(f.control[read](), false);
            f.held.clear();
            f.state.valid = false;
            f.tick();
            f.state.valid = true;
            f.held.add(b);
            f.tick();
            assert.equal(f.control[read](), false, "invalid enumeration cannot simulate release");
            f.held.clear();
            f.tick();
            f.held.add(b);
            f.tick();
            assert.equal(f.control[read](), true);
        }
    });
    test("raw virtual direction navigates without confirmation; real action policy still suppresses terminal Attack", () => {
        const f = fixture();
        f.held.add(7);
        f.tick();
        assert.equal(f.control.isUp(), true);
        assert.equal(f.control.isMenuUpPressed(), true);
        assert.equal(f.control.isMenuSelectPressed(), false);
        f.held.clear();
        f.tick();
        f.held.add(-3);
        f.tick();
        assert.equal(f.control.isAttack(), true);
        f.main.beatStageFlag = true;
        assert.equal(f.control.isAttack(), false);
        f.main.beatStageFlag = false;
        f.main.playerPower = 0;
        assert.equal(f.control.isAttack(), false);
    });
} finally {
    await server.close();
}
