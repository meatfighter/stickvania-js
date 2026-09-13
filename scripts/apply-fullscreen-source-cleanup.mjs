import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const mainPath = "pwa/src/stickvania/Main.ts";
const stateTestPath = "scripts/test-pwa-state-hardening.mjs";
const mainStatePolicyPath = "pwa/src/stickvania/persistence/MainStateFieldPolicy.ts";
let mainSource = readFileSync(mainPath, "utf8");
let stateTestSource = readFileSync(stateTestPath, "utf8");
let mainStatePolicySource = readFileSync(mainStatePolicyPath, "utf8");

for (const [pattern, label] of [
    [/    BufferUtils,\n/, "BufferUtils import"],
    [/    Cursor,\n/, "Cursor import"],
    [/    CursorLoader,\n/, "CursorLoader import"],
    [/    Mouse,\n/, "Mouse import"]
]) {
    mainSource = replaceExactlyOnce(mainSource, pattern, "", label);
}

mainSource = replaceExactlyOnce(
    mainSource,
    /\ntype BrowserFullscreenController = \{\n    isFullscreen\(\): boolean;\n    enterFullscreen\(\): void;\n    exitFullscreen\(\): void;\n\};\n/,
    "\n",
    "BrowserFullscreenController type"
);
mainSource = replaceExactlyOnce(mainSource, /\n    private nativeCursor: Cursor \| null = null;/, "", "nativeCursor field");
mainSource = replaceExactlyOnce(
    mainSource,
    /\n    public browserFullscreenController: BrowserFullscreenController \| null = null;/,
    "",
    "browserFullscreenController field"
);
mainSource = replaceExactlyOnce(
    mainSource,
    /\n        const fullscreenController = this\.browserFullscreenController;[\s\S]*?\n        this\.controlInput!\.update\(\);/,
    "\n        this.controlInput!.update();",
    "browser fullscreen update block"
);
mainSource = replaceExactlyOnce(
    mainSource,
    /\n        const fullscreenText = "SPACE - FULL-SCREEN MODE";\n        this\.drawString\(fullscreenText, trunc\(\(640 - fullscreenText\.length \* 16\) \/ 2\), 400\);/,
    "",
    "browser fullscreen title instruction"
);
mainSource = replaceExactlyOnce(
    mainSource,
    /\n    private showMouseCursor\(\): void \{[\s\S]*?\n    \}\n\n    private hideMouseCursor\(\): void \{[\s\S]*?\n    \}\n(?=\n    (?:public|private|protected) )/,
    "\n",
    "translated cursor fullscreen helpers"
);

for (const forbidden of [
    "BrowserFullscreenController",
    "browserFullscreenController",
    "SPACE - FULL-SCREEN MODE",
    "showMouseCursor",
    "hideMouseCursor",
    "BufferUtils",
    "CursorLoader",
    "Mouse.",
    "nativeCursor"
]) {
    if (mainSource.includes(forbidden)) {
        throw new Error(`Cleanup incomplete: ${forbidden} still exists in ${mainPath}`);
    }
}

stateTestSource = replaceExactlyOnce(
    stateTestSource,
    /\n    const obsolete = createPotentialSnapshot\(9\);\n    const obsoleteText = JSON\.stringify\(obsolete\);\n    storage\.setItem\(GAME_STATE_STORAGE_KEY, obsoleteText\);\n    assert\.equal\(hasPotentialStoredStickvaniaGameState\(storage\), false\);\n    assert\.equal\(storage\.getItem\(GAME_STATE_STORAGE_KEY\), obsoleteText\);\n/,
    "\n",
    "obsolete v9 save fixture"
);
if (/\bcreatePotentialSnapshot\(9\)/.test(stateTestSource)) {
    throw new Error(`Old development save fixture still exists in ${stateTestPath}`);
}

for (const [pattern, label] of [
    [/\n    nativeCursor: "runtime",/, "nativeCursor state-field policy entry"],
    [/\n    browserFullscreenController: "runtime",/, "browserFullscreenController state-field policy entry"]
]) {
    mainStatePolicySource = replaceExactlyOnce(mainStatePolicySource, pattern, "", label);
}
for (const forbidden of ["nativeCursor", "browserFullscreenController"]) {
    if (mainStatePolicySource.includes(forbidden)) {
        throw new Error(`Obsolete fullscreen state-field policy ${forbidden} still exists in ${mainStatePolicyPath}`);
    }
}

writeFileSync(mainPath, mainSource);
writeFileSync(stateTestPath, stateTestSource);
writeFileSync(mainStatePolicyPath, mainStatePolicySource);
unlinkSync(fileURLToPath(import.meta.url));
console.log(
    "Removed obsolete Stickvania browser fullscreen/cursor machinery, pre-release save-schema fixture, and stale state-field policy entries; cleanup helper deleted itself. Regenerate StateFieldRegistry.generated.ts with npm run generate:state-fields before qualification."
);

function replaceExactlyOnce(text, pattern, replacement, label) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    const matches = [...text.matchAll(globalPattern)];
    if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${label}; found ${matches.length}. Source was not modified.`);
    }
    return text.replace(pattern, replacement);
}
