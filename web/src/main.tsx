import "./index.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"

const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)")
const applyMotion = () => document.documentElement.toggleAttribute("data-reduce-motion", !!motion?.matches)
applyMotion()
motion?.addEventListener("change", applyMotion)

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
