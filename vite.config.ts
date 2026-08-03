import { readFileSync } from "node:fs";
import { defineConfig, type PluginOption } from "vite";

interface VersionInfo {
    readonly version: string;
    readonly buildStamp: string;
}

const versionInfo = JSON.parse(readFileSync(new URL("./version.json", import.meta.url), "utf8")) as VersionInfo;
const encodedBuildStamp = encodeURIComponent(versionInfo.buildStamp);

function versionedHtmlPlugin(): PluginOption {
    return {
        name: "stickvania-versioned-html",
        transformIndexHtml: {
            order: "post",
            handler(html: string): string {
                return html
                    .replaceAll("%APP_VERSION%", versionInfo.version)
                    .replaceAll("%BUILD_STAMP%", encodedBuildStamp);
            }
        }
    };
}

export default defineConfig({
    plugins: [versionedHtmlPlugin()],
    define: {
        __APP_VERSION__: JSON.stringify(versionInfo.version),
        __BUILD_STAMP__: JSON.stringify(versionInfo.buildStamp)
    },
    build: {
        target: "es2022",
        sourcemap: false
    },
    server: {
        port: 5174,
        strictPort: false
    },
    preview: {
        port: 4174,
        strictPort: false
    }
});
