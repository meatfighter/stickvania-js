import assert from "node:assert/strict";
import { test } from "node:test";
import { withCounterModules } from "./counter-test-utils.mjs";

test("actual decimal renderer and resource awards preserve Java behavior", async () => {
    await withCounterModules({}, async (load) => {
        const { Main } = await load("Main");
        const main = Object.create(Main.prototype);
        const calls = [];
        const glyphs = Array.from({ length: 256 }, (_, code) => ({
            draw(x, y) {
                calls.push({ code, x, y });
            }
        }));
        main.symbols = glyphs;
        for (const [score, expected] of [
            [0, "000000"],
            [1, "000001"],
            [999999, "999999"],
            [1000000, "000000"],
            [1234567, "234567"]
        ]) {
            calls.length = 0;
            main.score = score;
            main.drawNumber(score, 6, 160, 32);
            const sorted = calls.toSorted((a, b) => a.x - b.x);
            assert.equal(sorted.map((c) => String.fromCharCode(c.code)).join(""), expected);
            assert.equal(sorted.at(-1).x, 240);
            assert.equal(main.score, score, "render never changes logical score");
        }
        let sounds = 0;
        main.playSound = () => sounds++;
        for (const count of [98, 99]) {
            main.players = count;
            main.addPlayers(1);
            assert.equal(main.players, 99);
            main.hearts = count;
            main.addHearts(1);
            assert.equal(main.hearts, 99);
        }
        assert.equal(sounds, 2, "one-up cue occurs even at cap");
        main.score = 29990;
        main.players = 98;
        main.addPoints(10);
        assert.equal(main.score, 30000);
        assert.equal(main.players, 99);
        main.addPoints(50000);
        assert.equal(main.score, 80000);
        assert.equal(main.players, 99);
        assert.equal(sounds, 4);
        main.playerPower = 1;
        main.restoreHealth();
        assert.equal(main.playerPower, 16);
    });
});
