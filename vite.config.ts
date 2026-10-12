/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const SERVER = `http://127.0.0.1:${process.env.UPGO_PORT || 4141}`

// Dev UI on 5173 proxies the API + SSE to `upgo ui --no-open`. Production: `upgo ui` serves web/dist.
export default defineConfig({
    root: "web",
    plugins: [react()],
    build: { outDir: "dist", emptyOutDir: true },
    server: { proxy: { "/api": { target: SERVER } } },
    test: {
        root: ".",
        include: ["tests/**/*.test.{ts,tsx}"],
        globals: true,
        setupFiles: ["tests/setup.ts"],
        testTimeout: 20000,
    },
})
