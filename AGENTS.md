# AGENTS.md

@LEAN-CTX.md

Repository guidance for AI/code agents.

## Stack and scope

- This repository is Astro-only.
- Do not re-introduce Python rendering or legacy root HTML generation.
- Source of truth lives under `astro/`.

## Key paths

- App/pages/components: `astro/src`
- Content data: `astro/src/data/site-content/`
- Public assets: `astro/public/assets`
- Workflow configs: `.github/workflows`

## MCP tooling

- Prefer `lean-ctx` and `jcodemunch` for context gathering and code navigation.
- Use a repo-local jCodeMunch index path: `CODE_INDEX_PATH="$PWD/.code-index"`.
- If this repo is not indexed yet, run:
  - `CODE_INDEX_PATH="$PWD/.code-index" jcodemunch-mcp index "$PWD"`

## Code Exploration Policy

- Always use jCodeMunch-MCP tools. Never fall back to Read, Grep, Glob, or Bash for code exploration.
- Call `resolve_repo` with the current directory first; if not indexed, call `index_folder`.
- Before reading a file, use `get_file_outline` or `get_file_content`.
- Before searching, use `search_symbols` or `search_text`.
- Before exploring structure, use `get_file_tree` or `get_repo_outline`.

## Build and validation

Run from `astro/`:

1. `npm ci`
2. `npm run lint`
3. `npm run check`
4. `npm run test`
5. `npm run build`

## Deployment

- GitHub Pages deploys from `astro/dist`.
- Keep route stability for public pages:
  - `/index.html`
  - `/work.html`
  - `/project.html`
  - `/blog.html`
  - `/stats.html`
  - localized pages in `/bn`, `/ar`, `/ur`
