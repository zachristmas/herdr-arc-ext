#!/bin/sh
# Builds gh-as for Branch Issue and installs Branch PR with the per-repo gh account patch.
# Needs Go 1.23+, git and gh. Run after copying mods/ into the Herdr home.
set -e
H="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
[ -f "$H/gh-accounts.json" ] || cp "$ROOT/gh-accounts.json" "$H/gh-accounts.json"
mkdir -p "$H/mods/branch-issue/bin"
(cd "$H/mods/branch-issue/helper/gh-as" && go build -o ../../bin/gh-as .)
git clone -q --depth 1 https://github.com/munza/herdr-mods "$T/mz"
cp -R "$ROOT/patches/branch-pr/." "$T/mz/branch-pr/"
if [ -d "$H/mods/branch-pr" ]; then flag=--update; else flag=; fi
(cd "$T/mz/branch-pr" && go -C helper run ./install $flag)
