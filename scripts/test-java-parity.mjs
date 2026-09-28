import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const STICKVANIA_TS = join(ROOT, "pwa", "src", "stickvania");
const STICKVANIA_JAVA = join(ROOT, "desktop", "src", "stickvania");
const JAVA_PARITY_METADATA = JSON.parse(readProjectFile("scripts", "generated", "java-parity-metadata.json"));

function readProjectFile(...parts) {
    return readFileSync(join(ROOT, ...parts), "utf8");
}

function javaInt(value) {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value <= -0x80000000) {
        return -0x80000000;
    }
    if (value >= 0x7fffffff) {
        return 0x7fffffff;
    }
    const result = Math.trunc(value);
    return result === 0 ? 0 : result;
}

function javaFloat(value) {
    return Math.fround(value);
}

function javaIntDivide(dividend, divisor) {
    dividend = javaInt(dividend);
    divisor = javaInt(divisor);
    if (divisor === 0) {
        throw new RangeError("Java integer division by zero");
    }
    if (dividend === -0x80000000 && divisor === -1) {
        return -0x80000000;
    }
    return javaInt(dividend / divisor);
}

function javaIntRemainder(dividend, divisor) {
    dividend = javaInt(dividend);
    divisor = javaInt(divisor);
    if (divisor === 0) {
        throw new RangeError("Java integer division by zero");
    }
    const result = dividend % divisor;
    return result === 0 ? 0 : result;
}

function simulateSimonJump({ binary32, startY, supportY }) {
    const round = binary32 ? Math.fround : (value) => value;
    const gravity = round(0.130027228);
    const jumpVelocity = round(-4.262100987);
    const ry2 = 63;

    let y = round(startY);
    let vy = jumpVelocity;
    let minimumY = y;
    let apexUpdate = 0;
    const positions = [y];

    for (let update = 1; update <= 1000; update++) {
        const targetY = round(y + vy);
        const y1 = javaInt(round(y + ry2));
        const y2 = javaInt(round(targetY + ry2));
        vy = round(vy + gravity);

        if (targetY < minimumY) {
            minimumY = targetY;
            apexUpdate = update;
        }

        if (vy >= 0) {
            for (let scanY = y1; scanY <= y2; scanY++) {
                if (scanY + 1 === supportY) {
                    y = round(scanY - ry2);
                    vy = round(0);
                    positions.push(y);
                    return {
                        apexUpdate,
                        gravity,
                        jumpVelocity,
                        landingUpdate: update,
                        minimumY,
                        positions
                    };
                }
            }
        }

        y = targetY;
        positions.push(y);
    }

    throw new Error("Simon did not land within 1,000 updates");
}

function compareSimonJump(startY, supportY) {
    const browserDouble = simulateSimonJump({ binary32: false, startY, supportY });
    const javaFloat = simulateSimonJump({ binary32: true, startY, supportY });
    let maximumPositionDelta = 0;
    let differingRenderedYUpdates = 0;

    assert.equal(browserDouble.positions.length, javaFloat.positions.length);
    for (let index = 0; index < browserDouble.positions.length; index++) {
        maximumPositionDelta = Math.max(maximumPositionDelta, Math.abs(browserDouble.positions[index] - javaFloat.positions[index]));
        if (Math.trunc(browserDouble.positions[index]) !== Math.trunc(javaFloat.positions[index])) {
            differingRenderedYUpdates++;
        }
    }

    return {
        browserDouble,
        javaFloat,
        maximumPositionDelta,
        differingRenderedYUpdates
    };
}

function assertClose(actual, expected, tolerance, label) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

function countMatches(text, pattern) {
    return [...text.matchAll(pattern)].length;
}

function collectTypeScriptFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectTypeScriptFiles(path));
        } else if (entry.name.endsWith(".ts")) {
            files.push(path);
        }
    }
    return files;
}

const javaMathSource = readProjectFile("pwa", "src", "stickvania", "JavaMath.ts");
assert.match(
    javaMathSource,
    /export const javaFloat:\s*\(value: number\) => number = Math\.fround;/,
    "javaFloat must remain a direct, allocation-free Math.fround binding"
);
assert.doesNotMatch(javaMathSource, /Float32Array|new\s+Number|Object\.create/, "Java float conversion must not allocate wrapper objects");
assert.match(javaMathSource, /Number\.isNaN\(value\)/);
assert.match(javaMathSource, /JAVA_INT_MIN/);
assert.match(javaMathSource, /JAVA_INT_MAX/);
assert.match(javaMathSource, /dividend === JAVA_INT_MIN && divisor === -1/);

assert.equal(javaInt(Number.NaN), 0);
assert.equal(javaInt(Number.POSITIVE_INFINITY), 0x7fffffff);
assert.equal(javaInt(Number.NEGATIVE_INFINITY), -0x80000000);
assert.equal(javaInt(12.9), 12);
assert.equal(javaInt(-12.9), -12);
assert.equal(Object.is(javaInt(-0.25), -0), false);
assert.equal(javaIntDivide(-0x80000000, -1), -0x80000000);
assert.equal(javaIntDivide(-7, 3), -2);
assert.equal(javaIntRemainder(-7, 3), -1);
assert.equal(Object.is(javaIntRemainder(-0x80000000, -1), -0), false);
assert.throws(() => javaIntDivide(1, 0), RangeError);
assert.throws(() => javaIntRemainder(1, 0), RangeError);

const mainSource = readProjectFile("pwa", "src", "stickvania", "Main.ts");
assert.match(mainSource, /HARD_ATTACK_COOLDOWN_MULTIPLIER: number = javaFloat\(0\.7\)/);
assert.match(mainSource, /trunc\(javaFloat\(baseDelay \* multiplier\)\)/);
assert.equal(Math.trunc(90 * 0.7), 62, "The old browser-double calculation should expose the known edge case");
assert.equal(javaInt(Math.fround(90 * Math.fround(0.7))), 63, "Java float cooldown calculation must produce 63");

const javaMainSource = readProjectFile("desktop", "src", "stickvania", "Main.java");

// This is a narrow source-parity guard, not a substitute for browser/desktop execution.
function normalizeInputReviewBody(body) {
    assert.equal(typeof body, "string", "Missing finishInputConfig method body");
    return body
        .replace(/\/\/[^\r\n]*/g, "")
        .replace(/\bthis\./g, "")
        .replace(/\bMain\./g, "")
        .replace(/\s+/g, " ")
        .trim();
}
const tsFinishInputBody = mainSource.match(/public finishInputConfig\(\): void \{([\s\S]*?)\n    \}/)?.[1];
const javaFinishInputBody = javaMainSource.match(/public void finishInputConfig\(\) \{([\s\S]*?)\n  \}/)?.[1];
const expectedInputReviewBody = "initTitleScreen(); titleMenu = TITLE_MENU_INPUT; titleSelectedIndex = 2;";
assert.equal(
    normalizeInputReviewBody(tsFinishInputBody),
    "invalidateTitleInputMappingCache(); " + expectedInputReviewBody,
    "TS completion must invalidate rows and select Input/Done after one existing title initialization"
);
assert.equal(
    normalizeInputReviewBody(javaFinishInputBody),
    expectedInputReviewBody,
    "Java completion must select the same Input/Done destination without a second input reset"
);
const tsInputOptions = mainSource.match(/TITLE_INPUT_OPTIONS[^=]*=\s*\[([\s\S]*?)\];/)?.[1];
const javaInputOptions = javaMainSource.match(/TITLE_INPUT_OPTIONS[^=]*=\s*\{([\s\S]*?)\};/)?.[1];
for (const [label, options] of [
    ["TS", tsInputOptions],
    ["Java", javaInputOptions]
]) {
    assert.equal(typeof options, "string", `${label}: missing Input option declaration`);
    assert.deepEqual(
        [...options.matchAll(/"([^"]*)"/g)].map((match) => match[1]),
        ["CHANGE", "RESET", "DONE"],
        `${label}: selected index 2 must still mean Done`
    );
}
assert.match(mainSource, /const attributionText = "2010, 2026 MEATFIGHTER\.COM";/);
assert.match(mainSource, /this\.drawString\(attributionText, this\.centerTextX\(attributionText\), 430\);/);
assert.doesNotMatch(mainSource, /@ 2010, 2026 MEATFIGHTER\.COM/);
assert.doesNotMatch(mainSource, /\bcopyrightText\b/);
assert.match(javaMainSource, /String attributionText = "2010, 2026 MEATFIGHTER\.COM";/);
assert.match(javaMainSource, /drawString\(attributionText, centerTextX\(attributionText\), 430\);/);
assert.doesNotMatch(javaMainSource, /@ 2010, 2026 MEATFIGHTER\.COM/);
assert.doesNotMatch(javaMainSource, /\bcopyrightText\b/);
assert.match(javaMainSource, /nextFrameTime \+= Sys\.getTimerResolution\(\) \/ 91;/);
assert.match(mainSource, /nextFrameTime \+= idiv\(Sys\.getTimerResolution\(\), 91\);/);
assert.equal(Math.trunc(1000 / 91), 10, "The historical Windows LWJGL timing expression must remain a 10 ms fixed step");
assert.match(javaMainSource, /checkpoint\.x -= 16 \* 32 \* 2 - 128;/, "Java credits checkpoint source changed; re-audit the TS expression");
assert.doesNotMatch(
    mainSource,
    /checkpoint\.x = javaFloat\(javaFloat\(this\.checkpoint\.x - 16 \* 32 \* 2\) - 128\);/,
    "Credits checkpoint -= expression must preserve Java RHS grouping"
);
assert.equal(
    countMatches(mainSource, /checkpoint\.x = javaFloat\(this\.checkpoint\.x - \(16 \* 32 \* 2 - 128\)\);/g),
    2,
    "Credits cases 2 and 3 must both subtract Java's grouped 896-pixel offset"
);

const checkpointBaseX = javaFloat(4096);
const creditsCheckpointSubtractionDelta = javaFloat(javaFloat(checkpointBaseX - javaFloat(16 * 32 * 2 - 128)) - checkpointBaseX);
const badUngroupedCheckpointSubtractionDelta = javaFloat(javaFloat(javaFloat(checkpointBaseX - 16 * 32 * 2) - 128) - checkpointBaseX);
assert.equal(creditsCheckpointSubtractionDelta, -896);
assert.equal(badUngroupedCheckpointSubtractionDelta, -1152);

const normalJump = compareSimonJump(256, 320);
assert.equal(normalJump.browserDouble.apexUpdate, 33);
assert.equal(normalJump.javaFloat.apexUpdate, 33);
assert.equal(normalJump.browserDouble.landingUpdate, 67);
assert.equal(normalJump.javaFloat.landingUpdate, 67);
assert.equal(normalJump.differingRenderedYUpdates, 0);
assertClose(normalJump.maximumPositionDelta, 0.0000959306251218095, 1e-15, "normal jump maximum position delta");

const longDrop = compareSimonJump(-64, 320);
assert.equal(longDrop.browserDouble.apexUpdate, 33);
assert.equal(longDrop.javaFloat.apexUpdate, 33);
assert.equal(longDrop.browserDouble.landingUpdate, 111);
assert.equal(longDrop.javaFloat.landingUpdate, 111);
assert.equal(longDrop.differingRenderedYUpdates, 0);
assertClose(longDrop.maximumPositionDelta, 0.00029060946104664254, 1e-15, "long-drop maximum position delta");

let gridAlignedJumpCases = 0;
for (let startingSupportY = 0; startingSupportY <= 320; startingSupportY += 32) {
    for (let landingSupportY = startingSupportY; landingSupportY <= 320; landingSupportY += 32) {
        const comparison = compareSimonJump(startingSupportY - 64, landingSupportY);
        assert.equal(comparison.browserDouble.landingUpdate, comparison.javaFloat.landingUpdate);
        assert.equal(comparison.differingRenderedYUpdates, 0);
        gridAlignedJumpCases++;
    }
}
assert.equal(gridAlignedJumpCases, 66);

const javaThingSource = readProjectFile("desktop", "src", "stickvania", "Thing.java");
const javaMermanSpawnerSource = readProjectFile("desktop", "src", "stickvania", "MermanSpawner.java");
const tsMermanSpawnerSource = readProjectFile("pwa", "src", "stickvania", "MermanSpawner.ts");
assert.match(javaThingSource, /public float vy;/);
assert.match(javaMermanSpawnerSource, /private float vy;/);
assert.match(tsMermanSpawnerSource, /private spawnVy: number = javaFloat\(0\);/);
assert.doesNotMatch(tsMermanSpawnerSource, /\b(?:public|private|protected)\s+vy\s*:/);
assert.match(tsMermanSpawnerSource, /new Merman\(this\.main, target, this\.spawnVy, this\)/);

const gameStateSchemaSource = readProjectFile("pwa", "src", "stickvania", "persistence", "GameStateSchema.ts");
assert.match(gameStateSchemaSource, /GAME_STATE_VERSION = 20;/);
for (const spawner of ["BirdSpawner.ts", "MermanSpawner.ts", "ZombieSpawner.ts"]) {
    const source = readProjectFile("pwa", "src", "stickvania", spawner);
    assert.doesNotMatch(source, /Number\.isFinite\(this\.(?:activeCap|count)\)/, `${spawner} still contains obsolete save-migration checks`);
}

const tsconfig = JSON.parse(readProjectFile("pwa", "tsconfig.json"));
assert.equal(tsconfig.compilerOptions.strict, true);
assert.equal(tsconfig.compilerOptions.noImplicitOverride, true);
assert.equal(tsconfig.compilerOptions.strictPropertyInitialization, false);
assert.equal(tsconfig.compilerOptions.useDefineForClassFields, true);

const typeScriptFiles = collectTypeScriptFiles(STICKVANIA_TS);
let combinedTypeScript = "";
for (const file of typeScriptFiles) {
    combinedTypeScript += `\n// ${relative(ROOT, file)}\n${readFileSync(file, "utf8")}`;
}
assert.doesNotMatch(combinedTypeScript, /@ts-nocheck/);
assert.doesNotMatch(combinedTypeScript, /\bas\s+any\b|:\s*any\b|<any>/);
for (const file of typeScriptFiles) {
    const source = readFileSync(file, "utf8");
    for (const line of source.split(/\r?\n/)) {
        assert.doesNotMatch(
            line,
            /\bstatic\s+readonly\b.*=.*\bMain\./,
            `${relative(ROOT, file)} has a Main-dependent static readonly initializer that can trip ES module cycles`
        );
    }
}
assert.doesNotMatch(combinedTypeScript, /Float32Array\s*\(\s*\[/, "Float emulation must not create a temporary typed array");
assert.ok(countMatches(combinedTypeScript, /\boverride\b/g) >= 130, "Expected Java override relationships to be expressed in TypeScript");
assert.ok(countMatches(combinedTypeScript, /\bjavaFloat\b/g) >= 1200, "Expected the Java float semantic pass to remain in place");

const floatFieldRenames = new Map([["MermanSpawner.vy", "spawnVy"]]);
for (const classInfo of JAVA_PARITY_METADATA.classes) {
    const source = readProjectFile("pwa", "src", "stickvania", `${classInfo.className}.ts`);
    for (const javaField of classInfo.floatFields) {
        const tsField = floatFieldRenames.get(`${classInfo.className}.${javaField}`) ?? javaField;
        assert.match(source, new RegExp(`\\b${tsField}: number\\b`), `${classInfo.className}.${javaField} must remain an explicit TypeScript number field.`);
        const roundedInitializer = new RegExp(`\\b${tsField}: number\\s*=\\s*javaFloat\\(`);
        const roundedAssignment = new RegExp(`this\\.${tsField}\\s*=\\s*javaFloat\\(`);
        assert.ok(
            roundedInitializer.test(source) || roundedAssignment.test(source),
            `${classInfo.className}.${javaField} must preserve a Java float32 write boundary.`
        );
    }
}

console.log("Java/TypeScript parity checks passed.");
console.log(
    JSON.stringify(
        {
            hardCooldown90: {
                oldBrowserDouble: Math.trunc(90 * 0.7),
                javaFloat: javaInt(Math.fround(90 * Math.fround(0.7)))
            },
            creditsCheckpointSubtraction: {
                javaParityDelta: creditsCheckpointSubtractionDelta,
                badUngroupedDelta: badUngroupedCheckpointSubtractionDelta
            },
            normalJump: {
                apexUpdate: normalJump.javaFloat.apexUpdate,
                browserHeight: 256 - normalJump.browserDouble.minimumY,
                javaFloatHeight: 256 - normalJump.javaFloat.minimumY,
                landingUpdate: normalJump.javaFloat.landingUpdate,
                maximumPositionDelta: normalJump.maximumPositionDelta,
                differingRenderedYUpdates: normalJump.differingRenderedYUpdates
            },
            topToBottomJump: {
                apexUpdate: longDrop.javaFloat.apexUpdate,
                browserHeight: -64 - longDrop.browserDouble.minimumY,
                javaFloatHeight: -64 - longDrop.javaFloat.minimumY,
                landingUpdate: longDrop.javaFloat.landingUpdate,
                maximumPositionDelta: longDrop.maximumPositionDelta,
                differingRenderedYUpdates: longDrop.differingRenderedYUpdates
            },
            gridAlignedJumpCases
        },
        null,
        2
    )
);

// Narrow source guards complement the executing TS regressions and real Java build.
const orbBoundaryJava = readProjectFile("desktop", "src", "stickvania", "Main.java");
assert.match(orbBoundaryJava, /public void hurtSimon\(int power\) \{\s*if \(beatStage\) \{\s*return;\s*\}\s*syncSimonPhysicsProfile\(\);/);
for (const method of ["intersectsWeapon", "intersectsSimon"]) {
    assert.match(orbBoundaryJava, new RegExp("public boolean " + method + "\\(int[^}]+if \\(beatStage \\|\\| playerPower == 0\\)"));
}
assert.match(orbBoundaryJava, /if \(beatStage \|\| !simon\.whipping \|\| simon\.whipIndex != 2 \|\| simon\.throwing\s*\|\| playerPower == 0\)/);
