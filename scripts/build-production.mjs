import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { canonicalDistDir, cleanDirectory, releaseComponentsDir, readVersion, rootDir, versionPath, writeVersion } from "./build-utils.mjs";

const candidateDir = join(releaseComponentsDir, "production-candidate");
const backupDir = join(releaseComponentsDir, `dist-backup-${process.pid}`);
const originalVersionBytes = readFileSync(versionPath);
const originalTrackedSourceState = readTrackedSourceState();
const releaseScripts = ["_build:pwa:release", "_build:about", "build:desktop", "_assemble", "_verify:pwa-release", "verify:desktop-release"];
let versionRestored = false;

try {
    cleanDirectory(candidateDir);
    rmSync(backupDir, { recursive: true, force: true });

    const version = readVersion();
    version.buildStamp = new Date().toISOString();
    writeVersion(version);
    console.log(`Temporarily stamped ${version.version} at ${version.buildStamp}`);

    const childEnv = {
        ...process.env,
        STICKVANIA_DIST_DIR: candidateDir
    };

    for (const scriptName of releaseScripts) {
        runNpmScript(scriptName, childEnv);
    }

    if (process.env.STICKVANIA_FAIL_AFTER_CANDIDATE === "true") {
        throw new Error("Injected production build failure after candidate verification.");
    }

    if (process.env.STICKVANIA_TEST_MUTATE_TRACKED_SOURCE_AFTER_CANDIDATE === "true") {
        appendFileSync(join(rootDir, "README.md"), "\n<!-- injected release promotion source mutation -->\n");
    }

    restoreVersionJson();
    assertTrackedSourceStateUnchanged(originalTrackedSourceState);
    promoteCandidate();
    console.log(`Promoted verified release candidate to ${relative(rootDir, canonicalDistDir)}`);
} finally {
    if (!versionRestored) {
        restoreVersionJson();
    }
}

function runNpmScript(scriptName, env) {
    const result = spawnSync(getNpmCommand(), getNpmArgs(scriptName), {
        cwd: rootDir,
        env,
        stdio: "inherit"
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`Release script failed: npm run ${scriptName}`);
    }
}

function getNpmCommand() {
    return process.platform === "win32" ? "cmd.exe" : "npm";
}

function getNpmArgs(scriptName) {
    return process.platform === "win32" ? ["/d", "/s", "/c", `npm.cmd run ${quoteWindowsCommandArgument(scriptName)}`] : ["run", scriptName];
}

function quoteWindowsCommandArgument(value) {
    return /^[A-Za-z0-9:_-]+$/.test(value) ? value : `"${value.replaceAll('"', '""')}"`;
}

function restoreVersionJson() {
    writeFileSync(versionPath, originalVersionBytes);
    versionRestored = true;
}

function readTrackedSourceState() {
    const result = spawnSync("git", ["ls-files", "-z"], {
        cwd: rootDir,
        encoding: "buffer"
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(result.stderr.toString("utf8"));
    }

    const files = result.stdout
        .toString("utf8")
        .split("\0")
        .filter((file) => file.length > 0)
        .sort();
    return files.map((file) => ({
        file,
        hash: hashFile(join(rootDir, file))
    }));
}

function assertTrackedSourceStateUnchanged(expectedState) {
    const actualState = readTrackedSourceState();
    const actualByFile = new Map(actualState.map((entry) => [entry.file, entry.hash]));
    const changed = [];

    for (const expected of expectedState) {
        if (actualByFile.get(expected.file) !== expected.hash) {
            changed.push(expected.file);
        }
        actualByFile.delete(expected.file);
    }

    changed.push(...actualByFile.keys());

    if (changed.length > 0) {
        throw new Error(`Tracked source files changed before release promotion: ${changed.join(", ")}`);
    }
}

function hashFile(path) {
    if (!existsSync(path)) {
        return null;
    }
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function promoteCandidate() {
    const hadExistingDist = existsSync(canonicalDistDir);

    try {
        if (hadExistingDist) {
            renameSync(canonicalDistDir, backupDir);
        }
        renameSync(candidateDir, canonicalDistDir);
    } catch (error) {
        rmSync(canonicalDistDir, { recursive: true, force: true });
        if (existsSync(backupDir)) {
            renameSync(backupDir, canonicalDistDir);
        }
        throw error;
    }

    rmSync(backupDir, { recursive: true, force: true });
}
