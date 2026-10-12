import { useEffect } from "react"
import Dialog from "../dialog/Dialog.tsx"
import Button from "../button/Button.tsx"
import { confirmNo, confirmStore, confirmYes } from "./confirm.ts"

const DESTRUCTIVE_ICON = { name: "iconify:warning-rounded", color: "var(--color-danger)" }

export default function ConfirmDialog() {
    const { open, options } = confirmStore.use()
    // Nothing can answer once the host is gone.
    useEffect(() => confirmNo, [])

    return (
        <Dialog
            open={open}
            onClose={confirmNo}
            role="alertdialog"
            title={options.message}
            description={options.description}
            icon={options.variant === "destructive" ? DESTRUCTIVE_ICON : undefined}
        >
            <div className="dialogActions">
                <Button variant="secondary" onClick={confirmNo}>
                    {options.cancelLabel ?? "Cancel"}
                </Button>
                <Button variant={options.variant === "destructive" ? "destructive" : "primary"} onClick={confirmYes}>
                    {options.confirmLabel ?? "Confirm"}
                </Button>
            </div>
        </Dialog>
    )
}
