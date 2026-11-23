// Every shared-state key this mod reads or writes. These strings are live
// user state (shared.json): never rename one without migrating it.
//
// Paired with arc-space: its lib/state.js repeats LAUNCHER_OPEN, LAUNCHER_MODE,
// LAUNCHER_STEP and RECENT_PANES, because a mod folder must stay self-contained
// and may not import across mods.
export const OPEN = "terminals-launcher.open";
export const MODE = "terminals-launcher.mode";
export const STEP = "terminals-launcher.step";

// Paired with new-menu, which fills this cache of installed agents.
export const NEW_MENU_AGENTS = "new-menu.agents";

// Written by arc-space's sidebar; this launcher orders panes by it.
export const RECENT_PANES = "arc-space.recent-panes";
