import type { ComponentProps, ReactNode } from "react"
import Icon from "../icon/Icon.tsx"
import "./button.css"

export type Varient = "primary" | "secondary" | "destructive" | "icon" | "textHyperLink" | "switcherOption"

type ButtonProps = {
    imgProps?: { img: string; side?: "left" | "right"; className?: string; color?: string }
    children?: ReactNode
    variant?: Varient
} & ComponentProps<"button">

export default function Button({ variant = "primary", imgProps, children, className, type = "button", ...buttonProps }: ButtonProps) {
    const imgEl = imgProps && <Icon name={imgProps.img} color={imgProps.color} className={imgProps.className ?? ""} />
    return (
        <button type={type} className={`${getVeriantStyles(variant)} outfit size-1 font-bold defaultButton ${className ?? ""}`} {...buttonProps}>
            {imgProps && imgProps.side !== "right" && imgEl}
            {children}
            {imgProps?.side === "right" && imgEl}
        </button>
    )
}

function getVeriantStyles(variant: Varient) {
    switch (variant) {
        case "primary":
            return "buttonPrimary"
        case "secondary":
            return "buttonSecondary"
        case "destructive":
            return "buttonDestructive"
        case "icon":
            return "buttonIcon"
        case "textHyperLink":
            return "textHyperLink"
        case "switcherOption":
            return "buttonSwitcherOption"
        default:
            throw new Error(`Invalid variant: ${variant satisfies never}`)
    }
}
