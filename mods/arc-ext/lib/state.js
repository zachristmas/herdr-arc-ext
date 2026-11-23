// Every shared-state key this mod reads or writes, one name each, so a typo
// cannot silently split a value in two. These strings are live user state
// (shared.json): never rename one without migrating it.
//
// Paired with terminals-launcher: its lib/state.js repeats the same strings
// for LAUNCHER_OPEN, LAUNCHER_MODE, LAUNCHER_STEP and RECENT_PANES. A mod
// folder must stay self-contained, so the copy is deliberate.
export const THEMES = "arc-ext.themes";
export const JOB = "arc-ext.job";
export const MENU_OPEN = "arc-ext.menu-open";
export const COLLAPSED = "arc-ext.collapsed";
export const WIDTH = "arc-ext.width";
export const RECENT_PANES = "arc-ext.recent-panes";
export const CLOSED = "arc-ext.closed";

// terminals-launcher's own state, opened and driven from this sidebar.
export const LAUNCHER_OPEN = "terminals-launcher.open";
export const LAUNCHER_MODE = "terminals-launcher.mode";
export const LAUNCHER_STEP = "terminals-launcher.step";

// Herdr's own key: the shown layout's name.
export const LAYOUT = "layout";
