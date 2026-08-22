import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { distDir, readVersion, rootDir } from "./build-utils.mjs";
import { readZipCentralDirectory } from "./zip-store.mjs";

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
assert.equal(sha256(stableZipPath), sha256(versionedZipPath), "Stable and versioned desktop ZIPs should be byte-identical.");
console.log(`Verified desktop release zips in ${relative(rootDir, downloadsDir)}`);

function verifyDesktopZip(zipPath) {
    assert.ok(existsSync(zipPath), `Missing desktop release zip: ${zipPath}`);
    const entries = readZipCentralDirectory(zipPath);

    for (const entry of requiredEntries) {
        assert.ok(entries.has(entry), `${relative(rootDir, zipPath)} is missing ${entry}`);
    }

    for (const entry of entries.keys()) {
        assert.equal(entry.startsWith("META-INF/"), false, `${relative(rootDir, zipPath)} should not include root outer manifest entries.`);
        assert.equal(
            entry.startsWith(`${distributionName}/META-INF/`),
            false,
            `${relative(rootDir, zipPath)} should not include distribution outer manifest entries.`
        );
    }

    assert.equal(permissionMode(entries.get(`${distributionName}/run-linux.sh`)), 0o755);
    assert.equal(permissionMode(entries.get(`${distributionName}/run-macos.sh`)), 0o755);

    for (const entry of requiredEntries.filter((name) => !name.endsWith(".sh"))) {
        assert.equal(permissionMode(entries.get(entry)), 0o644, `${entry} should use mode 0644.`);
    }
}

function permissionMode(entry) {
    assert.ok(entry, "Missing ZIP entry metadata.");
    return entry.mode & 0o777;
}

function sha256(path) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}
