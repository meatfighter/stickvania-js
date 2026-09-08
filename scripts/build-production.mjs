import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import {
    assertSafeGeneratedOutputDirectory,
    canonicalDistDir,
    cleanDirectory,
    releaseComponentsDir,
    readVersion,
    rootDir,
    runCommandWithReleaseLock,
    versionPath,
    withReleaseOperationLock,
    writeAtomicTextFile
} from "./build-utils.mjs";

const candidateDir = join(releaseComponentsDir, "production-candidate");
const promotionJournalPath = join(releaseComponentsDir, "production-promotion-journal.json");
const releaseScripts = [
    "_build:pwa:release",
    "_build:about",
    "build:desktop",
    "_assemble",
    "_verify:pwa-release",
    "verify:pwa-install-metadata",
    "verify:desktop-release"
];

await withReleaseOperationLock("build-production", async () => {
    const backupDir = join(releaseComponentsDir, `dist-backup-${process.pid}`);
    const originalVersionBytes = readFileSync(versionPath);

    try {
        recoverInterruptedPromotion();
        assertCleanWorkingTree();
        const originalTrackedSourceState = readTrackedSourceState();
        cleanDirectory(candidateDir);
        rmSync(backupDir, { recursive: true, force: true });

        const version = readVersion();
        const buildStamp = new Date().toISOString();
        console.log(`Building production release ${version.version} at ${buildStamp}`);

        const childEnv = {
            ...process.env,
            STICKVANIA_ALLOW_DIST_DIR_OVERRIDE: "true",
            STICKVANIA_ALLOW_VERSION_OVERRIDE: "true",
            STICKVANIA_BUILD_STAMP: buildStamp,
            STICKVANIA_DIST_DIR: candidateDir
        };

        for (const scriptName of releaseScripts) {
            await runNpmScript(scriptName, childEnv);
        }

        if (process.env.STICKVANIA_FAIL_AFTER_CANDIDATE === "true") {
            throw new Error("Injected production build failure after candidate verification.");
        }

        if (process.env.STICKVANIA_TEST_MUTATE_TRACKED_SOURCE_AFTER_CANDIDATE === "true") {
            appendFileSync(join(rootDir, "README.md"), "\n<!-- injected release promotion source mutation -->\n");
        }

        restoreVersionJsonIfChanged(originalVersionBytes);
        assertTrackedSourceStateUnchanged(originalTrackedSourceState);
        promoteCandidate(backupDir);
        console.log(`Promoted verified release candidate to ${relative(rootDir, canonicalDistDir)}`);
    } finally {
        restoreVersionJsonIfChanged(originalVersionBytes);
    }
});

async function runNpmScript(scriptName, env) {
    const result = await runCommandWithReleaseLock(getNpmCommand(), getNpmArgs(scriptName), {
        cwd: rootDir,
        env,
        stdio: "inherit"
    });
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

function restoreVersionJsonIfChanged(originalVersionBytes) {
    const currentVersionBytes = readFileSync(versionPath);
    if (!currentVersionBytes.equals(originalVersionBytes)) {
        writeAtomicTextFile(versionPath, originalVersionBytes);
    }
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

function assertCleanWorkingTree() {
    const result = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
        cwd: rootDir,
        encoding: "utf8"
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(result.stderr);
    }

    const status = result.stdout.trim();
    if (status.length > 0) {
        throw new Error(`Production releases require a clean Git working tree. Commit, stash, or remove these changes first:\n${status}`);
    }
}

function hashFile(path) {
    if (!existsSync(path)) {
        return null;
    }
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function recoverInterruptedPromotion() {
    if (!existsSync(promotionJournalPath)) {
        return;
    }

    const journal = readPromotionJournal();
    validatePromotionJournal(journal);

    const distExists = existsSync(canonicalDistDir);
    const backupExists = existsSync(journal.backupDir);
    const candidateExists = existsSync(candidateDir);

    if (!distExists && backupExists) {
        renameSync(journal.backupDir, canonicalDistDir);
        rmSync(candidateDir, { recursive: true, force: true });
        removePromotionJournal();
        return;
    }

    if (distExists && backupExists && !candidateExists) {
        rmSync(journal.backupDir, { recursive: true, force: true });
        removePromotionJournal();
        return;
    }

    if (distExists && !backupExists) {
        rmSync(candidateDir, { recursive: true, force: true });
        removePromotionJournal();
        return;
    }

    if (!distExists && !backupExists && candidateExists) {
        rmSync(candidateDir, { recursive: true, force: true });
        removePromotionJournal();
        return;
    }

    throw new Error("Unable to recover production promotion journal; release directories are in an ambiguous state.");
}

function promoteCandidate(backupDir) {
    assertSafeGeneratedOutputDirectory(canonicalDistDir, { allowCanonicalDist: true, label: "production dist directory" });
    assertSafeGeneratedOutputDirectory(candidateDir, { label: "production candidate directory" });
    assertSafeGeneratedOutputDirectory(backupDir, { label: "production backup directory" });

    const hadExistingDist = existsSync(canonicalDistDir);
    let candidatePromoted = false;
    writePromotionJournal(backupDir);

    try {
        if (hadExistingDist) {
            renameSync(canonicalDistDir, backupDir);
        }
        renameSync(candidateDir, canonicalDistDir);
        candidatePromoted = true;
    } catch (error) {
        if (!candidatePromoted) {
            restoreDistFromBackup(backupDir);
            removePromotionJournal();
        }
        throw error;
    }

    cleanupCompletedPromotion(backupDir);
}

function writePromotionJournal(backupDir) {
    writeAtomicTextFile(
        promotionJournalPath,
        `${JSON.stringify(
            {
                backupDir,
                canonicalDistDir,
                candidateDir,
                operation: "promote-production",
                startedAt: new Date().toISOString()
            },
            null,
            4
        )}\n`
    );
}

function readPromotionJournal() {
    try {
        return JSON.parse(readFileSync(promotionJournalPath, "utf8"));
    } catch (error) {
        throw new Error(`Unable to read production promotion journal: ${error.message}`);
    }
}

function validatePromotionJournal(journal) {
    if (
        journal?.operation !== "promote-production" ||
        resolve(journal.canonicalDistDir) !== canonicalDistDir ||
        resolve(journal.candidateDir) !== candidateDir ||
        !basename(resolve(journal.backupDir)).startsWith("dist-backup-")
    ) {
        throw new Error("Production promotion journal does not match this repository.");
    }

    assertSafeGeneratedOutputDirectory(journal.candidateDir, { label: "journal candidate directory" });
    assertSafeGeneratedOutputDirectory(journal.backupDir, { label: "journal backup directory" });
    assertSafeGeneratedOutputDirectory(journal.canonicalDistDir, { allowCanonicalDist: true, label: "journal dist directory" });
}

function restoreDistFromBackup(backupDir) {
    if (!existsSync(backupDir)) {
        return;
    }
    rmSync(canonicalDistDir, { recursive: true, force: true });
    renameSync(backupDir, canonicalDistDir);
}

function cleanupCompletedPromotion(backupDir) {
    try {
        rmSync(backupDir, { recursive: true, force: true });
        removePromotionJournal();
    } catch (error) {
        console.warn(`Release promoted, but promotion cleanup will need recovery on the next run: ${error.message}`);
    }
}

function removePromotionJournal() {
    rmSync(promotionJournalPath, { force: true });
}
