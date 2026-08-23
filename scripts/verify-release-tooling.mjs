import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import {
    assertSafeGeneratedOutputDirectory,
    canonicalDistDir,
    cleanDirectory,
    releaseCandidatesDir,
    releaseComponentsDir,
    releaseLockDir,
    releaseSecretsDir,
    rootDir,
    versionPath,
    withReleaseOperationLock
} from "./build-utils.mjs";

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
const buildProductionScriptPath = join(rootDir, "scripts", "build-production.mjs");
const buildAboutScriptPath = join(rootDir, "scripts", "build-about.mjs");
const productionCandidateDir = join(releaseComponentsDir, "production-candidate");
const readmePath = join(rootDir, "README.md");
const stampScriptPath = join(rootDir, "scripts", "stamp.mjs");

verifyReleaseStateIgnores();
verifyNoTrackedReleaseState();
verifyGeneratedDirectoriesIgnoredBySourceTooling();
verifyGeneratedOutputPathSafety();
verifyGeneratedOutputRejectsIntermediateLinks();
verifyReleaseEnvOverridesAreGated();
verifyReleaseLockRejectsConcurrentMutation();
verifyComponentBuildPreservesCanonicalDist();
verifyProductionRejectsTrackedMutationBeforePromotion();
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

function verifyGeneratedDirectoriesIgnoredBySourceTooling() {
    const prettierIgnore = readFileSync(join(rootDir, ".prettierignore"), "utf8");
    const eslintConfig = readFileSync(join(rootDir, "eslint.config.js"), "utf8");
    const generatedDirectoryPatterns = [
        ".release-components/",
        ".release-candidates/",
        ".release-secrets/",
        ".dist-pending-*/",
        ".dist-previous-*/",
        ".dist-active-before-*/"
    ];

    for (const pattern of generatedDirectoryPatterns) {
        assert.match(prettierIgnore, new RegExp(`^${escapeRegExp(pattern)}$`, "m"), `.prettierignore should include ${pattern}`);
    }

    for (const pattern of [
        ".release-components/**",
        ".release-candidates/**",
        ".release-secrets/**",
        ".dist-pending-*/**",
        ".dist-previous-*/**",
        ".dist-active-before-*/**"
    ]) {
        assert.match(eslintConfig, new RegExp(escapeRegExp(pattern)), `eslint config should ignore ${pattern}`);
    }
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

function verifyGeneratedOutputPathSafety() {
    const blockedPaths = [
        rootDir,
        dirname(rootDir),
        canonicalDistDir,
        releaseComponentsDir,
        join(rootDir, ".git"),
        join(rootDir, ".git", "objects", "unsafe-output"),
        join(rootDir, ".release-candidates"),
        join(rootDir, ".release-secrets"),
        join(rootDir, "about"),
        join(rootDir, "desktop"),
        join(rootDir, "node_modules"),
        join(rootDir, "pwa"),
        join(rootDir, "pwa", "unsafe-output"),
        join(rootDir, "releases"),
        join(rootDir, "scripts")
    ];

    for (const blockedPath of blockedPaths) {
        assert.throws(
            () => assertSafeGeneratedOutputDirectory(blockedPath, { label: "test output directory" }),
            /must/,
            `${blockedPath} should be rejected as generated output.`
        );
    }

    assert.doesNotThrow(() => assertSafeGeneratedOutputDirectory(join(releaseComponentsDir, "safe-output"), { label: "test output directory" }));
    assert.doesNotThrow(() => assertSafeGeneratedOutputDirectory(join(releaseCandidatesDir, "safe-output"), { label: "test output directory" }));
    assert.doesNotThrow(() => assertSafeGeneratedOutputDirectory(join(releaseSecretsDir, "safe-output"), { label: "test output directory" }));
    assert.doesNotThrow(() =>
        assertSafeGeneratedOutputDirectory(canonicalDistDir, {
            allowCanonicalDist: true,
            label: "test output directory"
        })
    );
}

function verifyGeneratedOutputRejectsIntermediateLinks() {
    const realTargetDir = join(releaseComponentsDir, `path-safety-real-target-${process.pid}`);
    const linkedDir = join(releaseComponentsDir, `path-safety-linked-target-${process.pid}`);
    const sentinelPath = join(realTargetDir, "sentinel.txt");

    removePathSafetyLink(linkedDir);
    rmSync(realTargetDir, { recursive: true, force: true });
    mkdirSync(realTargetDir, { recursive: true });
    writeFileSync(sentinelPath, "keep me");

    try {
        symlinkSync(realTargetDir, linkedDir, "junction");
        assert.throws(() => cleanDirectory(join(linkedDir, "nested"), { label: "test linked output directory" }), /symbolic links|junctions/);
        assert.equal(readFileSync(sentinelPath, "utf8"), "keep me");
    } finally {
        removePathSafetyLink(linkedDir);
        rmSync(realTargetDir, { recursive: true, force: true });
    }
}

function removePathSafetyLink(path) {
    if (!existsSync(path)) {
        return;
    }
    if (lstatSync(path).isSymbolicLink()) {
        unlinkSync(path);
    } else {
        rmSync(path, { recursive: true, force: true });
    }
}

function verifyReleaseEnvOverridesAreGated() {
    const buildStampOverride = "test-build-stamp-override";
    const ungatedVersion = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", 'import { readVersion } from "./scripts/build-utils.mjs"; console.log(readVersion().buildStamp);'],
        {
            cwd: rootDir,
            encoding: "utf8",
            env: {
                ...process.env,
                STICKVANIA_BUILD_STAMP: buildStampOverride,
                STICKVANIA_ALLOW_VERSION_OVERRIDE: ""
            }
        }
    );
    assert.equal(ungatedVersion.status, 0, ungatedVersion.stderr);
    assert.notEqual(ungatedVersion.stdout.trim(), buildStampOverride);

    const gatedVersion = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", 'import { readVersion } from "./scripts/build-utils.mjs"; console.log(readVersion().buildStamp);'],
        {
            cwd: rootDir,
            encoding: "utf8",
            env: {
                ...process.env,
                STICKVANIA_ALLOW_VERSION_OVERRIDE: "true",
                STICKVANIA_BUILD_STAMP: buildStampOverride
            }
        }
    );
    assert.equal(gatedVersion.status, 0, gatedVersion.stderr);
    assert.equal(gatedVersion.stdout.trim(), buildStampOverride);

    const directDistDir = join(releaseComponentsDir, `direct-env-dist-${process.pid}`);
    const childEnv = {
        ...process.env,
        STICKVANIA_DIST_DIR: directDistDir
    };
    delete childEnv.STICKVANIA_ALLOW_DIST_DIR_OVERRIDE;

    const directDist = spawnSync(process.execPath, [buildAboutScriptPath], {
        cwd: rootDir,
        encoding: "utf8",
        env: childEnv
    });
    const output = `${directDist.stdout}\n${directDist.stderr}`;
    assert.notEqual(directDist.status, 0, "Direct STICKVANIA_DIST_DIR should be rejected without the release-tooling gate.");
    assert.match(output, /requires STICKVANIA_ALLOW_DIST_DIR_OVERRIDE=true/);
    assert.equal(existsSync(directDistDir), false);
}

function verifyReleaseLockRejectsConcurrentMutation() {
    const beforeVersion = readFileSync(versionPath);
    const hadInheritedReleaseLock = process.env.STICKVANIA_RELEASE_LOCK_TOKEN !== undefined && process.env.STICKVANIA_RELEASE_LOCK_TOKEN !== "";
    withReleaseOperationLock("verify-release-tooling", () => {
        const childEnv = { ...process.env };
        delete childEnv.STICKVANIA_RELEASE_LOCK_TOKEN;

        const result = spawnSync(process.execPath, [stampScriptPath], {
            cwd: rootDir,
            encoding: "utf8",
            env: childEnv
        });
        const output = `${result.stdout}\n${result.stderr}`;

        assert.notEqual(result.status, 0, "A second mutating release command should not acquire the active lock.");
        assert.match(output, /Another release operation is already running/);
    });
    assert.deepEqual(readFileSync(versionPath), beforeVersion, "version.json should not change when a concurrent stamp is rejected.");
    if (hadInheritedReleaseLock) {
        const owner = JSON.parse(readFileSync(join(releaseLockDir, "owner.json"), "utf8"));
        assert.equal(
            owner.holders.some((holder) => holder.pid === process.pid),
            false,
            "inherited release lock holder should unregister after the nested operation exits."
        );
    } else {
        assert.equal(existsSync(releaseLockDir), false, "release lock should be removed after the owner exits.");
    }
}

function verifyProductionRejectsTrackedMutationBeforePromotion() {
    const beforeVersion = readFileSync(versionPath);
    const beforeReadme = readFileSync(readmePath);
    const beforeDistSnapshot = snapshotDirectory(canonicalDistDir);
    const distBackupDir = join(releaseComponentsDir, `promotion-safety-dist-backup-${process.pid}`);
    const childEnv = {
        ...process.env,
        STICKVANIA_TEST_MUTATE_TRACKED_SOURCE_AFTER_CANDIDATE: "true"
    };
    delete childEnv.STICKVANIA_DIST_DIR;

    rmSync(distBackupDir, { recursive: true, force: true });
    if (beforeDistSnapshot !== null) {
        cpSync(canonicalDistDir, distBackupDir, { recursive: true });
    }

    try {
        const result = spawnSync(process.execPath, [buildProductionScriptPath], {
            cwd: rootDir,
            encoding: "utf8",
            env: childEnv,
            maxBuffer: 50 * 1024 * 1024
        });
        const output = `${result.stdout}\n${result.stderr}`;

        assert.notEqual(result.status, 0, "Production build should fail when tracked source changes after candidate verification.");
        assert.match(output, /Tracked source files changed before release promotion/);
        assert.deepEqual(readFileSync(versionPath), beforeVersion, "version.json should be restored before failed promotion exits.");
        assert.deepEqual(snapshotDirectory(canonicalDistDir), beforeDistSnapshot, "Canonical dist should remain unchanged after failed promotion.");
    } finally {
        writeFileSync(readmePath, beforeReadme);
        writeFileSync(versionPath, beforeVersion);
        restoreDistSnapshot(beforeDistSnapshot, distBackupDir);
        rmSync(distBackupDir, { recursive: true, force: true });
        rmSync(productionCandidateDir, { recursive: true, force: true });
        removeReleaseComponentBackups();
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

function snapshotDirectory(directory) {
    if (!existsSync(directory)) {
        return null;
    }

    return collectFiles(directory).map((file) => ({
        file: relative(directory, file).replaceAll("\\", "/"),
        hash: createHash("sha256").update(readFileSync(file)).digest("hex")
    }));
}

function collectFiles(directory) {
    const rootStat = lstatSync(directory);
    if (rootStat.isSymbolicLink()) {
        throw new Error(`Release snapshot must not contain symbolic links or junctions: ${directory}`);
    }
    if (!rootStat.isDirectory()) {
        throw new Error(`Release snapshot must be a directory: ${directory}`);
    }

    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const fullPath = join(directory, entry.name);
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
            throw new Error(`Release snapshot must not contain symbolic links or junctions: ${fullPath}`);
        }
        if (stat.isDirectory()) {
            files.push(...collectFiles(fullPath));
        } else if (stat.isFile()) {
            files.push(fullPath);
        } else {
            throw new Error(`Release snapshot must not contain special filesystem entries: ${fullPath}`);
        }
    }
    return files.sort();
}

function restoreDistSnapshot(beforeDistSnapshot, distBackupDir) {
    if (beforeDistSnapshot === null) {
        rmSync(canonicalDistDir, { recursive: true, force: true });
        return;
    }

    if (snapshotMatches(snapshotDirectory(canonicalDistDir), beforeDistSnapshot)) {
        return;
    }

    rmSync(canonicalDistDir, { recursive: true, force: true });
    cpSync(distBackupDir, canonicalDistDir, { recursive: true });
}

function snapshotMatches(actual, expected) {
    return JSON.stringify(actual) === JSON.stringify(expected);
}

function removeReleaseComponentBackups() {
    if (!existsSync(releaseComponentsDir)) {
        return;
    }

    for (const entry of readdirSync(releaseComponentsDir, { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.startsWith("dist-backup-")) {
            rmSync(join(releaseComponentsDir, entry.name), { recursive: true, force: true });
        }
    }
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
