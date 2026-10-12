// Bundled from ../icons; nothing reaches a CDN.
const files = import.meta.glob("../icons/*.svg", { query: "?url", import: "default", eager: true }) as Record<string, string>

const LOCAL = new Map<string, string>()
for (const [path, url] of Object.entries(files)) {
    LOCAL.set(path.split("/").pop()!.replace(/\.svg$/, "").replace(/--/g, ":"), url)
}

const MISSING = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'/%3E"

// "iconify:add" | "add" -> "material-symbols:add"
export function normalizeIconId(name: string): string {
    const raw = name.startsWith("iconify:") ? name.slice("iconify:".length) : name
    return raw.includes(":") ? raw : `material-symbols:${raw}`
}

export function resolveIconSrc(name: string): string {
    return LOCAL.get(normalizeIconId(name)) ?? MISSING
}
