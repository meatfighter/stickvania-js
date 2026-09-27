import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { withCounterModules, replace } from "./counter-test-utils.mjs";

async function probe(mutation = (s) => s, sanityMutation = (s) => s) {
    await withCounterModules(
        {
            JavaMath: (s) => s + "\nexport {ResourceLoader};",
            "persistence/StateFieldValuePolicy": mutation,
            "persistence/GameStateSanity": (s) => sanityMutation(s) + "\nexport {isReasonableValue};"
        },
        async (load) => {
            const policy = await load("persistence/StateFieldValuePolicy"),
                { Main } = await load("Main");
            const fields = await load("persistence/StateFieldRegistry.generated");
            const { ResourceLoader } = await load("JavaMath");
            const getResource = ResourceLoader.getResourceAsStream;
            ResourceLoader.getResourceAsStream = (ref) => new Uint8Array(readFileSync(new URL("../pwa/public/" + ref, import.meta.url)));
            let main;
            try {
                main = new Main();
            } finally {
                ResourceLoader.getResourceAsStream = getResource;
            }
            const base = Object.fromEntries(fields.MAIN_PERSISTED_STATE_FIELD_NAMES.map((k) => [k, main[k]]));
            const valid = (f) => policy.isPersistedMainFieldValuesValid({ ...base, ...f });
            assert.equal(valid({}), true, "actual Main defaults");
            assert.equal(valid({ mode: Main.MODE_MAP, players: 100 }), true, "MAP100 positive");
            for (const [mode, players] of [
                [Main.MODE_PLAYING, 100],
                [Main.MODE_MAP, 101]
            ])
                assert.equal(valid({ mode, players }), false, "life boundary");
            for (const n of [91, 92, 2147483647]) assert.equal(valid({ timeIncrementor: n }), true, "clock range");
            const { isReasonableValue } = await load("persistence/GameStateSanity");
            assert.equal(isReasonableValue({ timeIncrementor: 92 }, "mainFields", 0), true, "independent sanity clock");
            assert.equal(valid({ mode: Main.MODE_DEMO, demoIndex: 2, recordingIndex: 2730 }), true, "demo terminal sentinel");
            assert.equal(valid({ mode: Main.MODE_DEMO, demoIndex: 3 }), false, "demo index");
            assert.equal(valid({ mode: Main.MODE_DEMO, demoIndex: 0, recordingIndex: 2731 }), false, "demo cursor");
            assert.equal(valid({ mode: Main.MODE_CREDITS, creditsIndex: 12, creditsPresents: true, recordingIndex: 728 }), true, "credits terminal sentinel");
            assert.equal(
                valid({ mode: Main.MODE_CREDITS, creditsIndex: 12, creditsPresents: true, recordingIndex: 727 }),
                false,
                "credits sentinel implication"
            );
            assert.equal(valid({ mode: Main.MODE_CREDITS, creditsIndex: 11, creditsPresents: false, recordingIndex: 729 }), false, "credits cursor");
            assert.equal(valid({ mode: Main.MODE_TITLE_SCREEN, creditsIndex: 12, creditsPresents: false, recordingIndex: 2730 }), true, "inactive credits");
            for (const type of ["Bat", "MedusaHead", "Dog", "Simon"]) {
                const C = (await load(type))[type];
                const actor = new C(main, 128, 128, Main.RIGHT);
                const captured = Object.fromEntries(fields.THING_PERSISTED_STATE_FIELD_NAMES[type].map((k) => [k, actor[k]]));
                const check = (f) => policy.isPersistedThingFieldValuesValid({ id: 0, type, fields: f }, new Map([[0, type]]), 1);
                assert.equal(check(captured), true, "actual actor constructor " + type);
                for (const [name, [lo, hi]] of Object.entries(policy.PROVEN_THING_INTEGER_RANGES[type])) {
                    assert.equal(check({ ...captured, [name]: hi }), true, "actor upper positive");
                    for (const n of [lo - 1, hi + 1, 0.5])
                        assert.equal(check({ ...captured, [name]: n }), false, "actor indexed negative " + type + "." + name);
                }
                if (type === "Simon") assert.equal(check({ ...captured, whipIncrementor: 45 }), true, "retained45");
            }
            // Nullable references use the serializer's plain-null encoding too.
            const { Boomerang } = await load("Boomerang");
            main.simon = new (await load("Simon")).Simon(main);
            main.mode = Main.MODE_PLAYING;
            main.time = 300;
            const boomerang = new Boomerang(main, 128, 128, Main.RIGHT);
            const captured = Object.fromEntries(fields.THING_PERSISTED_STATE_FIELD_NAMES.Boomerang.map((k) => [k, boomerang[k]]));
            assert.equal(
                policy.isPersistedThingFieldValuesValid({ id: 0, type: "Boomerang", fields: captured }, new Map([[0, "Boomerang"]]), 1),
                true,
                "nullable capture"
            );
        }
    );
}
test("Stickvania bounds and sentinels defeat targeted mutants", async () => {
    await probe();
    for (const [from, to] of [
        ["fields.mode === Main.MODE_MAP ? 100 : 99", "99"],
        ["fields.mode === Main.MODE_MAP ? 100 : 99", "100"],
        ["isIntegerInRange(value, 0, JAVA_INT_MAX)", "isIntegerInRange(value, 0, 90)"],
        ["isIntegerInRange(fields.demoIndex, 0, 2)", "isIntegerInRange(fields.demoIndex, 0, 3)"],
        ["isIntegerInRange(fields.recordingIndex, 0, 2730)", "isIntegerInRange(fields.recordingIndex, 0, 2729)"],
        ["isIntegerInRange(cursor, 0, 728)", "isIntegerInRange(cursor, 0, 727)"],
        ["isIntegerInRange(cursor, 0, 728)", "isIntegerInRange(cursor, 0, 729)"],
        ["isIntegerInRange(fields.recordingIndex, 0, 2730)", "isIntegerInRange(fields.recordingIndex, 0, 2731)"],
        ["isIntegerInRange(index, 0, 12)", "isIntegerInRange(index, 0, 11)"],
        ["if (fields.mode === Main.MODE_CREDITS)", "if (fields.mode === Main.MODE_CREDITS || fields.mode === Main.MODE_TITLE_SCREEN)"],
        ["fields.mode === Main.MODE_MAP ? 100 : 99", "fields.mode === Main.MODE_MAP ? 101 : 99"],
        ["whipIncrementor: [0, 45]", "whipIncrementor: [0, 44]"],
        ["if (range !== undefined) return isIntegerInRange(value, range[0], range[1]);", "if (range !== undefined) return true;"]
    ])
        await assert.rejects(
            probe((s) => replace(s, from, to)),
            (e) =>
                e.code === "ERR_ASSERTION" &&
                /MAP100|life boundary|clock range|demo index|sentinel|retained45|indexed negative|cursor|inactive credits/.test(e.message)
        );
    await assert.rejects(
        probe(
            (s) => s,
            (s) => replace(s, "Number.isInteger(value) && value >= 0 && value <= JAVA_INT_MAX", "Number.isInteger(value) && value >= 0 && value <= 90")
        ),
        (e) => e.code === "ERR_ASSERTION" && /sanity clock/.test(e.message)
    );
    for (const type of ["Bat", "MedusaHead", "Dog", "Simon"]) {
        await assert.rejects(
            probe((s) =>
                replace(
                    s,
                    "const range = PROVEN_THING_INTEGER_RANGES[type]?.[name];",
                    `if (type === "${type}" && name === "${type === "Simon" ? "walkSpriteIndex" : "spriteIndex"}") return true; const range = PROVEN_THING_INTEGER_RANGES[type]?.[name];`
                )
            ),
            (e) => e.code === "ERR_ASSERTION" && e.message.includes("actor indexed negative " + type)
        );
    }
    await assert.rejects(
        probe((s) =>
            replace(
                s,
                "const range = PROVEN_THING_INTEGER_RANGES[type]?.[name];",
                'if (type === "Dog" && name === "STATE_RUNNING") return true; const range = PROVEN_THING_INTEGER_RANGES[type]?.[name];'
            )
        ),
        (e) => e.code === "ERR_ASSERTION" && e.message.includes("Dog.STATE_RUNNING")
    );
    await probe();
});

async function mapProducer(mutate = (s) => s) {
    await withCounterModules({ Main: mutate }, async (load) => {
        const { Main } = await load("Main");
        const main = Object.create(Main.prototype);
        Object.assign(main, { players: 99, stageIndex: 0, clearInputPressedRecords() {}, createStage() {}, requestMusic() {} });
        main.initMapScreen();
        assert.equal(main.players, 100, "actual MAP producer must borrow the hundredth life");
    });
}
test("MAP clamp mutant fails the actual Main producer", async () => {
    await mapProducer();
    await assert.rejects(
        mapProducer((s) => replace(s, "this.players++;", "this.players = Math.min(99, this.players + 1);")),
        (e) => e.code === "ERR_ASSERTION" && /hundredth life/.test(e.message)
    );
    await mapProducer();
});
