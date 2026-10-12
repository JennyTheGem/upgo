import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { Op } from "../../../src/core/ops.ts"
import { api, errorText, onServerEvent, type ProjectData } from "../api.ts"
import { toast } from "../primitives/toast/toast.ts"
import { optimistic } from "./optimistic.ts"

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

    const run = useCallback(
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
                if (guess) setData((d) => d && { ...d, file: before.file })
                toast.error(errorText(e))
                return false
            }
        },
        [id, onChanged],
    )

    return { data, error, reload, run }
}
