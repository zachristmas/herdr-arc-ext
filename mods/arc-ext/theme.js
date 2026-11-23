import { shared, setShared, settings } from "herdr";
import {
  clamp, DEFAULT, LIGHT_TEXT, DARK_TEXT, textOn,
  colors as pureColors, backgrounds as pureBackgrounds, isDark as pureIsDark,
} from "./lib/color.js";
import { THEMES } from "./lib/state.js";
import { readSpaceLabel, writeSpaceLabel } from "./lib/spacelabel.js";

export {
  PRESET_SETS, EMPTY, MAX_DOTS, DEFAULT, clamp,
  hexToRgb, rgbToHex, hslToHex, hexToHsl, mix, contrast, textOn, dotHex,
  radiusOf, moveDots,
} from "./lib/color.js";

// The colour maths is pure (lib/color.js, tested by node --test). These three
// read the host's appearance setting and hand it in, so auto still follows it.
const systemDark = () => settings().dark !== false;

export function isDark(theme) {
  return pureIsDark(theme, systemDark());
}

export function colors(theme) {
  return pureColors(theme, systemDark());
}

export function backgrounds(theme) {
  return pureBackgrounds(theme, systemDark());
}

export function themeFor(spaceId) {
  const t = readSpaceLabel(spaceId, "arc.theme", THEMES);
  if (!t) return DEFAULT;
  const dots = (t.dots ?? []).map((d) => (d.r === undefined ? { h: d.h, r: clamp((0.85 - d.l) / (0.85 - 0.3), 0, 1) } : d));
  return { ...DEFAULT, ...t, dots };
}

export function saveTheme(spaceId, theme) {
  writeSpaceLabel(spaceId, "arc.theme", theme, THEMES);
}

export function palette(theme) {
  const cs = colors(theme);
  if (textOn(cs) === "light") {
    return {
      selected: "#ffffff24", selectedEdge: "#ffffff1f", split: "#ffffff0f", chip: "#ffffff0d",
      hover: "#ffffff12", rule: "#ffffff1a", text: LIGHT_TEXT, soft: "#d2d4d8", dim: "#ffffff8c",
      dot: cs[0], pressed: "#00000033",
    };
  }
  return {
    selected: "#ffffffb8", selectedEdge: "#ffffffcc", split: "#ffffff4d", chip: "#ffffff40",
    hover: "#0000000f", rule: "#0000001a", text: DARK_TEXT, soft: "#2f3137", dim: "#0000008c",
    dot: cs[0], pressed: "#0000001f",
  };
}

export function find(node, id) {
  if (node.id === id) return node;
  for (const c of node.children ?? []) {
    const hit = find(c, id);
    if (hit) return hit;
  }
  return null;
}

export function apply(tree, theme, sidebarPx) {
  const bg = backgrounds(theme);
  const next = JSON.parse(JSON.stringify(tree));
  next.background = bg.root;
  const tint = next.children.find((c) => c.id === "tint");
  tint.background = bg.tint;
  tint.children.find((c) => c.id === "grain").background = bg.grain;
  find(next, "sidebar").size = { px: sidebarPx };
  find(next, "main").content.pane.focus = { width: 2, color: bg.focus };
  return next;
}
