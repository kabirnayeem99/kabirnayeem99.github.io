# AGENTS.md

Project guidance for AI/code agents working in this repository.

## Core stack rule (mandatory)

- Build and edit this site using raw `HTML` and `CSS`.
- Use `JavaScript` only when clearly necessary for progressive enhancement.
- Do not introduce frameworks or build tools (no React, Vue, Angular, Next, Astro, Vite, Webpack, npm pipeline) unless explicitly requested by the user.
- Do not add unnecessary dependencies.

## Project architecture

- This is a static multilingual GitHub Pages site.
- English pages are at the root:
  - `index.html`, `work.html`, `project.html`, `blog.html`, `stats.html`
- Localized pages mirror structure in:
  - `bn/`, `ar/`, `ur/`
- Shared assets:
  - `assets/css/styles.css`
  - `assets/js/year.js`
  - `assets/icons/*`
  - `assets/images/*`
- Metadata and crawl files:
  - `site.webmanifest`, `robots.txt`, `sitemap.xml`

## HTML conventions to preserve

- Keep semantic structure: `header`, `nav`, `main`, `section`, `article`, `footer`.
- Keep SEO/social tags on each page:
  - `meta description`, canonical URL, Open Graph, Twitter card tags.
- Keep favicon + manifest links in each page head.
- Keep language and direction accurate:
  - `lang="bn"`, `lang="ar" dir="rtl"`, `lang="ur" dir="rtl"`.

## CSS conventions

- Keep styles centralized in `assets/css/styles.css`.
- Reuse existing classes and visual language before adding new ones.
- Maintain responsive behavior for mobile and desktop.
- Avoid inline styles unless there is a strong reason.

## JavaScript conventions

- Prefer no JS when HTML/CSS can solve it.
- Reuse `assets/js/year.js` for:
  - footer year (`#year`)
  - last refreshed date (`#last-refreshed`)
- Prefer external scripts over duplicated inline scripts.

## Content and localization rules

- When updating shared sections (nav, footer, structure), apply equivalent updates across `en`, `bn`, `ar`, and `ur` pages unless intentionally language-specific.
- Keep route stability; do not rename public page files without explicit instruction.

## Validation checklist (after edits)

1. Run: `./scripts/validate-links.sh`
2. Verify local preview: `python3 -m http.server 8080`
3. Spot-check at least:
   - one root page
   - one localized RTL page
   - one localized LTR page
4. Ensure no broken asset paths and no removed SEO/meta essentials.

## Out of scope by default

- No migrations to SPA frameworks.
- No TypeScript/toolchain setup.
- No package-manager driven refactors.
- No major redesign of information architecture unless asked.
