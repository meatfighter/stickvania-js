import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { readVersion, rootDir, versionPath, writeVersion } from "./build-utils.mjs";

const scriptNames = process.argv.slice(2);

if (scriptNames.length === 0) {
    throw new Error("Pass one or more npm script names to run under a temporary release stamp.");
}

const originalVersionBytes = readFileSync(versionPath);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const useShell = process.platform === "win32";
let exitStatus = 0;

try {
    const version = readVersion();
    version.buildStamp = new Date().toISOString();
    writeVersion(version);
    console.log(`Temporarily stamped ${version.version} at ${version.buildStamp}`);

    for (const scriptName of scriptNames) {
        const result = spawnSync(npmCommand, ["run", scriptName], {
            cwd: rootDir,
            shell: useShell,
            stdio: "inherit"
        });
        if (result.error) {
            throw result.error;
        }
        if (result.status !== 0) {
            exitStatus = result.status ?? 1;
            break;
        }
    }
} finally {
    writeFileSync(versionPath, originalVersionBytes);
}

process.exit(exitStatus);
