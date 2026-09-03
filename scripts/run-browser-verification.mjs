import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { cleanupBrowser, launchBrowser, stopChild, waitForExpression, waitForHttpServer } from "./browser-test-utils.mjs";
import { rootDir } from "./build-utils.mjs";

const port = 5198;
const url = `http://127.0.0.1:${port}/browser-verify.html`;
const viteBin = resolve(rootDir, "node_modules", "vite", "bin", "vite.js");
const server = spawn(process.execPath, [viteBin, "--config", "pwa/vite.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: rootDir,
    stdio: ["ignore", "pipe", "pipe"]
});
let browser = null;
try {
    await waitForHttpServer(server, url);
    browser = await launchBrowser(url, rootDir, "stickvania-browser-");
    const output = await waitForExpression(
        browser.page,
        '(() => { const element = document.querySelector("#result"); if (element?.dataset.status === "failed") throw new Error(element.textContent || "Browser verification failed."); return element?.dataset.status === "passed" ? element.textContent : false; })()'
    );
    console.log(output);
} finally {
    await cleanupBrowser(browser);
    await stopChild(server);
}
