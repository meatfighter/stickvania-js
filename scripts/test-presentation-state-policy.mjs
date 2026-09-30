import assert from "node:assert/strict";
import { test } from "node:test";
import { withCounterModules } from "./counter-test-utils.mjs";

test("presentation policy follows the real credits producer and rejects contradictory routing", async () => {
    await withCounterModules({}, async (load) => {
        const { Main } = await load("Main");
        const P = await load("persistence/PresentationStatePolicy");
        const T = await load("CreditsText");
        const valid = P.isPresentationSnapshotValid;
        assert.deepEqual(Object.values(P.PRESENTATION_REASON), [
            Main.FADE_REASON_STAIRS,
            Main.FADE_REASON_RESTORE_CHECKPOINT,
            Main.FADE_REASON_SHOW_MAP,
            Main.FADE_REASON_SHOW_INTRO,
            Main.FADE_REASON_SHOW_CONTINUE_SCREEN,
            Main.FADE_REASON_SHOW_TITLE_SCREEN,
            Main.FADE_REASON_SHOW_CASTLE_FALLS,
            Main.FADE_REASON_SHOW_DEMO,
            Main.FADE_REASON_SHOW_CREDITS,
            Main.FADE_REASON_ADVANCE_CREDITS,
            Main.FADE_REASON_SHOW_INPUT_CONFIG
        ]);
        assert.deepEqual(Main.credits, T.CREDITS_TITLES);
        assert.equal(Main.CREDITS2, T.CREDITS_PERSON);
        assert.equal(Main.CREDITS3, T.CREDITS_INSPIRATION);
        assert.equal(Main.CREDITS4, T.CREDITS_PRESENTER);
        const stages = [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4];
        const audio = (requested = "ending") => ({
            currentSong: "ending",
            requestedSong: requested,
            currentMusic: null,
            songs: [{ id: "ending", playing: true, intro: null, loop: { id: "ending.loop", playback: { transport: "playing", looped: true } } }]
        });
        // These are focused boundary records, NOT full serializer fixtures.
        const wrap = (fields, simon = { dead: 0, hurt: false, onStairs: false, y: 100 }) => ({
            mode: fields.mode,
            mainFields: fields,
            stage: { simon: 1 },
            things: [{ id: 1, type: "Simon", fields: simon }],
            audio: audio(fields.mode === Main.MODE_CREDITS ? "stage_1_2" : "ending")
        });
        const base = (mode = Main.MODE_PLAYING) => ({
            mode,
            stageIndex: 0,
            fadeState: 0,
            fade: 0,
            fadeReason: 0,
            players: 4,
            playerPower: 16,
            beatStageFlag: false,
            beatStageDelay: 0,
            time: 200,
            hearts: 5,
            floorBreaking: false,
            titleMenu: 0,
            titleSelectedIndex: 0,
            titleTimeout: 1365
        });
        const clip = (i) => ({
            ...base(Main.MODE_CREDITS),
            stageIndex: stages[i],
            creditsIndex: i,
            recordingIndex: 728,
            creditsPresents: i === 12,
            creditsPaused: false,
            creditsAdvance: false,
            creditsTitleIndex: 0,
            creditsTitleIndex2: 0,
            creditsDelay: 0
        });

        // Call the ACTUAL updateCredits method with only input doubled. Every caption,
        // ordinary waiting period, and accelerated final-card waiting period is covered.
        for (let i = 0; i <= 12; i++)
            for (const press of [false, true]) {
                const main = Object.create(Main.prototype);
                Object.assign(main, clip(i), { controlInput: { isAnyNonDirectionalPressed: () => press } });
                if (i === 12) {
                    main.creditsPaused = true;
                    main.fadeState = Main.FADE_IN;
                    main.fade = 22;
                    main.fadeReason = Main.FADE_REASON_ADVANCE_CREDITS;
                    assert(valid(wrap(main)), "Final-card initialized fade");
                    main.fadeState = Main.FADE_DONE;
                    main.fade = 0;
                    // The real dispatcher immediately calls updateCredits on this boundary.
                    main.updateCredits({});
                }
                let reached = false;
                for (let n = 0; n < 5000; n++) {
                    assert(valid(wrap(main)), `clip ${i}, caption tick ${n}`);
                    if (main.fadeState === Main.FADE_OUT) {
                        reached = true;
                        break;
                    }
                    main.updateCredits({});
                }
                assert(reached, "Caption must request its next transition");
                for (let fade = 0; fade <= 22; fade++) assert(valid(wrap({ ...main, fade })));
            }

        const frozen = Object.create(Main.prototype);
        Object.assign(frozen, clip(4), { recordingIndex: 100, creditsPaused: true, currentSong: null, requestedSong: null, controlInput: { update() {} } });
        for (let i = 0; i < 1000; i++) frozen.updateFrame({});
        assert.equal(frozen.recordingIndex, 100, "Concrete current runtime deadlock witness");
        assert.equal(valid(wrap(frozen)), false);
        assert(valid(wrap(clip(4))), "Unpaused cursor 728 is a legitimate stable boundary");

        const bad = { ...base(), fadeState: Main.FADE_OUT, fade: 22, fadeReason: Main.FADE_REASON_SHOW_TITLE_SCREEN };
        assert.equal(valid(wrap(bad)), false);
        assert.equal(valid(wrap({ ...bad, fadeReason: Main.FADE_REASON_STAIRS })), false);
        assert(valid(wrap({ ...bad, fadeReason: Main.FADE_REASON_STAIRS }, { onStairs: true, hurt: false, y: -62, dead: 0 })));
        const floor = { ...bad, stageIndex: 2, fadeReason: Main.FADE_REASON_SHOW_MAP, floorBreaking: false };
        assert(valid(wrap(floor)), "FloorBreaker exit is not an ordinary completed-tally state");
        assert.equal(valid(wrap({ ...floor, floorBreaking: true })), false);
        for (const mode of [0, 1, 2, 4, 5, 6, 10])
            for (let reason = 0; reason <= 10; reason++) assert(valid(wrap({ ...base(mode), fadeReason: reason })), "Inactive reasons remain harmless");

        const castle = { ...base(7), stageIndex: 5, beatStageFlag: true, beatStageDelay: 0, time: 0, hearts: 0, castleCrumbleRumbleTicks: 505, fadeReason: 6 };
        assert(valid(wrap(castle)));
        assert.equal(valid({ ...wrap(castle), audio: audio("stage_6_1") }), false, "Old inspection request was stale");
        assert.equal(valid({ ...wrap(castle), audio: { ...audio(), currentSong: "stage_1_1" } }), false);
        assert(P.isEndingAudioStateValid(clip(0), audio("stage_1_2")), "Credits retain a distinct queued stage song");
        const afterOrb = { ...base(), stageIndex: 5, beatStageFlag: true };
        assert(
            P.isEndingAudioStateValid(afterOrb, { currentSong: null, requestedSong: "ending", currentMusic: { id: "dracula_dead" } }),
            "Do not reject the one-tick request/promotion boundary after Orb collection"
        );

        const blockedTitle = Object.create(Main.prototype);
        Object.assign(blockedTitle, base(Main.MODE_TITLE_SCREEN), { fade: 12, currentSong: null, requestedSong: null, controlInput: { update() {} } });
        for (let i = 0; i < 100; i++) blockedTitle.updateFrame({});
        assert.equal(blockedTitle.titleTimeout, 1365, "DONE/nonzero fade prevents title input and timeout work");
        assert.equal(valid(wrap(blockedTitle)), false);

        const before = JSON.stringify(wrap(castle));
        for (let i = 0; i < 10; i++) assert(valid(wrap(castle)));
        assert.equal(JSON.stringify(wrap(castle)), before);
    });
});
