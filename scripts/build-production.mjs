import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { canonicalDistDir, cleanDirectory, releaseComponentsDir, readVersion, rootDir, versionPath, writeVersion } from "./build-utils.mjs";

const candidateDir = join(releaseComponentsDir, "production-candidate");
const backupDir = join(releaseComponentsDir, `dist-backup-${process.pid}`);
const originalVersionBytes = readFileSync(versionPath);
const releaseScripts = ["_build:pwa:release", "_build:about", "build:desktop", "_assemble", "_verify:pwa-release", "verify:desktop-release"];

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

    promoteCandidate();
    console.log(`Promoted verified release candidate to ${relative(rootDir, canonicalDistDir)}`);
} finally {
    writeFileSync(versionPath, originalVersionBytes);
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
