// What arc-space opens over the sidebar: a tab's or a space's context menu,
// and the small picker that splits a tab with another one.
//
// The panel itself is a Herdr surface (a popover), so everything drawn on it
// takes its colours from Herdr's theme too. palette() is chosen for contrast
// against the space gradient underneath, not against the popover: on a light
// gradient it picks near-black text, which is unreadable on a dark popover.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { spaces, panes, machines, theme, run, openOverlay, props, closeOverlay, shared, setShared } from "herdr";
import { iconMenu } from "./icons.js";
import { goMachine, machineLabel, machineNames, machineOf } from "../lib/machine.js";
import { lead, label as tabLabel, tile } from "./rows.js";
import { JOB } from "../lib/state.js";

function job(spec) {
  setShared(JOB, spec);
  run("arc-ext.job");
}

// What a menu or picker draws with: Herdr's own surface colours, read once per
// render from theme(). `chip` and `dot` are what rows.js's tile() needs inside
// a popover: a raised chip, and a ring in the panel colour around a status dot.
function surface(t) {
  return {
    panel: t.popover,
    edge: t.border,
    text: t.foreground,
    soft: t.muted,
    dim: t.muted,
    hover: t.hover,
    rule: t.border,
    chip: t.raised,
    dot: t.popover,
  };
}

function menuPanel(items, S) {
  return v_flex().id("ctx-menu").w_full().p(6).gap(1).rounded(12).border_1().border_color(S.edge).bg(S.panel).shadow_lg().children(items);
}

function menuItem(overlay, id, label, action, danger, S) {
  return div()
    .id(`mn-${id}`)
    .h(34)
    .px(12)
    .flex()
    .items_center()
    .rounded(8)
    .cursor_pointer()
    .text_size(13.5)
    .text_color(danger ? "#ff8a80" : S.text)
    .hover((s) => s.bg(S.hover).text_color(S.text))
    .on_click(() => {
      closeOverlay(overlay);
      action();
    })
    .child(label);
}

function rule(S) {
  return div().h(1).mx(8).my(4).bg(S.edge);
}

export function tabMenu(tab, space, pane) {
  const split = panes().filter((q) => q.tab === tab).length > 1;
  const rows = split ? (pane ? 3 : 2) : 3;
  openOverlay({ mod: "arc-ext", kind: "popup", width: 230, height: 22 + rows * 35 + 9, frame: "none", props: { view: "tab-menu", tab, space, pane, split } });
}

export function tabMenuView() {
  const { tab, space, pane, split, overlay } = props();
  const S = surface(theme());
  const items = split
    ? [menuItem(overlay, "separate", "Separate All Tabs", () => job({ kind: "separate", tab }), false, S)]
    : [
        menuItem(overlay, "add-split", "Add Split Terminal\u2026", () =>
          openOverlay({ mod: "arc-ext", kind: "popup", width: 280, height: 360, frame: "none", props: { view: "tab-pick", tab, space } }), false, S,
        ),
        menuItem(overlay, "rename", "Rename Tab\u2026", () => run("tab.rename", { id: tab }), false, S),
      ];
  items.push(rule(S));
  if (split && pane) items.push(menuItem(overlay, "close-pane", "Close Pane", () => run("pane.close", { pane }), true, S));
  items.push(menuItem(overlay, "close-tab", "Close Tab", () => closeTab(tab, space), true, S));
  return menuPanel(items, S);
}

export function tabPickView() {
  const { tab, space, overlay } = props();
  const t = theme();
  const S = surface(t);
  const all = panes();
  const others = (spaces().find((p) => p.id === space)?.tabs ?? []).filter((c) => c.id !== tab);
  const rows = others.map((c) => {
    const mine = all.filter((q) => q.tab === c.id);
    const p = lead(mine);
    return div()
      .id(`pick-${c.id}`)
      .h(38)
      .px(10)
      .flex()
      .gap(10)
      .items_center()
      .rounded(8)
      .cursor_pointer()
      .text_size(13.5)
      .text_color(S.text)
      .hover((s) => s.bg(S.hover).text_color(S.text))
      .on_click(() => {
        closeOverlay(overlay);
        job({ kind: "merge", into: tab, from: c.id });
      })
      .child(tile(t, p, S))
      .child(div().flex_1().min_w(0).truncate().child(tabLabel(c, p)))
      .when(mine.length > 1, (el) => el.child(div().text_size(11.5).text_color(S.dim).child(`${mine.length} panes`)));
  });
  return menuPanel([
    div().px(12).pt(6).pb(4).text_size(11).font_semibold().text_color(S.dim).child("SPLIT WITH"),
    ...(rows.length ? rows : [div().px(12).py(8).text_size(13).text_color(S.dim).child("No other tabs in this space")]),
  ], S);
}

export function spaceMenu(spaceId) {
  openOverlay({ mod: "arc-ext", kind: "popup", width: 230, height: 207, frame: "none", props: { view: "menu", space: spaceId } });
}

export function menuView() {
  const { space, overlay } = props();
  const S = surface(theme());
  const item = (id, label, action, danger) =>
    div()
      .id(`mn-${id}`)
      .h(34)
      .px(12)
      .flex()
      .items_center()
      .rounded(8)
      .cursor_pointer()
      .text_size(13.5)
      .text_color(danger ? "#ff8a80" : S.text)
      .hover((s) => s.bg(S.hover).text_color(S.text))
      .on_click(() => {
        closeOverlay(overlay);
        action();
      })
      .child(label);
  return v_flex()
    .id("space-menu")
    .w_full()
    .p(6)
    .gap(1)
    .rounded(12)
    .border_1()
    .border_color(S.edge)
    .bg(S.panel)
    .shadow_lg()
    .child(item("theme", "Edit Theme Color\u2026", () => editTheme(space)))
    .child(item("icon", "Set Icon…", () => iconMenu(space)))
    .child(item("rename", "Rename Space\u2026", () => run("space.rename", { id: space })))
    .child(item("tab", "New Tab", () => run("tab.new", { space })))
    .child(div().h(1).mx(8).my(4).bg(S.edge))
    .child(item("close", "Close Space", () => confirmCloseSpace(space), true));
}

function confirm(title, detail, ok, command) {
  openOverlay({ mod: "arc-space-confirm", kind: "dialog", frame: "none", width: 400, height: 170, props: { title, detail, confirm: ok, command } });
}

function confirmCloseSpace(spaceId) {
  const s = spaces().find((p) => p.id === spaceId);
  const n = s?.tabs.length ?? 0;
  confirm(
    `Close “${s?.name ?? "this space"}”?`,
    `Its ${n === 1 ? "tab" : `${n} tabs`} and every terminal in ${n === 1 ? "it" : "them"} will end.`,
    "Close Space",
    { name: "space.close", args: { id: spaceId, confirmed: true } },
  );
}

export function closeTab(tabId, spaceId) {
  const s = spaces().find((p) => p.id === spaceId);
  if (s && s.tabs.length <= 1) confirmCloseSpace(spaceId);
  else run("tab.close", { id: tabId, confirmed: true });
}

export function editTheme(spaceId) {
  openOverlay({ mod: "arc-ext", kind: "popup", width: 376, height: 600, frame: "none", props: { view: "theme", space: spaceId } });
}

// The machine picker: opened from the status bar's machine chip.
export function machineMenu() {
  const rows = machineNames().length;
  openOverlay({ mod: "arc-ext", kind: "popup", width: 270, height: 22 + rows * 35 + 9, frame: "none", props: { view: "machine-menu" } });
}

export function machineMenuView() {
  const { overlay } = props();
  const t = theme();
  const S = surface(t);
  const here = machineOf(spaces().find((s) => s.active));
  const state = (name) => machines().find((mc) => (mc.name ?? "") === name)?.layout;
  const items = machineNames().map((name) => {
    const n = spaces().filter((s) => machineOf(s) === name).length;
    const down = name !== "" && state(name) === "unavailable";
    const dot = down ? "#ff8a80" : state(name) === "loading" ? "#e6c07b" : "#7fd99a";
    return div()
      .id(`mc-${name || "local"}`)
      .h(34)
      .px(12)
      .gap(10)
      .flex()
      .items_center()
      .rounded(8)
      .cursor_pointer()
      .text_size(13.5)
      .text_color(S.text)
      .when(name === here, (el) => el.bg(S.hover))
      .hover((s) => s.bg(S.hover))
      .on_click(() => {
        closeOverlay(overlay);
        goMachine(name);
      })
      .child(div().flex_none().w(8).h(8).rounded_full().bg(dot))
      .child(div().flex_1().truncate().child(machineLabel(name)))
      .child(div().flex_none().text_size(11).text_color(S.dim).child(`${n} space${n === 1 ? "" : "s"}`));
  });
  return menuPanel(items, S);
}
