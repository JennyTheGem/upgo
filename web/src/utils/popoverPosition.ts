// Opens down-right, flips when it would overflow, clamps into the viewport.
export type PopoverPoint = { x: number; y: number; flipX?: number; flipY?: number }
export type PopoverSize = { width: number; height: number }

const EDGE_MARGIN = 8

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max))
}

export function positionAtPoint(point: PopoverPoint, size: PopoverSize, vw: number, vh: number): { left: number; top: number } {
    const openLeft = point.x + size.width > vw - EDGE_MARGIN
    const openUp = point.y + size.height > vh - EDGE_MARGIN
    const left = openLeft ? (point.flipX ?? point.x) - size.width : point.x
    const top = openUp ? (point.flipY ?? point.y) - size.height : point.y
    return {
        left: clamp(left, EDGE_MARGIN, vw - size.width - EDGE_MARGIN),
        top: clamp(top, EDGE_MARGIN, vh - size.height - EDGE_MARGIN),
    }
}
