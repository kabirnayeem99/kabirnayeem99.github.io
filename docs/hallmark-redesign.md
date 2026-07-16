# Editorial Brutalism Redesign

## Intent

Redesign the Astro portfolio as a coherent editorial-brutalist system while
preserving all routes, component ownership, factual content, and content data.
The existing warm-paper, forest-green, and ochre palette remains the visual
anchor. The redesign should make the content feel like a personal working
archive rather than a stack of generic portfolio sections.

## System

- Genre: editorial brutalism.
- Paper: warm, lightly textured paper rather than pure white.
- Ink: deep olive-black rather than neutral black.
- Accent: forest green, with ochre reserved for markers and selected detail.
- Type: EB Garamond for editorial voice, Anton for decisive display moments,
  and the existing locale-specific faces for translated pages.
- Geometry: sharp rules and square edges; no soft-card default.
- Motion: restrained. Interactions may use quick transform or opacity changes,
  but the page must not rely on continuous ambient or scroll-triggered motion.
- Navigation: preserve the existing paintbrush-surrounded idea, refining it
  into a deliberate navigation rail rather than replacing it with generic
  application chrome.

## Macrostructure Families

### Home: Split Studio

The homepage uses an offset editorial diptych instead of a centered stack.
The personal introduction and current work form the primary split, while later
sections deliberately vary their width, alignment, and density.

Books are a distinct reading-shelf catalogue band, not a small trailing grid.
Book covers should lead the composition, with title and author metadata treated
as a compact catalogue caption. The layout may use controlled irregularity on
larger screens but must remain a clear, readable grid on narrow screens.

### Stats: Stat-Led Report

The statistics page reads as a personal report. Live metrics remain useful and
legible, but the Goodreads collection becomes its visual anchor: a cover-first
catalogue with strong metadata hierarchy and deliberate section breaks.

The book grid should feel materially different from generic cards:

- Covers use consistent image tracks and crisp rules.
- Metadata is typographic and compact, not floating in rounded containers.
- Grid density changes by viewport without horizontal overflow.
- Book entries retain their existing links and source data.

### Blog, Work, and Project: Archive Index

Content-heavy pages share the same type, palette, rule language, and navigation
voice. Their layouts can vary between editorial index and portfolio grid, but
must remain clearly part of the same site.

## Shared Components

- The header keeps the paintbrush navigation concept while improving its visual
  rhythm and small-screen behavior.
- Footer treatment should read as a compact colophon, not a generic link wall.
- Buttons and chips remain sharp, tactile, and keyboard-visible.
- All interactive controls must retain a visible `:focus-visible` state.

## Responsive Requirements

- Verify at 320px, 375px, 414px, and 768px.
- `html` and `body` must clip horizontal overflow without hiding focusable
  content.
- Primary navigation and controls must remain single-line clickable targets.
- Image grids must use `minmax(0, 1fr)` tracks.
- Display headings must wrap safely inside long words.
- Section heads collapse to one column on mobile.

## Scope

Expected implementation files:

- `astro/public/assets/css/styles.source.css`
- `astro/public/assets/css/styles.css`
- `astro/src/components/page/IndexPageDocument.astro`
- `astro/src/components/page/StatsPageDocument.astro`
- `astro/src/components/page/PageNav.astro`
- `astro/src/components/page/PageFooter.astro`

No production routes, content data, or existing content copy should be deleted
or changed. The existing working-tree edits in the two stylesheets and homepage
document must be preserved and incorporated.

## Verification

Run from `astro/` after implementation:

1. `npm run lint`
2. `npm run check`
3. `npm run test`
4. `npm run build`
5. Browser checks for the home and stats pages at the required viewport widths.
