# Resume agents after a Herdr core stop

Stopping the core ends every program in it. Tabs, folders and labels survive, but each terminal comes back as a plain shell. These scripts record which agent session each terminal held and retype the resume command.

- `herdr-session-label.sh`: a Claude Code `SessionStart` hook. It writes the session id to the terminal as the label `claude.session` (`hc label $HC_TERMINAL_ID ...`). No-op outside Herdr.
- `herdr-resume.mjs`: Node 18+.
  - `snapshot` labels every live opencode, pi and Copilot terminal with `agent.kind` and `agent.session`, matching the newest session in the terminal's folder that no other terminal owns. Run it every couple of minutes (Windows scheduled task through `conhost.exe --headless node ...`, macOS launchd with `StartInterval` 120).
  - With no argument it types `claude --resume <id>`, `opencode -s <id>`, `pi --session <id>` or `copilot --resume <id>` into each terminal that now holds a shell. `--dry` previews.

Install: `install-windows.ps1` (scheduled task) or `install-macos.sh` (copies the scripts to `~/.claude/hooks` and loads `dev.herdr.agent-snapshot.plist`).

Hook entry for `~/.claude/settings.json`:

    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claude/hooks/herdr-session-label.sh", "timeout": 5 }] }]

Limits: opencode, pi and Copilot are matched by folder, so two terminals running the same agent in one folder can be swapped. Resume restores the conversation, not a tool call that was mid-run.
