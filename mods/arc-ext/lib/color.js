// Pure colour maths: no host APIs, so `node --test` can run it. theme.js keeps
// the glue (shared state, herdr's theme, the layout tree) and re-exports this.

export const PRESET_SETS = [
  ["#fdfbfb", "#f6e6ef", "#e8d3ea", "#f3c9cf", "#f7dfd2", "#fdf5df", "#ddf5e2", "#ddeef6", "#c2c6e2"],
  ["#f1ece6", "#e8a0bf", "#9b72a0", "#e05d6a", "#f08a5d", "#f2d264", "#6ee59a", "#7ab8d9", "#61637f"],
  ["#3b2a45", "#6b2c4f", "#8d3a32", "#b5703a", "#d9b25a", "#d3d3a8", "#8cb88a", "#2e5e3c", "#2b4470"],
];
export const EMPTY = { dark: ["#1c1128", "#3a2741"], light: ["#ece4f0", "#f7f2f5"] };
export const MAX_DOTS = 3;
export const DEFAULT = { dots: [{ h: 137.5, r: 0.318 }], intensity: 0.81, noise: 0, mode: "dark" };
const L_TOP = 0.85;
const L_BOTTOM = 0.3;
const BASE = { dark: "#15161b", light: "#f3f1ed" };
export const LIGHT_TEXT = "#f2f3f5";
export const DARK_TEXT = "#1b1c20";

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}

export function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i] - v) * t));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function dotHex(dot) {
  return hslToHex(dot.h, 0.12 + dot.r * 0.7, 0.8 - dot.r * 0.22);
}

// systemDark is passed in so this stays pure; theme.js supplies settings().dark.
export function isDark(theme, systemDark = true) {
  return theme.mode === "dark" || (theme.mode === "auto" && systemDark);
}

export function colors(theme, systemDark = true) {
  if (!theme.dots.length) return isDark(theme, systemDark) ? EMPTY.dark : EMPTY.light;
  const base = isDark(theme, systemDark) ? BASE.dark : BASE.light;
  const strength = 0.12 + theme.intensity * 0.78;
  return theme.dots.map((d) => mix(base, dotHex(d), strength));
}

export function textOn(backgrounds) {
  const worst = (text) => Math.min(...backgrounds.map((bg) => contrast(text, bg)));
  return worst(LIGHT_TEXT) >= worst(DARK_TEXT) ? "light" : "dark";
}

// The three background layer values for a theme. Grain must survive on every
// machine: any noise above 0.02 selects a tile, 0.02 and below is transparent.
export function backgrounds(theme, systemDark = true) {
  const cs = colors(theme, systemDark);
  const level = theme.noise > 0.02 ? Math.max(1, Math.round(clamp(theme.noise, 0, 1) * 5)) : 0;
  const lead = theme.dots[0];
  return {
    focus: lead ? hslToHex(lead.h, 0.78, 0.72) : "#b9a4e8",
    root: { gradient: [cs[0], cs[1] ?? mix(cs[0], isDark(theme, systemDark) ? "#000000" : "#ffffff", 0.25)], angle: theme.dots.length ? 165 : 100 },
    tint: { gradient: [cs[2] ? cs[2] + "d9" : "#00000000", "#00000000"], angle: 30 },
    grain: level ? { image: `mods/arc-ext/grain/grain-fine-${level}.png`, fit: "cover" } : "#00000000",
  };
}

export function radiusOf(hex) {
  const { s } = hexToHsl(hex);
  return clamp((s - 0.12) / 0.7, 0.15, 1);
}

export function moveDots(dots, index, h, r) {
  const d = dots[index];
  const dh = h - d.h;
  const scale = d.r > 0.02 ? r / d.r : null;
  return dots.map((p, i) => ({
    h: (((i === index ? h : p.h + dh) % 360) + 360) % 360,
    r: clamp(i === index ? r : scale === null ? r : p.r * scale, 0, 1),
  }));
}
