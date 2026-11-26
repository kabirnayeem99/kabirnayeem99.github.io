#!/usr/bin/env bash
# Shared helpers for the repo's git hooks (sourced, not run). Docs: .githooks/README.md.
# A hook that sources this defines usage() and calls parse_hook_args first.

HOOK_NAME="${0##*/}"
readonly HOOK_NAME

TEMP_FILES=()
cleanup() {
  if ((${#TEMP_FILES[@]})); then
    rm -f "${TEMP_FILES[@]}"
  fi
}
trap cleanup EXIT
# Without these, an interrupted check would be reported as a failed one.
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -t 2 && -z "${NO_COLOR:-}" ]]; then
  readonly C_RED=$'\033[31m' C_YELLOW=$'\033[33m' C_GREEN=$'\033[32m' C_RESET=$'\033[0m'
else
  readonly C_RED='' C_YELLOW='' C_GREEN='' C_RESET=''
fi
info() { printf '%s[%s] %s%s\n' "$C_GREEN" "$HOOK_NAME" "$*" "$C_RESET" >&2; }
warn() { printf '%s[%s] warning: %s%s\n' "$C_YELLOW" "$HOOK_NAME" "$*" "$C_RESET" >&2; }
die() {
  printf '%s[%s] %s%s\n' "$C_RED" "$HOOK_NAME" "$*" "$C_RESET" >&2
  exit 1
}
usage_error() {
  printf '%s: %s\nTry '\''.githooks/%s --help'\''.\n' "$HOOK_NAME" "$1" "$HOOK_NAME" >&2
  exit 2
}

# Usage: parse_hook_args MIN MAX "$@". Answers -h/--help, and rejects options and an argument
# count that git would never pass.
parse_hook_args() {
  local min="$1" max="$2" arg
  shift 2
  for arg in "$@"; do
    case "$arg" in
      -h | --help)
        usage
        exit 0
        ;;
      -*) usage_error "unknown option: $arg" ;;
      *) ;;
    esac
  done
  if (($# < min)); then
    usage_error "missing argument"
  fi
  if (($# > max)); then
    usage_error "unexpected argument: ${*:max+1:1}"
  fi
}

# Sets REPO_ROOT and moves there, so repo-relative paths work wherever the hook was run from.
enter_repo() {
  REPO_ROOT="$(git rev-parse --show-toplevel)"
  readonly REPO_ROOT
  cd "$REPO_ROOT" || die "cannot enter $REPO_ROOT"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "$1 not found (install: $2)"
}

# Usage: run_check NAME DIR COMMAND... (DIR is relative to the repo root).
# The command reads /dev/null: git sends pre-push its ref list on stdin, and the global
# (Git LFS) hook that runs afterwards still has to read it.
run_check() {
  local name="$1" dir="$2"
  shift 2
  info "$name"
  (cd "$dir" && "$@") </dev/null \
    || die "$name failed. Fix it, or bypass once with --no-verify."
}

# A repo hooksPath replaces the global one, so hand over to the global hook of the same name
# (Git LFS installs pre-push/post-* hooks there).
run_global_hook() {
  local global_dir hook
  # Unset is normal, and makes git config exit 1.
  global_dir="$(git config --global --type=path core.hooksPath || true)"
  [[ -n "$global_dir" ]] || return 0
  hook="$global_dir/$HOOK_NAME"
  [[ -x "$hook" ]] || return 0
  # A global hooksPath that points back here would run this hook for ever.
  if [[ "$hook" -ef "$REPO_ROOT/.githooks/$HOOK_NAME" ]]; then
    return 0
  fi
  "$hook" "$@"
}
