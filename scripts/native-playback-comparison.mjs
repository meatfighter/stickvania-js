import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { tmpdir } from "node:os";

// Extends the existing native NullThingBoundaryTest, in separate JVMs. No graphics window.
export function runNativePlayback({ testClasses, productionClasspath, releaseArgs }) {
    const baseline = "45566f2511f74d9e47fe3278286347bf4b8b9ac6";
    const signature = createHash("sha256")
        .update(readFileSync("desktop/test/stickvania/NullThingBoundaryTest.java"))
        .update(readFileSync("desktop/test/stickvania/EnemyArcMotionTest.java"))
        .update(baseline)
        .digest("hex");
    const cache = join(tmpdir(), "stickvania-native-baseline-" + signature);
    const evidence = join(process.env.QUALIFICATION_EVIDENCE_DIR ?? tmpdir(), "stickvania-native-replay");
    mkdirSync(cache, { recursive: true });
    mkdirSync(evidence, { recursive: true });
    function run(command, args) {
        const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
        assert.equal(result.status, 0, command + " native replay");
    }
    if (!existsSync(join(cache, "compiled"))) {
        const sources = ["Main", "Raven", "BridgeBat", "GrimReaper"].map((name) => {
            const path = join(cache, name + ".java");
            writeFileSync(path, execFileSync("git", ["show", `${baseline}:desktop/src/stickvania/${name}.java`]));
            return path;
        });
        run("javac", ["-encoding", "UTF-8", "-Xlint:-options", ...releaseArgs, "-cp", productionClasspath, "-d", cache, ...sources]);
        writeFileSync(join(cache, "compiled"), baseline);
    }
    for (const difficulty of [0, 1]) {
        const expected = join(cache, "replay-" + difficulty + ".txt"),
            actual = join(evidence, "replay-" + difficulty + ".txt");
        const invoke = (classpath, output) =>
            run("java", [
                "--add-opens=java.base/java.util=ALL-UNNAMED",
                "-Djava.awt.headless=true",
                "-Djava.library.path=" +
                    resolve("desktop/natives/" + (process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macosx" : "linux")),
                "-cp",
                classpath,
                "stickvania.NullThingBoundaryTest",
                output,
                String(difficulty)
            ]);
        if (!existsSync(expected + ".complete")) {
            invoke(`${cache}${delimiter}${testClasses}${delimiter}${productionClasspath}`, expected);
            writeFileSync(expected + ".complete", baseline);
        }
        invoke(`${testClasses}${delimiter}${productionClasspath}`, actual);
        const a = readFileSync(expected),
            b = readFileSync(actual);
        if (!a.equals(b)) {
            let i = 0;
            while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
            const prefix = a.subarray(0, i).toString();
            const frame = prefix.slice(prefix.lastIndexOf("FRAME ")).split("\n")[0];
            assert.fail(
                `Native first divergence ${frame}: baseline ${a.subarray(Math.max(0, i - 120), i + 180)} candidate ${b.subarray(Math.max(0, i - 120), i + 180)}`
            );
        }
        const hash = createHash("sha256").update(b).digest("hex");
        writeFileSync(
            join(evidence, "comparison-" + difficulty + ".json"),
            JSON.stringify({ baseline, signature, cache, difficulty, matched: true, sha256: hash, bytes: b.length })
        );
        console.log(`Native baseline replay exact, difficulty ${difficulty}, SHA-256 ${hash}`);
    }
}
