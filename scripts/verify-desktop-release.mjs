import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { readVersion, resolveConfiguredDistDir, rootDir } from "./build-utils.mjs";
import { desktopDistributionName, desktopLicenseFiles, desktopRuntimeArtifacts, desktopThirdPartySourceArtifacts } from "./desktop-runtime-manifest.mjs";
import { readZipCentralDirectory } from "./zip-store.mjs";

const version = readVersion();
const distDir = resolveConfiguredDistDir();
const downloadsDir = join(distDir, "downloads");
const distributionName = desktopDistributionName;
const stableZipPath = join(downloadsDir, `${distributionName}.zip`);
const versionedZipPath = join(downloadsDir, `${distributionName}-${version.version}.zip`);
const runtimeArtifactEntries = desktopRuntimeArtifacts.map((artifact) => distributionArtifact(artifact));
const runtimeArtifactEntryNames = new Set(runtimeArtifactEntries.map((artifact) => artifact.entry));
const thirdPartySourceEntries = desktopThirdPartySourceArtifacts.map((artifact) => distributionArtifact(artifact));
const thirdPartySourceEntryNames = new Set(thirdPartySourceEntries.map((artifact) => artifact.entry));
const licenseEntries = desktopLicenseFiles.map((file) => `${distributionName}/${file}`);
const licenseEntryNames = new Set(licenseEntries);
const requiredEntries = [
    `${distributionName}/${distributionName}.jar`,
    ...runtimeArtifactEntries.map((artifact) => artifact.entry),
    ...licenseEntries,
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
        if (entry.startsWith(`${distributionName}/lib/`) || entry.startsWith(`${distributionName}/natives/`)) {
            assert.ok(runtimeArtifactEntryNames.has(entry), `${relative(rootDir, zipPath)} should not include undeclared runtime artifact ${entry}.`);
        }
        if (entry.startsWith(`${distributionName}/third-party-sources/`)) {
            assert.ok(thirdPartySourceEntryNames.has(entry), `${relative(rootDir, zipPath)} should not include undeclared source artifact ${entry}.`);
        }
        if (entry.startsWith(`${distributionName}/licenses/`)) {
            assert.ok(licenseEntryNames.has(entry), `${relative(rootDir, zipPath)} should not include undeclared license file ${entry}.`);
        }
    }

    assert.equal(permissionMode(entries.get(`${distributionName}/run-linux.sh`)), 0o755);
    assert.equal(permissionMode(entries.get(`${distributionName}/run-macos.sh`)), 0o755);

    for (const entry of requiredEntries.filter((name) => !name.endsWith(".sh"))) {
        assert.equal(permissionMode(entries.get(entry)), 0o644, `${entry} should use mode 0644.`);
    }

    for (const artifact of [...runtimeArtifactEntries, ...thirdPartySourceEntries]) {
        assert.equal(sha256ZipEntry(entries.get(artifact.entry)), artifact.sha256, `${artifact.entry} should match the expected artifact hash.`);
    }

    verifyLauncherCompatibility(entries);
}

function distributionArtifact(artifact) {
    return {
        entry: `${distributionName}/${artifact.path}`,
        sha256: artifact.sha256
    };
}

function permissionMode(entry) {
    assert.ok(entry, "Missing ZIP entry metadata.");
    return entry.mode & 0o777;
}

function verifyLauncherCompatibility(entries) {
    const windowsCmd = zipEntryText(entries.get(`${distributionName}/run-windows.cmd`));
    const windowsPowerShell = zipEntryText(entries.get(`${distributionName}/run-windows.ps1`));
    const linux = zipEntryText(entries.get(`${distributionName}/run-linux.sh`));
    const macos = zipEntryText(entries.get(`${distributionName}/run-macos.sh`));

    for (const [label, launcher] of [
        ["Windows CMD", windowsCmd],
        ["Windows PowerShell", windowsPowerShell],
        ["Linux", linux],
        ["macOS", macos]
    ]) {
        assert.match(launcher, /--enable-native-access=ALL-UNNAMED/, `${label} launcher should enable native access when supported.`);
        assert.match(launcher, /--sun-misc-unsafe-memory-access=allow/, `${label} launcher should allow legacy Unsafe access when supported.`);
    }

    assert.match(macos, /-XstartOnFirstThread/, "macOS launcher should request the first JVM thread when supported.");
}

function sha256(path) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function zipEntryText(entry) {
    assert.ok(entry?.data, "Missing ZIP entry data.");
    return entry.data.toString("utf8");
}

function sha256ZipEntry(entry) {
    assert.ok(entry?.data, "Missing ZIP entry data.");
    return createHash("sha256").update(entry.data).digest("hex");
}
