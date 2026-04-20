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

## Lean-CTX

PREFER lean-ctx MCP tools over native equivalents for token savings:

| PREFER                                   | OVER                         | Why                                              |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------ |
| `ctx_read(path)`                         | Read / cat / head / tail     | Cached, 8 compression modes, re-reads ~13 tokens |
| `ctx_shell(command)`                     | Shell / bash / terminal      | Pattern compression for git/npm/cargo output     |
| `ctx_search(pattern, path)`              | Grep / rg / search           | Compact, token-efficient results                 |
| `ctx_tree(path, depth)`                  | ls / find / tree             | Compact directory maps                           |
| `ctx_edit(path, old_string, new_string)` | Edit (when Read unavailable) | Search-and-replace without native Read           |

Edit files: use native Edit/StrReplace if available. If Edit requires Read and Read is unavailable, use ctx_edit.

Write, Delete, Glob - use normally. NEVER loop on Edit failures - switch to ctx_edit immediately.

## jCodeMunch + Lean-CTX Workflow

Use `jcodemunch` as the primary code-intelligence layer, and `lean-ctx` as the primary file/shell compression layer.

### Prefer jcodemunch for symbol-aware tasks

- `list_repos` / `resolve_repo(path)` before starting work.
- `index_folder(path, incremental=true)` when repo is missing or stale.
- `plan_turn(repo, query)` for first-pass navigation.
- `search_symbols(repo, query)` for functions/classes/methods.
- `get_file_outline(repo, file_path)` before reading large files.
- `get_symbol_source(repo, symbol_id)` for exact implementation details.
- `get_context_bundle(repo, symbol_id|symbol_ids)` for multi-symbol context.
- `get_blast_radius(repo, symbol)` before renaming/deleting/changing signatures.
- `plan_refactoring(...)` for multi-file rename/move/signature edits.
- `register_edit(repo, file_paths, reindex=true)` after edits to keep index/search accurate.

### Prefer lean-ctx for compressed reads and command output

- `ctx_read(path, mode)` for targeted file slices around symbols found via jcodemunch.
- `ctx_search(pattern, path)` only for raw text that symbol search may miss.
- `ctx_tree(path, depth)` for compact filesystem maps.
- `ctx_shell(command)` for compressed git/gradle/npm/cargo output.

### Compatibility rules (important)

- Don't duplicate discovery: run `search_symbols` first, then fall back to `ctx_search` only if needed.
- Use jcodemunch to decide *what* to inspect, then lean-ctx to read focused ranges (`lines:N-M`).
- For refactors, generate impact/plan with jcodemunch before applying edits.
- After edit batches, always run `register_edit` so subsequent jcodemunch lookups stay in sync.
