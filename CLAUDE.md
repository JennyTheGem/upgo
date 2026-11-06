@goals.md

Goals live in goals.json, managed by upgo; goals.md is generated and auto-loaded. Use the upgo CLI (see the upgo skill), never edit either file.

After every push that bumped the version, also publish to npm as `@uplift-beyond/upgo` (`npm publish`).

When a change touches the CLI, the dashboard or how agents should use upgo, update `skill/SKILL.md` in the same change (it is symlinked as the live upgo skill), plus `upgo help` and README where they apply.
