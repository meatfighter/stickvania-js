import assert from "node:assert/strict";
import { test } from "node:test";
import { withCounterModules } from "./counter-test-utils.mjs";

test("empty drops never enter stacks, in gameplay or recorded presentations", async () => {
    await withCounterModules({}, async (load) => {
        const { Main } = await load("Main");
        const { ThingStack } = await load("ThingStack");
        const { Candles } = await load("Candles");
        const { Torch } = await load("Torch");
        const { BreakWall } = await load("BreakWall");
        const { BoneDragon } = await load("BoneDragon");
        const { JavaRandom } = await load("@slick");
        for (const mode of [Main.MODE_PLAYING, Main.MODE_DEMO, Main.MODE_CREDITS]) {
            const main = Object.create(Main.prototype);
            Object.assign(main, {
                mode,
                difficulty: Main.DIFFICULTY_NORMAL,
                weaponType: Main.WEAPON_TYPE_NONE,
                regionThingStack: new ThingStack(),
                random: new JavaRandom(0xdeadbeef | 0),
                intersectsWhip: () => true,
                intersectsWeapon: () => false,
                playSound: () => {},
                playRumble: () => {},
                removeBlock: () => {},
                addPoints: () => {},
                adjustEnemyHits: (hits) => hits
            });
            const original = { x: 0, onDiscarded() {} };
            main.pushThing(original);
            main.pushThing(null);
            main.pushThing(undefined); // Runtime defensive boundary, not a TS call contract.
            assert.equal(main.regionThingStack.top, 0);
            assert.equal(main.regionThingStack.pop(), original);
            assert.equal(main.regionThingStack.pop(), null);
            const buckets = [new ThingStack()];
            main.pushThing(buckets, null);
            assert.equal(buckets[0].top, -1);
            const stack = new ThingStack();
            assert.throws(() => stack.push(null), /null Thing/);
            assert.equal(stack.top, -1);
            const assertDense = (count) => {
                const s = main.regionThingStack;
                assert.equal(s.top + 1, count);
                assert.ok(s.things.slice(0, s.top + 1).every((value) => value != null));
            };
            for (const [make, count] of [
                [() => new Candles(main, 64, 64, Main.CANDLE_ITEM_EMPTY), 2],
                [() => new Torch(main, 64, 64, Main.CANDLE_ITEM_EMPTY), 3],
                [() => new BreakWall(main, 2, 2, Main.CANDLE_ITEM_EMPTY), 5]
            ]) {
                main.regionThingStack = new ThingStack();
                main.pushThing(original);
                assert.equal(make().update({}), false);
                assertDense(count); // Original actor plus the real surviving effects.
            }
            main.regionThingStack = new ThingStack();
            main.pushThing(original);
            const dragon = new BoneDragon(main, 128, 128, Main.CANDLE_ITEM_EMPTY, false);
            dragon.hits = 1;
            assert.equal(dragon.update({}), true);
            assert.equal(dragon.dead, true);
            assertDense(3); // Original, spark and flame; no empty item.
            for (let i = 0; i < 6; i++) {
                dragon.deadDelay = 1; // Boundary seed; execute the real producer.
                assert.equal(dragon.update({}), i < 5);
                assertDense(4 + i);
            }
        }
    });
});
