import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { rootDir } from "./build-utils.mjs";

const mainSource = readFileSync(join(rootDir, "pwa", "src", "main.ts"), "utf8");
const preferencesSource = readFileSync(join(rootDir, "pwa", "src", "app", "BrowserPreferences.ts"), "utf8");
const menuSource = readFileSync(join(rootDir, "pwa", "src", "app", "MenuView.ts"), "utf8");
const wrapperSource = readFileSync(join(rootDir, "pwa", "src", "stickvania", "StickvaniaBufferedGame.ts"), "utf8");
const stylesSource = readFileSync(join(rootDir, "pwa", "src", "styles.css"), "utf8");
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const packageLock = JSON.parse(readFileSync(join(rootDir, "package-lock.json"), "utf8"));

test("Stickvania PWA uses the 512x416 buffered viewport wrapper", () => {
    assert.match(mainSource, /new runtime\.StickvaniaBufferedGame\(mainGame,\s*preferences\.scaling\)/);
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
    assert.match(preferencesSource, /export const DEFAULT_VOLUME = 0\.1;/);
    assert.match(preferencesSource, /export const DEFAULT_RUMBLE_ENABLED = true;/);
    assert.match(preferencesSource, /export const DEFAULT_DISPLAY_MODE: DisplayModePreference = "light";/);
    assert.match(preferencesSource, /export const DEFAULT_SCALING_PREFERENCE: StickvaniaScalingPreference = "crisp";/);
    assert.match(preferencesSource, /getBrowserStorageKey\("scaling"\)/);
    assert.match(menuSource, /id="scaling-picker"/);
    assert.match(menuSource, /id="scaling-button"/);
    assert.match(menuSource, /id="scaling-list"/);
    assert.match(menuSource, /id="display-mode-button" class="theme-picker-button display-mode-button"/);
    assert.match(menuSource, /<span class="picker-caret" aria-hidden="true"><\/span>/);
    assert.doesNotMatch(menuSource, /id="scaling-select"/);
    assert.doesNotMatch(stylesSource, /rotate\(180deg\)/);
    assert.match(menuSource, /<span>Scaling<\/span>/);
    assert.match(menuSource, /value: "smooth", label: "Smooth"/);
    assert.match(menuSource, /value: "crisp", label: "Crisp"/);
    assert.match(menuSource, /value: "pixel-perfect", label: "Pixel Perfect"/);
    assert.match(mainSource, /activeBufferedGame\?\.setScalingPreference\(value\)/);
    assert.match(preferencesSource, /if \(value === "false"\) {\s*return false;\s*}/);
    assert.match(wrapperSource, /constructor\(held: Game, scalingPreference: StickvaniaScalingPreference = "crisp"\)/);
});

test("the PWA menu has a full local reset escape hatch", () => {
    assert.match(preferencesSource, /const PWA_RESET_STORAGE_KEYS = \[/);
    assert.match(preferencesSource, /GAME_STATE_STORAGE_KEY/);
    assert.match(preferencesSource, /VOLUME_STORAGE_KEY/);
    assert.match(preferencesSource, /DISPLAY_MODE_STORAGE_KEY/);
    assert.match(preferencesSource, /SCALING_STORAGE_KEY/);
    assert.match(preferencesSource, /RUMBLE_STORAGE_KEY/);
    assert.match(preferencesSource, /FULLSCREEN_STORAGE_KEY/);
    assert.match(preferencesSource, /DIFFICULTY_STORAGE_KEY/);
    assert.match(preferencesSource, /INPUT_MAPPING_STORAGE_KEY/);
    assert.match(menuSource, /id="reset-button" class="reset-button"/);
    assert.match(menuSource, /resetButton\.addEventListener\("click", callbacks\.onReset\)/);
    assert.match(mainSource, /function resetPwaState\(\): void/);
    const resetStart = mainSource.indexOf("function resetPwaState(): void");
    const resetEnd = mainSource.indexOf("async function startGame", resetStart);
    const reset = mainSource.slice(resetStart, resetEnd);
    assert.match(reset, /if \(!canActivateFromMenu\(\)\) return;/);
    assert.match(reset, /const epoch = ownership\.epoch;/);
    assert.match(reset, /if \(!destroyGame\(\)\) return;/);
    const destroyIndex = reset.indexOf("if (!destroyGame()) return;");
    const resetIndex = reset.indexOf("const cleared = preferences.reset(() => ownership.isCurrent(epoch));");
    assert.ok(destroyIndex >= 0 && resetIndex > destroyIndex, "preferences must reset only after destructive cleanup succeeds");
    assert.match(reset, /preferences\.reset\(\(\) => ownership\.isCurrent\(epoch\)\)/, "reset must retain the captured-epoch authorization boundary");
    assert.match(reset, /if \(!ownership\.isCurrent\(epoch\)\) return;/);
    assert.match(reset, /sessionMapping\.resetToDefaults\(\)/);
    assert.match(reset, /renderRootMenu\(cleared \? "" : "Some settings could not be reset\."\)/);
    assert.match(preferencesSource, /this\.volume = DEFAULT_VOLUME;/);
    assert.match(preferencesSource, /this\.displayMode = DEFAULT_DISPLAY_MODE;/);
    assert.match(preferencesSource, /this\.scaling = DEFAULT_SCALING_PREFERENCE;/);
    assert.match(preferencesSource, /this\.rumbleEnabled = DEFAULT_RUMBLE_ENABLED;/);
    assert.match(preferencesSource, /this\.fullscreen = DEFAULT_FULLSCREEN_PREFERENCE;/);
    assert.match(preferencesSource, /this\.difficulty = DEFAULT_DIFFICULTY;/);
    assert.match(preferencesSource, /for \(const key of PWA_RESET_STORAGE_KEYS\)/);
    assert.match(preferencesSource, /removePreference\("Stickvania browser setting", key, isAuthorized\)/);
    assert.doesNotMatch(preferencesSource, /localStorage\.removeItem\(key\)/);
    assert.match(stylesSource, /\.settings-row/);
    assert.match(stylesSource, /\.reset-button/);
});

test("Stickvania pins slick2d-ts to a reproducible public HTTPS revision", () => {
    const dependency = packageJson.dependencies["slick2d-ts"];
    const lockedDependency = packageLock.packages[""].dependencies["slick2d-ts"];
    const lockedSlick = packageLock.packages["node_modules/slick2d-ts"];

    assert.equal(dependency, lockedDependency);
    assert.match(dependency, /^https:\/\/codeload\.github\.com\/meatfighter\/slick2d-ts\/tar\.gz\/[a-f0-9]{40}$/);
    assert.equal(lockedSlick.resolved, dependency);
    assert.match(lockedSlick.version, /^\d+\.\d+\.\d+$/);
});
