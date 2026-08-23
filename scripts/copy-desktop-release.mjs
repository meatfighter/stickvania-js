import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { readVersion, rootDir, withReleaseOperationLock } from "./build-utils.mjs";

withReleaseOperationLock("copy-desktop-release", () => {
    const version = readVersion();
    const releasesDir = join(rootDir, "releases");
    const distributionName = "stickvania-desktop";
    const sourceZip = join(rootDir, "desktop", "target", `${distributionName}-${version.version}.zip`);
    const releaseZip = join(releasesDir, `${distributionName}-${version.version}.zip`);

    if (!existsSync(sourceZip)) {
        throw new Error(`Missing desktop release zip: ${sourceZip}`);
    }

    mkdirSync(releasesDir, { recursive: true });
    copyFileSync(sourceZip, releaseZip);
    console.log(`Copied ${relative(rootDir, releaseZip)}`);
});
