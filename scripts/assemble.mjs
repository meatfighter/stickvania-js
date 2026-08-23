import { join } from "node:path";
import { copyFileAtomic, ensureDirectory, readVersion, resolveConfiguredDistDir, rootDir } from "./build-utils.mjs";

const version = readVersion();
const distDir = resolveConfiguredDistDir();
const downloadsDir = join(distDir, "downloads");
const desktopTargetDir = join(rootDir, "desktop", "target");
const distributionName = "stickvania-desktop";
const sourceZip = join(desktopTargetDir, `${distributionName}-${version.version}.zip`);
const stableZip = join(downloadsDir, `${distributionName}.zip`);
const versionedZip = join(downloadsDir, `${distributionName}-${version.version}.zip`);

ensureDirectory(downloadsDir);
copyFileAtomic(sourceZip, stableZip, { label: "assembled stable desktop ZIP destination" });
copyFileAtomic(sourceZip, versionedZip, { label: "assembled versioned desktop ZIP destination" });
console.log(`Copied desktop downloads to ${downloadsDir}`);
