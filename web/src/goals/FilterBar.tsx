import { OPEN_STATUSES, PHASES, PHASE_LABEL, SIZES, STATUSES, isOpenStatus } from "../../../src/core/vocab.ts"
import type { GoalsFile } from "../../../src/core/schema.ts"
import Button from "../primitives/button/Button.tsx"
import Dropdown, { type DropdownEntry } from "../primitives/dropdown/dropdown.tsx"
import { useDropdownTrigger } from "../primitives/dropdown/useDropdownTrigger.ts"
import SearchInput from "../primitives/searchInput/searchInput.tsx"
import { NO_FILTERS, isNarrowed, scopesIn, type Filters } from "./filters.ts"

export default function FilterBar({ file, filters, onChange }: { file: GoalsFile; filters: Filters; onChange: (f: Filters) => void }) {
    const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
    const scopes = scopesIn(file)
    const statuses = filters.showClosed ? STATUSES : OPEN_STATUSES
    const any = isNarrowed(filters) || filters.sections.length > 0 || filters.showClosed

    return (
        <div className="uiContentContainer filterBar">
            <SearchInput flat className="filterSearch" value={filters.search} onChange={(search) => set({ search })} placeholder="Search id, title, body, pointers" aria-label="Search items" />
            <div className="filterButtons">
                <FilterMenu label="Phase" options={PHASES.map((p) => [p, PHASE_LABEL[p]])} picked={filters.phases} onChange={(phases) => set({ phases })} />
                <FilterMenu label="Status" options={statuses.map((s) => [s, s])} picked={filters.statuses} onChange={(s) => set({ statuses: s })} />
                <FilterMenu label="Section" options={file.sections.map((s) => [s.n, `§${s.n} ${s.title}`])} picked={filters.sections} onChange={(sections) => set({ sections })} />
                <FilterMenu label="Size" options={SIZES.map((s) => [s, s])} picked={filters.sizes} onChange={(sizes) => set({ sizes })} />
                {scopes.length > 0 && <FilterMenu label="Scope" options={scopes.map((s) => [s, s])} picked={filters.scopes} onChange={(s) => set({ scopes: s })} />}
                <Button
                    variant="switcherOption"
                    className={filters.showClosed ? "buttonSwitcherOption--active" : ""}
                    aria-pressed={filters.showClosed}
                    imgProps={{ img: filters.showClosed ? "iconify:visibility" : "iconify:visibility-off" }}
                    onClick={() => set({ showClosed: !filters.showClosed, statuses: filters.showClosed ? filters.statuses.filter(isOpenStatus) : filters.statuses })}
                >
                    Show done/dropped
                </Button>
                {any && (
                    <Button variant="textHyperLink" className="filterClear" onClick={() => onChange(NO_FILTERS)}>
                        Clear filters
                    </Button>
                )}
            </div>
        </div>
    )
}

function FilterMenu<T extends string | number>({ label, options, picked, onChange }: { label: string; options: [T, string][]; picked: T[]; onChange: (values: T[]) => void }) {
    const menu = useDropdownTrigger()
    const items: DropdownEntry[] = options.map(([value, text]) => ({
        type: "item",
        id: String(value),
        label: text,
        keepOpen: true,
        active: picked.includes(value),
        onSelect: () => onChange(picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value]),
    }))
    return (
        <>
            <Button
                variant="switcherOption"
                className={picked.length ? "buttonSwitcherOption--active" : ""}
                aria-haspopup="menu"
                aria-expanded={menu.open}
                imgProps={{ img: "iconify:expand-more-rounded", side: "right" }}
                onClick={(e) => menu.openFromElement(e.currentTarget, [])}
            >
                {picked.length ? `${label} (${picked.length})` : label}
            </Button>
            <Dropdown open={menu.open} anchor={menu.anchor} items={items} onClose={menu.close} label={label} />
        </>
    )
}
