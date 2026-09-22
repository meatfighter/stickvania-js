const SERVICE_WORKER_STARTUP_TIMEOUT_MS = 3000;

let registrationPromise: Promise<void> | null = null;
export function registerStickvaniaServiceWorker(): Promise<void> {
    registrationPromise ??= registerOnce().catch((error: unknown) => {
        console.warn("Unable to register Stickvania service worker.", error);
    });
    return registrationPromise;
}
async function registerOnce(): Promise<void> {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV || location.protocol === "file:") {
        return;
    }
    const serviceWorkerUrl = new URL("./sw.js", window.location.href);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let removeControllerListener = () => {};
    let expired = false;
    try {
        await Promise.race([
            (async () => {
                await navigator.serviceWorker.register(serviceWorkerUrl.href, { scope: "./", updateViaCache: "none" });
                if (expired) return;
                await navigator.serviceWorker.ready;
                if (expired || navigator.serviceWorker.controller !== null) return;
                await new Promise<void>((resolve) => {
                    const controlled = () => resolve();
                    removeControllerListener = () => {
                        navigator.serviceWorker.removeEventListener("controllerchange", controlled);
                        resolve();
                    };
                    navigator.serviceWorker.addEventListener("controllerchange", controlled);
                    if (navigator.serviceWorker.controller !== null) resolve();
                });
            })(),
            new Promise<void>((resolve) => {
                timeout = setTimeout(() => {
                    expired = true;
                    console.warn("Offline installation is still pending; continuing online.");
                    resolve();
                }, SERVICE_WORKER_STARTUP_TIMEOUT_MS);
            })
        ]);
    } finally {
        expired = true;
        clearTimeout(timeout);
        removeControllerListener();
    }
}
