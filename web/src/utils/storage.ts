// localStorage can throw (private mode, blocked site data); a lost preference is fine.
export function readPref(key: string): string | null {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

export function writePref(key: string, value: string): void {
    try {
        localStorage.setItem(key, value)
    } catch {
        // ignored
    }
}
