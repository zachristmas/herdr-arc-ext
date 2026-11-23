// A space's theme and icon, kept as labels (arc.theme, arc.icon) on every terminal in the
// space so they reach every window on that machine. Spaces have no labels of their own.
// The shared store keeps a copy as a cache for spaces that have no terminal yet.
import { shared, setShared, terminals, exec } from "herdr";

const held = new Map(); // `${space}|${key}` -> { at, value }
const HOLD = 6000;

function addrsOf(spaceId) {
  const slash = spaceId.indexOf("/");
  const prefix = slash >= 0 ? spaceId.slice(0, slash + 1) : "";
  const bare = slash >= 0 ? spaceId.slice(slash + 1) : spaceId;
  return terminals().filter((t) => t.labels?.["herdr.space"] === bare && (t.address.startsWith(prefix) && (prefix || !t.address.includes("/"))));
}

export function readSpaceLabel(spaceId, key, cacheKey) {
  const h = held.get(`${spaceId}|${key}`);
  if (h && Date.now() - h.at < HOLD) return h.value;
  for (const t of addrsOf(spaceId)) {
    const v = t.labels?.[key];
    if (v) {
      try { return JSON.parse(decodeURIComponent(v)); } catch { /* fall through */ }
    }
  }
  return (shared(cacheKey) ?? {})[spaceId] ?? null;
}

export function writeSpaceLabel(spaceId, key, value, cacheKey) {
  held.set(`${spaceId}|${key}`, { at: Date.now(), value });
  const all = { ...(shared(cacheKey) ?? {}) };
  if (value) all[spaceId] = value; else delete all[spaceId];
  setShared(cacheKey, all);
  const text = value ? encodeURIComponent(JSON.stringify(value)) : "";
  for (const t of addrsOf(spaceId)) exec("hc", ["label", t.address, `${key}=${text}`]).catch(() => {});
}
