import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDirectory, readVersion, resolveConfiguredDistDir, rootDir } from "./build-utils.mjs";

const version = readVersion();
const distDir = resolveConfiguredDistDir();
const downloadsDir = join(distDir, "downloads");
const desktopTargetDir = join(rootDir, "desktop", "target");
const distributionName = "stickvania-desktop";
const sourceZip = join(desktopTargetDir, `${distributionName}-${version.version}.zip`);
const stableZip = join(downloadsDir, `${distributionName}.zip`);
const versionedZip = join(downloadsDir, `${distributionName}-${version.version}.zip`);

ensureDirectory(downloadsDir);
copyFileSync(sourceZip, stableZip);
copyFileSync(sourceZip, versionedZip);
console.log(`Copied desktop downloads to ${downloadsDir}`);
