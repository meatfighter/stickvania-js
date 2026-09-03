import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { rootDir } from "./build-utils.mjs";

const mainSource = readFileSync(join(rootDir, "pwa", "src", "main.ts"), "utf8");
const wrapperSource = readFileSync(join(rootDir, "pwa", "src", "stickvania", "StickvaniaBufferedGame.ts"), "utf8");
const stylesSource = readFileSync(join(rootDir, "pwa", "src", "styles.css"), "utf8");
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(join(rootDir, "package-lock.json"), "utf8"));

test("Stickvania PWA uses the 512x416 buffered viewport wrapper", () => {
    assert.match(mainSource, /new runtime\.StickvaniaBufferedGame\(mainGame,\s*scalingPreference\)/);
    assert.match(mainSource, /new runtime\.slick\.AppGameContainer\(bufferedGame,/);
    assert.doesNotMatch(mainSource, /new runtime\.ScalableGame2\(/);
    assert.doesNotMatch(mainSource, /import\("\.\/stickvania\/ScalableGame2\.js"\)/);
    assert.doesNotMatch(mainSource, /mainGame\.scalableGame\s*=/);
});

test("the native framebuffer is exactly the visible viewport and supports all presentation modes", () => {
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_X\s*=\s*64/);
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_Y\s*=\s*32/);
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_WIDTH\s*=\s*512/);
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_HEIGHT\s*=\s*416/);
    assert.match(wrapperSource, /super\(new StickvaniaViewportGame\(held\),\s*STICKVANIA_VIEWPORT_WIDTH,\s*STICKVANIA_VIEWPORT_HEIGHT,/);
    assert.match(wrapperSource, /scalingMode:\s*getBufferedScalingMode\(scalingPreference\)/);
    assert.match(wrapperSource, /case "smooth":[\s\S]*?return BufferedScalingMode\.Linear/);
    assert.match(wrapperSource, /case "crisp":[\s\S]*?return BufferedScalingMode\.Nearest/);
    assert.match(wrapperSource, /case "pixel-perfect":[\s\S]*?return BufferedScalingMode\.Integer/);
    assert.match(wrapperSource, /setScalingPreference\(preference: StickvaniaScalingPreference\): void/);
});

test("input is remapped back to Stickvania's original logical viewport", () => {
    assert.match(wrapperSource, /public override recalculateScale\(\): void/);
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_WIDTH\s*\/\s*this\.targetWidth/);
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_HEIGHT\s*\/\s*this\.targetHeight/);
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_X\s*-\s*this\.xoffset\s*\*\s*inputScaleX/);
    assert.match(wrapperSource, /STICKVANIA_VIEWPORT_Y\s*-\s*this\.yoffset\s*\*\s*inputScaleY/);
});

test("the browser compositor is not asked to pixelate the already-smoothed canvas", () => {
    assert.doesNotMatch(stylesSource, /image-rendering\s*:\s*pixelated/);
});

test("the PWA menu persists the requested scaling preference", () => {
    assert.match(mainSource, /const DEFAULT_VOLUME = 0\.1;/);
    assert.match(mainSource, /const DEFAULT_RUMBLE_ENABLED = true;/);
    assert.match(mainSource, /const DEFAULT_DISPLAY_MODE: DisplayModePreference = "light";/);
    assert.match(mainSource, /const DEFAULT_SCALING_PREFERENCE: StickvaniaScalingPreference = "crisp";/);
    assert.match(mainSource, /getBrowserStorageKey\("scaling"\)/);
    assert.match(mainSource, /id="scaling-picker"/);
    assert.match(mainSource, /id="scaling-button"/);
    assert.match(mainSource, /id="scaling-list"/);
    assert.match(mainSource, /id="display-mode-button" class="theme-picker-button display-mode-button"/);
    assert.match(mainSource, /<span class="picker-caret" aria-hidden="true"><\/span>/);
    assert.doesNotMatch(mainSource, /id="scaling-select"/);
    assert.doesNotMatch(stylesSource, /rotate\(180deg\)/);
    assert.match(mainSource, /<span>Scaling<\/span>/);
    assert.match(mainSource, /value: "smooth", label: "Smooth"/);
    assert.match(mainSource, /value: "crisp", label: "Crisp"/);
    assert.match(mainSource, /value: "pixel-perfect", label: "Pixel Perfect"/);
    assert.match(mainSource, /activeBufferedGame\?\.setScalingPreference\(value\)/);
    assert.match(mainSource, /if \(value === "false"\) {\s*return false;\s*}/);
    assert.match(wrapperSource, /constructor\(held: Game, scalingPreference: StickvaniaScalingPreference = "crisp"\)/);
});

test("the PWA menu has a full local reset escape hatch", () => {
    assert.match(mainSource, /const PWA_RESET_STORAGE_KEYS = \[/);
    assert.match(mainSource, /GAME_STATE_STORAGE_KEY/);
    assert.match(mainSource, /VOLUME_STORAGE_KEY/);
    assert.match(mainSource, /DISPLAY_MODE_STORAGE_KEY/);
    assert.match(mainSource, /SCALING_STORAGE_KEY/);
    assert.match(mainSource, /RUMBLE_STORAGE_KEY/);
    assert.match(mainSource, /DIFFICULTY_STORAGE_KEY/);
    assert.match(mainSource, /INPUT_MAPPING_STORAGE_KEY/);
    assert.match(mainSource, /id="reset-button" class="reset-button"/);
    assert.match(mainSource, /resetButton\.addEventListener\("click", resetPwaState\)/);
    assert.match(mainSource, /function resetPwaState\(\): void/);
    assert.match(mainSource, /destroyGame\(\);\s*clearPwaStorage\(\);/);
    assert.match(mainSource, /volume = DEFAULT_VOLUME;/);
    assert.match(mainSource, /displayModePreference = DEFAULT_DISPLAY_MODE;/);
    assert.match(mainSource, /scalingPreference = DEFAULT_SCALING_PREFERENCE;/);
    assert.match(mainSource, /rumbleEnabled = DEFAULT_RUMBLE_ENABLED;/);
    assert.match(mainSource, /function clearPwaStorage\(\): void/);
    assert.match(mainSource, /localStorage\.removeItem\(key\)/);
    assert.match(stylesSource, /\.settings-row/);
    assert.match(stylesSource, /\.reset-button/);
});

test("Stickvania pins slick2d-ts to a reproducible public HTTPS revision", () => {
    const dependency = packageJson.dependencies["slick2d-ts"];
    const lockedDependency = packageLock.packages[""].dependencies["slick2d-ts"];
    const lockedSlick = packageLock.packages["node_modules/slick2d-ts"];

    assert.equal(dependency, lockedDependency);
    assert.match(dependency, /^git\+https:\/\/github\.com\/meatfighter\/slick2d-ts\.git#[a-f0-9]{40}$/);
    assert.equal(lockedSlick.resolved, dependency);
    assert.match(lockedSlick.version, /^\d+\.\d+\.\d+$/);
});
