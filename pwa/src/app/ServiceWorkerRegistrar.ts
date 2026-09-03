export async function registerStickvaniaServiceWorker(cacheVersion: string): Promise<void> {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV || location.protocol === "file:") {
        return;
    }
    const version = encodeURIComponent(cacheVersion);
    const serviceWorkerUrl = new URL(`./sw.js?v=${version}`, window.location.href);
    await navigator.serviceWorker.register(serviceWorkerUrl.href, { scope: "./" });
    await navigator.serviceWorker.ready;
    await waitForServiceWorkerController();
}

async function waitForServiceWorkerController(): Promise<void> {
    if (navigator.serviceWorker.controller !== null) {
        return;
    }
    await new Promise<void>((resolve) => {
        const finish = () => {
            window.clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("controllerchange", finish);
            resolve();
        };
        const timeout = window.setTimeout(finish, 3000);
        navigator.serviceWorker.addEventListener("controllerchange", finish);
    });
}
