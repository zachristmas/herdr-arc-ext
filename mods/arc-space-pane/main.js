import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, home, shared, window as win } from "herdr";
import { Tips } from "./tip.js";


function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class TerminalsPane extends View {
  init(_props, cx) {
    this.jobs = [];
    this.tips = new Tips((ms, fn) => {
      this.jobs.push({ ms, fn });
      this.wake?.();
    });
    cx.spawn(async (cx) => {
      for (;;) {
        await new Promise((wake) => (this.wake = wake));
        for (const job of this.jobs.splice(0)) {
          cx.timer.after(job.ms, (cx) => {
            job.fn();
            cx.notify();
          });
        }
      }
    });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(id, icon, command, args, label, keys) {
    return this.tips.wrap(id, div()
      .id(id)
      .p(4)
      .rounded(5)
      .text_color("#5d6168")
      .cursor_pointer()
      .hover((s) => s.bg("#ffffff0d").text_color("#d6d8db"))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/arc-space-pane/icons/${icon}.svg`).size(15)), label, keys);
  }

  lead(p) {
    if (!shared("arc-space.collapsed")) return null;
    return panes().find((q) => q.tab === p.tab)?.pane === p.pane ? p : null;
  }

  render() {
    const p = this.me();
    if (!p) return div();
    const pane = p.pane;
    const g = p.program;
    const where = folder(p.cwd);
    // Shells often put the folder in their title already.
    const title = p.title || "shell";
    const dir = where && !title.includes(where) && !/^[~/]/.test(title) ? where : "";
    const first = this.lead(p);
    const w = win() ?? {};
    const mac = w.platform === "macos" && w.titlebar === "none" && !w.fullscreen;
    return h_flex()
      .id(`tm-head-${pane}`)
      .size_full()
      .pl(12)
      .pr(8)
      .gap(8)
      .items_center()
      .text_size(14)
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(first) && mac, (el) => el.pl(76))
      .when(Boolean(first), (el) =>
        el.child(
          this.tips.wrap(
            `th-side-${pane}`,
            div()
              .id(`th-side-${pane}`)
              .p(4)
              .rounded(5)
              .text_color("#8b8f95")
              .cursor_pointer()
              .hover((s) => s.bg("#ffffff0d").text_color("#d6d8db"))
              .on_click((_e, cx) => {
                cx.stop_propagation();
                run("arc-space.toggle");
              })
              .child(svg("mods/arc-space-pane/sidebar.svg").size(16)),
            "Toggle sidebar",
            "cmd-s",
          ),
        ),
      )
      .when(Boolean(g?.icon), (el) =>
        el.child(g.tint ? svg(g.icon).size(16).flex_none().text_color("#d6d8db") : image(g.icon).w(15).h(15).flex_none()),
      )
      .child(div().flex_none().max_w(320).truncate().font_semibold().text_color(p.focused ? "#e8e9eb" : "#a9adb3").child(title))
      .child(div().flex_1().truncate().text_color("#8b8f95").child(dir))
      .child(this.button(`th-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }, "Split right", "cmd-d"))
      .child(this.button(`th-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }, "Split down", "cmd-shift-d"))
      .child(this.button(`th-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }, p.zoomed ? "Unzoom pane" : "Zoom pane", "cmd-shift-enter"))
      .child(this.button(`th-x-${pane}`, "close", "pane.close", { pane }, "Close pane", "cmd-w"));
  }
}
