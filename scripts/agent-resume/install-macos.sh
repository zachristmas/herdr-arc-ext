#!/usr/bin/env bash
# Installs the launchd job that snapshots agent sessions. Run from this folder.
set -e
dest="$HOME/Library/LaunchAgents/dev.herdr.agent-snapshot.plist"
node_bin="$(command -v node)"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.claude/hooks"
cp herdr-resume.mjs herdr-session-label.sh "$HOME/.claude/hooks/"
chmod +x "$HOME/.claude/hooks/herdr-resume.mjs" "$HOME/.claude/hooks/herdr-session-label.sh"
sed -e "s|__HOME__|$HOME|g" -e "s|__NODE__|$node_bin|g" dev.herdr.agent-snapshot.plist > "$dest"
launchctl unload "$dest" 2>/dev/null || true
launchctl load "$dest"
launchctl list | grep dev.herdr.agent-snapshot
