import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { renderAboutMarkdown } from "./about-markdown.mjs";
import { rootDir } from "./build-utils.mjs";

const aboutDir = join(rootDir, "about");
const contentMarkdown = readFileSync(join(aboutDir, "content.md"), "utf8");
const indexTemplate = readFileSync(join(aboutDir, "index.html"), "utf8");
const styles = readFileSync(join(aboutDir, "styles.css"), "utf8");
const themeScript = readFileSync(join(aboutDir, "theme.js"), "utf8");
const buildAboutSource = readFileSync(new URL("./build-about.mjs", import.meta.url), "utf8");
const desktopZipProse = `The Java desktop version is available as a [ZIP file](__DESKTOP_ZIP__). Download and extract the ZIP, then run the launcher for your operating system:

- Windows: \`run-windows.cmd\`
- Linux: \`run-linux.sh\`
- macOS: \`run-macos.sh\`

Java 21 or newer is required.`;

function renderedAboutFixture() {
    return renderAboutMarkdown(
        contentMarkdown
            .replaceAll("__PWA_URL__", "pwa/?v=test-build")
            .replaceAll("__REPOSITORY_URL__", "https://github.com/meatfighter/stickvania-js")
            .replaceAll("__DESKTOP_ZIP__", "downloads/stickvania-desktop.zip?v=test-build")
    );
}

test("about Markdown content is the user-facing source of truth", () => {
    assert.match(contentMarkdown, /\[Play\]\(__PWA_URL__\)/);
    assert.match(contentMarkdown, /\[meatfighter\/stickvania-js repository\]\(__REPOSITORY_URL__\)/);
    assert.ok(contentMarkdown.includes(desktopZipProse));
    assert.doesNotMatch(contentMarkdown, /\*\*\[here\]\*\*/);
    assert.doesNotMatch(contentMarkdown, /\bTODO\b/i);
    assert.doesNotMatch(contentMarkdown, /executable JAR/i);
    assert.doesNotMatch(contentMarkdown, /java -jar/i);
    assert.doesNotMatch(contentMarkdown, /â|Å/);
    assert.doesNotMatch(contentMarkdown, /!\[.*stickvania-screenshot\.png/i);
});

test("about Markdown renderer creates the expected article features", () => {
    const rendered = renderedAboutFixture();

    assert.match(rendered.articleHtml, /<h1 id="about">/);
    assert.match(rendered.articleHtml, /<a class="heading-link" href="#about">About<\/a>/);
    assert.match(rendered.articleHtml, /<h1 id="controls">/);
    assert.match(rendered.articleHtml, /<button class="copy-link" type="button" data-copy-url="#controls"/);
    assert.match(rendered.articleHtml, /<h2 id="browser-menu">/);
    assert.match(rendered.articleHtml, /class="play-button" href="pwa\/\?v=test-build"/);
    assert.doesNotMatch(rendered.articleHtml, /class="play-button"[^>]+target="_blank"/);
    assert.match(rendered.articleHtml, /<div class="table-wrap"><table>/);
    assert.match(rendered.articleHtml, /href="https:\/\/github\.com\/meatfighter\/stickvania-js" target="_blank" rel="noopener noreferrer"/);
    assert.match(rendered.articleHtml, /href="downloads\/stickvania-desktop\.zip\?v=test-build" download="stickvania-desktop\.zip"/);
    assert.doesNotMatch(rendered.articleHtml, /downloads\/stickvania-desktop\.zip\?v=test-build" target="_blank"/);
    assert.doesNotMatch(rendered.articleHtml, /stickvania-screenshot\.png/);
    assert.ok(rendered.headings.some((heading) => heading.slug === "hard-mode" && heading.level === 1));
    assert.match(rendered.tocHtml, /<nav class="toc" aria-labelledby="toc-heading">/);
    assert.match(rendered.tocHtml, /<h2 id="toc-heading">Contents<\/h2>/);
    assert.match(rendered.tocHtml, /<li class="toc-level-1"><a href="#about">About<\/a><\/li>/);
    assert.match(rendered.tocHtml, /<li class="toc-level-2"><a href="#browser-menu">Browser Menu<\/a><\/li>/);
    assert.doesNotMatch(rendered.tocHtml, /class="toc-level-3"/);
});

test("about page shell carries SEO, theme, footer, and generated-content placeholders", () => {
    assert.match(indexTemplate, /<link rel="canonical" href="__CANONICAL_URL__" \/>/);
    assert.match(indexTemplate, /<meta property="og:image" content="__SOCIAL_IMAGE_URL__" \/>/);
    assert.match(indexTemplate, /<meta name="twitter:card" content="summary_large_image" \/>/);
    assert.match(indexTemplate, /Stickvania/);
    assert.match(indexTemplate, /href=".\/assets\/fonts\/source-sans-3\/SourceSans3VF-Upright\.ttf\.woff2\?v=__BUILD_STAMP_ENCODED__"/);
    assert.match(indexTemplate, /as="font"/);
    assert.match(indexTemplate, /class="site-logo"/);
    assert.match(indexTemplate, /src=".\/__TITLE_SVG_SRC__"/);
    assert.match(indexTemplate, /sizes="__TITLE_IMAGE_SIZES__"/);
    assert.match(indexTemplate, /width="__TITLE_IMAGE_WIDTH__"/);
    assert.match(indexTemplate, /height="__TITLE_IMAGE_HEIGHT__"/);
    assert.match(indexTemplate, /__TOC_HTML__/);
    assert.match(indexTemplate, /__ARTICLE_HTML__/);
    assert.match(indexTemplate, /https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/\?ref=chooser-v1/);
    assert.match(indexTemplate, /class="license-wrap"/);
    assert.match(indexTemplate, /class="license-icons"/);
    assert.match(indexTemplate, /<a href="__REPOSITORY_URL__" target="_blank" rel="noopener noreferrer">Source<\/a>/);
    assert.match(indexTemplate, /<a href="https:\/\/meatfighter\.com\/">Home<\/a>/);
    assert.match(indexTemplate, /<script src=".\/theme\.js\?v=__BUILD_STAMP_ENCODED__"><\/script>/);
    assert.match(styles, /--measure: 750px;/);
    assert.match(styles, /--bg: #fcfcfc;/);
    assert.match(styles, /--bg: #000000;/);
    assert.match(styles, /--text: #0d0d0d;/);
    assert.match(styles, /--text: #ffffff;/);
    assert.match(styles, /--link: #666666;/);
    assert.match(styles, /--link-hover: #262626;/);
    assert.match(styles, /--link: #999999;/);
    assert.match(styles, /--link-hover: #d9d9d9;/);
    assert.match(styles, /--switch-track: #0d0d0d;/);
    assert.match(styles, /--switch-track-checked: #ffffff;/);
    assert.match(styles, /--switch-knob: #fcfcfc;/);
    assert.match(styles, /--switch-knob-checked: #000000;/);
    assert.match(styles, /--play-button-bg: #0d0d0d;/);
    assert.match(styles, /--play-button-text: #fcfcfc;/);
    assert.match(styles, /--play-button-bg: #ffffff;/);
    assert.match(styles, /--play-button-text: #000000;/);
    assert.match(styles, /a \{\s+color: var\(--link\);\s+font-weight: 600;\s+text-decoration: none;\s+transition: color 0\.18s ease;\s+\}/);
    assert.match(styles, /a:hover,[\s\S]*a:focus-visible \{\s+color: var\(--link-hover\);\s+\}/);
    assert.match(styles, /\.site-logo \{[\s\S]*filter: invert\(1\);/);
    assert.match(styles, /html\[data-theme="dark"\] \.site-logo \{[\s\S]*filter: none;/);
    assert.match(styles, /\.toc \{\s+margin: 0 0 2rem;/);
    assert.match(styles, /\.toc li:not\(:last-child\)::after \{[\s\S]*content: " \| ";/);
    assert.match(styles, /\.site-footer__inner \{[\s\S]*font-family: var\(--font-ui\);\s+line-height: 1\.6;/);
    assert.match(styles, /\.site-footer__left \{\s+font-size: 0\.95rem;\s+\}/);
    assert.match(styles, /\.site-footer__left p \+ p \{\s+margin-top: 0\.08rem;\s+\}/);
    assert.match(styles, /\.site-footer__links \{[\s\S]*line-height: 1\.6;\s+text-align: right;/);
    assert.match(styles, /font-family: "Source Sans 3";/);
    assert.match(themeScript, /stickvania-about-theme/);
    assert.match(themeScript, /theme === "dark" \? "#000000" : "#fcfcfc"/);
});

test("about build uses constrained Markdown and SVG title assets", () => {
    assert.match(buildAboutSource, /content\.md/);
    assert.match(buildAboutSource, /renderAboutMarkdown/);
    assert.match(buildAboutSource, /const titleImageWidth = 750;/);
    assert.match(buildAboutSource, /const titleImageHeight = 480;/);
    assert.match(buildAboutSource, /__TITLE_SVG_SRC__/);
    assert.match(buildAboutSource, /stickvania-screenshot\.png/);
    assert.match(buildAboutSource, /normalizeRepositoryUrl/);
    assert.doesNotMatch(buildAboutSource, /jackal/i);
});

test("about assets live with the about page source", () => {
    assert.equal(existsSync(join(aboutDir, "content.md")), true);
    assert.equal(existsSync(join(aboutDir, "assets", "title.svg")), true);
    assert.equal(existsSync(join(aboutDir, "assets", "title.png")), false);
    assert.equal(existsSync(join(aboutDir, "assets", "stickvania-screenshot.png")), true);
    assert.equal(existsSync(join(aboutDir, "assets", "icon.png")), true);
    assert.equal(existsSync(join(aboutDir, "assets", "fonts", "source-sans-3", "SourceSans3VF-Upright.ttf.woff2")), true);
    assert.equal(existsSync(join(aboutDir, "assets", "fonts", "source-sans-3", "SourceSans3VF-Italic.ttf.woff2")), true);
    assert.equal(existsSync(join(aboutDir, "assets", "fonts", "source-sans-3", "LICENSE.md")), true);
    assert.equal(existsSync(join(rootDir, "about.md")), false);
    assert.equal(existsSync(join(rootDir, "title.svg")), false);
    assert.equal(existsSync(join(rootDir, "title.png")), false);
    assert.equal(existsSync(join(rootDir, "stickvania-screenshot.png")), false);
    assert.equal(existsSync(join(rootDir, "nosferatu.png")), false);
});

test("about SVG title source is white artwork on a transparent background", () => {
    const titleSvg = readFileSync(join(aboutDir, "assets", "title.svg"), "utf8");

    assert.match(titleSvg, /<svg\b/);
    assert.match(titleSvg, /viewBox="0 0 155\.31 99\.396"/);
    assert.match(titleSvg, /fill="#fff"/);
    assert.doesNotMatch(titleSvg, /fill="#000/i);
    assert.doesNotMatch(titleSvg, /<script\b/i);
    assert.doesNotMatch(titleSvg, /\b(?:href|xlink:href)=["']https?:/i);
});
