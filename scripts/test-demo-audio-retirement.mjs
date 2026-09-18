import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({
    root: resolve(rootDir, "pwa"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

try {
    const { Main } = await server.ssrLoadModule("/src/stickvania/Main.ts");
    const { SOUND_EFFECT_FIELD_NAMES } = await server.ssrLoadModule("/src/stickvania/AudioRegistry.ts");

    for (const scenario of [
        { name: "user interruption", recordingIndex: 100, anyNonDirectionalPressed: true },
        { name: "natural recording completion", recordingIndex: 2730, anyNonDirectionalPressed: false }
    ]) {
        const events = [];
        const main = Object.create(Main.prototype);
        Object.assign(main, {
            mode: Main.MODE_DEMO,
            recordingIndex: scenario.recordingIndex,
            fadeState: Main.FADE_DONE,
            fadeReason: -1,
            playerPower: 16,
            floorBreaking: false,
            simon: {
                invincible: 0,
                drankPotion: false,
                lastX: 0,
                lastY: 0,
                x: 64,
                y: 128,
                hurt: false
            },
            controlInput: {
                isUp: () => false,
                isDown: () => false,
                isLeft: () => false,
                isRight: () => false,
                isJump: () => false,
                isAttack: () => false,
                isAnyNonDirectionalPressed: () => scenario.anyNonDirectionalPressed
            },
            stopAllSoundEffects() {
                events.push("purge-sfx");
            }
        });

        Main.prototype.updateSimon.call(main, {});

        assert.deepEqual(events, ["purge-sfx"], scenario.name);
        assert.equal(main.fadeState, Main.FADE_OUT, scenario.name);
        assert.equal(main.fadeReason, Main.FADE_REASON_SHOW_TITLE_SCREEN, scenario.name);
        assert.equal(main.recordingIndex, scenario.recordingIndex, `${scenario.name} must return before consuming another demo frame`);
    }

    const tsMain = readFileSync(resolve(rootDir, "pwa/src/stickvania/Main.ts"), "utf8");
    const tsEffects = sourceBetween(tsMain, "    public stopAllSoundEffects()", "    public stopAllSounds()");
    assert.match(tsEffects, /SoundStore\.get\(\)\.stopSoundEffects\(\)/);

    const tsTitle = sourceBetween(tsMain, "    public initTitleScreen()", "    public updateTitleScreen(");
    assert.doesNotMatch(tsTitle, /stopAllSoundEffects|stopSoundEffects/, "generic title entry must not erase destination-owned transition SFX");

    const tsDemoExit = sourceBetween(tsMain, "        if (this.mode == Main.MODE_DEMO || this.mode == Main.MODE_CREDITS)", "            let keyDown: number");
    assertInOrder(tsDemoExit, ["this.stopAllSoundEffects();", "this.fadeState = Main.FADE_OUT;", "this.fadeReason = Main.FADE_REASON_SHOW_TITLE_SCREEN;"]);

    const javaMain = readFileSync(resolve(rootDir, "desktop/src/stickvania/Main.java"), "utf8");
    const javaEffects = sourceBetween(javaMain, "  public void stopAllSoundEffects()", "  public void stopSong()");
    for (const id of SOUND_EFFECT_FIELD_NAMES) {
        assert.match(javaEffects, new RegExp(`\\b${escapeRegExp(id)}\\.stop\\(\\);`), `desktop cleanup missing ${id}`);
    }

    const javaDemoExit = sourceBetween(javaMain, "    if (mode == MODE_DEMO || mode == MODE_CREDITS)", "      int keyDown =");
    assertInOrder(javaDemoExit, ["stopAllSoundEffects();", "fadeState = FADE_OUT;", "fadeReason = FADE_REASON_SHOW_TITLE_SCREEN;"]);

    console.log("Stickvania autonomous demo SFX retirement checks passed.");
} finally {
    await server.close();
}

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert.ok(start >= 0 && end > start, `Unable to isolate source between ${startMarker} and ${endMarker}.`);
    return source.slice(start, end);
}

function assertInOrder(source, snippets) {
    let previous = -1;
    for (const snippet of snippets) {
        const index = source.indexOf(snippet);
        assert.ok(index > previous, `Expected ordered source snippet: ${snippet}`);
        previous = index;
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
