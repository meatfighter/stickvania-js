import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

for (const stalled of ["register", "ready", "controller"]) {
    test(`offline ${stalled} cannot block online startup`, async () => {
        const listeners = new Set();
        const never = new Promise(() => {});
        const context = {
            exports: {},
            URL,
            console,
            setTimeout: (callback) => setTimeout(callback, 10),
            clearTimeout,
            location: { protocol: "https:" },
            window: { location: { href: "https://example.test/game/" } },
            navigator: {
                serviceWorker: {
                    register: () => (stalled === "register" ? never : Promise.resolve({})),
                    ready: stalled === "ready" ? never : Promise.resolve({}),
                    controller: null,
                    addEventListener: (_name, callback) => listeners.add(callback),
                    removeEventListener: (_name, callback) => listeners.delete(callback)
                }
            }
        };
        const source = readFileSync("pwa/src/app/ServiceWorkerRegistrar.ts", "utf8").replaceAll("import.meta.env.DEV", "false");
        vm.runInNewContext(
            ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
            context
        );
        await context.exports.registerStickvaniaServiceWorker("test");
        assert.equal(listeners.size, 0);
    });
}
