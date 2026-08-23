import { rootDir, runCommandWithReleaseLock, withReleaseOperationLock } from "./build-utils.mjs";

await withReleaseOperationLock("release-desktop", async () => {
    await runNpmScript("verify");
    await runNodeScript("scripts/copy-desktop-release.mjs");
});

async function runNpmScript(scriptName) {
    const result = await runCommandWithReleaseLock(getNpmCommand(), getNpmArgs(scriptName), {
        cwd: rootDir,
        stdio: "inherit"
    });
    if (result.status !== 0) {
        throw new Error(`Release script failed: npm run ${scriptName}`);
    }
}

async function runNodeScript(scriptPath) {
    const result = await runCommandWithReleaseLock(process.execPath, [scriptPath], {
        cwd: rootDir,
        stdio: "inherit"
    });
    if (result.status !== 0) {
        throw new Error(`Release script failed: node ${scriptPath}`);
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
