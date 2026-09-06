import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sourceRoot = new URL("../desktop/src/stickvania/", import.meta.url);
const support = readFileSync(new URL("ControllerSupport.java", sourceRoot), "utf8");
const main = readFileSync(new URL("Main.java", sourceRoot), "utf8");
const remapping = readFileSync(new URL("InputConfigMode.java", sourceRoot), "utf8");

// Behavioral coverage runs against the bundled libraries during build:desktop.
assert.doesNotMatch(support, /defaultEnvironment|refreshControllers|resetLwjglControllers|runWithFilteredJInputPollErrors/);
assert.doesNotMatch(main + remapping, /shouldRefreshControllers|refreshControllersIfNeeded|setControllerRefreshEnabled/);
assert.match(main, /public void update\(GameContainer gc, int delta\) throws SlickException \{\s*ControllerSupport\.beginFrame\(\);/);
console.log("ok - stickvania controller discovery stays startup-only");

const launcherPath = new URL("../desktop/run-windows.cmd", import.meta.url);
const launcher = readFileSync(launcherPath, "utf8");
assert.doesNotMatch(launcher, /^\s*if\b[^\r\n]*\(\s*$/im, "Windows launcher path checks must not use parenthesized CMD blocks");
assert.match(launcher, /if not exist "%JAR_PATH%" set "JAR_PATH=%BASE_DIR%stickvania-desktop\.jar"/);
assert.match(launcher, /if not exist "%NATIVE_PATH%" set "NATIVE_PATH=%BASE_DIR%natives\\windows"/);

if (process.platform === "win32") {
    const instrumentedLauncher = launcher
        .replace("java --enable-native-access=ALL-UNNAMED -version >nul 2>nul", "ver >nul")
        .replace("java --sun-misc-unsafe-memory-access=allow -version >nul 2>nul", "ver >nul")
        .replace(
            /^java %JAVA_COMPAT_ARGS% .* -jar "%JAR_PATH%"$/m,
            '> "%STICKVANIA_TEST_JAVA_LOG%" echo JAR=%JAR_PATH%\n>> "%STICKVANIA_TEST_JAVA_LOG%" echo NATIVE=%NATIVE_PATH%'
        );
    assert.notEqual(instrumentedLauncher, launcher);
    assert.doesNotMatch(instrumentedLauncher, /^java\b/im, "Launcher regression test must replace Java invocations with deterministic local commands");

    const tempRoot = mkdtempSync(join(tmpdir(), "stickvania-desktop (1) "));
    const installDir = join(tempRoot, "stickvania-desktop");
    const logPath = join(tempRoot, "java-args.txt");
    try {
        mkdirSync(join(installDir, "natives", "windows"), { recursive: true });
        writeFileSync(join(installDir, "run-windows.cmd"), instrumentedLauncher);
        writeFileSync(join(installDir, "stickvania-desktop.jar"), "");

        const result = spawnSync("cmd.exe", ["/d", "/c", "run-windows.cmd"], {
            cwd: installDir,
            encoding: "utf8",
            env: { ...process.env, STICKVANIA_TEST_JAVA_LOG: logPath }
        });
        assert.equal(
            result.status,
            0,
            `Windows launcher failed from a path containing parentheses.\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`
        );

        const javaLog = readFileSync(logPath, "utf8");
        assert.ok(javaLog.includes(`JAR=${join(installDir, "stickvania-desktop.jar")}`));
        assert.ok(javaLog.includes(`NATIVE=${join(installDir, "natives", "windows")}`));
    } finally {
        rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
}
console.log("ok - Windows desktop launcher tolerates paths containing parentheses");
