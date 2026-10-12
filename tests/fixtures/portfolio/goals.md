# goals.md

Living roadmap for **jenny.uplift-beyond.de**, Jenny Reinecke's portfolio: graphic design and web
development, one long scroll-driven page plus a project view per piece of work.

**Legend:** ✅ Implemented · 🚧 Partial · 📋 Planned

**Open work only.** Checking an item off means moving it to `goals-completed.md` in the same edit.
Long-form detail for an open item goes to `docs/goalsDetails/`.

**Last updated:** 2026-08-12, **the nebula no longer blanks a frame when it retunes.** `retune()` now
runs before `draw()` in the loop: a scale change wipes the canvas when the backing store resizes, and
running it after the draw left the wipe on screen for up to 33ms, a once-per-second blink while the
scale walked. Same-frame repaint now, the way `resize()` already did it.

**Committed before this, the footer is the nav takeover arriving from the other end of the page.**
It wears the takeover's material rather than a flat purple slab: `--footer-fill` is now the accent mixed
into `--color-scrim`, the glass wash sits on it, `.grain` gives it the texture, and `.footerInner` takes
the nav's 78rem column. The blur is the one piece of the recipe left off, since the panel is on screen
for as long as the visitor stays at the bottom and would re-resolve a 50px backdrop over the nebula the
whole time (the start boxes drop it for the same reason). Its rows now arrive on the takeover's own
tween, `REVEAL_FROM` / `REVEAL_TO` in `utils/motion.ts`, shared rather than copied: rise, un-blur, 0.045
stagger, scrubbed on `ease: 'none'` over a window measured off the panel's own height, because the last
element in the container never travels past a line in the viewport.

**In the same uncommitted batch: the Awwwards pass is written down.** Three fresh-context reviews
(judge, motion, creative tech) read the build; their full reports and the ranked synthesis are
`docs/goalsDetails/creativeDirection.md`, summarised as the new §9. Docs only, no code changed.

**And the card itself holds something now.** It was one caption, an address and a fine-print row in
40vh of screen, which is the definition of empty. The availability line is `1rem` at 70% instead of a
`0.85rem` caption at 60%, since it is what decides whether the address under it is worth writing to.
The address gained a **copy button**, because a `mailto` is not a way of taking an address: it renders
only where `navigator.clipboard` exists, says "Copied" for two seconds through an `.srOnly` `aria-live`
**sibling** of the button rather than text inside it (an `aria-label` makes a button's children
presentational, so a live region parked in one is pruned out of the tree and never fires), with the name
following the visible word so the control stays sayable while it reads "Copied", and is `.ghostControl`,
the nav's own quiet button. `footer.line` came out of the fine print to sit opposite
the address at `.display`, and the identity block now prints **her local time** beside the place
(`Intl.DateTimeFormat` on the new `contact.timeZone`, 24h in both languages, ticking every 30s), so the
last screen has one thing on it that is alive. Three new locale keys in both files (`copy`, `copied`,
`copyLabel`), and `footer.place` became `footer.placeTime`. The mobile floor went to `max(32rem, 52vh)`
to hold the taller card inside the resting 80%.

**Two classes came out of all this**, both written four times before they were one: `.quietLink` (nav
legal row, footer fine print, both legal-page link rows) and `.ghostControl` (the nav's cursor toggle
and language options, the footer's copy button), in `site.css`. Written up in `docs/designsystem.md`
("The footer is the contact screen", "The link cue", "Glass, one recipe", "Utility classes").

**In the same uncommitted batch: the skills list is an index that answers the pointer, and it names the
tools.** It was five rows of name plus a three-word note, which was the flattest block on a site whose
whole argument is motion. It is a three-column sheet now (index, name at up to 2.75rem, then the
deliverables over the tools), carrying the half the page never said: what she works in, with a tool she
is still learning marked as such rather than claimed. The lit row is the one authored moment: a flat
4%-white band wipes in, the numeral goes accent, the row leans right and every other name steps back in
tone, never in opacity, because GSAP owns the item's opacity for the arrival. Behind `@media (hover:
hover)` and revealing nothing, so a phone loses an effect and never a fact. `skills.items` gained
`tools` and `learning` in both locales plus a `skills.learning` label, and the web development note
stopped duplicating its own stack. Written up in `docs/designsystem.md` ("The about screen").

**In the same uncommitted batch: the projects section says it is clickable at rest.** The frame and each
card were `<button>`s that navigated, so the only thing announcing either as a target was the custom
cursor's tip, which is absent on every phone and off for anyone who turned it off. Both are `ViewLink`
now, which brings back the address in the status bar, open in a new tab and a crawler that can follow,
and the card link wraps the title and its label as one target. `primitives/actionCue` is the new seam
for the case where that is still not signal enough: the words, a hairline, a `>` that slides, all taking
their lit state from the ancestor `<a>` rather than their own hover. The sticky frame wears one
(`View Velora >`), because a mark is the one thing on that panel that does not name the project in
words; the cards deliberately do not, and its cue's string is also the link's `aria-label`, one key
rather than two wordings, so the control can be said out loud by someone driving the page with their
voice. **The nav strip's four marks went the same way**, so every project entry on the site is an
address now and the design system's old carve-out for a project entry as a button is withdrawn: the
strip's handler only closes the panel, only on a plain click. Written up in `docs/designsystem.md`
("The link cue", "Projects", "Nav takeover").

**In the same uncommitted batch: the background is Velora's nebula now, and `assets/backgrounds/orbs` is
gone.** Nine gradient blobs composited with `lighter` under a `blur(70px) saturate(1.1)`, each wobbling on
two sine terms, fading at the edge and back in where it wraps, instead of ten hard circles under a
`blur(250px)`. The header dot still owns it: `ORB_HUES` is unchanged, and the hue it lands on is turned
into a five-colour palette by `paletteFor()`, so the toy drives a cloud rather than one flat wash. The
canvas seeds its resolution from `backgroundQuality.ts` and then trades it between 25% and 60% against
the frame rate it measures, and reduce-motion paints one still frame and never starts a loop. Written up
in `docs/designsystem.md` ("Canvas background").

**In the same uncommitted batch: the site is bilingual, the locale decision landed on de + en.**
i18next + react-i18next + the browser detector in `src/i18n.ts`, both bundles in the entry chunk, the
choice remembered under `portfolio-language`. Every translated string moved to
`src/locales/{en,de}/translation.json`, including the ones that were never in a registry: `aria-label`s,
the cursor tips, the screen-reader headings. A project is split on one question, would a translator touch
it: `src/projects/<id>.ts` keeps id, name, kind, media and `href`, and the strings live under
`projects.<id>`, read through `projectText(t, id)`. `content/site.ts` is what is left. The language sits
in the nav's foot row beside the cursor toggle, `scripts/checkLocales.mjs` runs first in `npm run build`
so a key added to `en` and forgotten in `de` fails the build, and the Datenschutzerklärung names the new
storage key. Written up in `docs/designsystem.md` ("Language") and `goals-completed.md` §3.

**In the same uncommitted batch: the pinned horizontal about-track is gone and about is one screen.**
It showed half a screen at a time, which read as empty, and it charged the page its worst scroll
behaviour to do it. **The site now has no pinned section at all**, so `useSmoothScroll` lost its
`.pin-spacer` and `[data-scroll-track]` branches and `utils/useMediaQuery.ts` is deleted: it existed
only to decide whether to pin. The skills moved into the about screen, where they are the answer to the
paragraph beside them, under a `.size-1_5` label rather than a second `.title`; the block keeps
`id="skills"` so the nav entry still lands. `about` gained `lead` (the opening, pulled out of the
paragraph) and `facts` (Based / Working since / Team, behind a hairline under the prose), and lost the
"same job to me" sentence; those three live in the locale files now, and only the portrait's intrinsic
size stayed in `content/site.ts`. The photograph stopped being
a glass card: above 900px it spends the section's right padding as a negative margin and runs off the
edge of the page, masked at its left and drifting on a scrub. It is larger than the first pass (36vw,
62vh), cropped on the subject with `object-position: 48% 26%` instead of on the middle of the file, and
it wears the site's grain: **`.grain` is now its own class in `site.css`**, with `.uiColor` still
carrying it, because a panel and a photograph both want the texture and only one of them wants the
glass. Written up in `docs/designsystem.md` ("The about screen" and "Glass, one recipe"). The GSAP-over-`motion` case in `CLAUDE.md` lost its headline argument with the
pin and is restated there.
Three scroll fixes in the same batch, listed under "The scroll container" in the design system: a
`document.fonts.ready` refresh, `ignoreMobileResize`, and no tween built per scroll event (the footer's
swell and the bottom blur).

**Before this, on 2026-08-12: the legal pages and the footer as contact screen.**
`src/content/legal.ts` is the registry for the Impressum and the Datenschutzerklärung: `LEGAL_DOCS`
generates the routes, `LEGAL_LINKS` fills the footer and the nav's foot row, so a project view (which has
no footer) still reaches the Impressum. `screens/pages/legalPage` renders both as a document rather than
a column: a masthead, a **sticky index in the left margin** carrying the nav takeover's row grammar, and
the 38rem measure beside it, folding to one column with the index in the flow below 900px. Section
anchors come from `sectionId()` in the registry, so a paragraph can be linked to. The index deliberately
does *not* track where you are: with five short sections on screen at once, whichever entry lights is
arbitrary, so it is a list of jumps and nothing more. Written up in `docs/designsystem.md`
("Legal pages").
`content/site.ts` gained `contact`, the one place the name, email and address live, and the
address is still a marked `TODO`. The footer's largest element is now the mailto at the new
`--text-headline` step, with the identity block, the legal links and `@2026` under a rule. The panel
swells from `80%` rather than revealing from `55%`: the resting height holds the whole card, and
`min-height: fit-content` is the floor that makes that true at any wrap or density. Above the address is
`footer.lead`, now the **availability line** ("Not taking on new work right now, but say hi.") instead of
a pitch for work Jenny is not taking. `primitives/viewLink` is the new seam for a route link that has to
be a real `<a>`.
Landed in the same batch, as its own commit: the nav takeover, the start boxes wearing its surface, and
`--noise-opacity` at 5%.

**The corner name is now two controls.** The words are a link that scrolls back to the top, and the dot
between them keeps the orb-hue toy, which walks a four-hue list (`ORB_HUES`) instead of flipping magenta
to red. On a first visit the dot surfaces once in the next hue and leaves, `dotHinted` persisted so it
never repeats; on touch it is simply visible. Written up in `docs/designsystem.md` ("The corner name").

---

## Open decisions

- ✅ **English only, or de + en.** Decided: de + en, see `goals-completed.md` §3.
- 📋 **The domain.** `jenny.uplift-beyond.de` is what the company site's `/about` hands off to and what
  the client sites' footer credits should point at. Confirm it, then `coming-soon/` can go up there and
  the credits can be pointed at it.

## §1 React rewrite

✅ Done, see `goals-completed.md` §1.

## §2 Design system

✅ `docs/designsystem.md` is written against the build, see `goals-completed.md` §2. Keep it current:
a rule decided in review goes there in the same change.

## §3 Content

- 📋 **Client work is the reason this site exists and none is on it.** `public/media/projects/` carries
  `Luna/` and `NailWebsite/` with nothing pointing at them. The nail studio site is the named client
  example in the company site's scope rule. Decide how a `client` entry differs from a `product` one
  (clients are described, not named, on the company site; naming them here is allowed if they agree)
  and add them. The registry already has the `kind` field for it.
- 📋 **Velora has no screenshots.** Its gallery is the mark and a caption saying so. It needs real
  client shots before release.
- 📋 **The nav has no social link** because there was no destination for one. If there is an Instagram
  or other account to link, add it to `content/site.ts` and render it as a real `<a>` in the takeover's
  foot row, beside the legal links, which are the pattern to copy (`primitives/viewLink` for a route,
  a plain `<a rel="noreferrer">` for an outbound one).
- 📋 The project copy is written from the facts in `CLAUDE.md` and is accurate, but it is not yet in
  Jenny's own voice, in either language. Read both `src/locales/*/translation.json` once and rewrite what
  sounds like someone else. The German was written by Claude and has never been read by a native
  speaker's eye that also knows how Jenny talks, so it is the half that needs it more.
- 📋 **`about.facts[1].value` is a placeholder in both locales** (`[Year]` / `[Jahr]`). The about screen
  prints it as a fact, so it is the second visible placeholder on the site after `contact.address` in
  §7. Fill in the year Jenny started, or drop the entry from both files.

## §4 Motion and performance

- 📋 Measure the two expensive surfaces. The noise overlay animates a background-position at 1fps
  inside a `blur(50px)` backdrop, and the nebula carries a `blur(70px)` filter over the whole viewport
  plus nine wobbling paths per frame. The canvas is capped at 30fps and retunes its own resolution
  between 25% and 60%; the noise has had no such pass.
- 📋 The canvas quality knobs in `assets/backgrounds/backgroundQuality.ts` are module state with a
  setter and nothing drives them. The nebula now seeds its resolution from them and retunes from there,
  so only `setBackgroundQuality` is still unused: wire it to a device check, or drop the setter.

## §5 Assets and page weight

`public/media/` is roughly **100 MB**. A portfolio is judged on how it loads, so this is a feature.

- 📋 `noise.png` is **9.3 MB** for a texture tiled at 50% and rendered at 5% opacity. It should be a
  few KB, and a generated or procedural grain would be zero.
- 📋 Two videos, 25.9 MB and 17.2 MB, both autoplay-looping. One is the header of a project view.
- 📋 Fifteen PNGs over 1 MB, several over 3.7 MB, used as marks and thumbnails. The company site solved
  exactly this by cutting a 512px copy beside each master (3.7 MB to 54 KB); do the same and keep the
  masters as the source. The nav strip shows all four marks at 5rem and is the sharpest case: it defers
  them until the nav is first opened, which is a dodge, not a fix.
- 📋 WebP/AVIF beside the PNGs, and real `width`/`height` attributes so images stop shifting layout.
  Gallery images are already `loading="lazy"`; the about portrait is the first with its intrinsic size
  declared, and the rest should follow, because a lazy image with no reserved box is also a scroll bug
  (see "The scroll container" in `docs/designsystem.md`).
- 📋 **`public/media/me.png` is a JPEG wearing a `.png` name.** Browsers sniff past it, an image
  pipeline will not. Rename it, or re-encode it, when the asset pass in this section happens.
- 📋 The favicon, the mark size set (`.ico`, apple-touch) and the OG card at 1200x630 do not exist, so
  `index.html` ships no `og:image` and no icon at all.

## §6 Accessibility floor

The floor from `goals-completed.md` §1 is in: focus rings, real controls with names, split text that
reads as words, selectable prose, a reduce-motion path, no hover-only affordance.

- 📋 It has never been tested. Do one keyboard pass and one screen-reader pass over both routes and fix
  what they find. That is the only way to know whether the floor is real.
- 📋 Decide whether the site needs a skip link. There is no repeated nav block, so it may not.

## §7 Legal and privacy (gates the site going public)

✅ Both documents, their routes and their links are in, see `goals-completed.md` §7. What is left:

- 📋 **The postal address.** `contact.address` in `src/content/site.ts` is `[Straße und Hausnummer]` /
  `[PLZ und Ort]` and both legal pages print it, so it is the one thing that must be filled before the
  site is linked from anywhere. § 5 DDG wants a ladungsfähige Anschrift and a P.O. box is not one. A
  private person normally has to publish a real address, and a business-address service is the usual way
  around it. See `coding/business/uplift-platform.md` in the second brain.
- 📋 The Datenschutzerklärung promises the server logs are deleted after seven days. Set that on the
  server, or change the sentence to what the server actually does.
- 📋 If a Gewerbe is ever registered, the Impressum's Umsatzsteuer section changes and a § 19 UStG line
  or a USt-IdNr goes in.
- 📋 The old `Portfolio` and `New Portfolio` folders beside this repo are the predecessors. If either is
  live anywhere, decide whether it redirects here or comes down, so there is one portfolio.

## §8 Launch

- 📋 `coming-soon/` is the holding page and is not deployed anywhere yet.
- 📋 The site is an SPA with no static rendering, so a crawler and a link preview get whatever
  `index.html` says, which is now correct but is the same for every route. Decide the same question the
  company site has open in its §1: prerender, or accept it.
- 📋 A deploy needs an SPA rewrite rule, or `/project/velora` 404s on a cold load in production.
- 📋 Lighthouse and a page-weight budget before it is linked from anywhere.
- 📋 Point the client sites' footer credits at this subdomain once it is up.

## §9 Creative direction (the Awwwards pass)

Three fresh-context reviews (judge / motion / creative tech) read the build on 2026-08-12; the
ranked plan lives in [`docs/goalsDetails/creativeDirection.md`](./docs/goalsDetails/creativeDirection.md).

- 📋 **Batch 1, all S-cost, one statement:** the nebula narrates the page (per-project `hue` in the
  registry, the dot pins it), `--orb-hue` as a live CSS variable on decorative surfaces, procedural
  grain (kills the 9.3 MB `noise.png`, also §5), compositor grain + frame budget (closes §4).
- 📋 **Batch 2:** the hero consumes the loader and drops the word "PORTFOLIO", three reveal verbs
  (`REVEAL_CLIP` / `REVEAL_WIPE` beside `REVEAL_FROM`), the cursor rebuilt as a drawn object.
- 📋 **Batch 3:** project-view entrance, the variable-weight type lens, touch parity for the
  signature moves.
- 📋 The judge's content verdict overlaps §3 and outranks all motion work: client work on the site
  and real interface shots move the score more than any animation.

---

Finished items move to [`goals-completed.md`](./goals-completed.md).
