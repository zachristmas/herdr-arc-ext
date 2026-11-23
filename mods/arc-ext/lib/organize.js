// Pinned tabs and folders, per space, kept in Herdr's shared store:
//   { [spaceId]: { pins: [tabId...], folders: [{ id, name, open, tabs: [tabId...] }] } }
// A tab is in at most one of: the pins, one folder, or neither (then it is in the
// plain list below). Ids of tabs that no longer exist are dropped when read.
import { shared, setShared } from "herdr";

export const ORGANIZE = "arc-ext.organize";

const read = (spaceId) => {
  const o = (shared(ORGANIZE) ?? {})[spaceId] ?? {};
  return { pins: [...(o.pins ?? [])], folders: (o.folders ?? []).map((f) => ({ ...f, tabs: [...(f.tabs ?? [])] })) };
};
const save = (spaceId, o) => setShared(ORGANIZE, { ...(shared(ORGANIZE) ?? {}), [spaceId]: o });
const without = (o, tabId) => ({
  pins: o.pins.filter((x) => x !== tabId),
  folders: o.folders.map((f) => ({ ...f, tabs: f.tabs.filter((x) => x !== tabId) })),
});

export function pinTab(spaceId, tabId) {
  const o = without(read(spaceId), tabId);
  o.pins.push(tabId);
  save(spaceId, o);
}

export const unpinTab = (spaceId, tabId) => save(spaceId, without(read(spaceId), tabId));
export const removeFromFolder = unpinTab; // back to the plain list

export function newFolder(spaceId, name, tabId) {
  const o = tabId ? without(read(spaceId), tabId) : read(spaceId);
  const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  o.folders.push({ id, name: name.trim() || "Folder", open: true, tabs: tabId ? [tabId] : [] });
  save(spaceId, o);
  return id;
}

export function moveToFolder(spaceId, tabId, folderId) {
  const o = without(read(spaceId), tabId);
  const f = o.folders.find((x) => x.id === folderId);
  if (!f) return;
  f.tabs.push(tabId);
  f.open = true;
  save(spaceId, o);
}

export function renameFolder(spaceId, folderId, name) {
  const o = read(spaceId);
  const f = o.folders.find((x) => x.id === folderId);
  if (f && name.trim()) f.name = name.trim();
  save(spaceId, o);
}

export function toggleFolder(spaceId, folderId) {
  const o = read(spaceId);
  const f = o.folders.find((x) => x.id === folderId);
  if (f) f.open = !f.open;
  save(spaceId, o);
}

// Deleting a folder puts its tabs back in the plain list.
export function deleteFolder(spaceId, folderId) {
  const o = read(spaceId);
  o.folders = o.folders.filter((x) => x.id !== folderId);
  save(spaceId, o);
}

export const foldersOf = (spaceId) => read(spaceId).folders;
export const isPinned = (spaceId, tabId) => read(spaceId).pins.includes(tabId);
export const folderOf = (spaceId, tabId) => read(spaceId).folders.find((f) => f.tabs.includes(tabId)) ?? null;

// What the sidebar draws for a space, in order: pinned tabs, folders with their tabs,
// then the rest. `ordered` is every tab in that visual order (for the number shortcuts).
export function arrange(space) {
  const byId = new Map(space.tabs.map((c) => [c.id, c]));
  const o = read(space.id);
  const take = (ids) => ids.map((id) => byId.get(id)).filter(Boolean);
  const pinned = take(o.pins);
  const folders = o.folders.map((f) => ({ ...f, tabs: take(f.tabs) }));
  const placed = new Set([...pinned, ...folders.flatMap((f) => f.tabs)].map((c) => c.id));
  const rest = space.tabs.filter((c) => !placed.has(c.id));
  return { pinned, folders, rest, ordered: [...pinned, ...folders.flatMap((f) => f.tabs), ...rest] };
}
