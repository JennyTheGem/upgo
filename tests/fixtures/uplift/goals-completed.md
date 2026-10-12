# goals-completed.md

Archive of shipped (or deliberately dropped) work for **uplift-beyond.de**. Same § numbers as
[`goals.md`](./goals.md). Append the compacted entry when an item is checked off there; don't edit past
entries except for factual errors.

---

## §1 Foundation

- ✅ **2026-08-10 - Design tokens imported.** `src/index.css` copied verbatim from Velora
  (`velora-frontend-react/src/index.css`): `@property` color tokens, the full `:root` token set, the atomic
  utility layer, and the accessibility layers (`data-high-contrast`, `data-reduce-transparency`,
  `data-reduce-motion`, `forced-colors`). This file is the single source of truth for the design system.
- ✅ **2026-08-10 - Outfit variable font self-hosted.** `public/fonts/outfit-variable.woff2` + `OFL.txt`.
  No third-party font CDN, which is also the DSGVO-safe choice.
- ✅ **2026-08-10 - Nebula background ported.** `src/assets/backgrounds/nebula/nebula.tsx` verbatim from
  Velora (canvas 2D drifting blobs with its own adaptive resolution and FPS governor).
  `src/assets/backgrounds/backgroundQuality.ts` is adapted rather than copied: Velora sources the knobs from
  its settings store, here they are module state with a `setBackgroundQuality` setter, so the seam exists
  before there is a settings surface to drive it. Read once at mount, never per frame.
- ✅ **2026-08-10 - Scaffold installed and building.** React 19 + TS + Vite 8, Zustand, react-router v7,
  motion, i18next, eslint, mirroring Velora's versions and configs. `npm run build` and `npm run lint`
  both pass. `src/main.tsx` renders `src/app.tsx` (`BrowserRouter` + `<Routes>`), Velora's shape exactly.
  Added `src/vite-env.d.ts` (`noUncheckedSideEffectImports` rejects every co-located `.css` import
  without it) and `ignoreRestSiblings` to the eslint unused-vars rule (the primitives destructure props
  out purely to keep them off `...rest`).
- ✅ **2026-08-10 - `vite-react-ssg` dropped.** It still imports `react-router-dom/server.js`, removed in
  react-router v7, so the prerender step fails outright while the client build succeeds; its own README
  now tells v7 users to use react-router's built-in SSG instead. Pinning react-router back to v6 would
  have worked and was rejected: Velora is a plain `vite build` SPA and matching it keeps one stack across
  both repos. Static rendering for SEO stays open in §1, and react-router v7 framework mode is the
  candidate when it lands.

---

## §2 Presentation system

- ✅ **2026-08-11 - The theme axis is built, three themes.** `html.<theme>` token overrides, exactly
  the discipline §18 was written for, and the layout axis inherits the whole mechanism.
  - **The pieces.** `assets/site/themes.ts` is the registry (ids in switcher order, `DEFAULT_THEME`,
    `isThemeId`, `themeLabelKey`, and no colours). `assets/site/themes.css` holds one `html.<id>`
    block per theme plus that theme's swatch rule. `store/usePresentation.ts` is the state: persisted
    under `uplift-presentation`, hydrated from `?theme=` so a preset is a shareable link, and it
    writes the class on `<html>` at import rather than in an effect, so no route renders in the
    default theme and then swaps. `ui/themeSwitcher` is the control. Adding a theme is one registry
    entry, one CSS block, one swatch rule and a name in both locales; nothing else learns it exists.
  - **The three.** `ink` is the default and has no block at all: it is `site.css` as written. `warm`
    is EzReplay's reading theme (`#0e0f0f` ground, `#f0ede3` ink) and is **three declarations**,
    because every tint on the site is a `color-mix` of `--color-white` or `--color-background`, so
    two values carry the hairlines, fills, glass, panes and focus ring with them. `light` is
    EzReplay's lilac (`#f3e1ef` with `#171320` ink) and is the one that inverts.
  - **What inverting actually costs**, now written down in designsystem §18.2: the icon tint flips
    (the bundled glyphs are baked white) and the primary button takes the white one back, the hero's
    scrim has to lighten rather than darken, the accent **ink** darkens while the fill does not, and
    the opacity ladder floors.
  - **The ladder is why this took a sweep.** Hierarchy on this site is `opacity` on `--color-white`,
    and opacity buys its contrast against the ground: the `.55` rung measures 5.9:1 on the ink theme
    and 4.1:1 on a light one, under AA for small text. That made it a component edit a theme needed,
    which invariant 5 says is a broken seam. The two quiet rungs became `--ink-meta` and
    `--ink-faint`, applied at 32 call sites across 20 stylesheets; `light` raises them to .68 and
    .62. Six strays at `.6`/`.58` were folded onto the `.55` rung on the way, which is a 0.05 shift
    nobody can see and six fewer values off the documented ladder.
  - **Two contrast bugs fell out of writing the check.** `--accent-emphasis-fg` read `--color-white`,
    so on `warm` the accent ask's label became cream on unchanged violet (4.2:1) and on `light` it
    became near-black on it (3.7:1). The fill is the mark's violet on every theme, so its label is
    fixed too: it now reads `--color-neutral-50`. Nothing changes on `ink`, where the two are the
    same colour.
  - **`scripts/check-themes.mjs`** is the check that catches this next time: it parses both token
    layers plus `themes.css` and measures ink on ground (7:1), both quiet rungs, the accent ink, the
    accent label on its fill, the fill on the ground (3:1) and the primary button's label, for every
    theme found. All three pass. `npm run check:themes`.
  - **The nebula moved into the token layer** as `--nebula-palette`, read once per theme by
    `ui/heroBackground` (a canvas cannot read CSS on its own, and the id is only the cache key, so
    the component still never learns a theme's name). Each theme brings its own atmosphere and the
    canvas cross-fades between them on its own.
  - **The switcher rides the nav pill**, per Jenny: an icon button and an **opaque** pane (a nested
    `backdrop-filter` would blur the pill instead of the page), with `ThemeOptions` rendered flat in
    the mobile panel under a hairline, because a disclosure inside a disclosure is a maze on a phone.
    Each row is a swatch (the theme's ground and ink, two solid halves, no gradient), its name, and a
    check on the active one, which is the non-colour cue. Escape and an outside pointer close it and
    focus returns to the button.

## §3 Product identity

- ❌ **2026-08-10 - The per-product brand axis is DROPPED. Do not rebuild it.**
  Jenny: *"actually let's forget about the different app designs for each app, this just doesn't work,
  make everything look the same, it's one website so it should probably look the same."*
  **Why it failed.** The idea was that `/velora` and `/ezreplay` should each feel like arriving
  somewhere, so each product got its own ground, accent, glass weight, radius scale, motion curve and
  nebula palette, with a house look between them. Built for Velora and shipped on both `/velora` routes.
  In practice it did not read as three identities, it read as three websites sharing a nav, and the nav
  was the first casualty: it visibly changed shape between routes, which is what `ui/chrome/chrome.css`
  was invented to stop. That boundary worked, and it was the tell. A site that needs a wall to stop one
  page restyling the furniture of the next is a site whose pages do not belong together.
  **What was removed:** `src/assets/brands/` entirely (`velora.css`'s token pack, `VeloraBrand.tsx`,
  `palette.ts`), `ui/chrome/chrome.css` and its `--chrome-*` alias layer, the `settle` reveal preset with
  `REVEAL_PRESETS`/`RevealPreset`/`<RevealMotion>`, `HeroBackground`'s `colors` and `speed` props, and
  `PageHero`'s `background` prop.
  **What replaced it:** one token layer, `src/assets/site/site.css`, declared on `:root` and imported
  from `main.tsx`. Ground, accent roles, glass, pane, button knobs, page rhythm and the nav's own
  measurements each have exactly one definition, which the nav, the footer and every page read. Page CSS
  now declares no site token at all (only component-local `--page-hero-*` style knobs), so the chrome
  cannot be reshaped by the page under it and the boundary is structural instead of a wall.
  Plus `ui/page`, the shell every page renders in (skip link, nav, `<main>`, footer), so a new route
  cannot arrive with different furniture, and `Section`'s `close` prop, which replaced three copies of
  the same closing hairline.
  **What was kept from the Velora pack:** nothing. Both candidates were weighed and both lost on the
  merits, not on tidiness. Its 80px glass is `index.css`'s `--panel-surface`, meant for a static floating
  panel; the nav pill is fixed over an animating canvas and pays that blur every frame, so the site keeps
  50px. Its `settle` reveal (a rise decelerating on `ease-out-strong`, no scale) is a fine curve but a
  second reveal feel is precisely what made the pages read as different sites, and the flower motif is
  the site's own, so `bloom` is the only reveal.
  **Verified unchanged:** `/velora/get` still puts all four figures on the first screen (the vertical box
  model above them is untouched; the computed gaps between the figures are the same 96 / 84 / 114 px),
  the four prices are still `size="md"` peers, every hero still leads with its mark through
  `primitives/logo`, and the "Coming mid to late 2027" state is untouched: no checkout, no waitlist, no email
  capture.
  **What survives:** the theme and layout axes (§2) and the `PRODUCTS` registry (§3), the latter as a
  *content* registry. A product gets sections, docs, downloads, prices and a mark. It does not get a look.
- ✅ **2026-08-10 - Velora brand scope extracted to `assets/brands/velora/`.** _(Superseded by the drop
  above; kept for the record.)_ It was scoped to
  `.veloraGetPage`, which stopped being right the moment a second Velora route existed. Now
  `velora.css` holds the pack under `.veloraBrand` and `VeloraBrand.tsx` mounts it, so `/velora` and
  `/velora/get` render under one definition instead of two copies drifting apart.
  **Shape, deliberately:** everything between the `.veloraBrand` opening brace and its close is a
  contiguous list of custom properties and nothing else, so the registry entry §3 still owes is a move
  rather than a rewrite. The brand-root frame (`position`, `min-height`, font, colour, `user-select`)
  and the bare-`span` reset sit in separate rules below it for the same reason. The reveal preset
  (`settle`, a rise that decelerates, against the house's petal bloom) is registered by the component,
  since it is JS rather than a token, and the nebula palette moved to `palette.ts` beside it.
  **Verified no regression on `/velora/get`:** every declaration of the old `.veloraGetPage` /
  `html:has(.veloraGetPage)` blocks was diffed against the new selectors and all 39 are present; the
  page root's DOM is unchanged apart from the added `veloraBrand` class, and `.veloraGetPage` now
  carries no declarations at all, so there is nothing left to conflict in the cascade.
- ✅ **2026-08-10 - Marks cut to 512px.** `primitives/logo` served the masters: Velora 4000px / 3.7 MB,
  Uplift 2000px / 1.2 MB, EzReplay 2000px / 570 KB, for marks nothing renders above ~72 CSS px. A 512px
  cut of each (`public/logos/*-512.png`, HighQualityBicubic, alpha kept) covers a 3x screen and takes
  them to 54 / 111 / 82 KB. The masters stay in place as the source. This is what let the Velora mark
  into the `/velora` hero at all; the rest of the size set and WebP/AVIF stay open in §1.

- ✅ **2026-08-10 - Shared chrome made brand-proof (`ui/chrome/chrome.css`).** _(The file is gone with
  the brand axis; the rule it encoded lives on as "a page scope never declares a site token".)_
  The nav changed shape
  between `/` and `/velora`: `.veloraBrand` overrode `--radius-pill`, `--radius-xl` and `--radius-lg`, and
  the nav renders *inside* the brand wrapper, so the pill squared off on Velora routes. Its glass, its
  focus ring, its accent fill and its transition curve moved too. Reported by Jenny as "the nav is not the
  same"; the deliberate "you arrived somewhere" cue was the wrong call, and the fix is structural.
  **The boundary, in two layers.** `--chrome-*` is declared on `:root`, so the aliases resolve on `<html>`,
  above every brand scope and below `html.<theme>`. Then `.houseNav, .houseFooter` restate the *plain*
  token names from those, which stops a brand's override at the chrome's edge. No component branches on a
  brand, no component changed, and `Button`'s variants keep reading the tokens they always read.
  **Why it survives what is coming.** A theme still reaches the chrome (it overrides `--chrome-*` on
  `<html>`, which outranks `:root`), which is the intended split: themes restyle the chrome, product
  brands never do. And §3's registry entry is a list of plain token values, so a third product cannot
  reach `--chrome-*` and adding one does not touch this file.
  **What a route still owns:** its ground. The footer sits on the page's `--color-background` and the nav
  pill is translucent over it, so both follow the room. One glass recipe seen through a different page is
  not different chrome.
  **Dedupe that came with it:** `--nav-height/-pad/-block` were restated by both page scopes and now
  belong to the nav; the house accent hexes, the house glass recipe and the gutter were duplicated between
  `.landingPage` and the brand packs and now have one definition, which both read.
- ✅ **2026-08-10 - Velora's pack audited against `designsystemV2.md`.** _(Superseded: the pack itself
  was dropped later the same day.)_ Removed as invented rather than
  derived: the `--radius-pill/xl/lg` overrides (§2.2 and §8 are Velora's own radius system, and
  `index.css` already carries it verbatim) and the `--ease-default`/`--ease-bounce-soft` overrides (§2.5
  and §11.1 keep the hover/state curve and the reveal curve as two separate roles; Velora's reveal feel is
  the `settle` preset, which is where it belongs). Aligned: the focus ring to §10.1's one formula (accent
  at 25%, was 45%), and `--glass-blur` now reuses `index.css`'s ported `--panel-surface` instead of
  restating a second 80px recipe. The identity that carries Velora is unchanged and never needed those:
  its ground, its magenta, its heavy glass, its nebula palette and its decelerating reveal.

## §4 Motion system

_(nothing yet)_

## §5 Public site

- ✅ **2026-08-11 - The first pass of fixes off the fourteen-page design critique.** Four findings
  closed, and the items they answered are gone from `goals.md`.
  - **`primitives/closeLinks`**, replacing the row copied across eleven page stylesheets. The gap is
    the one eight of them already used (`--gap-xs` / `--gap-xl`, column under 34rem); the three
    outliers (the two Velora reference pages and `/ezreplay`) lost a larger row gap they only showed
    while wrapped and gained the phone column they never had. designsystem §22.1 now covers only the
    fact-link row.
  - **Every route has its own tab title.** `ui/page` takes an optional `title` and writes
    `document.title` in an effect, off `page.title.*` in both locales; the legal four use their own
    document titles and `/` stays the company name. The crawler's half (description, canonical, OG)
    is untouched and still waits on §1's static rendering, which is what the prop hands over to.
  - **The accent stopped being spent five times on the landing.** `Offer` grew a `variant` defaulting
    to `accent` and `ui/productPanel` passes `primary`, because a panel is what a reader passes on
    the way to the closing fork. designsystem §22.5 settled in the same pass: the rule reads **the
    page's one primary ask** rather than "primary commercial ask", so `/support`'s bug report
    qualifies, and **one per page** is the half that binds. The nav's persistent fill is chrome and
    is counted apart from the page.
  - **`/get/velora` is no longer a dead end.** The footer's `PRODUCT_GROUPS` entries carry a list of
    prefixes (longest match still wins), so a buyer standing there gets the Velora group; the close
    section gained the installer as a `secondary` ask plus the documentation and product links.
  - Plus: `/support`'s `mailto:` has a fallback, a copy-the-address control on a new `utils/useCopy.ts`
    that `primitives/code` now shares, because a machine with no mail handler answered the page's one
    ask with nothing; `EZREPLAY_APP_URL` moved out of three page files into `utils/links.ts`; two
    `.62` opacities moved to the body rung; the hero hint's `0.85` became a named property the label
    divides back out; and `offer.tsx` stopped keying its tier list on the figure.
  - **Dropped: the landing hero rebuild.** The h1 became the positioning sentence with the wordmark
    demoted to a lockup beside the mark, and `PageHero` grew a `lockup` slot for it. Jenny prefers the
    wordmark hero, so both came back out the same day. The finding behind it (the first viewport names
    no product and both its buttons are scroll anchors) stays open in `goals.md` §5 as a content
    question, not a composition one.

- ✅ **2026-08-11 - `/support`, the site's one help surface.** Jenny: *"we need a report a bug page
  velora points to one"*, then *"or maybe a help page overall"*. Velora's Settings → About panel ships
  three links to this site and two of them landed on the 404; this answers the one labelled "Report a
  bug", at the path the app already publishes rather than a new spelling.
  - **One page, not a help centre.** No categories, no search, no ticket form: there is no backend to
    post a form to, and support here is one inbox by decision (goals.md, Content). The page's whole job
    is making the email that arrives answerable in one round trip.
  - **The ask is a prefilled `mailto:`.** `mailto(subject, body)` joined `SUPPORT_EMAIL` in
    `utils/contact.ts`; both halves are locale strings, so the template arrives in the language the
    reader is reading, and it is editable in their own client rather than being a form pretending to be
    one. Beside it, the checklist of what a report needs, ordered easiest-first with the screenshot and
    the console output marked optional so nobody stalls on a log.
  - **The other four reasons people write** get a sentence of context each: a code that will not
    activate (with the release date, so it is not read as a broken purchase), a feature idea (welcome
    for EzReplay, and Velora is finished on purpose), a security issue (same address, "Security" in the
    subject, disclosed privately first), and a data or legal question. Two of them carry the link that
    actually answers them, `/get/velora` and `/legal/privacy`.
  - **The setup line names the third-party servers only** (Subsonic-compatible, Jellyfin, Emby, local
    files), per the rule that no surface describes the Velora backend as available.
  - **Reuse only, no new component:** `page`, `pageHero`, `section` (with `bleed` and `close`),
    `sectionHeading`, `factList`, `assurances`, `cta`, `ctaGroup`, `reveal`, `textLink`. The footer's
    "More" group and the 404's ways list both grew the one new entry.
  - ↳ files: `src/screens/pages/supportPage/{supportPage.tsx,supportPage.css}`, `src/utils/contact.ts`,
    `src/app.tsx`, `src/assets/components/ui/footer/footer.tsx`,
    `src/screens/pages/notFoundPage/notFoundPage.tsx`, `src/locales/{en,de}.json` (+44 keys each,
    `support.*` plus `landing.footer.support`)

- ✅ **2026-08-11 - the legal four are routed, as provisional drafts.** Jenny: *"do the legal pages just a
  temporary spaceholder"*. `/legal/impressum`, `/legal/privacy`, `/legal/terms` and `/legal/refund` were
  the last dead links on the site, reachable from the footer on every route and from all three `/get`
  pages, and they landed on the 404.
  - **One page, four documents.** They differ in text and never in form, so a second page file would have
    been four copies of one layout. `legalDocs.ts` holds a `LEGAL_DOCS` registry (slug plus ordered
    clause ids, and an optional link per clause), `legalPage.tsx` renders whichever `/legal/:doc` names,
    and an unknown slug renders the 404 rather than an empty document. Bare `/legal` redirects to the
    Impressum, which is what a reader typing it is after.
  - **The text lives in the locale files**, not in the registry: the German version is the legally
    relevant one and the two have to stay in step, so a clause is one id in TS and two strings per
    locale. Paragraphs split on the blank line, which is the whole markup language a legal clause needs.
  - **Every page opens on a placeholder notice**, in a lifted pane above the first clause rather than as
    a footnote. A draft that does not say it is a draft is worse than a dead link.
  - **Written from the business as it stands today**, which is what makes them useful rather than
    boilerplate: nothing purchasable, no accounts, no analytics, no cookies, fonts self-hosted, not yet
    deployed, address and VAT number pending the Gewerbeanmeldung, and each of those facts stated as a
    thing that changes rather than dressed up. Voice matches the rest of the site: first person, "du" in
    German, no "we". The contact clauses reuse `SUPPORT_EMAIL` from `utils/contact.ts`.
  - **What is deliberately not in them:** an ODR platform link (it is not the reader's route to anything
    here), an invented postal address, an invented host or subprocessor, and any claim about a checkout
    that does not exist. The withdrawal policy leads with the fact that no withdrawal case can arise yet.
  - **Reuse only:** `page`, `pageHero`, `section` (with `bleed`), `sectionHeading`, `prose`, `reveal`,
    `textLink`. The one new treatment is the clause number, mono because it is a count, drawn like the
    documentation pages' numbered nodes.
  - ↳ files: `src/screens/pages/legalPage/{legalDocs.ts,legalPage.tsx,legalPage.css}`, `src/app.tsx`,
    `src/locales/{en,de}.json` (+72 keys each, `legal.*`)

- ✅ **2026-08-11 - the support address exists: `admin@uplift-beyond.de`.** Every route claimed one
  inbox answered by one person and no route said which inbox, which is the one hole that makes the
  claim read as marketing. Jenny decided it, so it is now on the site.
  - **One constant, `utils/contact.ts`.** The footer, `/about` and (next) the Impressum have to name
    the same address, and a second copy is how they drift apart. `/about` interpolates it into the
    ledger's inbox entry (`{{email}}` in both locales) rather than hardcoding it in a string.
  - **The footer carries it on every route**, in the brand block rather than a link group: an address
    is contact, not navigation. It reuses the `textHyperLink` variant, so the only new CSS is a
    slightly louder opacity and `overflow-wrap` so it does not overflow a 360px screen.
  - This is the support half only. The Impressum's postal address question (§8) is untouched.
  - ↳ files: `src/utils/contact.ts`, `src/assets/components/ui/footer/footer.{tsx,css}`,
    `src/screens/pages/aboutPage/aboutPage.tsx`, `src/locales/{en,de}.json`

- ✅ **2026-08-11 - `/about` and the 404 route: every URL on the site now lands somewhere.** Both were
  linked from the nav and the footer on every page and neither existed, so the site's stated
  differentiator was a link to nothing and a typo was a blank `#root`.
  - **`/about` argues the differentiator rather than announcing it.** Four regions: how each product
    started (Velora because Jenny loves a clean interface and wanted one she could set up her own
    way, EzReplay from VOD reviews of her own gameplay, then noticing timestamped notes are just as
    good for learning), a ledger of what one developer means, the client-work paragraph, and the
    hand-off. First person throughout, no "we", no mission statement, no milestone timeline.
  - **The ledger states the cost, not just the benefit**, which is the part that makes the rest
    credible: one inbox that is read but not always the same day, I try to finish things, planned
    says planned, and the **AI-tooling entry**. Four entries, both sides, on the page rather than
    discovered after paying. A fifth ("there is no team", no phone line, nobody awake at three in
    the morning) was written and then cut by Jenny: the whole page already says one person answers,
    so spelling out the missing call centre was the one entry that argued with a reader nobody here
    is selling to.
    Jenny asked whether the AI line was a liability. It went in because the page's whole credibility
    is saying the awkward thing first, and it is framed as tooling plus responsibility ("I decide
    what goes in, and I read what ships") rather than as the reason the products exist, which is the
    framing that would have handed the authorship away. It ends on where the line is: **no
    AI-generated images and no AI-generated video**, on the site or in the products. That is a
    commitment, not a description, so any future asset has to hold it.
  - **A tone pass over the whole page**, after Jenny read the first draft back as *eingebildet*. The
    digs at other software are gone (Velora's paragraph now says good clients already exist and it
    talks to them rather than replacing them, "I just wanted a different one"), the humblebrags are
    gone ("I finish things" became "I try to finish things"), and the honest limits are in. Two
    factual corrections came out of the same pass: the first draft claimed every alternative wanted
    the music handed over, which is false and is the opposite of what Velora does, and a line called
    customization "not a settings page, it is the point" when it is, in fact, a settings page.
  - **Client work: attribution only, exactly as the scope decision requires.** One paragraph, no
    list, clients described and not named, no rates and no contact ask, and it ends by handing off to
    the portfolio. `PORTFOLIO_URL` moved out of `landingPage.tsx` and into `aboutPage.tsx`, so the
    landing's maker CTA is now an internal link to `/about` and `/about` is the only portfolio link
    on the site, which is what the goals.md item asked for.
  - **The 404 is a wrong turn, not an event.** One header band, one sentence of what happened, and a
    column of every real destination built from the nav's own labels so it cannot drift. It renders
    inside `ui/page` like everything else: a broken link that looks like a different site is a closed
    tab. The route is `path="*"` last in the table, so the legal four and the account screens land
    here until they are built.
  - **One extraction.** The marketing paragraph (`.landingProse`) was about to be written a second
    time, which is the design system's own extract-on-the-second-copy trigger, so it became
    `primitives/prose` with a `center` alignment and the landing migrated onto it. `.docsProse` stays
    where it is: a reference column is a different measure from a landing paragraph.
  - **Neither page invents a contact address.** The support claim is real and the inbox was not
    decided yet, so nothing on either page pretended otherwise. Answered on 2026-08-11, see the entry
    above.
  - ↳ files: `src/screens/pages/{aboutPage,notFoundPage}/`, `src/assets/components/primitives/prose/`,
    `src/app.tsx`, `src/screens/pages/landingPage/landingPage.{tsx,css}`, `src/locales/{en,de}.json`
    (+33 keys each, both at 931)

- ✅ **2026-08-10 - Inconsolata self-hosted, so the mono token finally names a font that exists.**
  `--font-mono: "Inconsolata"` came across in the verbatim copy of Velora's `index.css`, and Velora
  never loaded it either, so the token had always been a dead reference: every user of it fell through
  to whatever monospace the OS supplied. Nothing on this site set mono until the documentation pages
  did, which is why §3 had gated the work behind "if anything ever needs a mono face". It does now, on
  every code block, endpoint path, command verb and permission string, so the font is in:
  `public/fonts/inconsolata-variable.woff2`, 34 KB, the same latin subset Outfit ships (which already
  covers ä ö ü ß), variable weight 200 to 900, `font-display: swap`.
  - **Downloaded once, served from this origin.** The DSGVO problem with Google Fonts is the visitor's
    browser reaching Google's CDN at runtime, not fetching the file at build time, so self-hosting is
    the remedy rather than the violation. No `@font-face` on this site points off-origin.
  - `public/fonts/OFL.txt` carried only Outfit's copyright notice. The OFL requires each font's notice
    to ship beside it, so Inconsolata's was added and the file now names both plus the no-CDN reason.
  - Not preloaded, matching Outfit: mono appears on three routes out of ten, so a global preload would
    cost every other page a wasted fetch.
  - ↳ files: `public/fonts/{inconsolata-variable.woff2,OFL.txt}`, `src/index.css`, `docs/designsystem.md`

- ✅ **2026-08-10 - `/velora/documentation`, both public contracts, written from the source.** Jenny:
  "lets work on /velora/documentation for plugins and for the desktop api not for the app itself thats
  privat". A hub plus two complete references: `/velora/documentation/plugins` (SDK 2.6.0) and
  `/velora/documentation/desktop-api` (loopback protocol v3). `/velora/docs/*` redirects to the long
  spelling via one wildcard route, so there is still one canonical URL per page.
  - **Written from the implementation, because there is no spec left.** `plans/desktop-api-protocol.md`
    no longer exists in the Velora repo, so `electron/{localApi,importApi,main}.ts` and
    `apiValidation.js` are the only remaining authority, and this page is now the canonical protocol
    reference rather than a restatement of one. The frontend repo's own `plugin-authoring.md` was also
    stale (it lists 8 permissions; canonical `permissions.ts` has 9 fixed plus `network:`), so the
    permission table follows the code. Covered in full: 10 permissions with the wildcard grammar and
    how approval binds to the list, all 13 contribution points by kind, 22 hooks with the permission
    each costs, the descriptor unions, the Vite recipe including the `NODE_ENV` define, storage and
    file caps, local plugins with the honest "restricted is a convention, not a sandbox" note; and on
    the API side the discovery file and port walk, both route groups and why a browser can never reach
    the authed one, the full snapshot shape, SSE and WebSocket frames, all 17 command verbs with their
    XOR validation, all 7 authed reads, import, and 21 error codes.
  - **Staged as the boundary each contract actually is.** Both references open on an elevation: the two
    sides named across a rule, what the wall refuses worn on the rule itself, and every capability a
    numbered crossing hanging off it as a dimension line into its clause. `ui/docsLayout` continues that
    same rule as a sticky rail, so the elevation narrows rather than scrolling away, and every heading
    carries its own node. It refuses the docs-site default of a nav tree beside an article, which shows
    a table of contents where the subject is a trust perimeter.
  - **New shared parts, all of them second uses rather than speculation:** `primitives/code` (mono
    block with a file label and a copy control, and the one place `user-select` is turned back on, since
    `index.css` disables it globally and code is the one thing on the site that exists to be selected),
    `primitives/dataTable` (the site's hairline ledger as a real table, scrolling in its own container so
    the page never does), `ui/boundaryMap` and `ui/docsLayout`. Active section tracking is one shared
    `useActiveSection` observer. The rail's current state is **filled against hollow**, the site's own
    non-colour cue, rather than a fifth job for the accent.
  - **Decisions taken with Jenny on the day:** hub plus two pages rather than one long scroll or a
    tree; English-only prose but still through i18n keys, with `de.json` carrying the same strings so
    the seam survives; guide plus complete tables rather than a dump of every type signature; documented
    against `npm i @velora/plugin-sdk` even though it is unpublished (tracked as a prerequisite in
    `goals.md`); present tense on both pages, no release-date framing; and the two readers named
    separately, companion-app developers for the API and self-hosters for plugins.
  - **The footer became route-aware.** A prefix-keyed `PRODUCT_GROUPS` map, not a branch on product
    identity: `/velora/*` gets a Velora column (download, documentation, pricing) and every other route
    is unchanged. One more entry adds EzReplay, and the whole thing folds into `PRODUCTS` at §3.
  - `PRODUCT.md` written at the same time, capturing the product truth the site had only ever held
    implicitly across `CLAUDE.md`, `goals.md` and `docs/goalsDetails/site-look.md`.
  - ↳ files: `screens/pages/{veloraDocsPage,veloraPluginsPage,veloraDesktopApiPage}/`,
    `components/primitives/{code,dataTable}/`, `components/ui/{boundaryMap,docsLayout}/`,
    `utils/useActiveSection.ts`, `app.tsx`, `ui/footer/footer.tsx`, `locales/{en,de}.json` (+477 keys),
    `veloraPage.tsx`, `veloraDownloadPage.tsx`, `PRODUCT.md`

- ✅ **2026-08-10 - the nebula fade became `Section`'s `bleed`.** The gradient that washes the hero
  canvas down over the first rows was copy-pasted byte for byte in `veloraGetPage.css`,
  `ezreplayGetPage.css` and `veloraDownloadPage.css`, with only the class and the custom-property name
  differing. `goals.md` had flagged two copies as the missing-modifier signal and the ezreplay copy
  literally said "if a third wants it, it belongs in ui/section as a modifier"; the documentation pages
  would have made it a fourth. It is now one `bleed` prop on `primitives/section`, carrying the
  gradient plus all three escape hatches (`data-reduce-transparency`, `data-high-contrast`,
  `forced-colors`), and the three pages keep only their own `padding-top`. Four call sites, one
  definition.
  - ↳ files: `primitives/section/{Section.tsx,section.css}`, the three page CSS files and their `.tsx`

- ✅ **2026-08-10 - the purchase routes moved under `/get`.** Jenny: "lets make it /get and /get/velora
  or ezreplay i think thats clean". `/velora/get` became **`/get/velora`**, the new chooser took `/get`,
  and `/get/ezreplay` joined them. The nav's one persistent ask now points at `/get` and reads "Pricing"
  instead of "Velora pricing", so the site's single most-repeated control stopped being one product's
  link on a two-product site. Its settled state matches anything under `/get`, not one exact path.
  No redirect from the old `/velora/get`: nothing is published yet, so there is nothing to preserve.

- ✅ **2026-08-10 - `/get` built and routed.** `screens/pages/getPage/`, one new page, no new component.
  **Structure:** a fork, not a pricing table. A short header band (no CTA in it: the two choices below
  are the page, and a third ask above them would only compete with both), then the two products side by
  side, each with its mark, name, status pill, one line, its headline figure with secondary tiers
  through `ui/offer`, its assurances and its way down to its own ledger. Then what is true whichever you
  pick (one account, 4 devices, VAT-inclusive prices, one inbox, withdrawal and contract links), then a
  close for the reader who is not ready to pick.
  **It does not restate the four Velora tiers row by row.** Each product keeps its ledger one click
  down, so the reader chooses once here instead of twice.
  **Figures are not restated either:** every amount, period and tier note comes from the existing
  `landing.products.*` keys, so a price is declared once on the site and `/get` cannot drift from `/`.

- ✅ **2026-08-10 - `/ezreplay` product landing built and routed.** The nav and footer linked it from
  every page and it 404ed. `screens/pages/ezreplayPage/`, one new page, no new component.
  **FORM: one pass through the footage.** Velora's page is ordered as the path a track travels; this one
  is ordered as the path you travel through a video: load, watch, mark, write, jump back, keep the file.
  It closes on the file rather than on the app, because the video is borrowed and the exported `.md` is
  what outlives the session. Rendered through the existing `ui/signalChain`, whose filled terminal node
  lands on "take the file with you". It refuses the three-card feature grid and the emoji use-case row
  the app's own landing ships.
  **Claims, all traced to the EzReplay source** rather than assumed: YouTube link or local mp4/avi/mov
  by drag-and-drop or picker, played from a blob URL and never uploaded; `#` inserts `@[M:SS]` read off
  the live player and renders as a pill that seeks; the timestamp panel scrolls the note to that line
  rather than seeking; CodeMirror 6 with Obsidian-style live preview, a `/` palette and templates;
  the real shortcut set; `Ctrl+S` exports one `.md` with YAML frontmatter, import takes `.md`,
  `.ezreplay`, `.txt`; the last 30 sessions (`MAX_ENTRIES` in `js/history.js`); `localStorage` only,
  no backend, no account; three themes plus a custom one.
  **What was deliberately not claimed:** the app's own README says "offline-first", but `sw.js` and
  `js/utils/offline.js` are both zero bytes and nothing registers a service worker, so no copy on this
  page says it works without a connection. That audit also caught a false claim already live on `/`:
  see the assurance entry below.

- ✅ **2026-08-10 - `/get/ezreplay` built and routed, and EzReplay's purchase model unblocked.**
  Jenny decided: **the free tier is the real ask and Pro is listed as planned.** `/get/velora` is
  legitimately a price list for something nobody can buy until 2027; this page is not, because EzReplay
  is usable this afternoon, so it must not read as the same dead placeholder.
  **Structure:** a ledger ordered on availability rather than duration. Free leads the table (`lead` and
  `live`, state "Available now"), the page's one accent control sits directly under it and opens the app
  at `ezreplay.net`, and the two planned Pro rows (5 €/mo, 40 €/yr, 33% saving) carry a planned state
  and lines saying outright that they cannot be bought and that no date is promised. Then what free
  gives you and what stays free, the terms, the close.
  **The commitment:** everything the app does today stays free and Pro only ever adds. That is the most
  important sentence on the page and it is the h1.
  **What Pro contains is stated as undecided** rather than filled with unbuilt features, so deciding it
  later is a copy change on one fact list.

- ✅ **2026-08-10 - "Runs entirely offline" removed from the site.** It was on `/` and inherited by
  `/get`, and it is not true: EzReplay's `sw.js` and `js/utils/offline.js` are zero-byte files and
  nothing registers a service worker. Replaced by `landing.assurance.noInstall`, "Runs in the browser,
  nothing to install", which is true, is distinct from the `noBackend` assurance beside it, and keeps
  both surfaces at two assurances. A false advertising claim on a commercial page is a German UWG risk,
  not a copy nit. Also unified Velora's release wording: the landing said "Coming mid to late 2027"
  while three other surfaces said "Coming mid to late 2027".

- ✅ **2026-08-10 - `/velora/download` built and routed.** `screens/pages/veloraDownloadPage/`, one new
  page, no new component: the shelf is page-local CSS over the existing primitives.
  **The truth it is built on**, read out of `velora-frontend-react` rather than assumed: `app.tsx` gates
  the entire app behind `useLicense`, so an unlicensed install opens on the activation screen and asks for
  a 20-character code; the electron-builder config publishes an NSIS installer plus `latest.yml` to
  `https://uplift-beyond.de/velora/desktop` (so the app self-updates from the same place the page links
  to), the installer is not one-click, and Electron 43 puts the floor at Windows 10, 64-bit.
  **Structure:** a short header band, then a three-row ledger
  (Windows with the accent download button, the browser at `velora.uplift-beyond.de` with a secondary one
  beside it, Android with a "Coming mid to late 2027" chip in the same column), then what happens on first launch
  in the order it happens, then the close. Two asks and one accent: the page is `/velora/download`, so the
  installer is what it owes and the browser link is deliberately the quieter of the two.
  **The decision:** the page states the licence gate beside the button instead of below the fold. A
  download page that lets someone install a finished app and only then discover it cannot open is the
  one failure mode this surface has, and no wording downstream repairs it.
  Reachable from `/velora`'s platforms column. Unsigned installer, so it carries a SmartScreen note.
- ✅ **2026-08-10 - `/velora` product landing built and routed.** The nav and footer link it from every
  page and it 404ed. `screens/pages/veloraPage/`, plus `ui/signalChain/` (new).
  **Structure:** the page is ordered the way a track actually travels, not as a feature grid. Mark,
  kicker and release state, wordmark, one positioning sentence, two CTAs, and the four things it plays
  from pinned to the fold where a "trusted by" logo wall would otherwise sit (there is no social proof
  to borrow, so the honest equivalent is the list of servers it already talks to). Then: what it is
  plus the real screenshot, servers and platforms as two ledgers, the audio chain, the now-playing
  overlay, themes and plugins, the licence, and a close.
  **The one artifact:** `ui/signalChain` draws the Web Audio path as six stages hung off one continuous
  hairline rail, revealed in flow order, with the terminus node filled rather than hollow so the end of
  the chain reads in greyscale and in forced-colors. It is the page's memory test and it dramatizes a
  mechanism instead of restating a claim. Data in, no product knowledge.
  **Claims:** every one is traceable to Velora's own repo. Providers, platforms and the desktop
  integration list from its `CLAUDE.md` and `goals-completed.md`; the six now-playing modes are the real
  `MODE_REGISTRY` keys (Big Cover, Typographic, Vinyl, Editorial, Continuum, Polaroid Wall); nine
  languages from `src/locales/`; the plugin credential rule verbatim from its plugin architecture. No
  testimonials, user counts, ratings, awards, benchmarks or countdowns, and iOS is stated as
  deliberately not started rather than omitted.
  **Not the pricing page:** one anchor figure through `ui/offer` with no tiers, and the four plans, the
  licence terms and the VAT wording stay on `/velora/get`.
  **Reuse:** `price`, `cta`, `ctaGroup`, `assurances`, `offer`, `section`, `sectionHeading`, `eyebrow`,
  `factList`, `pill`, `reveal`, `media`, `logo`, `textLink`, `skipLink`, `ui/nav`, `ui/footer`,
  `ui/heroBackground` all taken as they stand, none forked, no new icon ids.
- ✅ **2026-08-10 - `/velora/get` built and routed.** The site's biggest conversion hole is closed: the
  landing's nav CTA, Velora panel and closing section all resolved to a 404 before this.
  `screens/pages/veloraGetPage/`, plus `ui/planTable/` (the four plans as a ledger) and
  `primitives/skipLink/` (extracted from the landing rather than duplicated).
  **Structure:** the page refuses the four-column feature matrix, because every tier is the same
  finished Velora and a matrix of ticks would have nothing to withhold. One axis instead, duration:
  free for 14 days, 5 €/month, 40 €/year (33% less than monthly, the strongest honest line available),
  99 € once for every future version. Under it, the licence stated once (4 devices, web/desktop/Android,
  self-hosted Velora server or the Subsonic family or Jellyfin/Emby or a local folder, one account for
  both products), then the terms (trial end, cancellation, VAT-inclusive gross prices, links to
  `/legal/refund` and `/legal/terms`).
  **No transaction, and no substitute for one:** each plan's state is a neutral status pill reading
  "Coming mid to late 2027" where a buy control would be, so no row is a dead button and no CTA promises a
  trial that can be started today. No waiting list, no email capture, no social proof of any kind.
  **Brand:** the page shipped with a per-route Velora token scope. Dropped 2026-08-10 (see the entry at
  the top of this section); it wears the one site look now.
  **Nav:** gained a current-page state (`aria-current` on the links, and on `/velora/get` the persistent
  ask drops its accent fill and stops being an ask).

- ✅ **2026-08-10 - `/velora/get` opens on the prices.** Jenny: "I don't wanna need to scroll to just shop
  it, that will disable some sells." The page opened with a header, then a second section title and lead,
  and only then the ledger. Now: kicker plus status chip, the h1, one short sentence, and the four figures,
  with the plans section carrying no top rhythm of its own. Header measured at ~313px and the whole ledger
  ending at ~745px on a 1440x800 laptop, so all four plans are in the first viewport. The licence section
  and the full terms are unchanged, just below the table.
  **What paid for it:** the plans section's own `SectionHeading` (the h1 above already names it, so
  `veloraGet.plans.title/lead` are gone from both locales and the plan names became the h2s), a shorter
  lead (its "nothing is held back" clause is stated in full in the licence section anyway), a one-line h1
  measure in both locales, and tighter header and row padding.
  **Still honest:** no checkout, no waiting list, no email capture, no CTA implying a trial can start
  today. Each row's state is the same neutral "Coming mid to late 2027" pill.
- ✅ **2026-08-10 - The four plan figures are peers.** Jenny: "why is the €40 way bigger than everything
  else." `planTable.tsx` passed `size={plan.lead ? 'lg' : 'md'}` to `Price`, and those two steps top out
  at 4.6rem against 2.6rem, so the yearly figure rendered nearly twice its neighbours. Free, €5, €40 and
  €99 are four options in one list; one at double size reads as a mistake, not as a recommendation.
  Every row is `size="md"` now, and the yearly row earns the nudge with three cues that are not type
  size and are not colour: the "Save 33%" badge (the only row with one), the two firmer hairlines
  bracketing it the way a ledger boxes a subtotal, and a lit band behind it. The band is a pseudo, so it
  can bleed past the row without dragging the ledger's hairlines out of line, it isolates its own stacking
  context (or the negative z-index falls through to behind the section fill), and its bleed stays inside
  the page gutter's minimum so 360px does not overflow. Under `forced-colors` the band drops and the
  badge plus the hairlines carry it. Checked the house landing for the same fault: its `Offer` headline
  and `ClosingCta` prices are already peers there, and €40 only appears as a small secondary tier chip.
- ✅ **2026-08-10 - Velora hero "plays from" shelf pulled.** The eyebrow plus the four servers pinned to
  the fold, where a "trusted by" logo wall would sit. Dropped at Jenny's request; the same four servers
  are argued properly in the Reach section's ledger a screen below, so nothing was lost but a restatement.
  `velora.playsFrom/playsVelora/playsSubsonic/playsJellyfin/playsLocal` removed from both locales.

## §6 Accounts and dashboard

_(nothing yet)_

## §7 Payments and licensing

_(nothing yet)_

## §8 Business prerequisites

_(nothing yet)_

## §9 Launch

_(nothing yet)_
