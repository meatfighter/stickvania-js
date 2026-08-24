import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readVersion, resolveConfiguredDistDir, rootDir } from "./build-utils.mjs";
import { readZipCentralDirectory } from "./zip-store.mjs";

const version = readVersion();
const distDir = resolveConfiguredDistDir();
const downloadsDir = join(distDir, "downloads");
const distributionName = "stickvania-desktop";
const stableZipPath = join(downloadsDir, `${distributionName}.zip`);
const versionedZipPath = join(downloadsDir, `${distributionName}-${version.version}.zip`);
const runtimeJarEntries = [
    `${distributionName}/lib/slick.jar`,
    `${distributionName}/lib/lwjgl.jar`,
    `${distributionName}/lib/lwjgl_util.jar`,
    `${distributionName}/lib/jinput.jar`,
    `${distributionName}/lib/jogg-0.0.7.jar`,
    `${distributionName}/lib/jorbis-0.0.17.jar`
];
const thirdPartySourceEntries = [
    {
        entry: `${distributionName}/third-party-sources/jogg-0.0.7-jcraft-jorbis-28592f3-source.zip`,
        sha256: "0c814790741d14debc4a88214bdf8d0369a521a652e4d9a375b0cdfdbc21597a"
    },
    {
        entry: `${distributionName}/third-party-sources/jorbis-0.0.17-sources.jar`,
        sha256: "1643dd368b9c160276caf8d1f6a8c0aae43ca5bf49b53348a2a01623641708e5"
    },
    {
        entry: `${distributionName}/third-party-sources/openal-soft-1.14.tar.bz2`,
        sha256: "87bd8d61d5943387898c92b6a2bbbb26118e745dec57550c817526a70fad0914"
    }
];
const requiredEntries = [
    `${distributionName}/${distributionName}.jar`,
    ...runtimeJarEntries,
    `${distributionName}/natives/windows/lwjgl64.dll`,
    `${distributionName}/natives/windows/OpenAL64.dll`,
    `${distributionName}/natives/windows/jinput-dx8_64.dll`,
    `${distributionName}/natives/windows/jinput-raw_64.dll`,
    `${distributionName}/licenses/GNU-LIBRARY-GPL-2.0.txt`,
    `${distributionName}/licenses/JINPUT-BSD.txt`,
    `${distributionName}/licenses/JORBIS-JOGG-LGPL-NOTICE.txt`,
    `${distributionName}/licenses/LWJGL-2-BSD.txt`,
    `${distributionName}/licenses/OPENAL-SOFT-LGPL-NOTICE.txt`,
    `${distributionName}/licenses/README.md`,
    `${distributionName}/licenses/SLICK2D-BSD-3-CLAUSE.txt`,
    ...thirdPartySourceEntries.map((artifact) => artifact.entry),
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
        if (entry.startsWith(`${distributionName}/lib/`) && entry.endsWith(".jar")) {
            assert.ok(runtimeJarEntries.includes(entry), `${relative(rootDir, zipPath)} should not include undeclared runtime jar ${entry}.`);
        }
    }

    assert.equal(permissionMode(entries.get(`${distributionName}/run-linux.sh`)), 0o755);
    assert.equal(permissionMode(entries.get(`${distributionName}/run-macos.sh`)), 0o755);

    for (const entry of requiredEntries.filter((name) => !name.endsWith(".sh"))) {
        assert.equal(permissionMode(entries.get(entry)), 0o644, `${entry} should use mode 0644.`);
    }

    for (const artifact of thirdPartySourceEntries) {
        assert.equal(sha256ZipEntry(entries.get(artifact.entry)), artifact.sha256, `${artifact.entry} should match the expected source artifact hash.`);
    }
}

function permissionMode(entry) {
    assert.ok(entry, "Missing ZIP entry metadata.");
    return entry.mode & 0o777;
}

function sha256(path) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256ZipEntry(entry) {
    assert.ok(entry?.data, "Missing ZIP entry data.");
    return createHash("sha256").update(entry.data).digest("hex");
}
