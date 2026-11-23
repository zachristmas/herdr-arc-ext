# Arc Ext

An Arc-browser-style Herdr window, forked from Arc Space: tabs in a left sidebar, a colour gradient per space, and a full-width bottom bar with the machine you are on, the focused pane's git branch, and buttons for side-panel mods such as Skillshare. Each machine keeps its own spaces. Ctrl+Tab cycles panes most-recently-used, like Firefox and Zen.

This folder is laid out like a Herdr home. The files are one build of this brief.

## What you see

A column with no title bar and 8px padding around a space-coloured gradient. Inside it:

- **Sidebar**, 240px, block `sidebar` (mod `arc-ext`): the space chip and folder at the top, one 34px row per tab of the shown space, `+ New Tab`, and at the bottom the command-palette button and one dot per space of the current machine.
- **Main card**: the shown tab's terminals, each pane framed by `arc-space-pane`.
- **Side panel**, 400px, hidden until opened: node `skillshare-panel`, a column holding the `skillshare` mod.
- **Bottom bar**, 28px, block `status` (mod `arc-ext`, props `{role: "status"}`): left to right, a machine chip, a git branch chip (hidden outside a repo), a spacer, then one button per entry of `mods/arc-ext/extensions.json`.

## How it behaves

- Machines: the machine is the one the shown space lives on. Other machines' spaces are hidden from the dots, the space shortcuts, the launcher and the switcher. The machine chip opens a picker popup; the machine shortcut opens a launcher-style list. Choosing a machine selects its last-used space, or creates one there.
- Ctrl+Tab: an invisible 200ms MRU switcher. A quick tap flips to the previous pane; holding Ctrl and pressing Tab or Shift+Tab walks the list and wraps; releasing Ctrl commits; Esc, Ctrl+G, Ctrl+C or Ctrl+[ cancels (Windows reserves Ctrl+Esc).
- Launcher and palette: Ctrl+N and Ctrl+P move the selection. They are bound per mod (`mod:arc-ext-launcher`, `mod:arc-ext-palette` in keys) so a global Ctrl+N or Ctrl+P binding, or macOS text-field bindings, do not take them.
- Space icons: right-click a space, Set Icon. An Emoji tab with search over names and tags, an Icons tab, and None, like Zen. Shown in the sidebar chip and the space dots; the first letter otherwise.
- Extension buttons toggle the layout node named in `extensions.json` (`{node, label, icon}`); the button is lit while the node is shown.

## Built from

Mods copied here: `arc-ext` (sidebar and status bar), `arc-space-pane`, `arc-space-confirm`, `arc-space-toast`, `arc-ext-launcher`, `arc-ext-palette`. Not copied: `skillshare` (https://github.com/runkids/skillshare/tree/main/herdr/skillshare-mod). The layout names `workspace-chrome` nowhere; it uses only the mods above and `skillshare`.

Keys: `keys.json` (Windows and Linux, ctrl-shift and alt) or `keys.macos.json` (cmd), both under `layout:arc-ext`. Merge into `keys.json`.

## Watch out

- Programs it runs: `herdr-app do ...`, and the help command of a pane's program (8s timeout) for "reopen closed tab". Network: none. `bin/haptic` is a macOS-only helper for the theme picker's trackpad tick; it does nothing elsewhere.
- No `skillshare` mod means the `skillshare-panel` node and the Skillshare button have nothing to show: install that mod, or delete the node and the `extensions.json` entry.
- Timers started inside `render` never fire; defer through `cx.spawn` in `init`.
- To add an extension button: add a hidden column node with the mod's block to the layout, then a line in `extensions.json`.

## Done when

- `herdr-app check` passes for every mod in `mods/`, and `layout.switch {"name": "arc-ext"}` shows the sidebar, bar and gradient.
- The bar shows the machine and, inside a git repo, the branch; the Skillshare button toggles its panel.
- With two machines connected, the machine chip lists both and each machine shows only its own spaces.
- Ctrl+Tab flips to the previous pane on a quick tap and walks the list when held; Shift+Tab goes back.

## Optional extension panels

The layout also holds hidden `pr-panel` and `issues-panel` columns (368px) for the `branch-pr` and `branch-issue` mods from https://github.com/munza/herdr-mods, with PRs and Issues buttons in `extensions.json`. Those mods are not copied here: each needs a Go 1.23+ helper built by its own installer (`go -C helper run ./install`), `gh` signed in for PRs, and a Linear key or GitHub mode for Issues. Without them, delete the two nodes and the two `extensions.json` entries.

`mods/branch-issue` is a copy of Branch Issue with GitHub Issues as the default provider and SSH-alias remotes (`github-cic`) recognised; it needs only `gh`, no helper build. The Linear provider needs the upstream helper. Branch PR is not copied: install it from munza/herdr-mods with Go 1.23+.

## GitHub accounts per repository

PRs and Issues call `gh` on the computer showing the window, so they use its active account. `gh-accounts.json` (copy it to the Herdr home) maps a remote's SSH host alias to a gh login: `{"github-cic": "zchristmas-cic", "github-personal": "zachristmas", "github-parallel5": "zparallel5"}`. A mapped repo runs as that login (its token goes to gh in `GH_TOKEN`, the active account is never switched); an alias not in the file, or a login not on this machine, uses the active account. Run `scripts/install-extensions.sh` to build `gh-as` for Issues and install Branch PR with the patch in `patches/branch-pr/`.
