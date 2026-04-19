# LEAN-CTX.md

Shared agent policy for this repository's MCP workflow.

## Use these tools first

- Use `lean-ctx` tools for compact project context, targeted reads, deltas, and compression.
- Use `jcodemunch` tools for symbol-aware repo navigation, impact analysis, and refactoring plans.

## Code Exploration Policy

- Always use jCodeMunch-MCP tools. Never fall back to Read, Grep, Glob, or Bash for code exploration.
- Call `resolve_repo` with the current directory first; if not indexed, call `index_folder`.
- Before reading a file, use `get_file_outline` or `get_file_content`.
- Before searching, use `search_symbols` or `search_text`.
- Before exploring structure, use `get_file_tree` or `get_repo_outline`.

## Repo-local jCodeMunch setup

- Keep index data inside this repo:
  - `CODE_INDEX_PATH="$PWD/.code-index"`
- Create/refresh index from repo root:
  - `CODE_INDEX_PATH="$PWD/.code-index" jcodemunch-mcp index "$PWD"`

## Typical workflow

1. Start with `ctx_overview` and/or `list_repos` + `resolve_repo`.
2. Use `plan_turn`, `suggest_queries`, and symbol/file tools to scope work.
3. Use `ctx_multi_read`/`ctx_smart_read` for efficient file reads.
4. After edits, call `register_edit` for changed files when using jCodeMunch indices.
5. Use `ctx_compress` before long responses or context-heavy turns.
