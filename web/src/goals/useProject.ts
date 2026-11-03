import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { Op } from "../../../src/core/ops.ts"
import { api, errorText, onServerEvent, type ProjectData } from "../api.ts"
import { toast } from "../primitives/toast/toast.ts"
import { optimistic } from "./optimistic.ts"
import { undoFor } from "./undo.ts"

export function useProject(id: string, onChanged: () => void) {
    const [data, setData] = useState<ProjectData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const latest = useRef(data)
    useLayoutEffect(() => {
        latest.current = data
    }, [data])

    const reload = useCallback(
        () =>
            api.project(id).then(
                (d) => {
                    setData(d)
                    setError(null)
                },
                (e) => setError(errorText(e)),
            ),
        [id],
    )

    useEffect(() => {
        reload()
    }, [reload])

    useEffect(() => onServerEvent((e) => e.type === "project" && e.id === id && reload()), [id, reload])

    const send = useCallback(
        async (op: Op): Promise<boolean> => {
            const before = latest.current
            if (!before) return false
            const guess = optimistic(before.file, op)
            if (guess) setData({ ...before, file: guess })
            try {
                const file = await api.op(id, op)
                setData((d) => d && { ...d, file })
                onChanged()
                return true
            } catch (e) {
                // Only undo our own guess: a later op may have landed since. The reload settles the rest.
                if (guess) {
                    setData((d) => (d && d.file === guess ? { ...d, file: before.file } : d))
                    reload()
                }
                toast.error(errorText(e))
                return false
            }
        },
        [id, onChanged, reload],
    )

    // `undoable` puts an Undo button on a success toast that sends the inverse ops in order.
    const run = useCallback(
        async (op: Op, undoable = false): Promise<boolean> => {
            const before = latest.current?.file
            const ok = await send(op)
            const undo = ok && undoable && before ? undoFor(before, op) : null
            if (undo) {
                toast.undoable(undo.message, async () => {
                    for (const o of undo.ops) if (!(await send(o))) return
                })
            }
            return ok
        },
        [send],
    )

    const dismiss = useCallback(
        async (ids: string[]): Promise<boolean> => {
            try {
                const suggestions = await api.dismiss(id, ids)
                setData((d) => d && { ...d, suggestions })
                return true
            } catch (e) {
                toast.error(errorText(e))
                return false
            }
        },
        [id],
    )

    return { data, error, reload, run, dismiss }
}
