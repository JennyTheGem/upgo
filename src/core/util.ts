// Every failure a user or agent can cause is an UpgoError: the CLI prints its message, the server sends it as a 400.
export class UpgoError extends Error {
    readonly details: string[]
    constructor(message: string, details: string[] = []) {
        super(details.length ? `${message}\n${details.map((d) => `  - ${d}`).join("\n")}` : message)
        this.name = "UpgoError"
        this.details = details
    }
}

export function today(now = new Date()): string {
    const p = (n: number) => String(n).padStart(2, "0")
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export function slugify(text: string, max = 48): string {
    const s = text
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    if (s.length <= max) return s || "item"
    const cut = s.slice(0, max)
    const at = cut.lastIndexOf("-")
    return (at > max / 2 ? cut.slice(0, at) : cut).replace(/-+$/, "")
}

// First free slug in `taken`, suffixing -2, -3... on a clash.
export function uniqueSlug(base: string, taken: Set<string>): string {
    if (!taken.has(base)) return base
    for (let i = 2; ; i++) {
        const next = `${base.slice(0, 56)}-${i}`
        if (!taken.has(next)) return next
    }
}
