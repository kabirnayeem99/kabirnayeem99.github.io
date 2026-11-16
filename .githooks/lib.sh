#!/usr/bin/env bash
# Shared helpers for the repo's git hooks (sourced, not run). Docs: .githooks/README.md.
# shellcheck shell=bash

REPO_ROOT="$(git rev-parse --show-toplevel)"
readonly REPO_ROOT
readonly APP_DIR="$REPO_ROOT/astro"

if [[ -t 2 && -z "${NO_COLOR:-}" ]]; then
  readonly C_RED=$'\033[31m' C_GREEN=$'\033[32m' C_RESET=$'\033[0m'
else
  readonly C_RED='' C_GREEN='' C_RESET=''
fi
info() { printf '%s%s%s\n' "$C_GREEN" "$*" "$C_RESET" >&2; }
die() { printf '%s%s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }

# Run one named check from astro/, failing the hook with the check's name.
run_check() {
  local name="$1"
  shift
  info "[$HOOK_NAME] $name"
  (cd "$APP_DIR" && "$@") || die "[$HOOK_NAME] $name failed. Fix it, or bypass once with --no-verify."
}

# A repo hooksPath replaces the global one, so hand over to the global hook of the same name
# (Git LFS installs pre-push/post-* hooks there).
run_global_hook() {
  local global_dir
  global_dir="$(git config --global core.hooksPath 2>/dev/null || true)"
  [[ -n "$global_dir" ]] || return 0
  global_dir="${global_dir/#\~/$HOME}"
  local hook="$global_dir/$HOOK_NAME"
  [[ -x "$hook" && "$hook" -ef "$REPO_ROOT/.githooks/$HOOK_NAME" ]] && return 0
  if [[ -x "$hook" ]]; then
    "$hook" "$@"
  fi
}
