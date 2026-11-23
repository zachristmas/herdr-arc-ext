// The small pieces a tab or space is drawn from: its program tile, its label,
// the row it sits in, and the buttons beside it. Shared by the sidebar and the
// menus so both name a tab the same way.
import { div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { run, home } from "herdr";

export function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export function lead(mine) {
  return mine.find((p) => p.focused) ?? mine.find((p) => p.program?.agent) ?? mine[0];
}

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

export function liveTitle(p) {
  if (!p?.program?.agent) return "";
  const live = clean(p.title);
  const path = /^[~/]|^[A-Za-z]:\\/.test((p.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  const telling = live && live !== p.terminal && live !== p.program.name && !path && !live.includes("@") && live.toLowerCase() !== p.program.key;
  return telling ? live : "";
}

export function label(tab, p) {
  const prog = p?.program?.name;
  const base = tab.named ? tab.name : prog ?? "Terminal";
  const live = liveTitle(p);
  return (tab.name === prog || !tab.named) && live ? live : base;
}

export function paneLabel(p) {
  if (!p.terminal) return p.title;
  return liveTitle(p) || p.program?.name || folder(p.cwd).split("/").pop() || "Terminal";
}

export function tile(t, p, C) {
  const g = p?.program;
  const dot = p?.status && p.status !== "idle" ? t[p.status] : null;
  return div()
    .relative()
    .flex_none()
    .w(20)
    .h(20)
    .rounded(5)
    .bg(g?.tile ?? C.chip)
    .flex()
    .items_center()
    .justify_center()
    .when(Boolean(g?.icon), (el) =>
      el.child(g.tint ? svg(g.icon).size(12).text_color(g.color ?? C.text) : image(g.icon).w(12).h(12)),
    )
    .when(Boolean(dot), (el) =>
      el.child(div().absolute().top(-3).right(-3).w(9).h(9).rounded_full().border_2().border_color(C.dot).bg(dot)),
    );
}

export function badge(n, C) {
  return div()
    .flex_none()
    .px(5)
    .h(18)
    .rounded(5)
    .bg(C.rule)
    .flex()
    .items_center()
    .text_size(11)
    .text_color(C.text)
    .child(`⌘${n}`);
}

export function own(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_mouse_down("right", (_e, cx) => cx.stop_propagation());
}

export function windowButton(id, icon, command, C) {
  return own(div())
    .id(id)
    .flex_none()
    .w(24)
    .h(24)
    .rounded_full()
    .flex()
    .items_center()
    .justify_center()
    .text_color(C.dim)
    .cursor_pointer()
    .hover((s) => s.bg(C.hover).text_color(C.text))
    .on_click(() => run(command))
    .child(svg(`mods/arc-ext/${icon}.svg`).size(14));
}

export function iconButton(id, icon, onClick, C) {
  return own(div())
    .id(id)
    .flex_none()
    .p(6)
    .rounded(7)
    .text_color(C.dim)
    .cursor_pointer()
    .hover((s) => s.bg(C.hover).text_color(C.text))
    .on_click(onClick)
    .child(svg(`mods/arc-ext/${icon}.svg`).size(16));
}

export function row(id, C) {
  return own(h_flex())
    .id(id)
    .flex_none()
    .w_full()
    .min_w(0)
    .h(38)
    .px(10)
    .gap(10)
    .items_center()
    .rounded(10)
    .cursor_pointer()
    .text_size(13)
    .active((s) => s.bg(C.pressed).shadow_none().pt(2));
}
