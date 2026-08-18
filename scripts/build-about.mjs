import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { distDir, ensureDirectory, readVersion, renderTemplate, rootDir } from "./build-utils.mjs";

const version = readVersion();
const encodedBuildStamp = encodeURIComponent(version.buildStamp);
const aboutDir = join(rootDir, "about");
const assetsDir = join(distDir, "assets");
const sourceImagesDir = join(rootDir, "pwa", "public", "images");
const replacements = {
    __APP_VERSION__: version.version,
    __BUILD_STAMP__: version.buildStamp,
    __BUILD_STAMP_ENCODED__: encodedBuildStamp,
    __DESKTOP_ZIP__: `downloads/stickvania-desktop.zip?v=${encodedBuildStamp}`,
    __PWA_URL__: `pwa/?v=${encodedBuildStamp}`
};

ensureDirectory(distDir);
ensureDirectory(assetsDir);
writeFileSync(join(distDir, "index.html"), renderTemplate(readFileSync(join(aboutDir, "index.html"), "utf8"), replacements));
writeFileSync(join(distDir, "styles.css"), renderTemplate(readFileSync(join(aboutDir, "styles.css"), "utf8"), replacements));
copyFileSync(join(sourceImagesDir, "icon.png"), join(assetsDir, "favicon-32.png"));
copyFileSync(join(sourceImagesDir, "icon-192.png"), join(assetsDir, "icon-192.png"));
copyFileSync(join(sourceImagesDir, "icon-512.png"), join(assetsDir, "icon-512.png"));
copyFileSync(join(sourceImagesDir, "title_screen.png"), join(assetsDir, "title-screen.png"));
console.log("Built about page");
