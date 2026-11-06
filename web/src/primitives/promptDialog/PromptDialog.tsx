import "./promptDialog.css"
import { useEffect, useRef, useState } from "react"
import Dialog from "../dialog/Dialog.tsx"
import Button from "../button/Button.tsx"
import Chip from "../chip/Chip.tsx"
import { promptCancel, promptStore, promptSubmit } from "./prompt.ts"

export default function PromptDialog() {
    const { open, options } = promptStore.use()
    const [value, setValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) setValue(options.initialValue ?? "")
    }

    useEffect(() => promptCancel, [])

    const trimmed = value.trim()
    const blocked = options.required !== false && !trimmed

    return (
        <Dialog open={open} onClose={promptCancel} title={options.title} description={options.description} className="promptPill" initialFocusRef={inputRef}>
            <form
                className="promptForm"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (!blocked) promptSubmit(trimmed)
                }}
            >
                {options.presets && (
                    <div className="promptPresets" role="group" aria-label="Presets">
                        {options.presets.map((p) => (
                            <Chip
                                key={p}
                                tone={p === trimmed ? "accent" : "neutral"}
                                onClick={() => {
                                    setValue(p)
                                    inputRef.current?.focus()
                                }}
                            >
                                {p}
                            </Chip>
                        ))}
                    </div>
                )}
                <label className="promptField">
                    <input
                        ref={inputRef}
                        className="promptInput font-bold"
                        type="text"
                        value={value}
                        placeholder={options.placeholder}
                        aria-label={options.placeholder ?? options.title}
                        autoComplete="off"
                        spellCheck={false}
                        enterKeyHint="done"
                        onChange={(e) => setValue(e.target.value)}
                    />
                </label>
                <div className="dialogActions">
                    <Button variant="secondary" onClick={promptCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={blocked}>
                        {options.confirmLabel ?? "OK"}
                    </Button>
                </div>
            </form>
        </Dialog>
    )
}
