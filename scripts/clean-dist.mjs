import { cleanDirectory, distDir } from "./build-utils.mjs";

cleanDirectory(distDir, { allowCanonicalDist: true, label: "clean output directory" });
console.log(`Cleaned ${distDir}`);
