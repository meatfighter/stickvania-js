import { canonicalDistDir, cleanDirectory, withReleaseOperationLock } from "./build-utils.mjs";

withReleaseOperationLock("clean-dist", () => {
    cleanDirectory(canonicalDistDir, { allowCanonicalDist: true, label: "clean output directory" });
    console.log(`Cleaned ${canonicalDistDir}`);
});
