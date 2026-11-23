// Which machine you are working on, and moving between them. The machine is the
// one the shown space lives on; spaces elsewhere are hidden from the bar, the
// switcher and the launcher.
import { spaces, machines, run, shared } from "herdr";

export const LAST_SPACE = "arc-ext.last-space";
export const machineOf = (s) => s?.machine ?? "";
export const machineLabel = (name) => name || "This PC";

export function machineNames() {
  const names = new Set([""]);
  for (const mc of machines()) if (mc.layout !== "unavailable") names.add(mc.name ?? "");
  for (const s of spaces()) names.add(machineOf(s));
  return [...names];
}

// Select the machine's last-used space, or make one there.
export function goMachine(target) {
  const mine = spaces().filter((s) => machineOf(s) === target);
  const last = (shared(LAST_SPACE) ?? {})[target];
  const pick = mine.find((s) => s.id === last) ?? mine[0];
  if (pick) run("space.select", { id: pick.id });
  else run("space.new", { machine: target });
}

export function switchMachine(step) {
  const all = machineNames();
  if (all.length < 2) return;
  const here = machineOf(spaces().find((s) => s.active));
  goMachine(all[(all.indexOf(here) + step + all.length) % all.length]);
}
