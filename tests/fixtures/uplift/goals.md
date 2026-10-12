# goals.md

Living roadmap for **uplift-beyond.de**, the Uplift Beyond company site (Velora + EzReplay Pro):
marketing, docs, downloads, purchase, accounts, licensing dashboard.

**Legend:** ✅ Implemented · 🚧 Partial · 📋 Planned

**Open work only.** Checking an item off means moving it to `goals-completed.md` in the same edit.
Long-form detail for an open item goes to `docs/goalsDetails/`.

**Last updated:** 2026-08-11, **a design critique of all fourteen pages, and the first pass of fixes
off it.** Two isolated reviewers, one reading the pages against the design system and one running the
mechanical detector; the machine found two things over `src/screens/pages` plus `src/assets/components`,
one of them a false positive (`Icon`'s computed `src`) and the other the nav's `max-width` transition
that §4 already tracks. The reading found more, and four of its findings are now closed:

- **The dead end at the bottom of `/get/velora` is gone.** `groupFor` in the footer matched `/velora`
  and `/velora/*`, so the page where a convinced buyer stands had no Velora group at all: it now takes
  a list of prefixes and `/get/velora` is one of them. The close section gained the one thing that is
  genuinely available (the installer, as a `secondary` ask, since the page's own ask is the one it
  cannot offer) plus the documentation and product links the download page already carried. The lead
  says what the button does rather than ending on "come back when it ships".
- **`primitives/closeLinks`**, replacing the row copied across **eleven** page stylesheets. The gap is
  the one eight of them already used (`--gap-xs` / `--gap-xl`, column under 34rem); the three outliers
  lost a larger row gap that only showed while wrapped. designsystem §22.1 is closed to the fact-link
  row, which is still copied seven times.
- **Every route has its own title.** `ui/page` writes `document.title` from an optional `title` prop
  (`page.title.*` in both locales, the legal four off their own doc titles), so a tab, a history entry
  and a bookmark stop reading "Uplift Beyond" fourteen times. The real per-route `<head>` still waits
  on §1's static rendering; this is the client-side half and it is not blocked on it.
- **The accent stopped being spent five times on the landing.** `Offer` takes a variant, `ui/productPanel`
  passes `primary`, and the closing fork keeps the accent, because a panel is what a reader passes on
  the way to the decision. §22.5 is settled in the same pass by widening the rule to **the page's one
  primary ask** (so `/support`'s bug report qualifies) with **one per page** as the binding half.

Plus: `/support`'s `mailto:` has a fallback, since a machine with no mail handler answered the page's
one ask with nothing at all (a copy-the-address control beside it, on a new `useCopy` hook that
`primitives/code` now shares); `EZREPLAY_APP_URL` was written in three page files and is now
`utils/links.ts`; `.62` opacity in `factList.css` and `offer.css` moved to the body rung; the hero
hint's `0.85` became a named custom property, since the label divides it back out and nothing pinned
the two together; and `offer.tsx` keyed its tier list on the figure, which collides if two cadences
ever share one.

**The landing hero was rebuilt and reverted the same day.** The h1 became the positioning sentence
with the wordmark demoted to a lockup beside the mark; Jenny preferred the original, so the wordmark
is the h1 again at display scale and `PageHero`'s `lockup` slot came back out with it. The finding
behind it stands and is open below: the first viewport names no product and both its buttons are
scroll anchors. Detail in `goals-completed.md` §5.

Before that: **the site can be switched to German by hand, not only by browser.**
Detection was already wired and had no visible control, so the two locales were reachable only by
changing the browser's own language. A `LANGUAGES` registry in `src/locales/` (id plus the name written
in that language, which is why the names are not locale keys), a `ui/langSwitcher` beside the theme one,
and a globe in the nav pill with the same flat list in the mobile panel. The pane itself extracted to
`ui/switcher` (escape, outside-click, focus return, the row styles) rather than copied, which is also
the shape §2's layout axis lands in.

The review pass killed the two i18next claims this entry first made, both measured against the real
config rather than read off the docs. **German detection was never broken:** i18next already strips
the region when matching `supportedLngs`, so `de-DE`, `de-AT` and `en-GB` always resolved right. What
`load: 'languageOnly'` actually changed was `i18n.language`, `de` to `de-AT`, and `<html lang>` was
written from it, so the page announced Austrian German while serving the generic bundle. The attribute
now comes from `resolvedLanguage`; the option stays for what it really does. **The cookie cache was
never on:** `caches: ['localStorage']` is the detector's default, so it pins a default rather than
dropping a cookie. `npm run check:i18n` is the guard (key parity plus resolution for `de-DE`, `de-AT`,
`en-GB`, `fr-FR`), and it fails on the old handler, which is the only reason to trust it.

Five more fixes: picking a row dropped focus to the document (the Escape path already guarded that,
the pick path did not); the outside-close listened on `pointerdown` only, so tabbing to the other
switcher and pressing Enter left both panes open, now a `focusin` guard; `.langCode` multiplied
`--ink-meta` by the button's own `.8` and rendered at `.44`, under the ladder's floor, so size and
tracking carry the demotion instead; the mobile panel gained a second group with no `max-height`, so
at 360x640 the theme rows fell past the viewport unreachable; and the marker column became
`.switcherRowMarker`, so the swatch and the code stop being two 16px literals that have to agree.

Before that: **the theme axis is built and the site has three of them.** `html.<theme>`
token overrides, exactly what designsystem §18 was written for: a registry in `assets/site/themes.ts`,
one block per theme in `themes.css`, `usePresentation` holding the active one (persisted, and readable
from `?theme=` so a preset is a link), and a switcher in the nav pill. `ink` is today's look and has no
block at all. `warm` is **three declarations**, because every tint on the site is a `color-mix` of
`--color-white` or `--color-background`, so two values carry the hairlines, fills, glass and panes with
them. `light` is the one that inverts, and it is what found the seam that was actually broken:
hierarchy here is `opacity` on the ink, and opacity buys its contrast against the ground, so the `.55`
rung measures 5.9:1 on the dark theme and 4.1:1 on a light one, under AA for small text. That is a
component edit a theme needed, which the §18 contract says is a broken seam, so the two quiet rungs
became `--ink-meta` and `--ink-faint` across 32 call sites and the light theme raises them. Writing
`scripts/check-themes.mjs` (it measures every theme's ink, both quiet rungs, the accent and the primary
button) then caught a real bug that predates the themes: the accent ask's label followed `--color-white`
while its fill never moves, so it read 4.2:1 on the cream theme and 3.7:1 on the light one. All three
themes now clear the floor. The nebula moved into the token layer with everything else, so each theme
brings its own atmosphere and the canvas cross-fades between them.

Before that: **the repo was audited against `docs/designsystem.md` and the drift is
closed.** The document was written from the code, so this was the first pass the other way: machine
checks for raw values, untokenized durations, page-scope tokens, guard parity, opacity lifts, breakpoint
reuse, locale parity and landmark names. Most held. Eight code fixes: `.sectionHeadingLead` and
`/`'s scroll hint were carrying a `.66`/`.6` opacity with no `html[data-high-contrast]` lift, which on
the section lead meant every heading block on the site; `--glass-surface` resolved to the ported app's
translucent grey under `data-reduce-transparency`, so the one token that had to end up solid did not;
`footer.css`, `boundaryMap.css` and `docsLayout.css` guarded their transitions with the media query only
or not at all; `offer.css` and `button.css` held the last two raw `rgba()`s outside the token layers;
and the nav's phone step was written `33.99rem` instead of the site's `34rem`. Ten `<Section>`s shipped
with no accessible name, because they deliberately carry no heading (the `h1` above names them and the
plan or platform names are the `h2`s) and `labelledBy` was the only way to name one, so `Section` grew
a `label` prop and six `common.region.*` keys in both locales. Four corrections went the other way,
into the document: the box-shadow rule named one shadow where three ship, the breakpoint table missed
five queries in use, the page-comment block was claimed for fourteen pages where `/legal` and the 404
were short two parts each (now written), and §22's Pill contradiction was four call sites where the
rule's own list already covers two of them.

Before that: **`docs/designsystem.md` is written out in full.** The seeded file became
the real reference, read off the code: two token layers and which wins, the site's own fluid type scale
and its opacity ladder (with the ported app utilities named as the wrong scale to reach for), the three
accent roles and their non-colour cues, the surface and spacing recipes, the double reduce-motion guard
this site needs because nothing writes `data-reduce-motion` yet, the page scaffold and the
`--page-hero-*` knobs, fourteen recipes, the primitive and region inventory, traps, a pre-ship
checklist, and the seven known duplications collected in one place. `CLAUDE.md` already points at it.

Before that: **`/support` exists, and Velora's own link to it now lands.** The app's
About panel ships three links to this site and two of them 404: `/support`, labelled "Report a bug", is
answered now. One page rather than a help centre: a prefilled bug-report mail (`mailto()` in
`utils/contact.ts`, subject and body from the locale files, so the template arrives in the reader's
language), a checklist of what a report needs, the four other reasons people write (a code that will not
activate, a feature idea, a security issue, a data or legal question), and the way out. No form, because
there is no backend to post one to. `/docs`, the third link, is still a 404 by decision.
Review pass on the same change fixed four things: the footer address was losing its own opacity to
`.houseFooterLink` (same specificity, declared earlier), `index.html`'s new site-wide canonical pointed
every route at `/`, `/velora`'s "you host one" headline still described the backend in the present tense,
and `mailto:` was being rebuilt by hand next to the `mailto()` that exists for it.

Before that: **the Velora backend stops being described as available.** It is not
finished: a TypeScript server today, being rewritten in Java, arriving mid to late 2028, a year after the
client. Six strings across `/`, `/velora`, `/get/velora` and `/velora/documentation` said otherwise in the
present tense, and now say what is true. The third-party servers lead every reach list, because for
Velora's whole first year they are the only servers there are. See the pricing block below for the rule.

Before that: **`/about` names the two side projects.** One short section between the
working ledger and the client paragraph: Specula (self-hosted Minecraft server panel plus Discord bot,
architecture decided, no code) and BeyondUI (the component library being pulled out of the repeated
pieces). Neither needs a licence key, so neither is a `PRODUCTS` entry and neither gets a page: the
section says that in its lead, which is what keeps it from becoming the portfolio the Scope rule bans.
BeyondUI's mark joined the family (`primitives/logo` grew a fourth id, master plus 512 cut in
`public/logos/`); Specula has no mark yet, so its row starts with its name and the mark rides the name
line as an inline glyph rather than sitting in a column that would be empty for half the list.

Before that: **the legal four are routed, as drafts that say so.** `/legal/impressum`,
`/privacy`, `/terms` and `/refund` are one page over a `LEGAL_DOCS` registry (a slug plus ordered clause
ids; the text is in the locale files, because the German version is the legally relevant one). Every one
of them opens on a placeholder notice, then numbered clauses written from the business as it stands
today: nothing purchasable, no accounts, no analytics, not deployed, address and VAT pending the
Gewerbeanmeldung. Bare `/legal` redirects to the Impressum and anything else under it still 404s. The
binding texts stay §8's job. Detail in `goals-completed.md` §5.

Before that: **the support address is decided and on the site**: `admin@uplift-beyond.de`,
once in `utils/contact.ts`, on every route through the footer's brand block and interpolated into
`/about`'s inbox entry in both locales. That closes the last hole in the support claim. The Impressum's
postal address (§8) is a separate question and still open. Detail in `goals-completed.md` §5.

Before that: **`/about` is in, and every URL now lands somewhere.** The founder
surface argues the differentiator instead of announcing it: how both products actually started, a
four-entry ledger of what buying from one person gets you *and* what it costs you (including the
AI-tooling entry, which ends on no AI-generated images or video anywhere), and the client-work
paragraph that hands off to the portfolio. A catch-all route ends the blank page: the
legal four and every mistyped URL land on a real 404 wearing the site's own furniture. The landing's
maker CTA now points at `/about` rather than off-domain, so `/about` is the site's only portfolio
link. One extraction on the way: the marketing paragraph became `primitives/prose`. Detail in
`goals-completed.md` §5.

Before that: **a whole-repo review pass.** Machine-checked the cross-cutting
invariants and they hold: no undefined token, no site token declared in a page scope, both locales
at 898 keys with every `t()` call resolving, every internal link served by `app.tsx` except the four
already-known 404s. Four real defects fixed: the favicon was the 1.15 MB master, `<html lang>` never
followed the detected language, Escape on the mobile nav panel dropped focus to the document, and an
external `TextLink` did not announce its new tab the way `Cta` does. Plus dead weight removed
(`createFrameThrottle`, `.buttonBlock`) and `docs/designsystem.md`'s mono claim corrected.

Before that: **Velora's two public developer contracts are documented.**
`/velora/documentation` is a hub that forks to `/velora/documentation/plugins` (SDK 2.6.0) and
`/velora/documentation/desktop-api` (loopback protocol v3), both written from the implementation and
complete enough to build against without the private repo. `/velora/docs/*` redirects to the long
spelling. The footer grew a **route-aware product group**, so `/velora/*` gets a Velora column and no
other route changes. Three new components (`primitives/code`, `primitives/dataTable`, `ui/boundaryMap`
plus `ui/docsLayout`) and `Section`'s new **`bleed`** modifier, which finally absorbs the nebula fade
that was copy-pasted in three pages. Detail in `goals-completed.md` §5.

Before that: **the buying surfaces are in and the purchase routes moved.** `/get` is a
new house-level chooser, and each product's ledger now hangs off it: `/velora/get` became **`/get/velora`**
and the new `/get/ezreplay` sits beside it. The nav's persistent ask points at `/get` and says "Pricing",
so it is no longer one product's link. `/ezreplay` is built too, so the nav and footer have no dead link
left except `/about` and the legal four. Detail in `goals-completed.md` §5.

Before that: **`/velora/download` is in**: the Windows installer is downloadable now,
the page says plainly that the app opens on an activation gate and that codes are sold from the mid to late 2027
release, and `/velora`'s platforms column links to it. Detail in `goals-completed.md` §5.

Before that: **the per-product brand axis was dropped**: one look for the whole site.
`assets/brands/` and `ui/chrome/chrome.css` are gone, the site's tokens live once on `:root` in
`assets/site/site.css`, `ui/page` is the shell every page renders in, and `bloom` is the only reveal.
`/velora` and `/get/velora` now wear exactly what `/` wears. Detail in `goals-completed.md` §3.

---

## Open decisions (blocking their sections)

- 📋 **Auth provider.** Better Auth on own Postgres (self-hosted streak, drops into the existing Fastify
  server, TOTP patterns reusable from Velora) vs Supabase EU/Frankfurt (auth + email verification + RLS in
  one, fastest, but a second datastore and another DSGVO subprocessor). Deferred by Jenny on 2026-08-10.
  `IBackend` + `useSession` is the seam that keeps this cheap, so §5 and §6 can be built against the mock
  before it is answered. Blocks §6 only.

## Decided 2026-08-10

**Build:** plain Vite SPA on Velora's stack, `tsc -b && vite build` · website first with the API contract
stubbed · self-hosted, joining Velora's n8n deploy · self-hosted Plausible (cookieless, so no consent
banner). `vite-react-ssg` was the original pick and was dropped on 2026-08-10: it still imports
`react-router-dom/server.js`, which react-router v7 removed, so it cannot prerender against v7 and its
own README now points v7 users at react-router's built-in SSG. Static rendering is deferred, see §1.

**v1 is the public site, no accounts:** house landing, `/about`, both product landings, legal pages,
presentation system, motion system. None of it is blocked on auth, Paddle, or the Gewerbeanmeldung.

**Scope: this site sells products, it is not a portfolio.** Uplift Beyond also builds things for other
people (a nail studio site, more coming) and those sites credit `uplift-beyond.de` in their footer, so a
visitor can arrive expecting a builder and meet a music player. The portfolio at
`jenny.uplift-beyond.de` already **is** that surface, so this site never grows a second one: no `WORK`
array, no `/work` route, no case studies, no client logos. `/about` carries one paragraph naming the split
and handing off, **attribution only** (no ask, no rates, no contact CTA) and clients **described, not
named**. Point the client sites' footer credits at the portfolio subdomain, not this domain's root: their
visitor is asking who built the site, and the portfolio is what answers that. The same test sorts every
future project: needs a licence key, it is a product and gets a `PRODUCTS` entry; built for someone else,
it goes on the portfolio and this repo never hears about it.

**Language:** auto-detect. Serve `/en/*` and `/de/*` with `hreflang` alternates plus `x-default`,
and redirect `/` on `Accept-Language` server-side. That is the one shape that gives auto-detect without
losing a stable canonical per page.

**Commerce:** trial needs an account but no card, so the email is captured for a day-10 nudge ·
99 € Lifetime covers all future Velora versions forever (low risk, Velora is finished) · EzReplay's free
tier keeps everything it has today and Pro only ever adds · no bundle, priced separately ·
`/get/velora` is built as the real pricing table from day one and simply cannot transact until Paddle
and the paperwork are done.

**Design: one website, one look.** The per-product brand axis was built and dropped on 2026-08-10
(`goals-completed.md` §3): every route wears the same ground, accent, glass, radius, motion and nebula.
The look is **monochrome at the base, plus one accent reserved for commercial emphasis** (pure
monochrome spent contrast evenly and the prices drowned). The accent is sampled from the Uplift mark's
own violet, lives in `--accent-emphasis*` on `:root`, is spent on three roles only (price figure,
primary ask, live status pill), and every accent distinction carries a second non-colour cue.
`--color-accent-solid` stays white. Detail in
[`docs/goalsDetails/site-look.md`](./docs/goalsDetails/site-look.md) ·
**don't add gradients**, default new surfaces to solid, and any
new one has to be really subtle; the existing ones (logo marks, nebula, `--surface-bg`) are Jenny's and
stay · the Uplift mark is a **flower**, and petals opening is the motif that drives the motion ·
the three marks are one purple family and are the only thing that changes between product pages ·
3 themes and 2 layouts in the switcher.

**Content:** docs are markdown in this repo · changelog is hand-curated per release ·
support is email only, which also satisfies the Impressum's fast-contact requirement.

**Domains:** apps keep their homes. `uplift-beyond.de/ezreplay` is the marketing and purchase page,
`ezreplay.net` keeps serving the app, and its old landing redirects to the new page so SEO consolidates.

## Pricing (decided 2026-08-10)

| Product | Tiers |
|---|---|
| **Velora** | 14-day trial · 5 €/month · 40 €/year · 99 € lifetime |
| **EzReplay Pro** | Free tier today · Pro later at 5 €/month · 40 €/year (no lifetime) |

Yearly is 40 € against 60 € monthly, so the annual saving is 33%. Say that on the page; it is the
strongest nudge on a pricing table and it costs nothing to state.

**Conflict to fix in the backend:** `velora-license-server/src/db.ts` hardcodes `TRIAL_DAYS = 7`. The
trial is 14 days, so that constant and any copy derived from it change together. Tracked in §7.

The Velora **client** is **finished and will not be reworked**, so the site describes a settled product, not a
moving target. Its **release is mid to late 2027**, so every surface says "Coming mid to late 2027" and no Velora CTA
may promise a trial that can be started today. EzReplay is the one still changing (React/TS rewrite,
Pro tier later).

**The Velora backend is the half that is not finished** (decided 2026-08-11). It is a TypeScript server
today and Jenny is rewriting it in Java, so it arrives **mid to late 2028**, a full year after the client
ships. It is also **not open source yet**: that is a promise about the Java one, so every surface says
"will be", never "is". The site had been describing it in the present tense on four surfaces, which sold a thing that does
not exist yet; that is corrected. The rule from here: **no surface describes the Velora backend as
available.**

The year-long gap is the part with consequences, because for its entire first year Velora is a paid client
with no Velora server behind it. The Subsonic family, Jellyfin, Emby and local files are not a fallback in
that window, they are the whole product, so they lead every "what does it work with" list and the pricing
page's licence facts. Three knock-ons: `/velora/documentation` says the plugin **server** contract is
unsettled while the rewrite is open, a backend self-hosting page cannot be written until the Java one
exists, and §7's launch checklist should confirm no purchase surface implies the Velora server is part of
what 99 € buys on day one.

## §1 Foundation

- ✅ Scaffold installed and building (see `goals-completed.md`). `vitest` is the one piece left out: no
  test exists yet, so it goes in with the first one.
- 📋 **Static rendering, still open.** The build is a plain SPA today, so a crawler and a link preview get
  an empty `#root`. That is fine while nothing is public and not fine at launch. Candidate: react-router
  v7 framework mode with `prerender`, which is where the ecosystem went. Decide before §9.
- 🚧 `index.html`: title, description, `theme-color`, favicon, `viewport-fit=cover` and now the Open
  Graph and Twitter card defaults, so a pasted link previews as the mark and the description instead of
  a bare URL. Two things are still open on it: the card image is the square 512px mark rather than a
  real 1200x630 card, and `og:url` is hardcoded to the domain root because a SPA has one head. The
  matching `<link rel="canonical">` was written and then **removed in review**: one head serves every
  route, so a canonical pointing at `/` tells a crawler that `/velora`, `/support` and the legal four
  are duplicates of the front page, which is strictly worse than no canonical at all. It comes back
  per-route with static rendering. Until then the defaults in `index.html` are all a crawler sees.
- 🚧 **Per-route titles are live, per-route meta is not.** `ui/page` takes a `title` and writes
  `document.title` in an effect, off `page.title.*` in both locales (the legal four use their own
  document titles). That fixes the reader's half, fourteen tabs, history entries and bookmarks that
  all read "Uplift Beyond", and it deliberately does not touch the crawler's half: one head still
  serves every route, so description, canonical and OG stay in `index.html` until static rendering
  lands. The `title` prop is the seam that hands over to it.
- ✅ `src/index.css` copied from Velora (tokens + utilities + a11y layers, the single source of truth).
- ✅ Outfit variable font self-hosted in `public/fonts/`.
- ✅ Nebula background ported (`src/assets/backgrounds/nebula/nebula.tsx`) with an adapted
  `backgroundQuality.ts` seam (module state + setter, no settings store yet).
- 🚧 `docs/designsystem.md` **is the full pass over what is built** (2026-08-11), written from the code
  rather than from a plan and structured like Velora's `designsystemV2.md`: golden rules, the two token
  layers and which one wins, the site's own type scale and opacity ladder (the ported utilities are app
  scale and are named as dead weight here), colour, surfaces, spacing, radius, icons, interaction,
  motion, breakpoints, page anatomy, recipes, a component inventory, i18n, naming, the accessibility
  floor, traps, a pre-ship checklist, and the known duplication. Open on it:
  - 📋 **The layout chapter cannot be written yet.** §18 is now the theme chapter (the pieces, what a
    theme has to override, the contrast floor); the layout half lands with its registry.
  - 📋 **The Pill rule contradicts the code**, on two call sites rather than the four first written
    down: §14.4's list already names a plan row's state and a download row's platform, so `ui/planTable`
    and `/velora/download` are covered. What it does not name is a pill in a page **header**
    (`/get/velora`) or on a chooser's **fork row** (`/get`). Both are "a product's availability", which
    is the rule's stated principle, so the example list is what is stale. Either add those two shapes
    to it or delete the pills.
- 🚧 i18n bootstrap: `i18next` + browser language detection is wired (`src/i18n.ts`, `de` + `en`, the
  registry in `src/locales/languages.ts`), `<html lang>` follows the resolved language, and the visitor
  can now override it in the nav (`ui/langSwitcher`, persisted to localStorage by the detector, and
  `?lng=de` works as a shareable link the way `?theme=` does). Open on it:
  - 📋 The routed half waits on static rendering: `/en/*` and `/de/*` with `hreflang` + `x-default`,
    `/` redirecting on `Accept-Language`. Until then the switcher is the whole mechanism and a language
    has no URL of its own, so a German page cannot be linked to or indexed as one.
  - 📋 The switcher writes only i18next's own state, so nothing tells a crawler or a returning visitor
    on a different device. That is the same question as the routed half and lands with it.
  - 📋 The **docs pages are English in both locales** (§5), so switching to German on
    `/velora/documentation` changes the chrome and nothing else. The switcher makes that visible in one
    click, which is an argument for deciding it rather than leaving it.
- 🚧 Image pipeline. Done: all four marks have a 512px cut (`public/logos/*-512.png`) and `primitives/logo`
  points at those, so Velora's mark went 3.7 MB to 54 KB, Uplift's 1.2 MB to 111 KB, EzReplay's 570 KB to
  82 KB and BeyondUI's 946 KB to 97 KB. The 2000 to 4000px masters stay put as the source. Still open:
  - 📋 The two product shots in `public/pictures/` (`velora_playlist.png` is 1.6 MB and now loads on two
    pages): resize plus WebP/AVIF next to the PNG.
  - 📋 **A small cut, for the marks used as inline glyphs.** `/about`'s side-projects list draws
    BeyondUI's mark at `1.15em`, roughly 18 CSS px, and pays 97 KB of 512px PNG for it. 512 is the right
    size for a hero and ~28x oversampled for a glyph, so the set wants a 64px cut (or the white SVGs,
    below, which solve it outright). Lazy and below the fold, so it is weight rather than a stall.
  - 📋 The rest of the mark size set (favicon, apple-touch, OG, PWA) and WebP/AVIF for the marks.
    `index.html`'s `<link rel="icon">` was still the 1.15 MB master and now points at the 512px cut
    (found in review), so this is no longer urgent; a real `.ico` plus apple-touch sizes still are.
  - 📋 Wire the white SVGs for the small sizes once Jenny adds them under the same filenames.
- ✅ Legal-safe font hosting: Outfit **and Inconsolata** self-hosted, no third-party CDN.
- 📋 Self-hosted Plausible on the same box as the site. Cookieless, so no consent banner, but it is still
  a subprocessor-free entry that belongs in the privacy policy as first-party analytics.

## §2 Presentation system (theme / layout)

The site is the demo of how customizable Jenny's apps are, so this is core architecture, not polish.
Two axes, since the brand axis was dropped: theme and layout.

- ✅ The theme half is built: registry, `usePresentation`, three themes, the nav switcher and a
  contrast check (see `goals-completed.md` §2). The layout half is what is left.
- 🚧 `usePresentation` holds the theme, persisted and hydrated from `?theme=`. It grows `layout` and
  `?layout=` with the registry below, which is why it is not called `useTheme`.
- 📋 Layout registry: named section arrangements a page can render itself with. A page declares its sections;
  the layout decides the arrangement. No page hardcodes an arrangement. **2 layouts** at v1.
- 🚧 The switcher exists for themes (`ui/themeSwitcher`, an icon button in the nav pill, flat in the
  mobile panel) and the disclosure under it is now shared (`ui/switcher`), since the language switcher
  wanted the same one. Open on it:
  - 📋 It takes the second axis when layouts land. The language switcher answered half of the question
    by precedent: **a second button, not a second group in one pane.** Layouts are the harder call, since
    theme and layout are one preset and language is not, so a grouped pane is still arguable there.
  - 📋 Three icon buttons plus the ask is what the nav bar carries at 48rem, where the centred link row
    is absolutely positioned and can collide with it. Adding the layout toggle to the bar wants the
    inline width measured first, in German, where the labels are longest.
  - 📋 The store's class write and the `?theme=` read both touch `document`/`window` at module import,
    which is exactly what static rendering (§1) cannot do. Guard it when that decision lands.
  - 📋 It is discoverable but unproven: an icon in a bar is a weak signal for what is supposed to be a
    selling point. The landing's "Make it yours" section below is the surface that would actually sell
    it, and that is a §5 item.
- 📋 Verify a **layout** swap needs zero component edits. The theme half is verified: `warm` is three
  declarations and `light` is nine, no component was touched for either, and what a theme has to
  override is written down in designsystem §18.2.
- ✅ A theme reaches the shared nav and footer for free, as designed. Keep the other half of the rule
  when the layout registry lands: **a page scope never declares a site token**, or it starts reshaping
  the chrome under itself, which is exactly what the dropped brand axis did.
- 📋 **A third and fourth theme are cheap now, and that is the point.** `#121212` (EzReplay's plain
  dark) was the one palette from the ported set that did not ship, because it sits between `ink` and
  `warm` and adds a row without adding a look. A high-contrast or a pure-black theme would each earn
  their place; run `npm run check:themes` before either ships.

## §3 Product content registry

The looks half of this section is finished by deletion (`goals-completed.md` §3): there is one site look
and a product does not get its own. What is left is the **content** registry.

- 📋 `src/products/` registry (`PRODUCTS`), one module per product: marketing section kit, docs tree,
  download feed shape, purchase config, mark id, route prefix. **Content only.** No token pack, no font,
  no background palette, no motion feel: those are the site's and live in `assets/site/site.css`.
  A registry entry that reaches for a colour is the dropped brand axis coming back.
- 📋 Routes, nav, the landing page and (later) the dashboard's licence list read `PRODUCTS` instead of
  hardcoding "velora" and "ezreplay". `/velora` and `/get/velora` are hand-composed today; folding them
  into the registry is what makes `/ezreplay` additive rather than a third hand-written page.
- 📋 Check the seam: adding a third product must be one entry plus its content, with no new branch and
  no CSS anywhere.
- ✅ Inconsolata self-hosted alongside Outfit (see `goals-completed.md`).
- 📋 Decide `ezreplay.net` vs `uplift-beyond.de/ezreplay`. The standalone domain is live with its own
  canonical and sitemap; coexisting splits SEO unless one canonicalises to the other. Blocks §5's
  EzReplay page.
- 🚧 EzReplay's purchase model. Decided on 2026-08-10 far enough to unblock the page: **the free tier
  is the real ask and Pro is listed as planned**, so `/get/ezreplay` renders Free as the live lead row
  with the app itself as its one control, and 5 €/mo plus 40 €/yr underneath carrying a planned state.
  Still open: **what Pro actually contains**. The page says outright that this is undecided, so
  deciding it is a copy change on one fact list, not a rebuild.

## §4 Motion system

Premium is the goal, and premium comes from craft and restraint, not volume. This is core, not polish.

- 📋 Shared spring + reveal built on the duration tokens. No per-component magic numbers. `utils/motion.ts`
  has the spring, `bloom`, the viewport rule and the two stagger helpers; the durations are still literal
  seconds there rather than the `--duration-*` tokens.
- 📋 Keep it **one** reveal. `bloom` is the site's, the landing hero has its own opening because a hero is
  a hero, and that is the whole budget. A second general-purpose reveal feel is how the site stopped
  reading as one site the first time (`goals-completed.md` §3).
- 📋 Scroll reveal primitive: runs once, viewport-aware, off-screen animation paused, `transform`/`opacity`
  only. Anything animating layout, filter or shadow gets measured first.
- 📋 **Measure the nav's settle transition.** `nav.css:23` transitions `max-width` on `.houseNavStack`,
  which is a layout property, and the element it resizes is the parent of the backdrop-filtered
  `.houseNavShell`, so every frame relayouts and re-rasterises a 50px blur. It is one shot at one
  scroll threshold, not per frame, and `max-width` is the only way to shrink a centred pill without
  distorting its text (`scaleX` squashes it, `scale` blurs it), so it stays until measured rather than
  being swapped for a worse-looking equivalent. This is exactly the case the house rule means by
  "measure it first".
- 📋 Hero motion. The hero is the one place allowed to be genuinely expensive.
- 📋 `data-reduce-motion` audit: decorative motion skipped entirely, page still makes sense with it all off.
- 📋 Motion budget check before each landing page ships (page weight, dropped frames on a low-end device).

## §5 Public site

- 🚧 `/` landing: built, including the conversion layer (persistent nav CTA, a price and ask on
  each product panel, a closing decision section) and the 2026-08-10 hierarchy pass that gave the
  commercial surfaces their weight. Both real screenshots are in
  (`public/pictures/{velora,ezreplay}/`). Still open on it:
  - 📋 The **"Make it yours" section is pulled, and half of what it was waiting for now exists.**
    `ui/tokenProof` and the `landing.customization.*` strings are still in the repo untouched. The
    theme axis is real and switchable (§2), so the section could go back today against themes alone;
    it was left out on purpose, because the proof tiles argue *two* axes and a landing section that
    demonstrates one and promises the other is weaker than one that waits for layouts. Put it back
    when the layout registry lands, or rewrite the tiles for themes only. Jenny's call.
  - 📋 Optimise the two screenshots before launch. `velora_playlist.png` is 1.6 MB, which is most of
    the page weight; it wants a resize plus WebP/AVIF next to the PNG. Folded into §1's asset pipeline.
  - 📋 **The first viewport names no product, and both its buttons are scroll anchors.** The critique's
    top finding (2026-08-11): the largest type on the site is a company name a first-time visitor has
    never heard, the sentence that explains the business is an eighth its size, and `#products` and
    `#maker` both only move the page. The fix that was tried, the sentence as the h1 with the wordmark
    demoted to a lockup beside the mark, was **built and reverted**: Jenny prefers the wordmark hero,
    which settles the look and leaves the payload question open. So the axis to move is content, not
    composition: name both products in the lead, or give the secondary ask a real destination (the one
    product anyone can use today is free, finished and one click away). Not the h1.
- 📋 Hero header modeled on EzReplay's (eyebrow tagline, enormous wordmark sliding up on load, two-line
  positioning sentence, twin CTAs, mono scroll hint, nav that gains glass on scroll), but with the nebula
  background instead of its looping video. **A starting point, not a decision**, and everything below the
  header goes its own way. See [`docs/goalsDetails/site-look.md`](./docs/goalsDetails/site-look.md).
- 🚧 `/about` built, and the 404 route with it (see `goals-completed.md`). Open on it:
  - 📋 The tab title is set (§1). Per-route meta on either page still needs the static-rendering
    decision in §1, and the 404 also answers **HTTP 200** until then, since a SPA's catch-all is a client-side route; a crawler
    reads that as a real page. Fixing it properly is a host rule, so it belongs with §9's deploy.
  - 📋 Hand-composed, like every other page. Folds into the registry's section kit when §3 lands.
  - 📋 The side-projects section is **two entries and stays that way**. It is the one place on the site
    that names work which is not a product, so it is also the easiest place for the Scope rule to erode:
    a third entry, a link out, a screenshot or a status pill turns it into the portfolio the rule bans.
    Name plus one line, or move it to the portfolio.
  - 📋 **The side project is now called Specula** (renamed from Velto on 2026-08-11). Renaming it again is
    one locale key in each file plus the `id`/`name` pair in `aboutPage.tsx`, not a rebuild, but the site
    is the thing that makes the name public, so its own repo has to match.
  - 📋 BeyondUI has no note in the second brain and no repo, only a mark. The one line on the page is the
    whole spec; write the note when there is more than that to say.
- 🚧 `/support` built as the site's one help surface (see `goals-completed.md`). Open on it:
  - 📋 **`uplift-beyond.de/docs` still 404s.** Velora's About panel links it beside `/support`, and it
    is left broken on purpose for now: only Velora has documentation, so the honest destinations are
    either a redirect to `/velora/documentation` or a real house-level hub, and that is a §3 question.
  - 📋 The reply-time claim is "not always the same day", the same words `/about` uses. It is the only
    promise on the page, so if it ever stops being true both surfaces change together.
  - 📋 The tab title is set (§1); per-route meta still needs static rendering (§1).
  - 📋 A prefilled `mailto:` is the whole mechanism, and it now has a fallback beside it: a machine
    with no mail handler registered answered the page's one ask with nothing at all, so a
    copy-the-address control sits next to it (`utils/useCopy.ts`, shared with `primitives/code`). A
    real form only becomes worth it if the inbox starts getting reports too thin to answer.
- 🚧 `/velora` product landing built (see `goals-completed.md`). Still open on it:
  - 📋 The servers list leads with the one option that does not exist. "Velora backend" is first and
    called the primary one, and it is now also the only one of the four carrying a "not finished" line.
    That is honest but it is a weak opening; if the Java rewrite slips again, move it below the three
    that work today rather than softening the sentence.
  - 📋 `velora_playlist.png` is the page's whole weight budget. Same §1 asset item as the landing.
  - 📋 The tab title is set (§1); per-route meta still needs static rendering (§1).
  - 📋 Its sections are hand-composed. They become the registry's section kit when §3 lands, which is
    also what makes `/ezreplay` additive rather than a second hand-written page.
- 🚧 `/ezreplay` product landing built (see `goals-completed.md`). Still open on it:
  - 📋 One screenshot only (`ezreplay_app_empty.png`), and it is the empty state. A shot with a real
    note and a timestamp pill in it would carry the argument far better.
  - 📋 The tab title is set (§1); per-route meta still needs static rendering (§1).
  - 📋 Hand-composed, like `/velora`. Both fold into the registry's section kit when §3 lands.
- 🚧 `/velora/documentation` built as a hub over the two public contracts (see `goals-completed.md`).
  Open on it:
  - 📋 **`@velora/plugin-sdk` is not published to npm.** The plugins page documents
    `npm i @velora/plugin-sdk` per Jenny's 2026-08-10 decision, so publishing it is now a prerequisite
    for that page being true. Until it ships, the setup section is the one thing on either reference
    page that is not verifiable against something that exists.
  - 📋 **A plugin's server half is going to move.** The scope note now says the backend is being
    rewritten in Java, so that contract is unsettled. When the rewrite settles, re-check whether the
    client SDK moved with it; a plugin page documenting a contract the server no longer honours is
    worse than no page. A backend self-hosting page waits on the same thing.
  - 📋 The hub's four count figures per contract (13 points, 10 permissions, 22 hooks, SDK 2.6.0 /
    15 endpoints, 17 commands, protocol v3) are the page's proof and are hand-counted. They need
    correcting whenever either contract grows.
  - 📋 **The German half of all three pages is English** (found in the design-system audit). Key parity
    holds, so nothing warns: `de.json` carries all 481 `docs`/`docsIndex`/`desktopApi`/`plugins` keys
    and every one of them is the English string, byte for byte. Every other group on the site is really
    translated. That is defensible for a developer reference and it is still the one surface where
    switching to German changes nothing, so it is a decision to make rather than an oversight to leave:
    translate them, or say on the hub that the reference is English only.
  - 📋 Tab titles are set (§1); per-route meta on all three still needs static rendering (§1).
    Docs are the pages most likely to be found by search, so this matters more here than elsewhere.
  - 📋 Both reference pages are hand-composed, like every other product page. They fold into the
    registry's section kit when §3 lands.
- 📋 `/ezreplay/documentation`: EzReplay has no public contract yet, so this waits on there being
  something to document. When it lands, the footer's `PRODUCT_GROUPS` map takes one more entry.
- 📋 Docs search. Two pages do not need one; a third or a real docs tree does.
- 🚧 `/velora/download` built (see `goals-completed.md`): the Windows installer is the accent ask, the
  browser at `velora.uplift-beyond.de` sits beside it as the quiet one, Android wears a status chip, and
  the page states the activation gate both of them open on. Open on it:
  - 📋 The installer URL is a hand-written constant. It becomes the update feed (`latest.yml` sits beside
    the `.exe` at the same URL, so the version and the file name are already published) once there is a
    feed reader, which is also what makes a version and a release date printable on the row.
  - 📋 `Velora-Setup.exe` has to exist at that path: electron-builder names its artifact
    `Velora-Setup-${version}.exe`, so the unversioned link needs a copy or a rewrite rule on the box.
  - 📋 The installer is unsigned, so the page carries a SmartScreen note. Signing it deletes that fact.
  - 📋 The tab title is set (§1); per-route meta still needs static rendering (§1).
- 📋 `/velora/changelog`: generated from the per-commit `package.json` bumps.
- 🚧 The buying surfaces `/get`, `/get/velora` and `/get/ezreplay` are built (see
  `goals-completed.md`). Still open across them:
  - 📋 Tab titles are set (§1); per-route meta on all three still needs static rendering (§1).
  - 📋 Flipping `/get/velora` from placeholder to real purchase is §7's last item, and
    `/get/ezreplay`'s two planned Pro rows go live with whatever §3 decides Pro contains.
  - 📋 `/get/velora`'s fold budget is unverified in a real browser. It is designed to 600px of visible
    document at 1280x720 and computed, not measured; Jenny verifies visually. Between 768px and
    ~840px wide the plan lines wrap to two and the last figure lands near 615px. At 360px only the
    first two or three figures fit a phone screen and the rest is one short scroll, which is as good
    as four priced rows get without shrinking type below reading size. `/get` and `/get/ezreplay`
    carry the same risk and are equally unmeasured.
  - 📋 The mark + name + status trio is now hand-written markup in `getPage.tsx` on top of the two
    copies inside `ui/productPanel` and `ui/closingCta`. Third occurrence, so it is a missing
    primitive (`primitives/productSignature`). The three differ in heading level and trailing
    element, so the extraction carries a design decision rather than being mechanical.
  - 📋 **The ledger row is written twice**, `.veloraDownloadRow` and `.docsIndexRow`: same grid, same
    hairline rule, same 48rem reflow, and the name/line pairs are identical declaration for
    declaration. Wants a `ui/ledgerRow`, which rewrites markup on two pages and so needs a look.
  - 📋 **The fact-link row is copied across seven** (`.getFactLink`, `.supportFactLink`,
    `.veloraDownloadFactLink`, `.veloraGetTermLink`, …), three declarations each and identical: a
    `display: flex` on a `TextLink` so it gets its own row under the sentence and keeps a 44px target.
    Seven copies of three lines wants an affordance on `TextLink` rather than a component. The
    close-link row beside it was extracted on 2026-08-11 (`primitives/closeLinks`, eleven call sites).
- 🚧 The legal four are routed and readable as **provisional drafts** (see `goals-completed.md`): one page
  over a `LEGAL_DOCS` registry serving `/legal/impressum`, `/privacy`, `/terms` and `/refund`, each one
  opening on a notice saying in as many words that it is a placeholder. That ends the last dead links on
  the site. What is still open is the part the drafts cannot invent:
  - 📋 **The binding texts**, which are §8's job, not a copy pass: the Impressum's postal address and VAT
    number, the host and every subprocessor by name in the privacy policy, and the merchant of record in
    the terms and the withdrawal policy. See `coding/business/uplift-platform.md` in the second brain: a
    wrong or missing Impressum is the classic German Abmahnung risk.
  - 📋 The drafts are written from the business as it stands today (nothing purchasable, no accounts, no
    analytics, not deployed). Every one of those facts changing is an edit to a named clause, which is
    what the clause ids are for.
  - 📋 A Steuerberater or lawyer consult before the notice comes off. The drafts are a shape to review,
    not a substitute for that review.
  - 📋 The tab title is set (§1). Per-route meta, and the `noindex` a draft legal page arguably wants, both need the
    static-rendering decision in §1.
- 📋 Sitemap, `robots.txt`, per-route canonical + OG tags. The 404 page itself is built.

## §6 Accounts and dashboard (blocked on the auth decision)

- 📋 `apiService` proxy singleton over `IBackend`, plus `MockBackend`, so all of §6 is buildable now.
- 📋 `/signup`, `/login`, `/verify-email`, `/forgot-password`. Email verification enforced. TOTP 2FA offered
  (reuse Velora's pattern).
- 📋 `/account`: profile, licenses across **both** products, device list with "free a device", subscription
  status, invoices via the Paddle portal deep-link, **delete account**.
- 📋 Delete account actually deletes: cancel subscription, revoke licenses, erase PII. GDPR data export too.
- 📋 `RequireAuth` restores the session before deciding to redirect (Velora's pattern; a naive guard flashes
  the login page on every reload).
- 📋 Session security: HTTPS-only Secure/SameSite cookies, CSRF on mutations, rate-limited auth.

## §7 Payments and licensing (spans the backend repo)

Backend work belongs in `velora-license-server` as it becomes **uplift-api**, not in this repo. Track the
cross-repo half in the out-of-repo roadmap beside those repos.

- 📋 Paddle account, products and prices, sandbox checkout. Velora: monthly, yearly, one-time lifetime.
  EzReplay Pro: monthly, yearly.
- 📋 Change `TRIAL_DAYS` from 7 to 14 in `velora-license-server/src/db.ts`. Existing trial codes pin to
  `trial_started_at`, so live trials silently extend by a week; acceptable, but know it happens.
- 📋 Generalize the license server: `users`, `subscriptions`, a `product` column and `user_id` on licenses,
  so one account holds licenses for both products. Existing `codes`/`devices` tables and the device-bound
  token flow stay as they are.
- 📋 Paddle webhook mints and revokes licenses. **Verify the signature and timestamp.** Highest-stakes item
  in the build; an unverified webhook hands out lifetime licenses to anyone.
- 📋 `HttpBackend` replaces `MockBackend` behind `apiService`.
- 📋 Flip `/get/velora` from placeholder to real purchase.

## §8 Business prerequisites (not code, but they gate taking money)

From `coding/business/uplift-platform.md`. Not legal advice; the German bits want one Steuerberater consult.

- 📋 Gewerbeanmeldung.
- 📋 Legal texts drafted (Impressum, Datenschutzerklärung, AGB, Widerrufsbelehrung).
- 📋 Separate business bank account.
- 📋 Decide the Impressum address question (a home address is normally required for a private person; a
  business-address service is the usual way around publishing it).
- 📋 Windows code-signing certificate for the Velora installer, before anyone pays. Unsigned costs two
  things: the SmartScreen warning `/velora/download` currently explains, and electron-updater skipping
  signature verification entirely (it only checks when `publisherName` is in `app-update.yml`), so the
  update channel rests on HTTPS alone. Options and the identity-validation catch are in
  `coding/business/uplift-platform.md`. Start the identity check early; the waiting period is the long
  pole, not the money.

## §9 Launch

- 📋 Hosting and deploy pipeline. Velora deploys via n8n webhooks; decide whether this joins that pattern.
- 📋 Lighthouse and page-weight budget for the public pages.
- 📋 Backups for the account/license DB.
- 📋 Cross-link from the apps: Velora and EzReplay point at the site for account and license management.

---

Finished items move to [`goals-completed.md`](./goals-completed.md).
