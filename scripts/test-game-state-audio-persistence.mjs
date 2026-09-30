import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import { createServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pwaRoot = resolve(rootDir, "pwa");
const server = await createServer({
    root: pwaRoot,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true }
});

const audioRegistry = await server.ssrLoadModule("/src/stickvania/AudioRegistry.ts");
const soundState = await server.ssrLoadModule("/src/stickvania/persistence/GameStateSoundEffects.ts");
const stateFields = await server.ssrLoadModule("/src/stickvania/persistence/StateFieldRegistry.generated.ts");
const { StopWatch } = await server.ssrLoadModule("/src/stickvania/StopWatch.ts");
const { StickvaniaGameStateSerializer } = await server.ssrLoadModule("/src/stickvania/persistence/StickvaniaGameStateSerializer.ts");
const { SoundStore } = await import("slick2d-ts");
const { SOUND_EFFECT_FIELD_NAMES, MAX_PERSISTED_SOUND_EFFECT_VOICES, registeredSoundEffects } = audioRegistry;
const { captureSoundEffects, restoreSoundEffects, isSoundEffectSnapshotsShape } = soundState;

class FakeSound {
    constructor(playback = emptyPlayback()) {
        this.playback = structuredClone(playback);
    }

    capturePlaybackState() {
        return structuredClone(this.playback);
    }

    restorePlaybackState(playback) {
        this.playback = structuredClone(playback);
    }
}

function emptyPlayback() {
    return { voices: [], activeVoiceIndex: null };
}

function voice(positionSeconds = 0.01, overrides = {}) {
    return {
        looped: false,
        playbackRate: 1,
        positionSeconds,
        gain: 1,
        spatialPosition: null,
        ...overrides
    };
}

function playback(voices, activeVoiceIndex = voices.length === 0 ? null : voices.length - 1) {
    return { voices, activeVoiceIndex };
}

function fakeMain() {
    return Object.fromEntries(SOUND_EFFECT_FIELD_NAMES.map((id) => [id, new FakeSound()]));
}

function collectSourceTree(directory) {
    let source = "";
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            source += collectSourceTree(path);
        } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
            source += `\n${readFileSync(path, "utf8")}`;
        }
    }
    return source;
}

function collectAudioPolicySetterCalls(directory, relative = "") {
    const calls = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            calls.push(...collectAudioPolicySetterCalls(path, childRelative));
            continue;
        }
        if (!entry.isFile() || !entry.name.endsWith(".ts")) {
            continue;
        }
        const source = readFileSync(path, "utf8");
        for (const method of ["setMusicOn", "setSoundsOn", "setSoundOn"]) {
            const matches = source.match(new RegExp(`\\.${method}\\s*\\(`, "g")) ?? [];
            for (let i = 0; i < matches.length; i++) {
                calls.push(`pwa/src/${childRelative}:${method}`);
            }
        }
    }
    return calls.sort();
}

function functionSource(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0 && end > start, `Unable to isolate ${startMarker}.`);
    return source.slice(start, end);
}

try {
    test("Sound registry covers every Main Sound field exactly once", () => {
        assert.equal(SOUND_EFFECT_FIELD_NAMES.length, 51);
        assert.equal(new Set(SOUND_EFFECT_FIELD_NAMES).size, SOUND_EFFECT_FIELD_NAMES.length);
        assert.equal(MAX_PERSISTED_SOUND_EFFECT_VOICES, 62);

        const source = readFileSync(resolve(rootDir, "pwa/src/stickvania/Main.ts"), "utf8");
        const sourceFile = ts.createSourceFile("Main.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        const mainClass = sourceFile.statements.find((statement) => ts.isClassDeclaration(statement) && statement.name?.text === "Main");
        assert.ok(mainClass, "Main class is missing.");
        const soundFields = mainClass.members
            .filter((member) => ts.isPropertyDeclaration(member) && member.type?.getText(sourceFile) === "Sound" && ts.isIdentifier(member.name))
            .map((member) => member.name.text)
            .sort();
        assert.deepEqual(soundFields, [...SOUND_EFFECT_FIELD_NAMES].sort());

        const main = fakeMain();
        assert.equal(registeredSoundEffects(main).length, SOUND_EFFECT_FIELD_NAMES.length);
        main.heartbeat = main.watch_tick;
        assert.throws(() => registeredSoundEffects(main), /same Sound object/);

        const allPwaSource = collectSourceTree(resolve(rootDir, "pwa", "src"));
        assert.doesNotMatch(allPwaSource, /\.setMaxSources\s*\(/, "62-voice durable bound assumes Stickvania keeps Slick's default source pool.");
    });

    test("capture is sparse and preserves overlapping/latest-voice semantics", () => {
        const main = fakeMain();
        main.watch_tick.playback = playback([voice(0.037)], 0);
        main.heartbeat.playback = playback([voice(0.011), voice(0.023)], null);

        const snapshot = captureSoundEffects(main);
        assert.deepEqual(
            snapshot.map(({ id }) => id),
            ["heartbeat", "watch_tick"]
        );
        assert.equal(snapshot[0].playback.voices.length, 2);
        assert.equal(snapshot[0].playback.activeVoiceIndex, null);
        assert.equal(snapshot[1].playback.voices[0].positionSeconds, 0.037);
    });

    test("restore replaces every registered Sound including omitted empty entries", () => {
        const main = fakeMain();
        main.watch_tick.playback = playback([voice(0.037)], 0);
        main.heartbeat.playback = playback([voice(0.011), voice(0.023)], null);
        const snapshot = captureSoundEffects(main);

        const restored = fakeMain();
        restored.lands.playback = playback([voice(0.5)], 0);
        restoreSoundEffects(restored, snapshot);
        assert.deepEqual(restored.watch_tick.playback, main.watch_tick.playback);
        assert.deepEqual(restored.heartbeat.playback, main.heartbeat.playback);
        assert.deepEqual(restored.lands.playback, emptyPlayback());
    });

    test("sound snapshot validator is sparse, identity-safe and source-pool bounded", () => {
        const valid = [{ id: "watch_tick", playback: playback([voice(0.037)], 0) }];
        assert.equal(isSoundEffectSnapshotsShape(valid), true);

        const maxPool = [
            {
                id: "heartbeat",
                playback: playback(
                    new Array(MAX_PERSISTED_SOUND_EFFECT_VOICES).fill(null).map((_, index) => voice(index / 1000)),
                    null
                )
            }
        ];
        assert.equal(isSoundEffectSnapshotsShape(maxPool), true);

        assert.equal(isSoundEffectSnapshotsShape([{ id: "not-a-sound", playback: playback([voice()], 0) }]), false);
        assert.equal(isSoundEffectSnapshotsShape([...valid, structuredClone(valid[0])]), false);
        assert.equal(isSoundEffectSnapshotsShape([{ id: "watch_tick", playback: emptyPlayback() }]), false);
        assert.equal(
            isSoundEffectSnapshotsShape([
                {
                    id: "heartbeat",
                    playback: playback(
                        new Array(MAX_PERSISTED_SOUND_EFFECT_VOICES + 1).fill(null).map(() => voice()),
                        null
                    )
                }
            ]),
            false
        );
        assert.equal(isSoundEffectSnapshotsShape([{ id: "watch_tick", playback: playback([voice(86_401)], 0) }]), false);
        assert.equal(isSoundEffectSnapshotsShape([{ id: "watch_tick", playback: playback([voice()], 2) }]), false);
    });

    test("restored StopWatch soundDelay suppresses an immediate duplicate tick", () => {
        const fields = stateFields.THING_PERSISTED_STATE_FIELD_NAMES.StopWatch;
        assert.ok(fields.includes("lifeTime"));
        assert.ok(fields.includes("soundDelay"));

        const played = [];
        const main = {
            mode: 4,
            playerPower: 16,
            simon: { dead: 0, x: 100, y: 100 },
            beatStageFlag: false,
            floorBreaking: false,
            time: 300,
            stageIndex: 0,
            enemyPower: 16,
            timeFrozen: 10,
            regionThingStack: { top: -1, things: [] },
            regionStackSwap: { top: -1, things: [] },
            currentSong: null,
            requestedSong: null,
            watch_tick: { id: "watch_tick" },
            playSound(sound) {
                played.push(sound);
            },
            playRumble() {}
        };
        const watch = Object.create(StopWatch.prototype);
        Object.assign(watch, {
            main,
            lifeTime: 10,
            soundDelay: 5,
            angle: 0,
            x: 0,
            y: 0,
            sx0: 0,
            sy0: 0,
            sx1: 0,
            sy1: 0,
            sx2: 0,
            sy2: 0
        });
        assert.equal(watch.update(null), true);
        assert.equal(Reflect.get(watch, "soundDelay"), 4);
        assert.deepEqual(played, [], "restored future-tick timer must not create a duplicate watch_tick immediately");
        watch.cancel();
    });

    test("failed audio restore cannot mutate application audio policy", () => {
        const serializer = new StickvaniaGameStateSerializer();
        const store = SoundStore.get();
        store.setMusicOn(false);
        store.setSoundsOn(true);

        const main = {
            boss_1: null,
            currentSong: null,
            requestedSong: null,
            currentMusic: null,
            stopCalls: 0,
            stopAllSounds() {
                this.stopCalls++;
            }
        };
        const snapshot = {
            currentSong: null,
            requestedSong: null,
            currentMusic: null,
            songs: [
                {
                    id: "boss_1",
                    playing: false,
                    intro: null,
                    loop: null
                }
            ],
            sounds: []
        };

        try {
            assert.throws(
                () => serializer.restoreAudio({ main, gc: {}, stageSegments: [], thingById: new Map() }, snapshot),
                /Saved song is unavailable: boss_1/
            );
            assert.equal(main.stopCalls, 2, "failed audio restore must clean up partial logical audio");
            assert.equal(store.musicOn(), false, "failed restore changed application Music policy");
            assert.equal(store.soundsOn(), true, "failed restore changed application Sound policy");
        } finally {
            store.destroy();
        }
    });

    test("serializer delegates full all-voice purge to Main before logical sound import", () => {
        const source = readFileSync(resolve(rootDir, "pwa/src/stickvania/persistence/StickvaniaGameStateSerializer.ts"), "utf8");
        const mainSource = readFileSync(resolve(rootDir, "pwa/src/stickvania/Main.ts"), "utf8");
        assert.match(source, /sounds:\s*captureSoundEffects\(main\)/);
        assert.match(source, /isSoundEffectSnapshotsShape\(snapshot\.sounds\)/);
        assert.match(source, /main\.stopAllSounds\(\)/);
        assert.doesNotMatch(source, /SoundStore\.get\(\)\.stopSoundEffects\(\)/);
        assert.match(mainSource, /public stopAllSoundEffects\(\): void \{\s*SoundStore\.get\(\)\.stopSoundEffects\(\);\s*\}/);
        assert.match(source, /restoreSoundEffects\(main, snapshot\.sounds\)/);
        assert.doesNotMatch(source, /\b(?:musicOn|soundOn|setMusicOn|setSoundOn)\b/);
    });

    test("only the PWA shell and isolated policy verification fixture may mutate global audio policy", () => {
        const calls = collectAudioPolicySetterCalls(resolve(rootDir, "pwa", "src"));
        assert.deepEqual(calls, [
            "pwa/src/PresentationStateVerification.ts:setMusicOn",
            "pwa/src/PresentationStateVerification.ts:setMusicOn",
            "pwa/src/main.ts:setMusicOn",
            "pwa/src/main.ts:setSoundsOn"
        ]);
        // The packaged-release verification rejects this dev-only fixture in any shipped chunk.
        assert.doesNotMatch(readFileSync(resolve(rootDir, "pwa/src/main.ts"), "utf8"), /PresentationStateVerification/);
    });

    test("PWA shell owns application audio policy before activation and on Reset", () => {
        const source = readFileSync(resolve(rootDir, "pwa/src/main.ts"), "utf8");

        const reset = functionSource(source, "function resetPwaState", "async function startGame");
        assert.match(reset, /applyApplicationAudioPreferences\(\)/);

        const start = functionSource(source, "async function startGame", "async function launchPreparedGame");
        assert.ok(start.indexOf("applyApplicationAudioPreferences()") < start.indexOf("beginGameAudio()"));

        const resume = functionSource(source, "async function resumeLiveGameFromMenu", "async function restoreExistingLiveMenuAfterInterruptedResume");
        assert.ok(resume.indexOf("applyApplicationAudioPreferences()") < resume.indexOf("beginGameAudio()"));

        const helper = functionSource(source, "function applyApplicationAudioPreferences", "function applyAudioVolume");
        assert.match(helper, /setMusicOn\(true\)/);
        assert.match(helper, /setSoundsOn\(true\)/);
        assert.match(helper, /applyAudioVolume\(preferences\.volume\)/);
    });

    test("PWA lifecycle retires before save and commits Sound generation before simulation resumes", () => {
        const source = readFileSync(resolve(rootDir, "pwa/src/main.ts"), "utf8");
        const liveMenu = functionSource(source, "async function showLiveMenuOverlay", "async function resumeLiveGameFromMenu");
        assert.ok(liveMenu.indexOf("suspendGameForMenu();") < liveMenu.indexOf("trySave(saveCurrentGameState)"));

        const resume = functionSource(source, "async function resumeLiveGameFromMenu", "async function restoreExistingLiveMenuAfterInterruptedResume");
        const commit = resume.indexOf("commitGameAudio(audio)");
        const browserResume = resume.indexOf("liveGame.setBrowserSuspended(false)");
        const loopResume = resume.indexOf("liveContainer.setLoopSuspended(false)");
        assert.ok(commit >= 0 && commit < browserResume && browserResume < loopResume);

        const fresh = functionSource(source, "async function launchPreparedGame", "function retireStaleContainer");
        const restoreHook = fresh.indexOf("mainGame.loadingCompleteHandler");
        const start = fresh.indexOf("await initializeWithDeadline(appContainer.start()");
        const freshCommit = fresh.indexOf("commitGameAudio(audio)");
        const freshBrowserResume = fresh.indexOf("mainGame.setBrowserSuspended(false)");
        const freshLoopResume = fresh.indexOf("appContainer.setLoopSuspended(false)");
        assert.ok(restoreHook >= 0 && restoreHook < start && start < freshCommit && freshCommit < freshBrowserResume && freshBrowserResume < freshLoopResume);
    });
} finally {
    await server.close();
}
