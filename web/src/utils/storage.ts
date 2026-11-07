// localStorage can throw (private mode, blocked site data); a lost preference is fine.
export function readPref(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

export function readList(key: string): string[] {
    try {
        const v: unknown = JSON.parse(readPref(key) ?? "[]")
        return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
    } catch {
        return []
    }
}

export function writePref(key: string, value: string): void {
    try {
        localStorage.setItem(key, value)
    } catch {
        // ignored
    }
}
