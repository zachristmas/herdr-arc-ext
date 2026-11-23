// Pinned tabs, folders and favorites, kept as labels on a tab's terminals so they ride
// Herdr's core and show up on every window attached to that machine (PC and Mac alike):
//   arc.pin=<time>      pinned tab (time orders the pins)
//   arc.fav=<time>      favorite tab (Arc's tile row, per machine)
//   arc.folder=<name>   the tab's folder in its space
// Every terminal of a tab carries the labels, so closing one keeps them. Writes show at once
// through a short-lived local overlay while the core catches up. Screen-local state (whether a
// folder is open, folders with no tabs yet) stays in the shared store.
import { shared, setShared, spaces, terminals, exec } from "herdr";
import { herdr } from "./herdr.js";

export const OPEN = "arc-ext.folders-open"; // { [spaceId]: { [folderName]: false } } (open unless false)
export const EMPTY = "arc-ext.folders-empty"; // { [spaceId]: [name...] }

const HOLD = 6000;
const overlay = new Map(); // tabId -> { at, set: { key: value|"" } }

const stamp = () => Date.now().toString(36);

// tabId -> [terminal address] and tabId -> merged arc.* labels
function index() {
  const out = new Map();
  for (const t of terminals()) {
    const tab = t.labels?.["herdr.tab"];
    if (!tab) continue;
    const slash = t.address.indexOf("/");
    const id = (slash >= 0 ? t.address.slice(0, slash + 1) : "") + tab;
    const e = out.get(id) ?? { addrs: [], labels: {} };
    e.addrs.push(t.address);
    for (const [k, v] of Object.entries(t.labels)) if (k.startsWith("arc.") && v !== "" && !e.labels[k]) e.labels[k] = v;
    out.set(id, e);
  }
  return out;
}

function labelsOf(idx, tabId) {
  const base = { ...(idx.get(tabId)?.labels ?? {}) };
  const o = overlay.get(tabId);
  if (o) {
    if (Date.now() - o.at > HOLD) overlay.delete(tabId);
    else for (const [k, v] of Object.entries(o.set)) if (v === "") delete base[k]; else base[k] = v;
  }
  return base;
}

function write(tabId, set) {
  overlay.set(tabId, { at: Date.now(), set: { ...(overlay.get(tabId)?.set ?? {}), ...set } });
  const addrs = index().get(tabId)?.addrs ?? [];
  const args = Object.entries(set).map(([k, v]) => `${k}=${v}`);
  for (const a of addrs) exec("hc", ["label", a, ...args]).catch(() => {});
}

const tabOf = (spaceId, tabId) => spaces().find((s) => s.id === spaceId)?.tabs.find((c) => c.id === tabId);
const tabsOf = (spaceId) => spaces().find((s) => s.id === spaceId)?.tabs ?? [];
const timeOf = (v) => parseInt(v, 36) || 0;

// Pinned tabs sort first in the core's own tab order, so every window agrees on positions.
async function sortPinsFirst(spaceId) {
  const idx = index();
  const tabs = tabsOf(spaceId);
  const pinned = tabs.filter((c) => labelsOf(idx, c.id)["arc.pin"]).sort((a, b) => timeOf(labelsOf(idx, a.id)["arc.pin"]) - timeOf(labelsOf(idx, b.id)["arc.pin"]));
  for (let i = 0; i < pinned.length; i++) {
    if (tabsOf(spaceId).find((c) => c.id === pinned[i].id)?.index !== i + 1) await herdr("tab.move", { id: pinned[i].id, index: i }).catch(() => {});
  }
}

export function pinTab(spaceId, tabId) {
  write(tabId, { "arc.pin": stamp(), "arc.folder": "" });
  sortPinsFirst(spaceId).catch(() => {});
}

export const unpinTab = (spaceId, tabId) => write(tabId, { "arc.pin": "", "arc.folder": "" });
export const removeFromFolder = unpinTab; // back to the plain list

const emptyOf = (spaceId) => (shared(EMPTY) ?? {})[spaceId] ?? [];
const setEmpty = (spaceId, names) => setShared(EMPTY, { ...(shared(EMPTY) ?? {}), [spaceId]: names });

export function newFolder(spaceId, name, tabId) {
  const n = name.trim() || "Folder";
  if (tabId) write(tabId, { "arc.folder": n, "arc.pin": "" });
  else if (!emptyOf(spaceId).includes(n)) setEmpty(spaceId, [...emptyOf(spaceId), n]);
  return n;
}

export function moveToFolder(spaceId, tabId, folderId) {
  write(tabId, { "arc.folder": folderId, "arc.pin": "" });
  setFolderOpen(spaceId, folderId, true);
}

const setFolderOpen = (spaceId, name, open) => {
  const all = shared(OPEN) ?? {};
  setShared(OPEN, { ...all, [spaceId]: { ...(all[spaceId] ?? {}), [name]: open } });
};

export function renameFolder(spaceId, folderId, name) {
  const n = name.trim();
  if (!n || n === folderId) return;
  const idx = index();
  for (const c of tabsOf(spaceId)) if (labelsOf(idx, c.id)["arc.folder"] === folderId) write(c.id, { "arc.folder": n });
  setEmpty(spaceId, emptyOf(spaceId).map((x) => (x === folderId ? n : x)));
  const open = (shared(OPEN) ?? {})[spaceId]?.[folderId];
  if (open === false) setFolderOpen(spaceId, n, false);
}

export function toggleFolder(spaceId, folderId) {
  const open = (shared(OPEN) ?? {})[spaceId]?.[folderId] !== false;
  setFolderOpen(spaceId, folderId, !open);
}

// Deleting a folder puts its tabs back in the plain list.
export function deleteFolder(spaceId, folderId) {
  const idx = index();
  for (const c of tabsOf(spaceId)) if (labelsOf(idx, c.id)["arc.folder"] === folderId) write(c.id, { "arc.folder": "" });
  setEmpty(spaceId, emptyOf(spaceId).filter((x) => x !== folderId));
}

// [{ id, name, open, tabs: [tabId] }] in first-seen order
export function foldersOf(spaceId) {
  const idx = index();
  const map = new Map(emptyOf(spaceId).map((n) => [n, []]));
  for (const c of tabsOf(spaceId)) {
    const f = labelsOf(idx, c.id)["arc.folder"];
    if (f) map.set(f, [...(map.get(f) ?? []), c.id]);
  }
  const open = (shared(OPEN) ?? {})[spaceId] ?? {};
  return [...map].map(([name, tabs]) => ({ id: name, name, open: open[name] !== false, tabs }));
}

export const isPinned = (spaceId, tabId) => Boolean(labelsOf(index(), tabId)["arc.pin"]);
export const folderOf = (spaceId, tabId) => foldersOf(spaceId).find((f) => f.tabs.includes(tabId)) ?? null;

export const isFavorite = (tabId) => Boolean(labelsOf(index(), tabId)["arc.fav"]);
export const favorite = (spaceId, tabId) => write(tabId, { "arc.fav": stamp() });
export const unfavorite = (tabId) => write(tabId, { "arc.fav": "" });

// Favorites whose space lives on `machine`: [{ space, tab }] in the order they were added.
export function favoritesOn(machine) {
  const idx = index();
  const out = [];
  for (const s of spaces()) {
    if ((s.machine ?? "") !== machine) continue;
    for (const c of s.tabs) {
      const t = labelsOf(idx, c.id)["arc.fav"];
      if (t) out.push({ space: s, tab: c, at: timeOf(t) });
    }
  }
  return out.sort((a, b) => a.at - b.at).map(({ space, tab }) => ({ space, tab }));
}

// What the sidebar draws for a space below the favorites, in order: pinned tabs, folders
// with their tabs, then the rest. `ordered` is every tab in that order (for the number shortcuts).
export function arrange(space) {
  const idx = index();
  const L = (c) => labelsOf(idx, c.id);
  const shown = space.tabs.filter((c) => !L(c)["arc.fav"]);
  const pinned = shown.filter((c) => L(c)["arc.pin"]).sort((a, b) => timeOf(L(a)["arc.pin"]) - timeOf(L(b)["arc.pin"]));
  const open = (shared(OPEN) ?? {})[space.id] ?? {};
  const names = [...new Set([...emptyOf(space.id), ...shown.map((c) => L(c)["arc.folder"]).filter(Boolean)])];
  const folders = names.map((name) => ({ id: name, name, open: open[name] !== false, tabs: shown.filter((c) => !L(c)["arc.pin"] && L(c)["arc.folder"] === name) }));
  const placed = new Set([...pinned, ...folders.flatMap((f) => f.tabs)].map((c) => c.id));
  const rest = shown.filter((c) => !placed.has(c.id));
  return { pinned, folders, rest, ordered: [...pinned, ...folders.flatMap((f) => f.tabs), ...rest] };
}
