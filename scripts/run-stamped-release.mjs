import { readFileSync } from "node:fs";
import {
    cleanDirectory,
    readVersion,
    resolveDistDir,
    rootDir,
    runCommandWithReleaseLock,
    versionPath,
    withReleaseOperationLock,
    writeAtomicTextFile
} from "./build-utils.mjs";

const options = parseOptions(process.argv.slice(2));
const scriptNames = options.scriptNames;

if (scriptNames.length === 0) {
    throw new Error("Pass one or more npm script names to run under a temporary release stamp.");
}

process.exitCode = await withReleaseOperationLock("run-stamped-release", async () => {
    const originalVersionBytes = readFileSync(versionPath);
    const version = readVersion();
    const buildStamp = new Date().toISOString();
    const childEnv = {
        ...process.env,
        STICKVANIA_ALLOW_VERSION_OVERRIDE: "true",
        STICKVANIA_BUILD_STAMP: buildStamp
    };
    let exitStatus = 0;

    if (options.distDir !== null) {
        childEnv.STICKVANIA_DIST_DIR = options.distDir;
        childEnv.STICKVANIA_ALLOW_DIST_DIR_OVERRIDE = "true";
    }

    if (options.cleanDist) {
        cleanDirectory(resolveDistDir(options.distDir ?? undefined), {
            allowCanonicalDist: options.distDir === null,
            label: "release stamp output directory"
        });
    }

    try {
        console.log(`Building ${version.version} at ${buildStamp}`);

        for (const scriptName of scriptNames) {
            const result = await runCommandWithReleaseLock(getNpmCommand(), getNpmArgs(scriptName), {
                cwd: rootDir,
                env: childEnv,
                stdio: "inherit"
            });
            if (result.status !== 0) {
                exitStatus = result.status ?? 1;
                break;
            }
        }
    } finally {
        restoreVersionJsonIfChanged(originalVersionBytes);
    }

    return exitStatus;
});

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

function parseOptions(args) {
    const parsed = {
        cleanDist: false,
        distDir: null,
        scriptNames: []
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--clean-dist") {
            parsed.cleanDist = true;
        } else if (arg === "--dist") {
            i++;
            if (i >= args.length) {
                throw new Error("Missing value after --dist.");
            }
            parsed.distDir = args[i];
        } else {
            parsed.scriptNames.push(arg);
        }
    }

    return parsed;
}
