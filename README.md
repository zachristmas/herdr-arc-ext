# herdr-arc-ext

An Arc-style layout for [Herdr](https://herdr.dev), forked from [eznix86/herdr-arc-space](https://github.com/eznix86/herdr-arc-space). See `RECIPE.md` for what it does and how it is built, and `NOTICE` for what changed.

## Install

Ask a Herdr agent: `Read ~/.config/herdr-app/AGENTS.md, then add this layout: https://github.com/zachristmas/herdr-arc-ext`. By hand:

1. Copy `layouts/arc-ext.json` to `~/.config/herdr-app/layouts/` and every folder in `mods/` to `~/.config/herdr-app/mods/`.
2. Merge `keys.json` (Windows, Linux) or `keys.macos.json` (macOS) into `~/.config/herdr-app/keys.json`.
3. Install the `skillshare` mod, or remove the `skillshare-panel` node and the entry in `mods/arc-ext/extensions.json`.
4. `herdr-app do layout.switch '{"name":"arc-ext"}'`.

Tested on Herdr 0.1.17 on Windows 11. The macOS keys are untested.
