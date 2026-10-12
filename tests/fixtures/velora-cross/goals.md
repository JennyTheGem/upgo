# Velora — cross-project goals (out of repo)

Lives beside the repos, not inside one, because these items span several of them (or belong to
none). Per-repo roadmaps stay where they are:

| Repo | Roadmap |
|---|---|
| `velora-frontend-react` | `goals.md` + `goals-completed.md` (+ `subsonic-goals.md`, `pluginSystem-goals.md`) |
| `velora-backend` | its own `goals.md` |
| `velora-license-server` | its own `goals.md` |

Phase tags **(Now)/(Next)/(Later)** as everywhere else.

---

## 1. Licensing / Activation Codes

The app is sold; access is gated by activation codes checked against the centrally hosted
license server (`velora-license-server`). Server, frontend gate, trial codes, and the 30-day
offline grace window are implemented — the frontend record is in the frontend's
`goals-completed.md` §23.

**Known / accepted:**
- Honest scope: this is client-side gating. It deters casual sharing; it does not stop someone
  patching the bundle (or forging `lastOkAt` / `maxSeenNow` in localStorage). The grace window
  plus the clock watermark raise the bar from "one hosts-file line" back to "patch the client".
  Accepted trade-off.
- Logout does **not** clear the license (the device stays activated). `useLicense.clear()`
  exists per store convention but is deliberately not wired into logout.
- Migration: installs activated before 2026-07-19 lack `lastOkAt`; a persist `migrate`
  (version 1) seeds it for already-valid state so they get a fresh 30-day window instead of
  soft-locking on the first offline launch.

- [ ] **(Later)** Self-service device-management UI (see a code's devices, free slots) —
  planned outside the Velora app, tracked in `velora-license-server/goals.md` §5.

---

## 3. One playing device per account

- [ ] **(Later)** Backend half: the playback state is per user and every socket plays it, so a play
  on one device starts all of them. Track a device per socket and name the active one in the
  snapshot; the others become remotes. The frontend half is `velora-frontend-react/goals.md` §1.

## 4. Server version in the descriptor

- [ ] **(Later)** Backend half: add `version` (from `core/utils/meta.ts`) to the auth-gated
  `/api/v1/server` descriptor and bump `DESCRIPTOR_CACHE_VERSION`. The frontend About → Server card
  already reads `desc.version` and shows it once present (today only admins can see it, through
  `/admin/system`).

## 5. Now playing on internet radio

- [ ] **(Later)** Backend half: a station's current song lives in the stream's ICY metadata, which a
  browser can't read cross-origin. A small auth-gated endpoint that reads `StreamTitle` from the
  stream (`Icy-MetaData: 1`) would let the player show it under the station name. The frontend
  shows the station's host there today (`velora-frontend-react`, `store/radioStations.ts`).
