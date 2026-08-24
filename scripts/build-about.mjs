import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ensureDirectory, readVersion, renderTemplate, resolveConfiguredDistDir, rootDir } from "./build-utils.mjs";

const version = readVersion();
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const distDir = resolveConfiguredDistDir();
const cacheVersion = `${version.version}-${version.buildStamp}`;
const encodedBuildStamp = encodeURIComponent(version.buildStamp);
const encodedCacheVersion = encodeURIComponent(cacheVersion);
const aboutDir = join(rootDir, "about");
const assetsDir = join(distDir, "assets");
const sourceImagesDir = join(rootDir, "pwa", "public", "images");
const replacements = {
    __APP_VERSION__: version.version,
    __BUILD_STAMP__: version.buildStamp,
    __BUILD_STAMP_ENCODED__: encodedBuildStamp,
    __DESKTOP_ZIP__: `downloads/stickvania-desktop.zip?v=${encodedBuildStamp}`,
    __PWA_URL__: `pwa/?v=${encodedCacheVersion}`,
    __REPOSITORY_URL__: normalizeRepositoryUrl(packageJson.repository)
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

function normalizeRepositoryUrl(repository) {
    const rawUrl = typeof repository === "string" ? repository : repository?.url;
    if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
        throw new Error("package.json must define a repository URL for the about page.");
    }

    let urlText = rawUrl.trim();
    if (urlText.startsWith("github:")) {
        urlText = `https://github.com/${urlText.substring("github:".length)}`;
    } else if (urlText.startsWith("git+")) {
        urlText = urlText.substring("git+".length);
    } else if (urlText.startsWith("git://")) {
        urlText = `https://${urlText.substring("git://".length)}`;
    }

    const url = new URL(urlText);
    if (url.protocol !== "https:") {
        throw new Error(`Repository URL must be HTTPS: ${rawUrl}`);
    }
    if (url.pathname.endsWith(".git")) {
        url.pathname = url.pathname.substring(0, url.pathname.length - ".git".length);
    }
    url.hash = "";
    url.search = "";
    return url.href.replace(/\/$/, "");
}
