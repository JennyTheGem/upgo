# goals-completed.md

The record of shipped work for **jenny.uplift-beyond.de**, same § numbers as
[`goals.md`](./goals.md). Open work lives there; this file is what is done.

Append a compacted entry when an item is checked off, in the same edit that removes it from
`goals.md`. Dropping an item counts as finishing it: record it here with the reason, so nobody
re-proposes it. Don't edit past entries except to fix a factual error.

---

## §0 Repo setup

**2026-08-11, the repo was initialised for Claude and the rewrite scaffold landed.**

- `CLAUDE.md`, `goals.md` and this file are written, in the same shape as the sibling repos, so the
  project split with uplift-beyond.de, the stack, the conventions and the facts about each project on
  the site do not have to be re-explained per session. `docs/goalsDetails/react-rewrite.md` carries the
  long-form plan for §1.
- **`src/index.css`** copied verbatim from the company site (itself Velora's): design tokens on `:root`,
  the utility layer, and the accessibility layers (`data-reduce-motion`, `data-reduce-transparency`,
  `data-high-contrast`, forced-colors). Its accent token is already `rgb(204, 26, 236)`, this site's
  magenta. It is inert until the rewrite imports it.
- **`public/fonts/`**: Outfit and Inconsolata variable faces plus their OFL license, self-hosted. Vite
  serves `public/` at `/`, so `index.css`'s `@font-face` rules resolve unchanged after the rewrite.
- **The Google Fonts CDN is off both pages.** `index.html` and `coming-soon/index.html` loaded Outfit
  (plus Lexend Deca, which nothing used) from Google's CDN, which transmits every visitor's IP to a US
  provider, has been ruled a DSGVO violation by a German court, and is a live Abmahnung vector for a
  German site. Both now load `css/default/webfonts.css` and an inline `@font-face` respectively, against
  the local files. That file is deleted when `index.css` takes over.

## §1 React rewrite

**2026-08-11, the site is React + TypeScript + Vite and the vanilla prototype is deleted.**

- **Scaffold**: `package.json` (v1.0.0), `vite.config.ts`, the three `tsconfig`s and `eslint.config.js`,
  all copied in shape from the company site. Dependencies are React 19, react-router-dom 7, Zustand 5 and
  GSAP; no i18next (English-only stands, copy lives in registries) and no `motion`.
- **The prototype is gone, not archived**: `index.html` is the Vite entry, and `main.js`, `style.css`,
  `css/` and `js/` are deleted. `media/` moved to `public/media/`, which is why every asset path is now
  `/media/…`. The `legacy/` staging step in the plan was skipped: the port reached parity in one pass, so
  the folder would have been created and deleted in the same change.
- **Token layers**: `src/site.css` sits on `src/index.css`. The `#0f0611` ground, the glass recipe, the
  noise overlay, the squircle and the fluid display scale are each one definition now instead of five.
  `index.css`'s utility set is the one that ships; the prototype's parallel set is gone, and so are its
  thin scrollbars.
- **`PROJECTS` registry** in `src/projects/`, one module per project: id, name, label, kind, mark, header
  media, body copy, gallery with captions, outbound link. The list, the sticky frame and the project view
  all read it. Non-project copy lives in `src/content/site.ts` for the same reason.
- **Real routing**: `/` and `/project/:id`, both surviving a cold load and a shared link. Navigation runs
  behind the start animation; returning to `/` restores the scroll position.
- **Behaviours are components and hooks now**, not scripts: `primitives/splitText` renders the letter and
  word spans instead of `replaceWith`-ing DOM React owns, `ui/cursor` reads the store and takes its tip
  from a `data-cursor-tip` attribute, `ui/menu` drops `window.scrollToContainer` and the inline
  `onclick=`, `assets/backgrounds/orbs` cancels, resizes and runs capped at 30fps and 35% resolution,
  `ui/startAnimation` drives both directions from one delay array.
- **Deleted with the rewrite**: `main.js`'s dev-mode block and `devMode: true`, the `.hidden` view
  toggle, the hand-rolled `smoothScroll` global, `css/default/webfonts.css`, the vendored GSAP, the unpkg
  ScrollTrigger tag and the `unicorn.studio` iframe.
- **GSAP over `motion`, decided**: the pinned horizontal track and the scrubbed reveals are ScrollTrigger
  features with no `motion` equivalent, and this site is mostly scroll choreography. Written down in
  `CLAUDE.md` and `docs/designsystem.md`; never ship both.
- Verified with `npm run build` and `npm run lint`, both clean.

## §2 Design system

**2026-08-11, `design.md` became `docs/designsystem.md`** and was rewritten against the React build: the
two token layers and what each may declare, the glass and noise recipes as tokens, the fluid display
scale, the breakpoint table (900px, which did not exist before), the component and primitive inventory,
the accessibility floor, and the structure. The opacity ladder is `index.css`'s `.op-*` scale.

_(the rest is open, see `goals.md`)_

## §3 Content

**2026-08-12, the locale decision landed on de + en, and the site is bilingual.** The open decision was
"English only, or de + en", and it is de + en: Jenny's clients are German, the legal pages had to be
German regardless, and a German visitor now gets a German site without asking.

- **i18next + react-i18next + i18next-browser-languagedetector**, the same setup Velora uses, in
  `src/i18n.ts`. Both bundles ship in the entry chunk rather than behind Velora's lazy backend: two files
  of a few kB do not pay for a partial bundle and a frame of English before the German lands. Detection
  is `localStorage` then `navigator`, cached under **`portfolio-language`**, and `nonExplicitSupportedLngs`
  is what makes `de-DE` resolve to `de` instead of falling through to English.
- **Every translated string moved to `src/locales/{en,de}/translation.json`**, including the ones that
  were never in the registry: `aria-label`s, the cursor tips, the screen-reader headings. A string that
  reaches a person is copy, and copy is not written in a component.
- **A project is now split on one question: would a translator touch it?** `src/projects/<id>.ts` keeps
  id, name, kind, media files and the outbound `href`; label, body, alt text, captions and the link's
  label live under `projects.<id>` in the locale files, read through `projectText(t, id)` in
  `src/projects/text.ts`. `Media` lost its `alt`, `Project` lost `label`, `body` and `link`, and the
  gallery pairs by index with an optional read, so a length mismatch degrades rather than throws.
- **`content/site.ts` is what a locale has no opinion about**: `contact`, `SECTION_IDS`, the portrait's
  path and size, the outbound URL, the `@2026`. The header stopped hardcoding "Jenny" and "Reinecke" and
  splits `contact.name`, so the name exists once.
- **The language lives in the nav's foot row**, beside the cursor toggle: both options visible rather
  than a toggle, generated from `LANGUAGE_OPTIONS`, in the cursor row's grammar and keyboard ring.
- `app.tsx` refreshes ScrollTrigger a frame after a language change, because German runs longer than
  English and every trigger's start and end moved. `i18n.ts` keeps `<html lang>` in step.
- **The Datenschutzerklärung names the new storage key.** Its `Einstellungen auf Ihrem Gerät` section
  now lists `portfolio-settings` and `portfolio-language` and says the browser's language preference is
  read in the browser. A new key means that section changes, every time.
- **`scripts/checkLocales.mjs` runs first in `npm run build`.** It walks both trees and asserts the same
  leaf paths and the same array lengths, because a key added to `en` and forgotten in `de` prints its own
  key path on the page and neither tsc nor eslint can see inside a JSON tree. `npm run check:locales`
  runs it alone.
- The legal documents themselves stay German and are not translated, as decided when they were written.

_(the rest is open, see `goals.md`)_

## §4 Motion and responsiveness

_(open, see `goals.md`)_

## §5 Assets and page weight

_(open, see `goals.md`)_

## §6 Accessibility floor

_(open, see `goals.md`)_

## §7 Legal and privacy

**2026-08-12, both legal pages exist and the footer became the site's contact screen.**

- **`src/content/legal.ts` is the registry** for the two documents: id (which is also the route), the
  short label the chrome uses, title, lead, `Stand:` line and the sections, where a section may carry
  paragraphs, tight lines (an address) and a `mail` that renders as a real `mailto`. `LEGAL_DOCS` drives
  the route table in `app.tsx`, `LEGAL_LINKS` drives the footer and the nav, so a third document is one
  entry and lands in all three places. They are German whatever the locale decision does to the rest of
  the site: those documents address a German reader and, if it ever comes to it, a German court.
- **Impressum** (`/impressum`): § 5 DDG and § 18 Abs. 2 MStV, private operation so no Gewerbe and no
  USt-IdNr, plus Haftung für Inhalte, Haftung für Links and an Urheberrecht clause that says client work
  stays the client's. The § 36 VSBG line is there; the EU ODR link deliberately is **not**, because that
  platform was shut down on 20 July 2025 and every boilerplate generator still emits a dead link to it.
- **Datenschutzerklärung** (`/datenschutz`): self-hosted, so it names the server logs and their seven-day
  deletion under Art. 6 Abs. 1 lit. f rather than a processor, and it can honestly say no cookies, no
  analytics, no CDN and no third-party font. The one thing the site does store is the cursor toggle in
  `localStorage` under `portfolio-settings`, declared as § 25 Abs. 2 Nr. 2 TDDG (no consent needed).
- **`content/site.ts` gained `contact`** (name, email, address), which both documents and the footer read,
  so the address exists once and cannot drift between them. `admin@uplift-beyond.de` is the address.
- **`screens/pages/legalPage`** renders both from the registry: a 38rem reading column, roughly 68
  characters, `lang="de"`, more space above a heading than below it. It keeps exactly one thing of the
  site's language, the title's letter tilt, so it reads as made by the same person; nothing scrubs or
  pins. Escape returns to `/`, the same contract as a project view.
- **The footer is the contact screen now.** The largest thing in it is `admin@uplift-beyond.de` at the new
  `--text-headline` step, as a `mailto` carrying the hover tilt. Under a rule: the identity block on the
  left, the legal and outbound links plus `@2026` on the right. It also gained a `--glass-border`
  hairline, and the year moved off `op-40`, which was 3.4:1 on the purple fill.
- **The panel swells rather than reveals.** It rests at `80%` and goes to `95%` at the bottom and `100%`
  under the pointer, and the resting height holds the whole card. The first pass rested at `55%` and let
  the growth uncover the address, which is a puzzle in front of the one thing on the page that must never
  need earning. `min-height: fit-content` on the panel is the floor that keeps it true at any wrap or
  `--ui-density`, since percentages of a fixed section cannot promise it. Under reduce-motion the height
  is `100%`, because nothing tweens it there and the resting value would otherwise be the final one.
- **`footer.lead` is the availability line, not a pitch.** "Not taking on new work right now, but say hi."
  replaced "Working on something?", because Jenny is not currently taking work and a portfolio that
  solicits it anyway wastes the reader's time and hers. One string, so flipping it back is one edit.
- **The nav takeover carries the two links as well**, in the foot row beside the cursor toggle: a project
  view has no footer, and the Impressum has to be reachable from every page. They join the keyboard ring.
- **`primitives/viewLink`** is the new seam: a real `<a href>` that navigates behind the start animation
  and leaves modifier clicks alone. A project entry can be a button, an Impressum cannot: it is an
  address, and it has to be openable in a new tab and followable by a crawler.
- **The name is now hidden on every route but `/`**, stated that way rather than as a list, so a new view
  does not have to remember to join it.
- Still open in §7: the postal address itself is a marked `TODO` in `content/site.ts`, and the footer
  needs to point somewhere real before launch.

## §8 Launch

_(open, see `goals.md`)_
