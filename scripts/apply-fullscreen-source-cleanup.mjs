import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const mainPath = "pwa/src/stickvania/Main.ts";
const stateTestPath = "scripts/test-pwa-state-hardening.mjs";
let mainSource = readFileSync(mainPath, "utf8");
let stateTestSource = readFileSync(stateTestPath, "utf8");

mainSource = replaceExactlyOnce(
    mainSource,
    /\ntype BrowserFullscreenController = \{\n    isFullscreen\(\): boolean;\n    enterFullscreen\(\): void;\n    exitFullscreen\(\): void;\n\};\n/,
    "\n",
    "BrowserFullscreenController type"
);
mainSource = replaceExactlyOnce(
    mainSource,
    /\n    public browserFullscreenController: BrowserFullscreenController \| null = null;\n/,
    "\n",
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

for (const forbidden of ["BrowserFullscreenController", "browserFullscreenController", "SPACE - FULL-SCREEN MODE"]) {
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

writeFileSync(mainPath, mainSource);
writeFileSync(stateTestPath, stateTestSource);
unlinkSync(fileURLToPath(import.meta.url));
console.log("Removed obsolete Stickvania browser fullscreen machinery and pre-release save-schema fixture; cleanup helper deleted itself.");

function replaceExactlyOnce(text, pattern, replacement, label) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    const matches = [...text.matchAll(globalPattern)];
    if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${label}; found ${matches.length}. Source was not modified.`);
    }
    return text.replace(pattern, replacement);
}
