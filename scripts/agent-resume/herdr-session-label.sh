#!/usr/bin/env bash
# SessionStart hook: record this Claude session's id on its Herdr terminal so
# herdr-resume.mjs can bring it back after a core stop. No-op outside Herdr.
[ -n "$HC_TERMINAL_ID" ] || exit 0
id=$(sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p' | head -1)
[ -n "$id" ] || exit 0
hc label "$HC_TERMINAL_ID" "claude.session=$id" >/dev/null 2>&1
exit 0
