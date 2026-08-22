import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalDistDir, rootDir } from "./build-utils.mjs";

const releaseStateIgnorePatterns = [
    ".release-components/",
    ".release-secrets/",
    ".release-candidates/",
    ".dist-pending-*/",
    ".dist-previous-*/",
    ".dist-active-before-*/",
    "releases/*.zip",
    "releases/*.tmp",
    "releases/*.log"
];

verifyReleaseStateIgnores();
verifyNoTrackedReleaseState();
verifyComponentBuildPreservesCanonicalDist();
console.log("Verified release tooling isolation.");

function verifyReleaseStateIgnores() {
    const gitignore = readFileSync(join(rootDir, ".gitignore"), "utf8");
    for (const pattern of releaseStateIgnorePatterns) {
        assert.match(gitignore, new RegExp(`^${escapeRegExp(pattern)}$`, "m"), `.gitignore should include ${pattern}`);
    }
}

function verifyNoTrackedReleaseState() {
    const result = spawnSync("git", ["ls-files"], {
        cwd: rootDir,
        encoding: "utf8"
    });
    if (result.error) {
        throw result.error;
    }
    assert.equal(result.status, 0, result.stderr);

    const trackedFiles = result.stdout.split(/\r?\n/).filter((line) => line.length > 0);
    const blocked = trackedFiles.filter((file) => isReleaseStatePath(file));
    assert.deepEqual(blocked, [], `Release-state files should not be tracked: ${blocked.join(", ")}`);
}

function verifyComponentBuildPreservesCanonicalDist() {
    const distExisted = existsSync(canonicalDistDir);
    const sentinelPath = join(canonicalDistDir, ".component-build-sentinel");
    const sentinelText = `sentinel ${Date.now()}`;

    mkdirSync(canonicalDistDir, { recursive: true });
    writeFileSync(sentinelPath, sentinelText);

    try {
        runNpmScript("build:about");
        assert.equal(readFileSync(sentinelPath, "utf8"), sentinelText);
    } finally {
        if (existsSync(sentinelPath)) {
            unlinkSync(sentinelPath);
        }
        if (!distExisted && existsSync(canonicalDistDir) && readdirSync(canonicalDistDir).length === 0) {
            rmSync(canonicalDistDir, { recursive: true, force: true });
        }
    }
}

function runNpmScript(scriptName) {
    const result = spawnSync(getNpmCommand(), getNpmArgs(scriptName), {
        cwd: rootDir,
        stdio: "inherit"
    });
    if (result.error) {
        throw result.error;
    }
    assert.equal(result.status, 0, `npm run ${scriptName} failed.`);
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

function isReleaseStatePath(file) {
    return (
        file.startsWith(".release-components/") ||
        file.startsWith(".release-secrets/") ||
        file.startsWith(".release-candidates/") ||
        /^\.dist-(?:pending|previous|active-before)-[^/]+\//.test(file) ||
        /^releases\/.*\.(?:zip|tmp|log)$/.test(file)
    );
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
