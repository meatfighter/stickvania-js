const STORAGE_KEY_PREFIX = "stickvania";
const DEFAULT_BROWSER_STORAGE_URL = "https://stickvania.invalid/";

export function getBrowserStorageKey(name: string, href: string = getCurrentBrowserHref()): string {
    return `${STORAGE_KEY_PREFIX}:${getBrowserStorageScopeId(href)}:${name}`;
}

export function getBrowserStorageScopeId(href: string = getCurrentBrowserHref()): string {
    return encodeURIComponent(getBrowserStorageScopePath(href));
}

export function getBrowserStorageScopePath(href: string = getCurrentBrowserHref()): string {
    const url = new URL(href, DEFAULT_BROWSER_STORAGE_URL);
    const pathname = url.pathname || "/";
    if (pathname.endsWith("/")) {
        return pathname;
    }

    const slash = pathname.lastIndexOf("/");
    return slash < 0 ? "/" : pathname.substring(0, slash + 1);
}

function getCurrentBrowserHref(): string {
    if (typeof window !== "undefined") {
        return window.location.href;
    }
    return DEFAULT_BROWSER_STORAGE_URL;
}
