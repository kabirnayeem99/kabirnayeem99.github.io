# Pressed Flower Notebook Redesign

Status: implemented on branch `redesign/pressed-flower-notebook` (October 2026).
Replaces the editorial-brutalist system described in `docs/hallmark-redesign.md`.

## Intent

The site is a scholar's notebook kept by a bibliophile: ruled paper, ink,
pressed watercolour flowers, washi tape, newspaper clippings and library cards.
Routes, content JSON and component ownership are unchanged; only the visual
system, decorative assets and light markup hooks changed.

## System

- **Paper**: cream ruled page (`.site`) on a desk-coloured body. Ruled lines are
  spaced to the body `line-height` (`--line`), so running text sits on them.
  A red margin line, punched holes and one coffee ring; all use logical
  properties and mirror in `ar`/`ur`.
- **Line height per locale**: `en` 32px, `bn` 34px, `ar` 36px, `ur` 44px.
- **Colour**: tokens in `@layer tokens`. Dark mode is night ink on navy paper.
- **Type**: EB Garamond for body and headings (small caps title, italic section
  heads). Caveat (OFL, self-hosted Latin subset) for annotations: tabs, dates,
  labels, buttons. `bn`/`ar`/`ur` fall back per glyph to their own faces.
- **Book text** uses `--book-hand`: Caveat for Latin, then a `Book Hand` family
  that routes Arabic-script characters to Scheherazade New and Bangla to Noto
  Serif Bengali by `unicode-range`, independent of page language.

## Botanicals

Style reference: muted watercolour pressed flowers (oxblood cosmos, sage,
dusty-pink eucalyptus, brown fern, poppy pods, seed heads). The SVGs are our own
drawings, not the stock reference files.

- `src/lib/botanicals.ts` builds one inline SVG sprite at build time (seeded
  PRNG, stable output) with a watercolour filter (`#bot-wc`).
- `BotanicalSprite.astro` renders it once per page (index header, `ClosePageHeader`,
  404). `Botanical.astro` places a symbol: `<Botanical name="cosmos" class="pf pf--end" />`.
- Margin flowers (`.pf`) are positioned relative to their section, stay out of
  the reading column, flip in RTL and hide under 760px (the footer bouquet
  stays, smaller).
- The home sleeve carries a pressed shapla (*Nymphaea nouchali*).

## Page treatments

- **Header**: kicker "this notebook belongs to —", small-caps name, handwritten
  tagline; theme/language/close controls are rubber stamps.
- **Navigation**: coloured index tabs sticking out of the notebook's inline-end
  edge; under 1380px they become divider tabs standing up from the sheet's top
  edge in a single row (scrolls sideways if a locale's labels don't fit).
- **Home**: intro text beside the logo/QR flip card in a glassine sleeve;
  "Right now" with the build date in the margin; selected works as taped
  specimen cards with a pressed flower each; blog posts as newspaper clippings;
  skills as colour-coded index tabs with a legend (language / platform /
  frameworks & domains / process / spoken); the last 9 books as taped covers, 5 per row, then a cover-sized library card in a kraft pocket ("Show all read books", count stamped on the pocket) linking to the stats books section.
- **Work**: a dated journal along a growing stem, current role in bloom.
- **Projects**: taped specimen cards, one pressed flower per card.
- **Blog**: newspaper clippings with a nameplate and topic from `meta`.
- **Stats**: each section is a graph-paper field-note sheet; headline numbers
  on small index cards; pencil-hatched pies and bars; the GitHub heatmap is
  stippled ink dots sized by activity (`data-level`); repos as catalogue cards;
  the full reading list uses the same taped covers as home, five per row.
- **Books**: covers pasted with a dated tape strip on top and a title strip
  below; hovering peels the top inline-end corner back. Live Goodreads
  arrivals are taped by `goodreads-loader.ts` before they animate in.
- **Footer**: a handwritten sign-off at the end of the page, like a letter: a
  pencilled line, the author's name as a signature with a red flourish, and the
  last-updated note. **404**: a blank page with a pencilled note.

## Hover language

Nothing scales up or floats; hover is always a paper action.

- **Dog-ear** (buttons, social links, clippings, repo cards): the top end corner
  is cut transparent (the ruled page shows through) and the back of the paper
  folds over it. Shared `--fold` / `--fill` background layers driven by the
  registered `--peel` length; shadows use `drop-shadow` so they follow the cut.
- **Peel** (project cards): the free bottom corner lifts, since the top is taped.
- **Book covers**: the top end corner peels back.
- **Skill tags** swing on their string hole. **Stamps** straighten and take a
  faint ink impression. **Nav tabs** slide out like a pulled tab. **Links** get a
  wavy ink underline.

Book title strips are capped at two lines.

## Living paper

- **Photo card** (home): hinged at its tape and always moving, as if in a light
  air current. `src/scripts/modules/paper-flutter.ts` drives under-damped springs
  from a wind signal (layered sines plus random gusts): hinge lift (rotateX in
  perspective), a small sway, and a curl of the free bottom corner; the shadow
  deepens as it lifts. Opt in with `data-paper-flutter`. Pauses off-screen and on
  hidden tabs; static with reduced motion.
- **Social links** are perforated postage stamps; **section links**
  ("Experiences →") are red-pen cross-references whose underline is pencilled in
  on hover.
- **Skills** live in a kraft card-file box: one index card per kind with a
  coloured divider tab; hovering pulls a card up out of the box.
- Dog-ear folds clip the corner off the whole element (paper and everything
  printed on it) and draw the folded flap as a separate top layer.

## Arrows

Hand-drawn red-pen arrows are used sparingly, only to point at information worth
acting on: on home, from the "open to remote roles and contract work" line to the
email stamp (rendered only when the page has an email stamp); on work, from the
section title to the current role. No arrows with text labels, no decorative
connectors.

## Layout and reading

Sheet up to 1160px wide with an 88px binding margin and 36px end margin (38px /
14px on phones). Body text 1.08rem on a 32px ruled period (bn 34, ar 36, ur 44),
measure 68ch, lighter rules.

## Cursor

`src/scripts/modules/cosmos-cursor.ts`, modelled on the edumax airplane cursor:
position follows the pointer directly (the flower centre is the hotspot), spin
carries momentum from pointer speed and decays, the flower flutters edge-on
while spinning, petals open over links and close on press. White border via
drop-shadows. Off for touch, reduced motion and forced colours; hides over form
fields, on Tab, blur and pointer leave. Book covers opt out of the hover bloom
with `data-cursor-plain`.

## Tooling

- Edit `astro/public/assets/css/styles.source.css`; `npm run css:build`
  regenerates `styles.css` (esbuild, already an Astro dependency). `prebuild`
  runs it, so CI and deploys can't ship a stale minified file.
- `npm run css:watch` rebuilds on save during `npm run dev`.

## Performance

- CSS is minified by esbuild in `prebuild` (runs in CI's `npm run build`);
  Astro compresses HTML and Vite minifies JS.
- Fonts trimmed without changing the look: the Bangla variable font is pinned to
  the 400–700 weight range at normal width (418 KB → 147 KB); book titles use
  script-only subsets (`bookhand_bangla_subset.woff2` 66 KB,
  `bookhand_arabic_subset.woff2` 99 KB) instead of full fonts; the Arabic
  regular face ships as woff2 (168 KB → 123 KB). Home page font weight went from
  about 722 KB to about 332 KB.
- The traced logo SVG was optimized with svgo at precision 1 (152 KB → 104 KB),
  visually identical.
- The botanical sprite stays inline (~44 KB raw, ~8 KB gzipped) to avoid an extra
  request and keep the SVG filters working everywhere.
- The paper-flutter loop pauses off-screen and on hidden tabs.

## Removed

Doodle parallax module and doodle SVGs, the Anton display font, and the
brush/marker/torn/rough-box icons used only by the old stylesheet.

## Open items

- Bangla, Arabic and Urdu strings added for the masthead kicker and skills
  legend need a native-speaker check.
- Regenerate `og-card.png` in the new style.
- Urdu book titles render in Scheherazade, because Urdu and Arabic share code
  points; using Nastaleeq would need a per-book language marker in the
  Goodreads snapshot.

## Verification

From `astro/`: `npm run lint`, `npm run check`, `npm run test`, `npm run build`
all pass. Browser checks: all five pages in light; home in dark; Arabic and
Bangla home, Urdu work; 375px home and stats. No horizontal overflow.
