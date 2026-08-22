import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { distDir, readVersion, rootDir } from "./build-utils.mjs";

const version = readVersion();
const downloadsDir = join(distDir, "downloads");
const distributionName = "stickvania-desktop";
const stableZipPath = join(downloadsDir, `${distributionName}.zip`);
const versionedZipPath = join(downloadsDir, `${distributionName}-${version.version}.zip`);
const requiredEntries = [
    `${distributionName}/${distributionName}.jar`,
    `${distributionName}/lib/slick.jar`,
    `${distributionName}/lib/lwjgl.jar`,
    `${distributionName}/lib/lwjgl_util.jar`,
    `${distributionName}/lib/jinput.jar`,
    `${distributionName}/lib/jogg-0.0.7.jar`,
    `${distributionName}/lib/jorbis-0.0.17.jar`,
    `${distributionName}/natives/windows/lwjgl64.dll`,
    `${distributionName}/natives/windows/OpenAL64.dll`,
    `${distributionName}/natives/windows/jinput-dx8_64.dll`,
    `${distributionName}/natives/windows/jinput-raw_64.dll`,
    `${distributionName}/LICENSE`,
    `${distributionName}/THIRD_PARTY_NOTICES.md`,
    `${distributionName}/README.md`,
    `${distributionName}/RUNTIME_DEPENDENCIES.md`,
    `${distributionName}/run-windows.cmd`,
    `${distributionName}/run-windows.ps1`,
    `${distributionName}/run-linux.sh`,
    `${distributionName}/run-macos.sh`
];

verifyDesktopZip(stableZipPath);
verifyDesktopZip(versionedZipPath);
console.log(`Verified desktop release zips in ${relative(rootDir, downloadsDir)}`);

function verifyDesktopZip(zipPath) {
    assert.ok(existsSync(zipPath), `Missing desktop release zip: ${zipPath}`);
    const entries = listZipEntries(zipPath);

    for (const entry of requiredEntries) {
        assert.ok(entries.has(entry), `${relative(rootDir, zipPath)} is missing ${entry}`);
    }
}

function listZipEntries(zipPath) {
    const result = spawnSync("jar", ["tf", zipPath], {
        cwd: rootDir,
        encoding: "utf8"
    });
    if (result.error) {
        throw result.error;
    }
    assert.equal(result.status, 0, result.stderr);
    return new Set(result.stdout.split(/\r?\n/).filter((line) => line.length > 0));
}
