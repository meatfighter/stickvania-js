import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateAboutImageAssets, titleImageHeight, titleImageSizes, titleImageWidth } from "./about-image-assets.mjs";
import {
    copyFileAtomic,
    ensureDirectory,
    readVersion,
    renderTemplate,
    resolveConfiguredDistDir,
    rootDir,
    withReleaseOperationLock,
    writeAtomicTextFile
} from "./build-utils.mjs";
import { renderAboutMarkdown } from "./about-markdown.mjs";

const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const canonicalUrl = normalizeCanonicalUrl(packageJson.homepage ?? "https://meatfighter.com/stickvania/");
const repositoryUrl = normalizeRepositoryUrl(packageJson.repository);
const description = "Play Stickvania in the browser and read about its Java origins, TypeScript rewrite, controls, difficulty modes, and desktop ZIP download.";

await withReleaseOperationLock("build-about", async () => {
    const version = readVersion();
    const distDir = resolveConfiguredDistDir();
    const aboutDir = join(rootDir, "about");
    const sourceAssetsDir = join(aboutDir, "assets");
    const outputAssetsDir = join(distDir, "assets");
    const cacheVersion = `${version.version}-${version.buildStamp}`;
    const encodedBuildStamp = encodeURIComponent(version.buildStamp);
    const encodedCacheVersion = encodeURIComponent(cacheVersion);

    const contentMarkdown = renderCheckedTemplate(
        readFileSync(join(aboutDir, "content.md"), "utf8"),
        {
            __DESKTOP_ZIP__: `downloads/stickvania-desktop.zip?v=${encodedBuildStamp}`,
            __PWA_URL__: `pwa/?v=${encodedCacheVersion}`,
            __REPOSITORY_URL__: repositoryUrl
        },
        "about Markdown content"
    );
    const renderedMarkdown = renderAboutMarkdown(contentMarkdown);
    const pageReplacements = {
        __APP_VERSION__: version.version,
        __ARTICLE_HTML__: renderedMarkdown.articleHtml,
        __BUILD_STAMP__: version.buildStamp,
        __BUILD_STAMP_ENCODED__: encodedBuildStamp,
        __CANONICAL_URL__: canonicalUrl,
        __DESCRIPTION__: description,
        __REPOSITORY_URL__: repositoryUrl,
        __SOCIAL_IMAGE_URL__: `${canonicalUrl}assets/stickvania-screenshot.png?v=${encodedBuildStamp}`,
        __TITLE_DARK_PNG_SRC__: `assets/title-dark-750.png?v=${encodedBuildStamp}`,
        __TITLE_DARK_PNG_SRCSET__: `assets/title-dark-750.png?v=${encodedBuildStamp} 750w, assets/title-dark-1448.png?v=${encodedBuildStamp} 1448w`,
        __TITLE_DARK_WEBP_SRCSET__: `assets/title-dark-750.webp?v=${encodedBuildStamp} 750w, assets/title-dark-1448.webp?v=${encodedBuildStamp} 1448w`,
        __TITLE_IMAGE_HEIGHT__: titleImageHeight,
        __TITLE_IMAGE_SIZES__: titleImageSizes,
        __TITLE_IMAGE_WIDTH__: titleImageWidth,
        __TITLE_LIGHT_PNG_SRC__: `assets/title-light-750.png?v=${encodedBuildStamp}`,
        __TITLE_LIGHT_PNG_SRCSET__: `assets/title-light-750.png?v=${encodedBuildStamp} 750w, assets/title-light-1448.png?v=${encodedBuildStamp} 1448w`,
        __TITLE_LIGHT_WEBP_SRCSET__: `assets/title-light-750.webp?v=${encodedBuildStamp} 750w, assets/title-light-1448.webp?v=${encodedBuildStamp} 1448w`,
        __TOC_HTML__: renderedMarkdown.tocHtml
    };

    ensureDirectory(distDir);
    ensureDirectory(outputAssetsDir);
    writeGeneratedText(
        join(distDir, "index.html"),
        renderCheckedTemplate(readFileSync(join(aboutDir, "index.html"), "utf8"), pageReplacements, "about index page")
    );
    writeGeneratedText(
        join(distDir, "styles.css"),
        renderCheckedTemplate(readFileSync(join(aboutDir, "styles.css"), "utf8"), pageReplacements, "about stylesheet")
    );
    writeGeneratedText(join(distDir, "theme.js"), renderCheckedTemplate(readFileSync(join(aboutDir, "theme.js"), "utf8"), pageReplacements, "about script"));
    copyDirectory(sourceAssetsDir, outputAssetsDir);
    await generateAboutImageAssets(sourceAssetsDir, outputAssetsDir);
    console.log("Built about page");
});

function writeGeneratedText(path, content) {
    writeAtomicTextFile(path, content, { label: "about generated text output file" });
}

function copyDirectory(sourceDir, targetDir) {
    const sourceStat = lstatSync(sourceDir);
    if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
        throw new Error(`About asset source must be a real directory: ${sourceDir}`);
    }

    ensureDirectory(targetDir);
    for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
        const sourcePath = join(sourceDir, entry.name);
        const targetPath = join(targetDir, entry.name);
        const stat = lstatSync(sourcePath);

        if (stat.isSymbolicLink()) {
            throw new Error(`About assets must not include symbolic links or junctions: ${sourcePath}`);
        }
        if (stat.isDirectory()) {
            copyDirectory(sourcePath, targetPath);
        } else if (stat.isFile()) {
            copyFileAtomic(sourcePath, targetPath, { label: "about asset output file" });
        } else {
            throw new Error(`About assets must not include special filesystem entries: ${sourcePath}`);
        }
    }
}

function renderCheckedTemplate(template, replacements, label) {
    const output = renderTemplate(template, replacements);
    assertNoUnresolvedTokens(output, label);
    return output;
}

function assertNoUnresolvedTokens(content, label) {
    const match = /__[A-Z][A-Z0-9_]*__/.exec(content);
    if (match !== null) {
        throw new Error(`${label} contains unresolved template token ${match[0]}.`);
    }
}

function normalizeCanonicalUrl(rawUrl) {
    const url = new URL(rawUrl);
    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) {
        url.pathname = `${url.pathname}/`;
    }
    return url.href;
}

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
