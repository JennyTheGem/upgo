# Velora Frontend - Goals

Living roadmap: **open work only**. Numbered by feature area; every item carries a phase tag **(Now)** / **(Next)** / **(Later)**.

- Finished work goes to [`goals-completed.md`](./goals-completed.md) under the same section number. **A `[x]` in this file is a bug**, checking something off means moving it in the same edit. That's what keeps this file short.
- Long-form detail for an open item goes to [`docs/goalsDetails/`](./docs/goalsDetails/); this file keeps the one-line summary + the link.
- Verbose bug reports and audits live in [`docs/`](./docs/).

Legend: ✅ Implemented · 🚧 Partial / stubbed (UI exists, not wired up) · 📋 Planned / new

keep the line bellow to only short descriptons of the update

Last updated: 2026-10-12 (Home remembers its scroll position.)

### Closed areas: implemented, no known gaps

Detail under the same § in [`goals-completed.md`](./goals-completed.md). A section only reappears below if something reopens.

**§3** BigMusic Overlay · **§4** Backgrounds & Visuals · **§7** Notifications · **§9** Theming & Localization · **§12** Bugs & Inconsistencies · **§14** Provider Parity · **§16** Command Palette · **§17** Settings Implementation Status · **§20** Admin / Server Management · **§21** Context Menus · **§24** Onboarding

Tracked outside this file: **§19** Plugin System → [`docs/goalsDetails/plugin-system.md`](./docs/goalsDetails/plugin-system.md) (sandbox plan: [`docs/plugin/sandbox-design.md`](./docs/plugin/sandbox-design.md), reviewed in [`docs/plugin/sandbox-review.md`](./docs/plugin/sandbox-review.md), frame delivery measured in [`docs/plugin/frame-delivery.md`](./docs/plugin/frame-delivery.md)). The sandbox is built, every first-party plugin is on it, the three gaps the port found are closed, and the flag day finished 2026-08-04 with the host policy at `script-src 'self'`; what is open is a decision on `openExternal` plus four deferred follow-ups. · **§23** Licensing → `../goals.md` (cross-project, out of repo). · **Picked ideas, Later / Way later** (37, any §) → [`docs/goalsDetails/ideas-backlog.md`](./docs/goalsDetails/ideas-backlog.md); move one into its § here when it gets scheduled.

### Live traps (read before touching these areas)

- **An ancestor with `opacity < 1` (or a `filter`) is a backdrop root**, so anything under it renders its `backdrop-filter` against an empty group and comes out flat. An element's *own* opacity is applied after its own backdrop-filter, so a surface may fade freely; a fading **wrapper** around one may not. `.uiContentContainer` paints its fill and blur on the element, through `--surface-paint` / `--surface-filter`: **override a surface by restating a token**, which is how a theme, a floater and reduce-transparency all reach it. It spent 2026-08-08 on a `::before` layer instead, to stop a repainting child re-blurring its own panel; that was reverted 2026-08-09 because the measurement below says the cost was never the panel (it was the child's repaint *rate*, fixed by stepping), while the layer made every fading card a backdrop root for its own blur and unfrosted every modal in the app.
- **A CSS animation repaints at the display's refresh rate, and nothing caps it** (measured 2026-08-08). The animated background is capped at `backgroundFps` and ~14 blurred surfaces re-blurring at that rate measured 2%; one 40px cover rotating inside a blurred surface measured 18% on a 240Hz panel. So a decoration that moves every frame costs multiples of the thing that looks expensive. The three cover spins are stepped for that reason, off the shared `--spin-steps` token (the playlist tile sets its own, a step turns ~3x as far at that size): don't "restore" them to `linear`. The home Spotlight re-measured the same law on 2026-08-10 and lost: its countdown bar cost **1.5% to 20% GPU** on that one card, stepping it did not save it and neither did **dropping the card's backdrop-filter** (which it keeps, restated through the reduce-transparency pair, since it costs a card that is all artwork and flat wash nothing). The bar was deleted; the reel's position is marked by state now, not by a moving line. Read that as the ceiling: on this app's surfaces, a continuously animating element has to justify itself with a measurement before it ships. The `bars` playing mark was retired outright the same day, on both pickers, because a 500ms animation cannot be stepped without reading as broken, and `spin` stopped being the default (`accent` is), so the app's out-of-the-box state has nothing animating in a surface. `PlayingBars` is deleted; a profile still holding `"bars"` is mapped to `accent` by `retiredBars` in `settings.tsx`'s persist merge, which also covers user-data import. Anything new that animates continuously inside a surface gets the same treatment or gets measured first.
- **A plugin frame is `position: fixed` and lives outside the React tree** since 2026-08-02. Moving an `<iframe>` in the DOM reloads its document, and the sidebar moves its whole docked panel into the BigMusic overlay, so a framed surface reparented by that move would lose its boot, its handshake and all plugin state. (The panel itself survives it: it lives in one never-replaced `display: contents` host that is moved by hand, because branching between a portal and a plain child remounted the subtree, see `goals-completed.md` §12.) `PluginFrame` renders a placeholder and `frameHost` syncs the frame's rect to it. Never render a plugin frame inline. The frames sit in **four** containers (`frameHost`'s `LAYER_Z`), `page` at `--z-card + 1`, `bigmusic` at `--z-bigmusic + 1`, `sidebar` at `--z-bigmusic + 2` and `sheet` at `--z-modal + 1`: a container is a stacking context and its children cannot escape it, so one container would paint every BigMusic mode behind the overlay it belongs to, and a sidebar tab (docked in the page, portalled into the overlay) has to clear both bands at once because the frame can never follow the portal. Which one a frame gets is **the mount's** call, not the surface's (`FrameHostOptions.layer` beats `SURFACE_LAYER`): the same `sidebarTabs` surface is a docked panel on desktop and a `Sheet` at `--z-modal` on mobile, and only the mount knows which. `sheet` is the one container above `--z-modal` and stops one step above it, so the confirm/prompt pills and the toast at `--z-overlay` still win. A frame is also **not moved by a transform**, since nothing the placement hook listens for fires for one: `useFramePlacement` follows its box for 600ms after each sync so a frame mounted inside a springing sheet lands on it.
- **A plugin approval binds to its permission list, not only its bundle** since 2026-08-03. The revision is `perm:<sorted set>|<bundle identity>` and is computed once per source into `PluginRuntimeInfo.revision`: `plugin.json` is a different file from `ui.mjs`, so a bundle-only revision let a plugin widen `ui.permissions` on unchanged bytes and have the wider table compiled for the next frame. Never spell the revision a second time in the UI, and never drop the permission half to stop a plugin asking for re-approval, that *is* the plugin asking.
- **`HOST_SDK_VERSIONS` is one entry, and that is a security control** since 2026-08-03. A 1.x bundle can only execute in the host realm, so re-adding one would let a plugin decline the sandbox by declaring a version string, with only the approval row in the way. Never widen that list to make a plugin load; port the plugin instead.
- **A `chrome` surface renders through the host, not the frame** since 2026-08-02 (`settingsPanels`, `artistSections`, `homeSections`, `playerControls`, `navWidgets`). Its frame exists and is never placed. Since 2026-08-06 a `routes` surface can opt in per render too (`PluginRoute` + `PageDescriptor`): there the frame *is* placed while the plugin publishes nothing and parked offscreen while the host draws, decided by `useFramePlacement`'s `placed` flag and never by moving the `<iframe>`. A descriptor is validated in `services/plugins/chrome/descriptors.ts` before anything reaches a renderer, because it arrives from a realm running plugin code: never render one without its parser, and never add a descriptor field that is a URL, a class or a style. Cover bytes are the one binary field and are sniffed, not trusted; the host owns every blob url it mints.
- **Keys leave a plugin frame through the frame document's bootstrap, not the SDK** since 2026-08-06. `plugin-sdk/runtime/` is bundled into each plugin's own bundle (there is no import map inside a frame), so a listener there only ever reaches plugins rebuilt against a newer SDK; `public/plugin-frame.html` is host-owned and already in every frame that exists. Editing that bootstrap **moves its CSP hash**, which the frame's own `<meta>` names: regenerate it (`npm run check:csp` prints the value), or the bootstrap is refused on every engine at once and the failure reads like a wrong policy rather than a stale one. The host only accepts a forwarded key from a frame that is **placed**, is `document.activeElement` and sits in a window that still has focus, which is also what keeps a recorder in Settings safe, so don't "simplify" any of the three away: activeElement goes on naming the iframe after the user alt-tabs, so the last one is what stops a plugin driving the keymap from a window nobody is looking at.
- **A keybind recorder's key must never reach the window matcher** since 2026-08-04. Committing a chord re-renders and blurs the recorder while the key is still travelling to `window`, so a guard that reads `document.activeElement` at that point sees `body` and runs the action the user was binding. `settingsKeybind.tsx` `stopPropagation()`s, and `useGlobalShortcuts` skips any focused `.settingsKeybind` (Space/Enter activate a button on the key itself). Keep both halves; `tests/components/settingsKeybind.test.tsx` fails on either. Related: a chord lives in one of **two** keymaps, `keybinds` (in-app) and `globalKeybinds` (OS-level, Electron), and only the in-app one is matched in the renderer. Matching tries **two spellings** per press, the printed cap and the physical key, and AltGr presses are ignored on purpose (Windows reports AltGr as Ctrl+Alt, so matching them would eat characters a German or Nordic layout types); never "simplify" `keybind.ts` back to `e.key` alone.
- **`index.html` carries a CSP** since 2026-08-01, tightened to `script-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'` on 2026-08-04. A remote `<script src>`, **any inline script**, an `<iframe>` to another origin, an `<object>`, a `<base>` and **any** native form submit are blocked, silently, in the built app. Every form in the app is `onSubmit` + `preventDefault`, which is what makes the last one free. It is deliberately narrow (no `default-src`, so images/fetch/styles are unrestricted, the backend origin is user input). Canonical string: `scripts/csp.mjs`, enforced by `npm run check:csp`, which also runs in `npm run build` and now fails on any inline `<script>` in the built document. Two traps: the import map and the `plugin-runtime` shims are **dev-only** (`vite.config.ts` emits them under `ctx.server`, and the dev server gets the looser `HOST_CSP_DEV` by rewriting the meta, never by adding a second one), and the meta is load-bearing on **not** being first in `<head>`, since Capacitor injects its native bridge inline above it and a meta policy does not govern what was parsed before it.
- **The palette overlay window draws nothing of its own** since 2026-08-04. `app://velora/#overlay` is the same document as the app, so `main.tsx` branches on the hash *before* importing `appBoot.tsx`: a second renderer that booted the app would carry its own session, i18n, audio engine and (on `ClientPlaybackController`) its own queue, while nearly every palette action mutates state that lives in the main window. `CommandPalette` stays the brain and publishes rows; the overlay returns a row id. Never import an app module from `src/overlay/`, and never hand that window `preload.cjs`, it gets the narrow `preloadOverlay.cjs` with no vmedia key and no local library. Its blur is the OS window material (acrylic/vibrancy), because `backdrop-filter` samples only the window's own empty document and would blur nothing over the game behind it.
- **A plugin's User-Agent is set in Electron main, never in the renderer** since 2026-08-06. `User-Agent` is a forbidden header name, so `fetch` discards it in a browser *and* in Electron's renderer: putting it in `createFetchExternal` looks like the fix and is dead code. `electron/pluginUserAgent.ts` rewrites it, scoped to the hosts the enabled plugins declared, and the string is sanitized on both sides because a newline in it is header injection.
- **`getTracks`'s `cursor` is a row id, not an offset**, and the id space runs newest-first (`lt(tracks.id, cursor)` + `orderBy(desc(tracks.id))` in the backend's `TrackRepository.listCursor`; `queryTracks` shares the convention). A `nextCursor` is the last row's id, so a "random offset" asks for the newest track below a number and, for any number past the newest id, returns the same first row every time, which is how the guess game shipped picking one song forever. The cursor is opaque by contract, so `utils/randomTrack.ts` proves what it is before inventing one (a page's `nextCursor` equal to its own last row's id) rather than assuming it.
- **Audio-reactive visuals** were removed for performance 2026-07-13. If they ever come back, rebuild on a shared JS value, never `:root` CSS vars read via per-frame `getComputedStyle`.
- **Electron prod** loads from `app://velora`, so the backend's `VELORA_CORS_ORIGINS` must include it or every API call from the packaged app is CORS-blocked. Dev (`npm run desktop`) uses `http://localhost:5500`, already covered.
- **Capacitor's webview** is its own origin (`https://localhost` on Android/iOS), so `VELORA_CORS_ORIGINS` must include that too. Operator-side backend config, not fixable from the frontend. (Cookie `SameSite`/`Secure` is a separate axis, only matters if the backend hasn't set `VELORA_AUTH_COOKIE_SAME_SITE=None`.)

### How to read this (for agents)

Open items carry inline pointers so the work is self-contained, verify paths before editing, they drift:

- `↳ files:` where the change lives (start here).
- `↳ seam:` the proxy / store / registry to go through (`musicService`, `playbackService`, `useSettings`, `MODE_REGISTRY`…). Never bypass it (see `CLAUDE.md`).
- `↳ depends:` must land after another item; cross-dependencies are noted inline.

When picking up an item, follow `CLAUDE.md` rules (proxies only, optimistic-mutation + revert, i18n keys in all 9 locale files, tokens-only CSS, Navidrome-mode guards at the component level).

---

## 1. Playback & Audio Engine

Everything shipped is in `goals-completed.md` §1.

- [ ] **(Later)** **One playing device per account.** The Velora state is shared, so every connected device plays it: a play on the desktop starts the phone too, and an OS pause on the phone pauses the desktop. A hidden phone now holds off (`heldOff` in `audioEngine.ts`), but two open devices still play the same song at once. Wants an active-device model (the server names who plays, the others are remotes), Spotify Connect style.
  - ↳ files: `veloraPlaybackController.ts`, `audioEngine.ts` (`heldOff` becomes "not the active device"), a device picker in the player
  - ↳ depends: the backend has to track devices per socket, tracked in `../goals.md`
- [ ] **(Later)** **Audio profiles per output device** (M, all platforms). EQ, volume and crossfeed remembered per `sinkId`, swapped in when the output changes (headphones vs speakers). Unset fields fall back to the current global values, so a new device starts from what you hear now.
  - ↳ trap: `outputDeviceId: ""` follows the OS default, so switching the OS output never changes the id; resolve `""` to the real device via the `"default"` entry of `enumerateDevices()` and listen for `devicechange`. Where `setSinkId` is missing (iOS Safari/WebView) there is one profile only.
  - ↳ depends: crossfeed does not exist yet; ship profiles with EQ + volume and add it when it lands
  - ↳ files: `audioEngine.ts` (`AudioSettings`, `applySinkId`), `docs/app/settings/audio.md` + `storage.md` (new persisted map, export scope)
  - ↳ seam: `audioEngine.getSettings()/set*`
- [ ] **(Later)** **Resume after a phone call on Android** (S, Android). Since 2026-10-03 an OS restart of a paused slot is paused again (`onOsResume` in `audioEngine.ts`), so music no longer comes back by itself after a call either. A call should resume, another app taking the audio should not: the WebView can't tell them apart, so the native side has to (a transient focus loss with the phone in a call, `AudioManager.getMode()` / `TelephonyManager`) and tell the engine to accept that one resume.
  - ↳ files: `MediaPlaybackService.java` + `VeloraMediaPlugin.java`, `audioEngine.ts` (`onOsResume`), `src/services/platform/nativeMedia.ts`
- [ ] **(Way later)** **Queue snapshots** (S, all). Save the current queue under a name and restore it later without making it a playlist.
  - ↳ seam: `playbackService.sendCommand(...)` to restore; snapshots are track ids in a persisted store (+ user-data export scope)
- [ ] **(Way later)** **Trim a song** (M, all). A start and end point per song so a long intro, spoken outro or hidden-track silence is skipped every time. Applies to playback, crossfade timing and the seek bar.
  - ↳ files: `audioEngine.ts` (start offset + early `next`, same path as `skipSilentEnding`), a trim editor on the waveform `Timeline`
- [ ] **(Way later)** **Beat-matched crossfade** (L, Velora). Line the beats of both songs up during a crossfade, a light DJ blend.
  - ↳ files: `audioEngine.ts` (crossfade scheduling, `playbackRate` nudge)
  - ↳ depends: `bpm` on tracks, which the backend does not write yet
- [ ] **(Way later)** **Skip short songs in shuffle** (S, all). Leave intros, skits and interludes under N seconds out of shuffle and autoplay; a setting with a seconds slider.
  - ↳ files: `src/utils/shufflePlay.ts`, `docs/app/settings/playback.md`
- [ ] **(Way later)** **Deep cuts** (S, Velora). A button on an artist page that plays the artist's least-played songs.
  - ↳ files: `screens/views/artistView/`
  - ↳ depends: per-track play counts (see §2 Unplayed songs); gate with a capability
- [ ] **(Later)** **Protect the queue** (S, all). Clicking a song in a list plays it but keeps the songs you queued by hand after it, instead of wiping them.
  - ↳ files: the list play path (`setQueue` callers), `src/utils/playTrackNow.ts` already does insert-and-jump for list-less surfaces
  - ↳ trap: needs to know which queue entries were added by hand (`addNext`/add to queue) versus seeded from a list; that marker doesn't exist yet, and on Velora the queue lives on the server

---

## 2. Library & Content

Reopened 2026-10-05 for picked ideas; everything shipped is in `goals-completed.md` §2.

- [ ] **(Later)** **Smart playlists, the next steps** (M, all). Variety caps (at most N per artist, never the same artist twice in a row), rules that point at the library (in playlist X / not in Y, one of my favorite artists, one of my top genres this month), nested rule groups, seed songs that a rule set narrows (Smart Radio + rules), skips inside a smart playlist sinking a song there only (never feeding radio or autoplay), and templates (Top 25, Forgotten favorites, Unheard, Daily mix) now that sorts exist.
  - ↳ files: `src/utils/smartPlaylist.ts`, `src/utils/smartPlaylistFetch.ts`, `ui/smartPlaylistEditor/`, backend `smartRules.ts`
- [ ] **(Later)** **Playlist folders** (M, all). Group playlists into folders in the nav and the playlists view, folded away when unused. Grouping lives in settings so it works on every provider.
  - ↳ files: `ui/nav/nav.tsx`, `screens/views/playlistsView/`, `src/settings.tsx` (folder map + export scope)
- [ ] **(Later)** **Folder browse** (M, all). Browse the library as its on-disk folder tree.
  - ↳ files: new view; Subsonic `getMusicDirectory`, local mode has the paths, Velora needs an endpoint
  - ↳ seam: `musicService` + a new capability
- [ ] **(Later)** **Album versions** (M, all). Fold remasters and deluxe editions of one album into a single card with a version picker.
  - ↳ files: `screens/views/albumsView/`, `screens/views/artistView/` (discography); grouping key = normalized title + album artist, stripped of edition suffixes
- [ ] **(Later)** **More search filters** (S, all). `year:`, `duration:`, `added:`, `-genre:` and quoted phrases next to the existing `genre:`/`bpm:`.
  - ↳ files: `src/utils/searchQuery.ts` (`parseSearchQuery`, shared by every search surface), the palette `?` cheatsheet
- [ ] **(Later)** **Playlist cover maker** (S, all). Make a cover from a template: a color, a title, an emoji or one of the playlist's covers, rendered to an image and saved as the playlist cover.
  - ↳ files: a canvas renderer in `src/utils/`, the playlist edit modal; reuse the custom cover path local mode already has
  - ↳ seam: `musicService` cover write, capability-gated where a provider can't store one
- [ ] **(Next)** **Split multi-artist records + artist aliases** (M, Velora + local, backend). Velora and local mode store `A, B` as **one** artist record with one id, so the artists list shows "Artist, Artist2" as a single artist; `toArtistSegments` only papers over it on track rows. Split them into separate artists at scan time, and fold spelling variants (Beyonce / Beyoncé) into one.
  - ↳ files: backend `ArtistRepository.ts` + scanner (`library/metadataTitle.ts` already splits for comparison), `electron/localLibrary.ts`, then retire the workaround in `src/utils/artistSegments.ts`
  - ↳ trap: some real names contain a comma or `&`; keep an exceptions list and prefer multi-value artist tags when the file has them

---

## 5. Navigation & Layout Shell

Reopened 2026-10-05; everything shipped is in `goals-completed.md` §5.

- [ ] **(Next)** **Three hooks still re-render the whole shell** (S, perf). `MainPage` re-renders topbar, nav, player, queue, BigMusic and popped settings on any state it holds. Every page change re-renders it: `useKeybindDispatch`, `usePasteToSearch` and `useLogout` call `useNavigate` (all push absolute paths, so `useStableNavigate` is a drop-in; update the `useNavigate` mock in `useKeybindDispatch.test.ts`). `useAutoplayContinuation.ts:24`'s `seedId` follows `isPlaying` while the last song in the queue plays, so play/pause there re-renders it (move it into a null-rendering component like `AccentSync`). `useNativeMediaSession.ts:29` re-renders it on every song change and again when lyrics load, on Android with lock-screen lyrics on (move it into a null-rendering component like `AccentSync`, or subscribe imperatively).
  - ↳ files: `src/utils/useAutoplayContinuation.ts`, `src/utils/useNativeMediaSession.ts`, `src/utils/useKeybindDispatch.ts`, `src/utils/usePasteToSearch.ts`, `src/utils/useLogout.ts`, `src/screens/pages/mainPage/mainPage.tsx`
  - ↳ check: the page-change and play/pause cases are `it.fails` in `tests/perf/renderCounts.test.tsx`; flip each to `it` when fixed

---

## 6. Settings & Personalization

- [ ] **(Later)** Active sessions, list logged-in devices and revoke any of them. Very useful for self-hosted; users want to know if something else is connected. Velora-only (needs backend session/device endpoints); hide in Navidrome/local mode via the capability model.
  - ↳ files: new section in `settingsView`; `src/services/music/capabilities.ts` (new capability key)
  - ↳ seam: `musicService` (new list/revoke methods); check `../velora-backend` for existing session endpoints first
- [ ] **(Later)** Let a plugin-contributed command take a keybind. The keymap already stores arbitrary command strings, so this is a stable per-command key (`plugin:<name>:<id>`) plus a dispatch case that lazy-loads the bundle first, and the picker listing them alongside the playlist/theme families.
  - ↳ files: `src/utils/keybindActions.ts` (family), `src/utils/useKeybindDispatch.ts`, `src/utils/useKeybindTargets.ts`
  - ↳ seam: `pluginRegistry.selectCommands` + `runPluginCommand` (same pair the command palette uses)
- [ ] **(Later)** **Link hints.** Hold a key and a letter badge appears over every interactive element on screen; typing it activates that one. Whole-app keyboard control without a keybind row per action, and an accessibility surface for free. Needs one overlay that collects the visible interactive nodes plus a hold key registered like any other action, so it stays rebindable. Idea, not scheduled.
  - ↳ files: new `src/utils/useLinkHints.ts` + an overlay mounted in `src/app.tsx`, `src/utils/keybindActions.ts` (the hold key)
  - ↳ seam: `useGlobalShortcuts` for the key, never a second global listener; it must skip a focused `.settingsKeybind` and any placed plugin frame the way the keymap already does
- [ ] **(Later)** **Scenes**, one named bundle of theme, background + its tweaks, BigMusic mode, EQ preset and `colorSyncSource`, applied in one click from Settings or the palette, and optionally bound to a playlist or genre so opening one redresses the app. Every ingredient is already a setting, so this is a saved-profile registry over `useSettings` plus a picker and a "save current as scene", and it rides the existing export/import scope picker. Idea, not scheduled.
  - ↳ files: `src/settings.tsx` (scene list + apply), `screens/views/settingsView` (picker), `src/utils/keybindActions.ts` (a `scene:<id>` family, same shape as the theme family)
  - ↳ seam: `useSettings` for every value it writes and `applyCustomTheme` for the theme half; a scene never writes a token or an audio setting directly
- [ ] **(Later)** **About: trust and legal.** A "what Velora sends, and where" privacy statement (no telemetry, icons bundled at build time, self-hosted font), plus imprint, privacy policy and terms links. The legal pages are needed before selling.
  - ↳ files: `aboutSection/AboutSection.tsx` (`LINKS`)
- [ ] **(Next)** **A settings write still costs a full registry build** (M, perf). Since 2026-10-08 a slider step or toggle re-renders only its own row, but `SettingsRegistry` still rebuilds every section per write (react-scan: ~6.7ms each, 816ms over a 10s slider drag). Also left: ~4 motion wrappers (`PresenceChild`/`motion.div`) render per write. Order: profile the build for hot spots first; only if the cost is spread out, split the registry per section so a write rebuilds only its own; then stop the motion wrappers rendering per write and extend `tests/perf/settingsRenders.test.tsx` to fail on it.
  - ↳ files: `settingsView/useSettingsSections.ts`, `settingsView/settingsRegistry.tsx` + `settingsRegistryStore.ts`, `settingsBox/settingsBox.tsx`
- [ ] **(Next)** **Reset this section** (S, all). One button per settings section that puts all its rows back to defaults, with an undo.
  - ↳ files: `settingsBox/settingsBox.tsx` (`footer`), the section's registry rows in `useSettingsSections.ts`; audio rows reset through `audioEngine.set*`
- Full user-data export/import shipped 2026-07-19 (scope picker on both halves + audio-engine settings 2026-08-09), the multi-chord + system-wide keybind rework 2026-08-04, the carousel poster look 2026-08-28, right-click-to-restyle 2026-09-04, OLED screen care 2026-09-11, cover shape 2026-09-30, the custom EQ curve 2026-09-30, middle-click to play next, lyrics on seek hover and paste to search 2026-10-01, the changelog and export scopes matching the sections 2026-10-03, the About additions, color profiles and About's what-works-here list 2026-10-04, custom tooltips 2026-10-05, the settings re-sort, full search and the Cache section 2026-10-06, see `goals-completed.md` §6.

---

## 8. Stats & Analytics

Reopened 2026-10-05 for picked ideas; everything shipped is in `goals-completed.md` §8. All three are Velora-only (`<Capable feature="userStats">`).

- [ ] **(Later)** **Listening calendar** (S, Velora). A day-by-day grid of listening time, a whole year at a glance.
  - ↳ files: `screens/views/statsView/` (new component), backend `/stats/listening` (needs a per-day series if it only returns months)
- [ ] **(Later)** **Song deep dive** (S, Velora). Per song: plays, first and last play, skip rate, busiest month.
  - ↳ files: `primitives/trackInfoModal/` + `ui/sidebar/views/InfoView/` (where song details already show), a per-track stats endpoint
  - ↳ seam: `musicService` (new method), capability-gated
- [ ] **(Later)** **Export listening history** (S, Velora). Download your plays as CSV or JSON from the stats view.
  - ↳ files: `statsView.tsx`, a paged history endpoint, `src/utils/downloadFile.ts` for the save

---

## 10. Auth & Session

Reopened 2026-10-05; everything shipped is in `goals-completed.md` §10.

- [ ] **(Next)** **Random logouts.** Jenny gets logged out now and then, a day after logging in, while the refresh token lives 7 days. Lead to check first: the backend rotates refresh tokens and answers a reused one with 401 "revoked or already used" (`velora-backend/src/routes/v1/auth/refresh.ts`), while `VeloraProvider`'s single-flight refresh only dedupes inside one renderer. Two tabs, or a second Electron window running the app, that hit a 401 at once both send the same cookie, one wins, the other is told the token was reused and the session ends. Fix candidates: a cross-tab lock (`navigator.locks` / `BroadcastChannel`) around refresh, and/or a short reuse grace window on the backend.
  - ↳ files: `veloraProvider.ts` (`refreshPromise`, `apiFetch` 401 path), `src/services/sessionRestore.ts`, backend `refresh.ts`
- [ ] **(Next)** **Account switcher** (M, all). Keep several servers or accounts signed in and switch without logging out.
  - ↳ trap: Velora auth is httpOnly cookies scoped to the backend origin, so two accounts on one server can't both hold a cookie; needs per-account refresh tokens kept by the platform (Electron `safeStorage`, Android keystore) or a re-login per switch on web
  - ↳ files: `src/store/session.ts`, `src/services/sessionRestore.ts`, `screens/pages/loginPage/`, every store's `clear()` on switch
  - ↳ depends: fix random logouts first, same code

---

## 11. Platform Expansion

Mobile shell via Capacitor (Android) and desktop shell via Electron **v1** are implemented, see `goals-completed.md` §11 (frameless window, `app://velora` prod protocol, sandboxed preload, tray mini-player + global media keys + NSIS packaging, auto-update, Discord Rich Presence, window bounds persistence, taskbar thumbnail toolbar, fullscreen handling, **Local mode (desktop v1) + `IPlatformAdapter`**, **external import API + Desktop API v3**, **mini player window**, **cover cache on disk**).

- [ ] **(Later)** Desktop API: per-client tokens with scopes. One bearer covers control + search + the whole library + import today, and control/search go live the moment a token exists for import, so a wallpaper that only wants now-playing + play/pause also gets the library and an import channel. Wants a named token per client with a scope set, listed and revocable in Settings → Integrations. Two smaller gaps ride along: queue mutation beyond `playIndex` (remove-at / reorder, now just a matter of exposing the `moveInQueue`/`removeAt` commands that shipped 2026-08-10 through the protocol's own vocabulary), and a per-token rate limit plus a bound on `pendingData` (every authed read parks a renderer round-trip for 10s and the map is unbounded). Deferred 2026-10-04: lands together with updating the external clients.
  - ↳ files: `electron/apiToken.ts`, `electron/localApi.ts` (`authorized` + `guardAuthedRead`), `electron/importApi.ts`, `electron/apiValidation.js` (`parseCommand`), Integrations section in `settingsView`
  - ↳ seam: the protocol contract is `../plans/desktop-api-protocol.md`, change it there first
- [ ] **(Later)** Capacitor `IPlatformAdapter` impl; verify local mode in the packaged installer build. Also verify the installed desktop build on-device (tray, media keys, auto-update, `app://velora` + backend CORS); first server-side installer build may need `wine64` (see `n8n/deploy-electron.sh`).
- [ ] **(Later)** **The Windows installer is unsigned, and that turns the updater's own signature check off.** `electron-builder.yml` carries neither `signtoolOptions` nor `azureSignOptions`, so `Velora-Setup-*.exe` ships with no publisher. The visible half is SmartScreen's "Windows protected your PC" plus "Unknown publisher" on UAC, which `uplift-beyond.de/velora/download` explains to the reader for now. The half that matters: `NsisUpdater.verifySignature()` reads `publisherName` out of `app-update.yml` and **returns null when it is absent**, which is exactly the unsigned case, so the downloaded exe installs unverified. The update channel's whole integrity story is then HTTPS plus a sha512 served from the same folder as the file it describes, and whoever can write to `uplift-beyond.de/velora/desktop` owns every install. Signing is what switches that check on, so this is a supply-chain item, not polish. Needed before anyone pays (release mid 2027).
  - ↳ options: Azure Trusted Signing (~$10/mo, no hardware token, native `win.azureSignOptions` in builder 26, driven through PowerShell's `TrustedSigning` module with Entra env credentials) · OV cert ~€200-400/yr (key on a FIPS token or the issuer's cloud HSM since June 2023, so CI signing means their cloud service, and SmartScreen can still warn until reputation builds) · EV cert ~€400-600/yr (the only one with reputation from day one)
  - ↳ trap: the long pole is identity validation, not the money. Trusted Signing wants ~3 years of verifiable business history, so a fresh Gewerbe does not qualify; start that clock early.
  - ↳ where: signtool needs Windows, and builder's osslsigncode fallback wants the key as a pkcs12 file, which the token/HSM rules forbid. Keep signing on a Windows runner even if `n8n/deploy-electron.sh` builds elsewhere, and always set an rfc3161 timestamp server or the signature dies with the cert.
  - ↳ seam: the business half (cost, purchase, who is the publisher) is `coding/business/uplift-platform.md` in the vault and §8 in the website repo's `goals.md`; this entry owns the build config only.
- [ ] **(Later)** **Android Auto / CarPlay browse tree** (L, mobile). The car can control playback through the existing media session but can't browse; expose a library tree (recent, playlists, albums, favorites) to pick from.
  - ↳ how: `MediaPlaybackService` is a plain `Service` with a `MediaSessionCompat`; Android Auto needs it to become a `MediaBrowserServiceCompat` (or Media3 `MediaLibraryService`) plus `automotive_app_desc.xml` and its manifest meta-data
  - ↳ trap: the car asks for the tree in native code, possibly with the WebView not running. Either the tree is pushed from JS and cached natively (works only while the app lives), or the service queries the backend itself with the WebView's cookie (`CookieManager` is already imported there) and a Subsonic/local path for the other providers. Decide that first.
  - ↳ depends: CarPlay needs the iOS project (see the iOS item below) and Apple's CarPlay audio entitlement, which is applied for, not just enabled
  - ↳ files: `android/app/src/main/java/com/upliftBeyond/velora/MediaPlaybackService.java` + `VeloraMediaPlugin.java`, `AndroidManifest.xml`, `src/utils/useNativeMediaSession.ts`
  - ↳ seam: `musicService` for the data, `playbackService.sendCommand(...)` when the car picks an item
- [ ] **(Next)** **Android home screen widget** (M, Android). Cover, title and play/pause/next on the home screen.
  - ↳ how: an `AppWidgetProvider` fed by `MediaPlaybackService`, which already holds the media session state; buttons send the same intents as the notification
  - ↳ files: `android/app/src/main/java/com/upliftBeyond/velora/MediaPlaybackService.java`, new widget provider + layout, `AndroidManifest.xml`
- [ ] **(Later)** Linux packaging targets (AppImage/deb), Windows NSIS shipped 2026-07-10; add targets to `electron-builder.yml` when wanted.
- [ ] **(Later)** iOS Capacitor project, only `android/` exists today (deliberate choice 2026-06-21: no Mac/Xcode in this environment to ever build or test one). Add via `npx cap add ios` once there's a way to actually run it; the JS-side native bootstrap (`useNativeBackButton`/`useNativeStatusBar`/splash handoff, see `goals-completed.md` §11) is platform-agnostic and needs no changes for iOS, `Capacitor.isNativePlatform()` already gates correctly, though the back-button hook is Android-only behavior. The iOS long-press context-menu gap is deferred with it.

---

## 13. Home Page Expansion

Reopened 2026-10-05; everything shipped is in `goals-completed.md` §13.

- [ ] **(Way later)** **Pinned row on home** (S, all). Pin any album, playlist or artist from its menu to a Pinned row at the top of home.
  - ↳ files: `screens/views/homeView/homeSections.tsx` (a new section in the order/hide list), `src/utils/mediaMenu.ts` + `playlistMenu.ts` (Pin entry), `src/settings.tsx` (pinned ids + export scope)

---

## 15. Navidrome-only capabilities (way later)

Things the Navidrome/Subsonic API supports that the Velora backend currently does **not**. Parking lot, revisit once core parity (§14) is solid. Full catalog (impact tiers, endpoints, capabilities, file/seam pointers): [`docs/goalsDetails/subsonic.md`](./docs/goalsDetails/subsonic.md). (Subsonic scrobble dropped 2026-07-19, see `goals-completed.md` §15.)

- [ ] **(Way later)** _Further Subsonic-only features_, catalogued in [`docs/goalsDetails/subsonic.md`](./docs/goalsDetails/subsonic.md); pull items up into the numbered sections here as they get scheduled.

---

## 18. Mobile Support

The responsive shell, the per-surface sweep, the gestures, the tab bar, the 2026-09-13 batch and the five failing tests are shipped, see `goals-completed.md` §18. Reopened for open items a mobile review found on 2026-09-13.

- [ ] **(Later)** Touch has no overflow affordance on `MediaCard`/grid tiles, Queue/Jar rows or (since 2026-09-30, removed by choice) list rows; the long-press is their only path to the menu, and since 2026-10-01 a hold on a card's cover previews instead (`holdToPreview`), so on touch only the caption still opens it. Cards have no reserved gutter and their cover already hosts the `showPlay` layer, so placement is a real decision; Queue/Jar rows need a gutter first, and their `onMoveUp`/`onMoveDown` entries exist precisely because touch has no drag yet are only reachable through the long-press iOS drops.
  - ↳ files: `primitives/mediaCard/`, `ui/sidebar/views/QueueView/`, `ui/sidebar/views/JarView/`
- [ ] **(Way later, maybe)** **Flip to pause with the screen locked** (M, Android). `useFlipToPause` only sees the sensor while the app is visible. Move detection into `MediaPlaybackService` (`SensorManager`): pausing works locked because a playing service holds its wake lock. Resuming needs the service to stay foreground and keep the wake lock for a grace window after a flip-pause (~10 min, tunable), since a paused service drops both, the CPU sleeps, and Android 12+ won't let a sensor trigger re-enter the foreground. The window also caps the late surprise resume. The JS hook steps aside on Android.
  - ↳ trap: some OEM battery savers (Xiaomi, Huawei) stop sensors with the screen off regardless
  - ↳ files: `android/.../MediaPlaybackService.java` (`render()`), `VeloraMediaPlugin.java`, `src/utils/useFlipToPause.ts`, `docs/app/settings/playback.md`
- [ ] **(Later)** **More haptic shapes.** Five picked ideas on top of the shipped feels: seek ticks that follow the waveform, swipe arming, a flip-to-pause thump, pull to refresh and a volume wall. Detail: [`docs/goalsDetails/haptics.md`](./docs/goalsDetails/haptics.md).
  - ↳ seam: a shape in `utils/haptics.ts`, played where the event happens; never a raw vibrate call or a second setting gate
- [ ] **(Next)** **Data saver** (S, mobile). A separate quality for mobile data, full quality on Wi-Fi. `"auto"` already reads `saveData`/`effectiveType`, but fast 4G reads as full quality, so it never saves data on a good signal.
  - ↳ files: `audioEngine.ts` (`resolveAutoQuality`, a `cellularQuality` setting), `docs/app/settings/audio.md`
  - ↳ how: `navigator.connection.type === "cellular"` works in the Android WebView; re-resolve on its `change` event for the next track

---

## 25. Games

The three games and the launcher are shipped, see [`goals-completed.md`](./goals-completed.md) §25. Only the shelf is open.

- [ ] **(Way later)** More games, catalogued in the same file (eight worked out, twenty on the shortlist). Adding one is a `GameId` + a `GAME_REGISTRY` entry + a component in `GameOverlay`; everything else (launcher tile, palette row, records, export) is already additive.
  - ↳ files: `ui/games/gameTypes.ts`, `ui/games/gameOverlay.tsx`, new `ui/<game>/`
  - ↳ seam: `store/games.ts` for open/close and the shared records map, never a per-game `open` flag

---

## 26. New Providers & Sources

- [ ] **(Later)** **Remote folder sources: WebDAV, S3, SMB.** Point the library at music that lives on a NAS or bucket instead of `<OS Music>/Velora`. Same scan/tag/SQLite pipeline as local mode, only the file listing and the byte stream change, so it is a source behind the local library, not a new provider. Credentials stay in Electron main, never the renderer.
  - ↳ files: `electron/localLibrary.ts` (source abstraction for list/read), `src/services/platform/`, Settings → Local Library (add/remove a source)
  - ↳ seam: `IPlatformAdapter` + the `local:*` IPC surface; `vmedia://` keeps serving the bytes
- [ ] **(Way later)** **Plex provider.** A new `IMusicProvider` with its own `capabilities` map, added to `musicProviderBundle` like `LocalProvider`; maybe, not scheduled.
  - ↳ files: new `src/services/music/providers/plexProvider.ts`, `src/services/music/capabilities.ts`
  - ↳ seam: `musicService`, the capability model gates whatever Plex can't do

---

## 27. Party Mode

- [ ] **(Way later, maybe)** **Party mode** (M, all platforms). The normal app with every destructive action off, so guests can pick songs, skip and change the volume but never edit, delete or create anything; exit with a PIN (recovery password resets it). Plan agreed 2026-10-01: [`docs/goalsDetails/party-mode.md`](./docs/goalsDetails/party-mode.md).
  - ↳ seam: one `locked` flag in `src/store/kiosk.ts`, enforced centrally (musicService allowlist, capability mask, `Dropdown` `partySafe`, palette/keybind allowlist, route guard, `<Unlocked>`), never per-component branches

---

## 28. Lyrics

- Lyrics styles for the sidebar shipped 2026-10-05, see `goals-completed.md` §28.
- [ ] **(Later)** **Lyrics offset** (S, all). Nudge synced lyrics earlier or later per song when they drift, and save the shifted timings back so the server has the right times from then on.
  - ↳ files: `src/utils/useTrackLyrics.ts`, `primitives/lyrics/Lyrics.tsx` (the nudge control)
  - ↳ seam: `musicService` (new save-lyrics method, capability-gated); providers that can't write keep the offset locally per track id
  - ↳ depends: a backend endpoint that stores corrected LRC (backend work, not filed yet)

---

## 29. Pets & Seasonal Decorations

The pet registry, the October ghost and the rabbit are shipped, see `goals-completed.md` §29.

- [ ] **(Later)** More year-round pets (a dog, a cat). One `walk` entry in `PET_REGISTRY` with no `season` + an SVG, like `rabbit/`.
- [ ] **(Later)** Pets and decorations on mobile (above the mini-player).

---

## 30. Memory

- [ ] **(Next)** **Lower desktop RAM** (L, desktop first). Prod home was 898 MB private after sized covers. Measure with `npm run desktop:prod:devtools` → Settings → Dev → Telemetry (private memory per process, renderer split), then cut: the unattributed native part of the renderer, GPU, the renderer kept whole while hidden to tray, plugin frames (one document per plugin × surface, runtime frame kept forever). Plan: [`docs/goalsDetails/memory.md`](./docs/goalsDetails/memory.md).
  - ↳ files: `src/assets/backgrounds/`, `src/utils/useBlobUrl.ts`, `electron/main.ts` (vmedia), `src/services/plugins/chrome/usePluginChrome.ts`, `src/services/plugins/frame/runtimeFrame.ts`
