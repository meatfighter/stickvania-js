import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const testSource = fileURLToPath(new URL("../desktop/test/stickvania/ControllerSupportTest.java", import.meta.url));

export function runDesktopInputTests({ classesDir, classpath, releaseArgs }) {
    const testClasses = mkdtempSync(join(tmpdir(), "stickvania-input-tests-"));
    const productionClasspath = `${classesDir}${delimiter}${classpath}`;
    function run(command, args) {
        const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
        if (result.error || result.status !== 0) {
            throw result.error ?? new Error(`${command} failed during desktop input tests.`);
        }
    }
    try {
        run("javac", ["-encoding", "UTF-8", "-Xlint:-options", ...releaseArgs, "-cp", productionClasspath, "-d", testClasses, testSource]);
        // JInput discovery is process-wide, so each scenario needs a fresh JVM.
        for (const scenario of ["empty", "connected", "poll-failure", "reported-failure", "initialization-failure"]) {
            run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.ControllerSupportTest", scenario]);
        }
    } finally {
        rmSync(testClasses, { recursive: true, force: true });
    }
}
