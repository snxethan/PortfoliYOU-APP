// Centralized brand constants and helpers used across main, preload, and renderer

export const APP_NAME = "Portfoli-YOU";
export const APP_ID = "dev.snxethan.portfoliyou"; // Windows AppUserModelID
export const APP_TAGLINE = "A Portfolio for you, by you.";

// Prefer PNG; fallback to SVG/ICO. In dev, use Vite public; in prod, use built dist files.
export function resolveAppIconPath(): string | undefined {
    const path = require("node:path");
    const fs = require("node:fs");
    const candidates = ["icon.png", "icon.svg", "favicon.ico", "icon.ico"];
    for (const name of candidates) {
        const devPath = path.join(process.cwd(), "app", "renderer", "public", name);
        if (fs.existsSync(devPath)) return devPath;
        const prodPath = path.join(__dirname, "../../dist", name);
        if (fs.existsSync(prodPath)) return prodPath;
    }
    return undefined;
}

export function brandTitle(subtitle?: string): string {
    return subtitle ? `${APP_NAME} — ${subtitle}` : APP_NAME;
}
