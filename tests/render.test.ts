import { GENERATED_MARK, render } from "../src/core/render.ts"
import { fixture } from "./helpers.ts"

describe("render", () => {
    it("renders the slim goals.md exactly", () => {
        expect(render(fixture())).toBe(
            [
                "# demo: goals",
                "",
                GENERATED_MARK,
                "",
                "Demo project",
                "",
                "Open work only. Full item: `upgo show <id>`. Any slice: `upgo list --phase later,wayLater,maybe`, `--status done,dropped`, `--section <n>`, `--search <text>`.",
                "",
                "Closed sections: §3 Empty",
                "",
                "## Traps",
                "",
                "- **Locks are per file** Never hold two.",
                "",
                "## 1. Core",
                "",
                "- `alpha` Alpha (now)",
                "- `beta` Beta (next, partial)",
                "- Plus 1 way later: `upgo list --section 1 --phase wayLater`",
                "",
                "## 2. UI",
                "",
                "- `delta` Delta (later)",
                "- Plus 1 maybe: `upgo list --section 2 --phase maybe`",
                "",
            ].join("\n"),
        )
    })

    it("never shows done or dropped items", () => {
        const md = render(fixture())
        expect(md).not.toContain("zeta")
        expect(md).not.toContain("`eta`")
    })

    it("follows section and item order from the file", () => {
        const f = fixture()
        f.sections.reverse()
        f.items.reverse()
        const md = render(f)
        expect(md.indexOf("## 2. UI")).toBeLessThan(md.indexOf("## 1. Core"))
        expect(md.indexOf("`beta`")).toBeLessThan(md.indexOf("`alpha`"))
    })

    it("combines way later and maybe counts and indents multi-line trap bodies", () => {
        const f = fixture()
        f.items.push({ ...f.items[2], id: "theta", phase: "maybe" }, { ...f.items[2], id: "iota" })
        f.traps[0].body = "line one\nline two"
        const md = render(f)
        expect(md).toContain("- Plus 2 way later, 1 maybe: `upgo list --section 1 --phase wayLater,maybe`")
        expect(md).toContain("- **Locks are per file** line one\n  line two")
    })

    it("omits empty parts and keeps a section whose only open item is way later", () => {
        const f = { ...fixture(), purpose: undefined, traps: [], items: [fixture().items[2]] }
        const md = render(f)
        expect(md).not.toContain("## Traps")
        expect(md).not.toContain("Demo project")
        expect(md).toContain("## 1. Core\n\n- Plus 1 way later")
        expect(md).toContain("Closed sections: §2 UI · §3 Empty")
    })

    it("contains no em dash", () => {
        expect(render(fixture())).not.toMatch(/\u2014/)
    })
})
