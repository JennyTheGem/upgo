import "./searchInput.css"
import { resolveIconSrc } from "../../utils/iconify.ts"
import Button from "../button/Button.tsx"

type Props = {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    "aria-label"?: string
    // Inside a surface: control fill instead of a nested card.
    flat?: boolean
}

export default function SearchInput({ value, onChange, placeholder, className = "", "aria-label": ariaLabel, flat = false }: Props) {
    return (
        <div
            className={`searchInputField outfit ${flat ? "searchInputField--flat" : "uiContentContainer"} ${className}`}
            data-filled={value ? "true" : "false"}
            onMouseDown={(e) => {
                if (e.target instanceof HTMLElement && !e.target.closest("input, button")) {
                    e.preventDefault()
                    e.currentTarget.querySelector("input")?.focus()
                }
            }}
        >
            <img src={resolveIconSrc("iconify:search")} className="iconImg searchInputIcon" alt="" />
            <input
                className="searchInputField__input"
                type="text"
                value={value}
                placeholder={placeholder}
                aria-label={ariaLabel ?? placeholder}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key !== "Escape") return
                    if (value) onChange("")
                    else e.currentTarget.blur()
                }}
            />
            {value && (
                <Button variant="icon" className="searchInputClear" imgProps={{ img: "iconify:close" }} aria-label="Clear search" title="Clear search" onClick={() => onChange("")} />
            )}
        </div>
    )
}
