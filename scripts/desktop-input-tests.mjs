import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const preferencesSource = fileURLToPath(new URL("../desktop/test/stickvania/MappingPreferenceVersionTest.java", import.meta.url));
const labelsSource = fileURLToPath(new URL("../desktop/test/stickvania/CompactKeyLabelsTest.java", import.meta.url));
const policySource = fileURLToPath(new URL("../desktop/test/stickvania/NativeDpadPolicyTest.java", import.meta.url));
const profileSource = fileURLToPath(new URL("../desktop/test/stickvania/NesControllerMappingTest.java", import.meta.url));
const testSource = fileURLToPath(new URL("../desktop/test/stickvania/ControllerSupportTest.java", import.meta.url));

export function runDesktopInputTests({ classesDir, classpath, releaseArgs }) {
    const testClasses = mkdtempSync(join(tmpdir(), "stickvania-input-tests-"));
    const productionClasspath = `${classesDir}${delimiter}${classpath}${delimiter}${fileURLToPath(new URL("../desktop/src", import.meta.url))}`;
    function run(command, args) {
        const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
        if (result.error || result.status !== 0) {
            throw result.error ?? new Error(`${command} failed during desktop input tests.`);
        }
    }
    try {
        run("javac", [
            "-encoding",
            "UTF-8",
            "-Xlint:-options",
            ...releaseArgs,
            "-cp",
            productionClasspath,
            "-d",
            testClasses,
            testSource,
            profileSource,
            policySource,
            labelsSource,
            preferencesSource,
            fileURLToPath(new URL("../desktop/test/stickvania/CounterParityTest.java", import.meta.url)),
            fileURLToPath(new URL("../desktop/test/stickvania/PitLifecycleTest.java", import.meta.url)),
            fileURLToPath(new URL("../desktop/test/stickvania/NullThingBoundaryTest.java", import.meta.url))
        ]);
        run("java", [
            "-Djava.awt.headless=true",
            "-Djava.util.prefs.PreferencesFactory=stickvania.MappingPreferenceVersionTest$MemoryFactory",
            "-cp",
            `${testClasses}${delimiter}${productionClasspath}`,
            "stickvania.MappingPreferenceVersionTest",
            "9",
            "8"
        ]);
        // JInput discovery is process-wide, so each scenario needs a fresh JVM.
        for (const scenario of [
            "empty",
            "connected",
            "poll-failure",
            "reported-failure",
            "initialization-failure",
            "legacy-buttons",
            "named-ordinary-buttons",
            "named-direction-buttons",
            "pov-only"
        ]) {
            run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.ControllerSupportTest", scenario]);
        }
        run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.NesControllerMappingTest"]);
        run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.NativeDpadPolicyTest"]);
        run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.CounterParityTest"]);
        run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.NullThingBoundaryTest"]);
        run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.PitLifecycleTest"]);
        const golden = JSON.parse(readFileSync(new URL("./fixtures/compact-key-labels.json", import.meta.url), "utf8"));
        const goldenPath = join(testClasses, "labels.txt");
        writeFileSync(goldenPath, golden.map((r) => `${r.code}|${r.constant}|${r.label}`).join("\n"));
        run("java", ["-Djava.awt.headless=true", "-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.CompactKeyLabelsTest", goldenPath]);
        const dump = spawnSync("java", ["-cp", `${testClasses}${delimiter}${productionClasspath}`, "stickvania.CompactKeyLabelsTest", "--dump"], {
            encoding: "utf8",
            windowsHide: true
        });
        if (dump.status !== 0) throw new Error("Java label dump failed");
        const dumpPath = join(testClasses, "dump.txt");
        writeFileSync(dumpPath, dump.stdout);
        run(process.execPath, [fileURLToPath(new URL("./test-compact-key-labels.mjs", import.meta.url)), "--java-dump", dumpPath]);
    } finally {
        rmSync(testClasses, { recursive: true, force: true });
    }
}
