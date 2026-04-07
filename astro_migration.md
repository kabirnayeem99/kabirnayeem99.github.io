# Codex Task Doc: Migrate Existing Portfolio to Astro

## Objective

Migrate the existing portfolio from raw HTML/CSS with Python templating to Astro, with strict TypeScript, exact design parity, strong SEO/performance, existing Umami analytics preserved, and localization moved cleanly into the Astro app.

This is a migration, not a redesign.

Priority order:

1. exact output parity
2. correctness
3. maintainability
4. performance
5. elegance

---

## Critical Constraint: Do Not Guess

Before changing code, first map the legacy project and treat that inventory as the source of truth. Do not invent behavior, routes, translation keys, or analytics events.

If any required input is missing, document it explicitly in the migration notes instead of guessing.

---

## Current Site Inventory

Fill this section from the actual repository before implementation starts.

```text
Legacy source root: `/Users/kabir/Projects/PersonPortfolio`
Main entry points/pages: `index.html`, `work.html`, `project.html`, `blog.html`, `stats.html`; localized: `bn/index.html`, `bn/work.html`, `bn/project.html`, `ar/index.html`, `ar/work.html`, `ar/project.html`, `ur/index.html`, `ur/work.html`, `ur/project.html`
Python templating system: custom Python renderer (string-based HTML assembly in `src/site_renderer/rendering.py`), invoked via `python3 src/main.py --render-site`
Template partials/includes: no template-engine partial files; reusable render helpers live in `src/site_renderer/rendering.py` (`render_head`, `render_nav`, `render_footer`, `render_scripts`, and page-specific `render_*_main`)
CSS entry files: source `assets/css/styles.source.css`; generated/minified output `assets/css/styles.css`
JS files: `assets/js/*.js` (13 files) plus generated `service-worker.js`
Assets root: `assets/` (`assets/css`, `assets/js`, `assets/fonts`, `assets/icons`, `assets/images`)
Locale files and format: centralized JSON content source `content/site-content.json` with typed per-page locale payloads and route maps
Supported locales: `en`, `bn`, `ar`, `ur`
Default locale: `en` (inferred from canonical root route and `x-default` generation behavior)
Current localized route pattern: English pages at root (`/index.html`, `/work.html`, `/project.html`, `/blog.html`, `/stats.html`); localized pages under `/{locale}/` for `bn`, `ar`, `ur` on `index/work/project`
RTL locales: `ar`, `ur`
SEO/meta source: generated in `src/site_renderer/rendering.py` (`render_head`, `render_schema_graph`, `render_sitemap`) from `content/site-content.json`
Umami script location: hardcoded in `src/site_renderer/rendering.py` (`render_head`) as `https://cloud.umami.is/script.js`
Umami website ID: `cdec8895-be63-42d6-a490-12dd2ea8f35c` (hardcoded in `render_head`)
Current custom analytics events: `nav-click`, `article-click`, `language-change`, `stats-section-click`, `theme-change` (from `assets/js/umami-events.js`)
Deployment target: GitHub Pages
Production base URL: `https://kabirnayeem99.github.io`
Repo name / base path: `PersonPortfolio` / `/` (base path inferred from production URL not including a repo subpath)
```

Do this inventory first. The migration must follow it.

---

## Acceptance Criteria

Every phase below must satisfy its acceptance criteria before moving to the next phase.

### Phase 1 — Legacy audit and Astro scaffold

Tasks:

- inspect and map the current site
- create Astro project scaffold
- set up TypeScript strict mode
- set up GitHub Pages-compatible config

Acceptance criteria:

- all legacy pages/templates/locales/assets are inventoried
- Astro project boots cleanly
- TypeScript strict mode is enabled
- `site` and `base` are configured for GitHub Pages
- no framework islands added unless justified

### Phase 2 — Layout, pages, and exact visual parity

Tasks:

- migrate layouts/pages/components
- preserve exact HTML semantics where practical
- preserve CSS and responsive behavior

Acceptance criteria:

- all main pages render in Astro
- no visible diff against legacy screenshots except documented unavoidable edge cases
- structure, spacing, typography, colors, and interactions match legacy output
- accessibility does not regress

### Phase 3 — Localization migration

Tasks:

- migrate current localization data and routing
- make all internal links locale-aware
- implement locale switcher
- support RTL correctly for all RTL locales

Acceptance criteria:

- all supported locales render correctly
- no hardcoded UI strings remain where translations already exist in legacy
- default locale behavior matches agreed routing strategy
- Arabic and any other RTL locale render with correct `dir="rtl"` and stable layout
- switching locale preserves equivalent page where possible

### Phase 4 — SEO and metadata

Tasks:

- centralize metadata
- implement canonical URLs, OG, Twitter, sitemap, robots
- add only accurate structured data

Acceptance criteria:

- each page has correct title and description
- canonical URLs are correct
- `lang` and `dir` attributes are correct per locale
- sitemap and robots are generated
- metadata is centralized and typed

### Phase 5 — Analytics migration

Tasks:

- move Umami script and any event tracking
- verify behavior on localized routes

Acceptance criteria:

- Umami pageview tracking works
- existing custom events are preserved if present in legacy
- no duplicate tracking
- tracking works on GitHub Pages deployment

### Phase 6 — Performance and cleanup

Tasks:

- reduce JS to the minimum
- optimize images/fonts/loading behavior
- remove dead legacy pieces
- do final parity pass

Acceptance criteria:

- unnecessary hydration is absent
- image dimensions are set where needed to avoid CLS
- dead Python templating remnants are removed or isolated intentionally
- final codebase is clean and documented

---

## Technology Decisions

## Astro

- Use Astro for the site shell and static rendering.
- Prefer `.astro` components for static UI.
- Default to zero client-side JS.
- Only add `client:*` hydration where interaction truly requires it.

## TypeScript

Use strict TypeScript everywhere practical.

Required baseline `tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "useDefineForClassFields": true
  }
}
```

Also enforce no casual `any` at lint level.

Required lint rule:

- `@typescript-eslint/no-explicit-any`: `error`

Use current Astro/TypeScript linting best practices.

---

## Localization Strategy

The legacy localization must be migrated faithfully, but the implementation choice must be validated against the target Astro version first.

### Required rule

Do **not** assume `astro-i18next` is compatible with the chosen Astro version.

Validate compatibility first. Astro has built-in i18n routing support, including locale config, localized URLs, fallback handling, and helpers. ([docs.astro.build](https://docs.astro.build/en/guides/internationalization/?utm_source=chatgpt.com))

There are recent `astro-i18next` ecosystem packages, but compatibility and maintenance status must be checked against the target Astro version before adoption. One maintained package on npm was updated recently, while the older `astro-i18next` repo shows open compatibility issues around newer environments. ([npmjs.com](https://www.npmjs.com/package/%40veguidev%2Fastro-i18next?utm_source=chatgpt.com))

### Decision rule

Use this order:

1. Prefer Astro built-in i18n routing plus `i18next` for translation resources if that cleanly satisfies the site.
2. Use `astro-i18next` only if compatibility is verified for the chosen Astro version and it clearly improves the migration.
3. Do not lock the migration to an outdated i18n integration if Astro-native routing covers the need.

### Requirements

- preserve existing locale keys where practical
- preserve current content and route behavior unless a better route structure is explicitly chosen
- keep translations externalized, not hardcoded in components
- set `lang` correctly per locale
- set `dir="rtl"` for Arabic and every RTL locale, including Urdu if present or added
- verify CSS under RTL, not just text direction

---

## Deployment Target

Target platform: GitHub Pages

Requirements:

- configure Astro for static output suitable for GitHub Pages
- set `site` to the production URL
- set `base` correctly if deploying from a repo subpath
- ensure canonical URLs and asset URLs work under the GitHub Pages base path

---

## Design Parity Rules

Preserve the current design exactly unless a deviation is necessary for correctness.

Must preserve:

- layout
- spacing
- typography
- colors
- section ordering
- breakpoints and responsive behavior
- icons and images
- animations/interactions
- current theme behavior if present

Guidance:

- reuse existing CSS where it makes sense
- avoid broad refactors that change output
- do not introduce Tailwind unless there is a compelling migration reason and no visual drift
- respect `prefers-reduced-motion` where practical

---

## SEO Requirements

Implement strong technical SEO with centralized typed metadata.

Required:

- title and meta description per page
- canonical URLs
- Open Graph tags
- Twitter card tags
- sitemap
- robots.txt
- semantic heading structure
- correct `lang` and `dir`
- accurate structured data only where it fits, likely `Person` and `WebSite`

Do not add spammy or decorative schema.

---

## Performance Requirements

This is a portfolio. It should be extremely fast.

Required:

- minimal shipped JS
- static rendering by default
- no unnecessary hydration
- image optimization where beneficial without changing appearance undesirably
- explicit width/height where needed to reduce CLS
- sensible font loading
- no bloated client-side framework added by default
- Use Astro <Image /> from astro:assets
  - correct width/height
  - prevent CLS
  - optimize formats

Target:

- strong Lighthouse and Core Web Vitals
- stable LCP/CLS/INP characteristics

---

## Umami Migration Requirements

Move over the existing Umami implementation exactly unless there is a bug to fix.

Required:

- preserve pageview tracking
- preserve existing custom event names and triggers if present
- ensure analytics works across localized routes
- avoid duplicate script injection
- keep implementation compatible with GitHub Pages static hosting

---

## Data and Component Guidance

Use typed data models only where they improve maintainability without changing output.

Good candidates:

- projects
- work history
- skills
- social links
- reading lists or book sections

Likely components:

- `BaseLayout`
- `HeadSEO`
- `Navbar`
- `Footer`
- `LanguageSwitcher`
- content section components matching the legacy site structure

Do not over-componentize trivial markup.

---

## Routing Expectations

Implement locale-aware routing cleanly.

Target behavior should be explicitly decided based on the legacy inventory and GitHub Pages deployment, for example:

```text
/
/en/
/bn/
/ar/
```

or another structure if the legacy site already has one worth preserving.

Requirements:

- default locale behavior must be explicit
- locale switching must work on all relevant pages
- internal links must be locale-aware
- GitHub Pages base path must not break localized routing

---

## Final Validation Checklist

### Functional parity

- [ ] Main pages match legacy behavior and structure
- [ ] No visible design drift except documented unavoidable cases
- [ ] Existing links and interactions still work
- [ ] Existing content order is preserved

### Localization

- [ ] All supported locales work
- [ ] Locale switcher works
- [ ] Internal links are locale-aware
- [ ] Arabic and all RTL locales render correctly with RTL-safe CSS

### Type safety and code quality

- [ ] TypeScript strict mode is enabled
- [ ] no casual `any`
- [ ] lint rule for `no-explicit-any` is active
- [ ] component props and shared data are typed

### SEO

- [ ] title/description per page
- [ ] canonical tags
- [ ] OG/Twitter metadata
- [ ] sitemap
- [ ] robots.txt
- [ ] semantic headings
- [ ] correct `lang`/`dir`

### Performance

- [ ] minimal JS shipped
- [ ] no unnecessary hydration
- [ ] images handled well
- [ ] CLS protections in place
- [ ] fonts handled sensibly

### Analytics

- [ ] Umami pageviews work
- [ ] existing custom events are preserved if present
- [ ] no duplicate tracking
- [ ] correct canonical URLs

### Deployment

- [ ] GitHub Pages deployment works
- [ ] `site` and `base` are correct
- [ ] assets and canonical URLs resolve correctly under production path

---

## Required Final Notes from Codex

At the end, provide a short report with:

1. what was migrated
2. any unavoidable parity deviations
3. chosen i18n implementation and why
4. how legacy localization mapped into the Astro project
5. how Umami was integrated
6. any follow-up improvements worth doing later

Visual Regression (MANDATORY)

Subjective parity is not acceptable.

Use automated visual testing:

Playwright OR BackstopJS

Steps:

capture baseline screenshots (legacy)
capture Astro output
diff

✓ Pixel-level diff must be near-zero
