import type { GoalsFile } from "../../../src/core/schema.ts"
import type { Op } from "../../../src/core/ops.ts"
import { editItem, moveItem, setStatus } from "../../../src/core/mutate.ts"
import { today } from "../../../src/core/util.ts"

// The core's own edit for the cheap ops (mutate.ts is zod-free); null waits for the server.
export function optimistic(file: GoalsFile, op: Op): GoalsFile | null {
    const day = today()
    try {
        switch (op.op) {
            case "edit":
                return editItem(file, op.id, op.patch, day)
            case "done":
                return setStatus(file, op.id, "done", op.note, day)
            case "drop":
                return setStatus(file, op.id, "dropped", op.reason, day)
            case "reopen":
                return setStatus(file, op.id, "planned", undefined, day)
            case "move":
                return moveItem(file, op.id, op, day)
            default:
                return null
        }
    } catch {
        return null
    }
}
