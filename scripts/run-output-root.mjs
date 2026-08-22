import { spawnSync } from "node:child_process";
import { cleanDirectory, resolveDistDir, rootDir } from "./build-utils.mjs";

const options = parseOptions(process.argv.slice(2));

if (options.scriptNames.length === 0) {
    throw new Error("Pass one or more npm script names to run with the configured output root.");
}

const childEnv = { ...process.env };

if (options.distDir !== null) {
    childEnv.STICKVANIA_DIST_DIR = options.distDir;
}

if (options.cleanDist) {
    cleanDirectory(resolveDistDir(options.distDir ?? undefined));
}

let exitStatus = 0;
for (const scriptName of options.scriptNames) {
    const result = spawnSync(getNpmCommand(), getNpmArgs(scriptName), {
        cwd: rootDir,
        env: childEnv,
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

process.exit(exitStatus);

function getNpmCommand() {
    return process.platform === "win32" ? "cmd.exe" : "npm";
}

function getNpmArgs(scriptName) {
    return process.platform === "win32" ? ["/d", "/s", "/c", `npm.cmd run ${quoteWindowsCommandArgument(scriptName)}`] : ["run", scriptName];
}

function quoteWindowsCommandArgument(value) {
    return /^[A-Za-z0-9:_-]+$/.test(value) ? value : `"${value.replaceAll('"', '""')}"`;
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
