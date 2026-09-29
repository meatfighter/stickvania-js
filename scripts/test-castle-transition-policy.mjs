import assert from "node:assert/strict";
import { test } from "node:test";
import { rumbleMutationPlugin } from "./rumble-mutation-plugin.mjs";
import { withCounterModules } from "./counter-test-utils.mjs";

test("castle transition policy follows Main's actual dispatcher and stable phases", async () => {
    await withCounterModules(
        { "persistence/CastlePresentationPhasePolicy": (s) => rumbleMutationPlugin().transform(s, "/persistence/CastlePresentationPhasePolicy.ts") ?? s },
        async (load) => {
            const { Main } = await load("Main");
            const { isCastleTransitionValid: valid } = await load("persistence/CastlePresentationPhasePolicy");
            const { isCastlePresentationValid: spatial } = await load("../rumble/CastleCrumbleTimeline");
            assert.deepEqual(
                [
                    Main.MODE_PLAYING,
                    Main.MODE_CASTLE_FALLS,
                    Main.FADE_DONE,
                    Main.FADE_OUT,
                    Main.FADE_IN,
                    Main.FADE_REASON_SHOW_CASTLE_FALLS,
                    Main.FADE_REASON_SHOW_CREDITS
                ],
                [4, 7, 0, 1, 2, 6, 8]
            );
            // Scalar boundary seed. Use real dispatcher/castle methods with input/audio no-ops.
            // Full stage/store/document restoration belongs to RumbleCastleVerification.
            const main = Object.create(Main.prototype);
            Object.assign(main, {
                mode: Main.MODE_PLAYING,
                stageIndex: 5,
                beatStageFlag: true,
                beatStageDelay: 0,
                playerPower: 16,
                time: 0,
                hearts: 0,
                fadeState: Main.FADE_OUT,
                fade: 22,
                fadeReason: Main.FADE_REASON_SHOW_CASTLE_FALLS,
                castleCrumbleRumbleTicks: 0,
                castleFallSparkX: 0,
                castleFallSparkY: 0,
                rumble: null,
                browserSuspended: false,
                currentSong: null,
                requestedSong: null,
                controlInput: { update() {} },
                random: { nextInt: () => 0 }
            });
            const frame = () => main.updateFrame({});
            const incoming = { ...main };
            for (let fade = 0; fade <= 22; fade++) assert(valid({ ...incoming, fade }));
            frame(); // Actual FADE_OUT dispatcher invokes initCastleFalls, then establishes FADE_IN.
            for (let fade = 22; fade >= 0; fade--) {
                assert.equal(main.fade, fade);
                assert.equal(main.castleCrumbleRumbleTicks, 0);
                assert(valid(main) && spatial(main));
                if (fade > 0) frame();
            }
            let middle;
            for (let tick = 1; tick <= 813; tick++) {
                frame();
                assert.equal(main.castleCrumbleRumbleTicks, tick);
                assert(valid(main) && spatial(main), `stable castle tick ${tick}`);
                if (tick === 505) middle = { ...main };
            }
            frame(); // Terminal dispatch does NOT increment the counter beyond 813.
            for (let fade = 0; fade <= 22; fade++) {
                assert.equal(main.fade, fade);
                assert.equal(main.castleCrumbleRumbleTicks, 813);
                assert(valid(main) && spatial(main));
                if (fade < 22) frame();
            }
            let creditsEntered = 0;
            main.initCredits = () => {
                creditsEntered++;
                main.mode = Main.MODE_CREDITS;
            };
            frame();
            assert.equal(creditsEntered, 1);
            assert.equal(main.mode, Main.MODE_CREDITS);

            // Spatial validity alone is insufficient; only one active phase triple is valid mid-fall.
            for (const fadeState of [0, 1, 2])
                for (let fade = 0; fade <= 22; fade++) {
                    for (let fadeReason = 0; fadeReason <= 10; fadeReason++) {
                        const candidate = { ...middle, fadeState, fade, fadeReason };
                        assert(spatial(candidate));
                        assert.equal(valid(candidate), fadeState === 0 && fade === 0 && fadeReason === 6, "Only DONE/0/SHOW_CASTLE_FALLS is valid mid-fall");
                    }
                }
            for (const [key, value] of Object.entries({
                stageIndex: 0,
                beatStageFlag: false,
                beatStageDelay: 7,
                playerPower: 15,
                time: 1,
                hearts: 1
            })) {
                assert.equal(valid({ ...middle, [key]: value }), false, `castle ${key}`);
                assert.equal(valid({ ...incoming, [key]: value }), false, `pending entry ${key}`);
            }
            for (const mode of [0, 1, 2, 4, 5, 6, 8, 10]) {
                assert.equal(valid({ ...middle, mode, fadeState: 1, fadeReason: 8 }), false);
                // Preserve stale reasons/castle counters that carry no active transition authority.
                assert(valid({ mode, fadeState: 0, fade: 0, fadeReason: 8, castleCrumbleRumbleTicks: 813 }));
            }
            const bootstrap = { ...incoming, mode: 7, fadeState: 2, fade: 22, fadeReason: 0 };
            assert.equal(valid(bootstrap), false, "old inspection bootstrap is not canonical");
            assert(valid({ ...bootstrap, fadeReason: 6 }));
        }
    );
});
