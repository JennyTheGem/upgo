import { useState } from "react"
import { POINTER_KEYS } from "../../../src/core/vocab.ts"
import type { Item } from "../../../src/core/schema.ts"
import { api, errorText } from "../api.ts"
import Button from "../primitives/button/Button.tsx"
import Chip from "../primitives/chip/Chip.tsx"
import { toast } from "../primitives/toast/toast.ts"
import Markdown from "./Markdown.tsx"

export default function ItemDetail({ item, projectId, onOpen }: { item: Item; projectId: string; onOpen: (ref: string) => void }) {
    const [file, setFile] = useState<{ path: string; text: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const pointers = POINTER_KEYS.filter((k) => item.pointers?.[k]?.length)

    const toggleFile = async () => {
        if (file) return setFile(null)
        setLoading(true)
        try {
            setFile(await api.detail(projectId, item.id))
        } catch (e) {
            toast.error(`Detail file: ${errorText(e)}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="itemDetail">
            {item.body ? <Markdown className="itemBody" text={item.body} /> : <span className="caption op-50">No body.</span>}
            {pointers.length > 0 && (
                <dl className="itemPointers">
                    {pointers.map((k) => (
                        <div key={k} className="itemPointer">
                            <dt className="microLabel">{k}</dt>
                            {item.pointers![k]!.map((v, i) => (
                                <dd key={i} className="Inconsolata caption break-words">
                                    {v}
                                </dd>
                            ))}
                        </div>
                    ))}
                </dl>
            )}
            {item.related && <RelatedChips refs={item.related} onOpen={onOpen} />}
            {item.note && (
                <div className="itemMeta">
                    <span className="microLabel">{item.status === "dropped" ? "Reason" : "Note"}</span>
                    <span className="caption op-80 break-words">{item.note}</span>
                </div>
            )}
            <span className="caption-small op-50">
                Created {item.created} · updated {item.updated}
            </span>
            {item.detail && (
                <div className="itemMeta">
                    <span className="microLabel">Detail</span>
                    <span className="Inconsolata caption op-80 break-words">{item.detail}</span>
                    <Button variant="secondary" className="itemDetailButton" imgProps={{ img: "iconify:menu-book" }} disabled={loading} aria-expanded={!!file} onClick={toggleFile}>
                        {file ? "Hide detail file" : "Show detail file"}
                    </Button>
                </div>
            )}
            {file && (
                <Markdown className="detailText" text={file.text} tabIndex={0} role="region" aria-label={`Detail file ${file.path}`} />
            )}
        </div>
    )
}

export function RelatedChips({ refs, onOpen }: { refs: string[]; onOpen: (ref: string) => void }) {
    return (
        <div className="itemMeta">
            <span className="microLabel">Related</span>
            {refs.map((r) => (
                <Chip key={r} mono title={`Open ${r}`} onClick={() => onOpen(r)}>
                    {r}
                </Chip>
            ))}
        </div>
    )
}
