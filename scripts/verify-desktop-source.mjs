import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceRoot = new URL("../desktop/src/stickvania/", import.meta.url);
const support = readFileSync(new URL("ControllerSupport.java", sourceRoot), "utf8");
const main = readFileSync(new URL("Main.java", sourceRoot), "utf8");
const remapping = readFileSync(new URL("InputConfigMode.java", sourceRoot), "utf8");

// Behavioral coverage runs against the bundled libraries during build:desktop.
assert.doesNotMatch(support, /defaultEnvironment|refreshControllers|resetLwjglControllers|runWithFilteredJInputPollErrors/);
assert.doesNotMatch(main + remapping, /shouldRefreshControllers|refreshControllersIfNeeded|setControllerRefreshEnabled/);
assert.match(main, /public void update\(GameContainer gc, int delta\) throws SlickException \{\s*ControllerSupport\.beginFrame\(\);/);
console.log("ok - stickvania controller discovery stays startup-only");
