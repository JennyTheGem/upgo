# BeyondUI: goals

Purpose: Jenny's own React component library, so every new app starts with the style,
motion and accessibility work already done in Velora instead of rebuilding it.

Legend: ✅ Implemented · 🚧 Partial · 📋 Planned
Finished items move to `goals-completed.md`.

Last updated: 2026-08-25

## 0. Decisions

| Topic | Decision |
| --- | --- |
| What it is | Own component library, plus a demo app in the same repo |
| Distribution | npm package target, not published yet, consumed by local path or git until it stabilises |
| Source | Ported from `Velora-v2/velora-frontend-react/src/assets/components/primitives`, per component: port the generic ones, rewrite the ones tangled with music state |
| Styling | Per-component CSS file next to the component (`Button.tsx` + `button.css`), global class names, tokens from `index.css` |
| i18n | None. Every string is a prop with an English default |
| Icons | Generator script only, consumers list the icon names they need. No SVGs bundled |
| Motion | `motion/react` as a peer dependency, `BeyondAnimate` (ported `springs.ts` + motion tokens) as the public vocabulary, `LazyMotion` hosted by the provider |
| State | One `BeyondProvider`: settings, toast host, confirm host, LazyMotion |
| Components | Every primitive meets the component contract in `CLAUDE.md`: themeable, density aware, open, 44px touch targets, keyboard operable, semantics derived not passed |
| States | Every primitive ships every state that applies: loading, success, error, disabled, empty, invalid. Driven by `src/lib/state/useStatus`, painted from `--bey-status`, announced through the one shared live region |

## 1. Foundation
- ✅ Vite 8 + React 19 + TypeScript 6 scaffold
- ✅ ESLint flat config, Vitest + jsdom + Testing Library
- ✅ Token layer in `src/index.css`
- ✅ Self-hosted Outfit variable font
- ✅ Repo split: `src/lib` (package) vs `src/demo` (showcase)
- 📋 Surface recipe: extract `.uiContentContainer` from Velora's `mainPage.css`, which
  `index.css` already references but never defines
- 🚧 Port utils: `iconify` done; `popoverPosition`, `useFocusTrap`, `useBackButtonDismiss`,
  `useBreakpoint`, `useSettledResize`, `usePullToRefresh` still to come
- ✅ Icon generator script (`scripts/fetch-icons.mjs`, takes --src / --out / --strict)

## 2. BeyondAnimate
- ✅ `animate/motion.ts`: the one place `motion/react` is imported, so the engine stays swappable
- ✅ `useReduceMotion`: reads `data-reduce-motion` and the OS preference. Stands in for the
  settings context until `BeyondProvider` lands
- 🚧 `springs.ts`: the `switcher` family and `INSTANT` exist. The notch / lift / land /
  handoff / trail / exit families port when the components that need them do
- 📋 Animation-speed multiplier (needs the settings context)
- 📋 Swap `motion` for `m` here once `BeyondProvider` hosts `LazyMotion`

## 3. Shared state
- ✅ `state/status.ts`: the `Status` vocabulary and `useStatus`, which turns a handler's
  returned promise into loading, then success or error
- ✅ `state/announce.ts`: one shared polite live region, because a status message inside a
  control joins that control's accessible name
- ✅ `state/status.css`: `--bey-status`, so every component paints an outcome the same way
- ✅ `icon/statusGlyphs.tsx`: the library's own marks as inline paths, since the icon
  generator only ever sees a consuming app's source
- 📋 Move the live region into `BeyondProvider` once it exists
- 📋 Field-level error text and `aria-describedby`, when the first form control lands

## 4. BeyondProvider
- 📋 Settings context: density, blur, animation speed, reduce-motion, high-contrast,
  focus indicators, writing the `<html>` attributes and CSS variables `index.css` expects
- 📋 LazyMotion host with `domAnimation` features
- 📋 Toast queue and host
- 📋 Confirm and prompt host

## 5. Primitives, v1
- 🚧 Core controls: Icon ✅, Button ✅ (+ `Button.Group`, `Switch`). Input, SearchInput, Tabs, Dropdown still to come
  - Button axes: tone x shape x size, all driven by `--bey-btn-*` variables, so `tone` is an
    open set and a theme reaches buttons through `:root`
  - Slots: icon, iconEnd, shortcut (`kbd`, hidden on touch), badge
  - Behaviours: async `onClick` drives the pending state, `href` / `asChild` render an
    anchor, `holdToConfirm` + `holdFrom` (left/right/top/bottom) for destructive actions, `pressed` for toggles
  - `Button.Group` supplies `tone` / `shape` / `size` defaults to its children
- 📋 Button, still open: tooltip on icon-only and collapsed buttons (needs Tooltip),
  success flash on an async action, split button (needs Dropdown)
- 📋 Overlays: Dialog, ConfirmDialog, Sheet, Toast, Tooltip (Tooltip is new, Velora has none)
- 📋 States and surfaces: EmptyState, ErrorState, GlassSurface, Skeleton (new, Velora
  applies `.skeletonPulse` inline)
- 📋 Interaction heavy: CustomScrollbar, ResizeHandle, SwipeableRow, PullToRefresh,
  VirtualizedGrid

## 6. Demo app

It is the documentation site as well as the showcase, so a change to a component
is not finished until its chapter, its props row and the builder agree with it.

- ✅ App shell (`src/demo/app.tsx`): masthead, sticky index with scroll spy, and a chapter
  per topic rendered as one hairline-seamed spec sheet rather than a grid of cards
- ✅ Docs: getting started (install, stylesheet, icon generator), a copyable source sample
  beside every specimen, and props tables for Button, Button.Group and Switch
- ✅ Component builder (`src/demo/Builder.tsx`): configure a Button across every axis and
  copy the generated JSX. The preview renders from the same config the code prints
- ✅ Nebula background, ported from Velora's `assets/backgrounds/nebula` into
  `src/demo/nebula`. The settings store is gone (the frame cap is a prop) and the palette
  comes from the active accent. Demo only, the library ships no backgrounds
- 🚧 A chapter per primitive group: Button, Button.Group and Switch are covered, the rest
  arrive with their components
- 🚧 Live settings panel (`src/demo/settings.ts`, `src/demo/Deck.tsx`), built out of the
  library's own Button.Group and Switch: theme, accent, density, interface blur,
  background and the four accessibility flags, written onto `<html>` exactly as
  `BeyondProvider` will. Animation speed waits on the settings context
- 📋 A builder for Button.Group and Switch, once the Button one has earned its keep

## 7. Package
- 📋 Library build target: entry points, generated typings, export map
- ✅ React 19 and `motion` declared as peer dependencies
- 📋 Ship the stylesheet as a side-effect import
- 📋 Consume from one real app to validate the surface

## 8. Deferred
- 📋 Themes (`themes.css`: dark, abyss, glazedCeramic, sakura, brushedTitanium, chromatic)
- 📋 Runtime custom themes (`:root` variables only)
- 🚧 Per-primitive tests as components land (`tests/button.test.tsx`)
