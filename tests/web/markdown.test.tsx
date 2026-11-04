// @vitest-environment jsdom
import { render } from "@testing-library/react"
import Markdown from "../../web/src/goals/Markdown.tsx"

it("renders blocks and inline markdown, keeps raw HTML as text and drops unsafe links", () => {
    const text = [
        "## Plan",
        "Run `npm test`, **bold** _em_ snake_case_name, see [docs](https://x.dev) or https://y.dev.",
        "second line",
        "",
        "- one",
        "  - nested",
        "",
        "- [bad](javascript:alert(1))",
        "",
        "3. three",
        "```",
        "<b>raw</b>",
        "```",
        "> quoted",
        "---",
        "<script>x</script>",
    ].join("\r\n")
    const c = render(<Markdown text={text} />).container
    const all = (sel: string) => Array.from(c.querySelectorAll(sel), (e) => e.textContent)
    expect(all("h4")).toEqual(["Plan"])
    expect(all("p code")).toEqual(["npm test"])
    expect(all("strong")).toEqual(["bold"])
    expect(all("em")).toEqual(["em"])
    expect(Array.from(c.querySelectorAll("a"), (a) => a.getAttribute("href"))).toEqual(["https://x.dev", "https://y.dev"])
    expect(c.querySelectorAll("p br")).toHaveLength(1)
    expect(c.querySelectorAll("ul")[0].children).toHaveLength(2)
    expect(all("ul li ul li")).toEqual(["nested"])
    expect(c.querySelector("ol")).toHaveAttribute("start", "3")
    expect(all("pre code")).toEqual(["<b>raw</b>"])
    expect(all("blockquote")).toEqual(["quoted"])
    expect(c.querySelectorAll("hr")).toHaveLength(1)
    expect(c.querySelector("b, script")).toBeNull()
    expect(c).toHaveTextContent("<script>x</script>")
})

it("never nests links, keeps inline triple backticks inline, ends lists at a rule and dedents fenced code", () => {
    const text = ["[https://x.dev](https://x.dev)", "```npm test``` is inline", "after", "", "- a", "- - -", "1. step", "   ```", "   npm i", "   ```", "foo__bar__baz"].join("\n")
    const c = render(<Markdown text={text} />).container
    expect(c.querySelectorAll("a")).toHaveLength(1)
    expect(c.querySelector("p")).toHaveTextContent("after")
    expect(c.querySelectorAll("ul li")).toHaveLength(1)
    expect(c.querySelectorAll("hr")).toHaveLength(1)
    expect(c.querySelector("ol pre code")?.textContent).toBe("npm i")
    expect(c.querySelector("strong")).toBeNull()
})
