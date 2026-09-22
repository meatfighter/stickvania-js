import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScript, memoryStorage, sourceMember, shellSubject } from "./persistence-test-loader.mjs";

const game = "stickvania";
const preferencesPath = "pwa/src/app/BrowserPreferences.ts";
const quiet = async (run) => {
    const old = console.warn;
    console.warn = () => {};
    try {
        await run();
    } finally {
        console.warn = old;
    }
};

test("settings constructors used by shells do not read before ownership; explicit reload does", async () => {
    const fake = memoryStorage();
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    Object.defineProperty(globalThis, "location", { value: new URL("https://example.test/stage/"), configurable: true });
    globalThis.window = { location: globalThis.location };
    if (game === "jackal") {
        const source = sourceMember("pwa/src/app/JackalWebApp.ts", "refreshOwnedSettings", "JackalWebApp");
        assert.match(source, /beginOwnership\(owner\.epoch\)/);
        assert.match(source, /readVolume\(\)/);
        assert.doesNotMatch(source, /\.save\(|setItem/);
        return;
    }
    const { BrowserPreferences } = await loadTypeScript(preferencesPath);
    const preferences = new BrowserPreferences(false);
    assert.equal(fake.calls.get.length, 0);
    preferences.reload();
    assert.ok(fake.calls.get.length >= 3);
    assert.equal(fake.calls.set.length, 0);
    assert.equal(fake.calls.remove.length, 0);
});

test("a failed preference write preserves the session value; stale changes do not mutate it", async () => {
    const fake = memoryStorage();
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    Object.defineProperty(globalThis, "location", { value: new URL("https://example.test/stage/"), configurable: true });
    globalThis.window = { location: globalThis.location };
    if (game === "jackal") {
        const { writeVolume } = await loadTypeScript("pwa/src/app/AppPreferences.ts");
        fake.faults.set = true;
        await quiet(() => {
            assert.equal(
                writeVolume(0.7, () => true),
                false
            );
            assert.equal(fake.calls.get.length, 0);
        });
        const source = sourceMember("pwa/src/app/JackalWebApp.ts", "bindMenuControls", "JackalWebApp");
        assert.ok(source.indexOf("this.setAudioVolume(") < source.indexOf("writeVolume(this.volume"));
        return;
    }
    const { BrowserPreferences } = await loadTypeScript(preferencesPath);
    const preferences = new BrowserPreferences(false);
    fake.faults.set = true;
    await quiet(() => {
        assert.equal(
            preferences.setVolume(0.7, true, () => true),
            false
        );
        assert.equal(preferences.volume, 0.7);
        assert.equal(
            preferences.setVolume(0.2, true, () => false),
            false
        );
        assert.equal(preferences.volume, 0.7);
        assert.equal(
            preferences.setFullscreen(false, () => true),
            false
        );
        assert.equal(preferences.fullscreen, false);
        assert.equal(
            preferences.setFullscreen(true, () => false),
            false
        );
        assert.equal(preferences.fullscreen, false);
        assert.equal(fake.calls.get.length, 0);
    });
});

test("partial Reset still installs coherent in-memory defaults and attempts the remaining owned keys", async () => {
    if (game === "jackal") {
        const source = sourceMember("pwa/src/app/JackalWebApp.ts", "resetPwaState", "JackalWebApp");
        assert.match(source, /sessionMapping\.resetToDefaults\(\)/);
        assert.match(source, /preferredHardMode = DEFAULT_HARD_MODE/);
        assert.match(source, /Some settings could not be reset/);
        return;
    }
    const fake = memoryStorage();
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    Object.defineProperty(globalThis, "location", { value: new URL("https://example.test/stage/"), configurable: true });
    globalThis.window = { location: globalThis.location };
    const { BrowserPreferences, DEFAULT_VOLUME, DEFAULT_SCALING_PREFERENCE, DEFAULT_FULLSCREEN_PREFERENCE } = await loadTypeScript(preferencesPath);
    const preferences = new BrowserPreferences(false);
    preferences.volume = 0.9;
    preferences.fullscreen = false;
    fake.faults.remove = true;
    await quiet(() =>
        assert.equal(
            preferences.reset(() => true),
            false
        )
    );
    assert.equal(preferences.volume, DEFAULT_VOLUME);
    assert.equal(preferences.scaling, DEFAULT_SCALING_PREFERENCE);
    assert.equal(preferences.fullscreen, DEFAULT_FULLSCREEN_PREFERENCE);
    assert.equal(fake.calls.remove.length, game === "stickvania" ? 8 : 4);
    assert.equal(fake.calls.get.length, 0);
});

test("obsolete menu listeners are fenced before their target handlers can change a setting", () => {
    const owner = game === "jackal" ? "JackalWebApp" : null;
    const path = game === "jackal" ? "pwa/src/app/JackalWebApp.ts" : game === "stickvania" ? "pwa/src/main.ts" : "pwa/src/app/main.ts";
    const handlers = new Map();
    const menu = {
        isConnected: true,
        addEventListener(name, handler, capture) {
            assert.equal(capture, true);
            handlers.set(name, handler);
        }
    };
    const ownership = {
        epoch: 1,
        isCurrent(epoch) {
            return this.epoch === epoch;
        }
    };
    const env = { ownership, activeMenu: null, pwaSessionState: "menu" };
    const subject = shellSubject(path, ["guardMenuEvents"], env, owner);
    if (owner) {
        subject.getOwnership = () => ownership;
        subject.pwaSessionState = "menu";
    }
    subject.guardMenuEvents(menu);
    let stopped = 0;
    const event = {
        preventDefault() {},
        stopImmediatePropagation() {
            stopped++;
        }
    };
    handlers.get("change")(event);
    assert.equal(stopped, 0);
    ownership.epoch = 2;
    handlers.get("change")(event);
    assert.equal(stopped, 1);
    ownership.epoch = 1;
    menu.isConnected = false;
    handlers.get("click")(event);
    assert.equal(stopped, 2);
});
