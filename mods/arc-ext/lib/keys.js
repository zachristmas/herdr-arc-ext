// The shortcut each action shows in tooltips, for this platform. The bindings
// themselves are in keys.json (Windows, Linux) and keys.macos.json.
import { window as win } from "herdr";

export const isMac = () => win()?.platform === "macos";

const WIN = { launch: "ctrl-shift-t", palette: "ctrl-shift-p", toggle: "ctrl-shift-b", closeTab: "ctrl-shift-w", machine: "ctrl-shift-m", space: (n) => `alt-${n}` };
const MAC = { launch: "cmd-t", palette: "cmd-shift-p", toggle: "cmd-s", closeTab: "cmd-w", machine: "cmd-shift-m", space: (n) => `ctrl-${n}` };

export const hint = (name, n) => {
  const k = (isMac() ? MAC : WIN)[name];
  return typeof k === "function" ? k(n) : k;
};
