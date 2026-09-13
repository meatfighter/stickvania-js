import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const targetPath = "pwa/src/stickvania/Main.ts";
let source = readFileSync(targetPath, "utf8");

source = replaceExactlyOnce(
    source,
    /\ntype BrowserFullscreenController = \{\n    isFullscreen\(\): boolean;\n    enterFullscreen\(\): void;\n    exitFullscreen\(\): void;\n\};\n/,
    "\n",
    "BrowserFullscreenController type"
);
source = replaceExactlyOnce(
    source,
    /\n    public browserFullscreenController: BrowserFullscreenController \| null = null;\n/,
    "\n",
    "browserFullscreenController field"
);
source = replaceExactlyOnce(
    source,
    /\n        const fullscreenController = this\.browserFullscreenController;[\s\S]*?\n        this\.controlInput!\.update\(\);/,
    "\n        this.controlInput!.update();",
    "browser fullscreen update block"
);
source = replaceExactlyOnce(
    source,
    /\n        const fullscreenText = "SPACE - FULL-SCREEN MODE";\n        this\.drawString\(fullscreenText, trunc\(\(640 - fullscreenText\.length \* 16\) \/ 2\), 400\);/,
    "",
    "browser fullscreen title instruction"
);

for (const forbidden of ["BrowserFullscreenController", "browserFullscreenController", "SPACE - FULL-SCREEN MODE"]) {
    if (source.includes(forbidden)) {
        throw new Error(`Cleanup incomplete: ${forbidden} still exists in ${targetPath}`);
    }
}

writeFileSync(targetPath, source);
unlinkSync(fileURLToPath(import.meta.url));
console.log(`Removed obsolete PWA fullscreen machinery from ${targetPath}; cleanup helper deleted itself.`);

function replaceExactlyOnce(text, pattern, replacement, label) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    const matches = [...text.matchAll(globalPattern)];
    if (matches.length !== 1) {
        throw new Error(`Expected exactly one ${label}; found ${matches.length}. Source was not modified.`);
    }
    return text.replace(pattern, replacement);
}
