import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { UPGO_DIR } from "../src/core/registry.ts"
import { jsonSchema } from "../src/core/schema.ts"

// goals.schema.json gives VS Code autocomplete for goals.json; tests fail if it drifts from the zod schema.
const path = join(UPGO_DIR, "goals.schema.json")
writeFileSync(path, JSON.stringify(jsonSchema(), null, 2) + "\n")
console.log(`wrote ${path}`)
