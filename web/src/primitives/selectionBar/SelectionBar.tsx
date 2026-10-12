import "./selectionBar.css"
import type { ReactNode } from "react"
import Button from "../button/Button.tsx"

export default function SelectionBar({ count, onExit, children }: { count: number; onExit: () => void; children: ReactNode }) {
    return (
        <div className="selectionBar z-dropdown">
            <div className="uiContentContainer selectionBarContent outfit" role="toolbar" aria-label="Selection">
                <span className="size-1 font-bold truncate">{count} selected</span>
                <figure className="divider-Vertical" />
                {children}
                <figure className="divider-Vertical" />
                <Button variant="icon" imgProps={{ img: "iconify:close" }} title="Clear selection" aria-label="Clear selection" onClick={onExit} />
            </div>
        </div>
    )
}
