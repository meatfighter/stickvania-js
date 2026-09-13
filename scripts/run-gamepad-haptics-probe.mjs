import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.HAPTICS_PROBE_PORT ?? "5199", 10);
const probeFile = resolve("tools", "gamepad-haptics-probe.page");

if (!existsSync(probeFile) || !statSync(probeFile).isFile()) {
    throw new Error(`Missing haptics probe: ${probeFile}`);
}

const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (requestUrl.pathname !== "/" && requestUrl.pathname !== "/gamepad-haptics-probe") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found\n");
        return;
    }

    response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
    });
    createReadStream(probeFile).pipe(response);
});

server.listen(port, host, () => {
    console.log(`Gamepad haptics probe: http://${host}:${port}/`);
    console.log("Open that URL manually in the browser you want to test (for example, your installed Firefox).");
    console.log("In Firefox, press a controller button after the page is visible if no gamepad appears immediately.");
    console.log("Press Ctrl+C here when you are done.");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        server.close(() => process.exit(0));
    });
}
