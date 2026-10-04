import "./validator-common.test.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { ResourceLoader } from "slick2d-ts";
import { execFileSync } from "node:child_process";
import { Main } from "../../pwa/src/stickvania/Main.ts";
import { Dog } from "../../pwa/src/stickvania/Dog.ts";
import { Bat } from "../../pwa/src/stickvania/Bat.ts";
import { THING_PERSISTED_STATE_FIELD_NAMES, MAIN_PERSISTED_STATE_FIELD_NAMES } from "../../pwa/src/stickvania/persistence/StateFieldRegistry.generated.ts";
import { isPersistedThingFieldValuesValid, isPersistedMainFieldValuesValid } from "../../pwa/src/stickvania/persistence/StateFieldValuePolicy.ts";
import { THING_INTEGER_FIELDS } from "../../pwa/src/stickvania/persistence/ThingIntegerFields.generated.ts";

// Use the shipped recordings, not invented data, when constructing the real Main.
for (const name of readdirSync("desktop/src/recordings")) {
    if (name.endsWith(".dat")) ResourceLoader.registerResource(`recordings/${name}`, readFileSync(`desktop/src/recordings/${name}`));
}

function fields(type, instance) {
    return Object.fromEntries(THING_PERSISTED_STATE_FIELD_NAMES[type].map((key) => [key, instance[key]]));
}
function neutralMain() {
    const main = new Main();
    main.timeFrozen = 0;
    main.camera = 0;
    main.intersectsWhip = () => false;
    main.intersectsWeapon = () => false;
    main.intersectsSimon = () => false;
    main.simon = { x: 512, y: 100 };
    return main;
}
for (const Type of [Bat, Dog])
    test(`${Type.name}: constructor/update values satisfy explicit field policy`, () => {
        const main = neutralMain(),
            actor = Type === Bat ? new Bat(main, 200, 160, Main.RIGHT) : new Dog(main, 0, 160);
        const values = new Set();
        for (let tick = 0; tick < 100; tick++) {
            const record = fields(Type.name, actor);
            values.add(record.spriteIndex);
            assert.equal(isPersistedThingFieldValuesValid({ type: Type.name, id: 0, fields: record }, new Map([[0, Type.name]]), 0), true);
            actor.update({});
        }
        if (Type === Bat) assert.deepEqual([...values].sort(), [0, 1, 2, 3]);
        else assert.deepEqual([...values], [1]);
    });

test("all Java integer field classifications are reproducible and not English-name guesses", () => {
    execFileSync(process.execPath, ["scripts/generate-persistence-integer-fields.mjs", "--check"], { stdio: "pipe" });
    assert.ok(THING_INTEGER_FIELDS.Simon.includes("dead"));
    assert.ok(THING_INTEGER_FIELDS.Dog.includes("spriteIndex"));
    assert.ok(!THING_INTEGER_FIELDS.Bat.includes("angle"));
    const source = readFileSync("pwa/src/stickvania/persistence/StateFieldValuePolicy.ts", "utf8");
    assert.doesNotMatch(source, /inferStaticIntegerValues|name\.endsWith\("(?:Delay|Timer)"\)/);
});

test("large finite dormant values remain data, while explicit sprite domains remain constrained", () => {
    const main = neutralMain();
    const bat = new Bat(main, 200, 160, Main.RIGHT),
        record = fields("Bat", bat);
    record.x = 1e6;
    record.vx = 1024;
    record.angle = 1e20;
    assert.equal(isPersistedThingFieldValuesValid({ type: "Bat", id: 0, fields: record }, new Map([[0, "Bat"]]), 0), true);
    record.spriteIndex = 4;
    assert.equal(isPersistedThingFieldValuesValid({ type: "Bat", id: 0, fields: record }, new Map([[0, "Bat"]]), 0), false);
    record.spriteIndex = 0;
    record.spriteDelay = 0.5;
    assert.equal(isPersistedThingFieldValuesValid({ type: "Bat", id: 0, fields: record }, new Map([[0, "Bat"]]), 0), false);
});

test("MAP life sentinel and dormant countdown fixes remain intact", () => {
    const main = new Main();
    main.mode = Main.MODE_MAP;
    main.players = 100;
    main.titleBatAngle = 1e20;
    main.timeIncrementor = 1000001;
    const record = Object.fromEntries(MAIN_PERSISTED_STATE_FIELD_NAMES.map((key) => [key, main[key]]));
    assert.equal(isPersistedMainFieldValuesValid(record), true);
    assert.equal(isPersistedMainFieldValuesValid({ ...record, mode: Main.MODE_PLAYING }), false);
});
