import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, spaces, panes, machines, knownAgents, run, theme, props, closeOverlay, shared, setShared, nextCommand } from "herdr";
import { OPEN, MODE, STEP, NEW_MENU_AGENTS, RECENT_PANES } from "./lib/state.js";

const ROW = 48;
const VISIBLE = 8;

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

function paneTitle(p) {
  if (p.mod) return p.mod;
  const live = clean(p.title);
  const prog = p.program?.name;
  const telling =
    live && live !== prog && live.toLowerCase() !== (p.program?.key ?? "").toLowerCase() && !live.includes("@") && !/^[~/]/.test(live);
  return telling ? live : prog ?? "Terminal";
}

function tabTitle(tab, p) {
  const prog = p?.program?.name;
  const live = p?.program?.agent ? clean(p.title) : "";
  const telling = live && live !== prog && live.toLowerCase() !== p.program.key && !live.includes("@") && !/^[~/]/.test(live);
  if (tab.named && tab.name !== prog) return tab.name;
  return telling ? live : prog ?? "Terminal";
}

// The launcher is a Herdr popover, so its surface and the ink on it come from
// theme(), read once per render; palette() describes the space gradient, not a
// popover, and would put near-black text on a dark panel.
function programIcon(g, t) {
  if (!g?.icon) return svg("icons/shell.svg").size(15).text_color(t.foreground);
  return g.tint ? svg(g.icon).size(15).text_color(g.color ?? t.foreground) : image(g.icon).w(15).h(15);
}

function tile(icon, bg, t) {
  return div().flex_none().w(28).h(28).rounded(7).bg(bg ?? t.raised).flex().items_center().justify_center().child(icon);
}

// A tab in a space on another machine only opens through herdr-app itself (run() did nothing there).
const newTab = (args) => exec("herdr-app", ["do", "tab.new", JSON.stringify(args)]).catch(() => run("tab.new", args));

export default class Launcher extends View {
  init(_props, cx) {
    if (props()?.overlay) setShared(OPEN, props().overlay);
    this.mode = props()?.mode === "panes" ? "panes" : props()?.mode === "machines" ? "machines" : "all";
    if (props()?.overlay) setShared(MODE, this.mode);
    this.step = shared(STEP) ?? 0;
    const space = spaces().find((s) => s.active);
    this.where = space?.machine ?? "";
    this.agents = shared(NEW_MENU_AGENTS)?.[this.where] ?? [];
    this.filter = "";
    this.went = false;
    this.at = (this.mode === "panes" ? this.paneRows().length : this.mode === "machines" ? this.machineRows().length : 0) > 1 ? 1 : 0;
    this.input = InputState.new({ placeholder: this.mode === "machines" ? "Switch machine" : this.mode === "panes" ? "Switch to a pane" : "Search tabs, panes or start something" });
    this.input.on("change", (_e, cx) => {
      this.filter = this.input.value().trim();
      this.at = 0;
      cx.notify();
    });
    this.input.on("submit", () => this.go(this.rows()[this.at]));
    // MRU switcher (Firefox/Zen Ctrl+Tab): two panes flip at once; otherwise the
    // list stays invisible for 200ms so a quick tap just flips to the last one.
    this.ctlHeld = this.mode === "panes";
    this.shown = this.mode !== "panes";
    if (props()?.reverse && this.mode === "panes") this.at = Math.max(0, this.paneRows().length - 1);
    if (this.mode === "panes") {
      const first = this.paneRows();
      if (first.length === 2) {
        this.go(first[1]);
        return;
      }
      cx.timer.after(200, (cx) => {
        this.shown = true;
        cx.notify();
      });
    }
    // Ctrl+N / Ctrl+P arrive as commands (keys.json, section mod:arc-ext-launcher): a global or
    // text-input binding of the same chord (macOS binds them) would otherwise take them.
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        const n = Math.max(1, this.rowCount ?? 1);
        if (c === "next") this.at = (this.at + 1) % n;
        else if (c === "prev") this.at = (this.at + n - 1) % n;
        else continue;
        cx.notify();
      }
    });
    this.input.focus();
    cx.timer.after(300, () => this.input.focus());
    cx.spawn(async (cx) => {
      try {
        this.agents = await knownAgents({ on: space?.machine });
        setShared(NEW_MENU_AGENTS, { ...shared(NEW_MENU_AGENTS), [this.where]: this.agents });
      } catch {}
      cx.notify();
    });
  }

  commitMru(rows, cx) {
    if (!this.ctlHeld) return;
    this.ctlHeld = false;
    const r = rows[this.at];
    if (r) this.go(r);
    cx.stop_propagation();
  }

  dismiss() {
    this.ctlHeld = false;
    closeOverlay(props().overlay);
  }

  async close() {
    if (shared(OPEN) === props()?.overlay) {
      setShared(OPEN, null);
      setShared(MODE, null);
    }
  }

  paneRows(t) {
    const space = spaces().find((s) => s.active);
    const recent = shared(RECENT_PANES) ?? [];
    const rank = (p) => {
      const i = recent.indexOf(p.pane);
      return i < 0 ? 1e6 : i;
    };
    const f = this.filter.toLowerCase();
    const out = [];
    for (const s of spaces()) {
      if ((s.machine ?? "") !== (space?.machine ?? "")) continue;
      for (const tab of s.tabs) {
        for (const p of panes().filter((q) => q.tab === tab.id)) {
          const name = paneTitle(p);
          const where = tabTitle(tab, p);
          if (f && ![name, where, s.name, p.program?.name ?? "", p.cwd ?? ""].join(" ").toLowerCase().includes(f)) continue;
          const current = Boolean(p.focused && tab.active && s.id === space?.id);
          out.push({ kind: "pane", name, pane: p, tab, space: s, here: s.id === space?.id, current, icon: programIcon(p.program, t), bg: p.program?.tile });
        }
      }
    }
    return out.sort((a, b) => b.current - a.current || rank(a.pane) - rank(b.pane));
  }

  // Machines (spaces are per machine): this one first, then the others.
  machineRows(t) {
    const f = this.filter.toLowerCase();
    const names = new Set([""]);
    for (const mc of machines()) if (mc.layout !== "unavailable") names.add(mc.name ?? "");
    for (const s of spaces()) names.add(s.machine ?? "");
    const here = spaces().find((s) => s.active)?.machine ?? "";
    return [...names]
      .sort((a, b) => (b === here) - (a === here))
      .filter((n) => !f || (n || "this pc").toLowerCase().includes(f))
      .map((n) => {
        const count = spaces().filter((s) => (s.machine ?? "") === n).length;
        return { kind: "machine", target: n, name: n || "This PC", count, here: n === here, icon: div().w(9).h(9).rounded_full().bg("#7fd99a"), bg: t?.raised };
      });
  }

  rows(t) {
    if (this.mode === "machines") return this.machineRows(t);
    if (this.mode === "panes") return this.paneRows(t);
    const space = spaces().find((s) => s.active);
    const all = panes();
    const f = this.filter.toLowerCase();
    const match = (...words) => !f || words.join(" ").toLowerCase().includes(f);
    const out = [];
    // Tiles and rows use the popover's own raised surface; the shell tint the
    // launcher had was a green that only worked on a dark panel.
    if (match("new terminal shell")) out.push({ kind: "new", name: "New Terminal", icon: svg("icons/shell.svg").size(15).text_color(t.foreground), bg: t.raised });
    if (match("split right new terminal")) out.push({ kind: "split", dir: "right", name: "Split Right", icon: svg("mods/arc-ext-launcher/split-right.svg").size(15).text_color(t.foreground), bg: t.raised });
    if (match("split down new terminal")) out.push({ kind: "split", dir: "down", name: "Split Down", icon: svg("mods/arc-ext-launcher/split-down.svg").size(15).text_color(t.foreground), bg: t.raised });
    if (match("new space")) out.push({ kind: "space", name: "New Space", icon: svg("mods/arc-ext-launcher/plus.svg").size(15).text_color(t.foreground), bg: t.raised });
    for (const s of spaces()) {
      if ((s.machine ?? "") !== (space?.machine ?? "")) continue;
      for (const tab of s.tabs) {
        const mine = all.filter((p) => p.tab === tab.id);
        // A split tab gets one row per pane: the tab row alone hides the panes
        // that are not focused, so typing their title found nothing.
        if (mine.length > 1) {
          for (const p of mine) {
            const name = paneTitle(p);
            if (!match(name, tabTitle(tab, p), s.name, p.program?.name ?? "")) continue;
            out.push({ kind: "pane", name, pane: p, tab, space: s, here: s.id === space?.id, icon: programIcon(p.program, t), bg: p.program?.tile });
          }
          continue;
        }
        const p = mine.find((q) => q.focused) ?? mine.find((q) => q.program?.agent) ?? mine[0];
        const name = tabTitle(tab, p);
        if (!match(name, s.name, ...mine.map((q) => q.program?.name ?? ""))) continue;
        out.push({ kind: "tab", name, tab, space: s, here: s.id === space?.id, icon: programIcon(p?.program, t), bg: p?.program?.tile });
      }
    }
    for (const a of this.agents.filter((a) => a.installed)) {
      if (!match("new", a.name, a.key)) continue;
      out.push({ kind: "agent", name: `New ${a.name}`, agent: a, icon: a.tint ? svg(a.icon).size(15).text_color(t.foreground) : image(a.icon).w(15).h(15) });
    }
    if (f) out.push({ kind: "run", name: `Run “${this.filter}”`, icon: svg("icons/shell.svg").size(15).text_color(t.foreground), bg: t.raised });
    return out;
  }

  go(r) {
    if (!r || this.went) return;
    this.went = true;
    const space = spaces().find((s) => s.active);
    this.dismiss();
    if (r.kind === "machine") {
      const mine = spaces().filter((s) => (s.machine ?? "") === r.target);
      const last = (shared("arc-ext.last-space") ?? {})[r.target];
      const pick = mine.find((s) => s.id === last) ?? mine[0];
      if (pick) run("space.select", { id: pick.id });
      else run("space.new", { machine: r.target });
    } else if (r.kind === "new") newTab({ space: space?.id });
    else if (r.kind === "space") {
      // Start it where the focused pane is, like Herdr's own new space.
      const cwd = panes().find((p) => p.focused && p.cwd)?.cwd;
      run("space.new", cwd ? { folder: cwd } : {});
    } else if (r.kind === "split") run("pane.split", { direction: r.dir });
    else if (r.kind === "agent") newTab({ name: r.agent.name, space: space?.id, argv: r.agent.run });
    else if (r.kind === "pane") {
      if (!r.here) run("space.select", { id: r.space.id });
      run("tab.select", { id: r.tab.id });
      run("pane.focus", { pane: r.pane.pane });
    } else if (r.kind === "tab") {
      if (!r.here) run("space.select", { id: r.space.id });
      run("tab.select", { id: r.tab.id });
    } else if (r.kind === "run") newTab({ space: space?.id, argv: ["sh", "-c", this.filter] });
  }

  hint(r, on, t) {
    const text =
      r.kind === "pane" && this.mode === "panes"
        ? r.current ? "Current" : r.here ? "Switch to Pane" : r.space.name
        : r.kind === "pane"
        ? r.here ? (r.tab.named ? r.tab.name : "Go to Pane") : r.space.name
        : r.kind === "tab"
          ? r.here ? "Switch to Tab" : r.space.name
          : r.kind === "split" ? "New Terminal"
          : r.kind === "machine" ? (r.here ? "Current" : `${r.count} space${r.count === 1 ? "" : "s"}`)
          : r.kind === "run" ? "New Tab" : "";
    return h_flex()
      .flex_none()
      .gap(12)
      .items_center()
      .when(Boolean(text), (el) => el.child(div().text_size(14).text_color(on ? t.foreground : t.muted).child(text)))
      .child(
        div()
          .w(30)
          .h(30)
          .rounded(7)
          .flex()
          .items_center()
          .justify_center()
          // On the selected row the arrow is the accent's ink on the accent,
          // so it stays legible whichever way round the theme puts them.
          .bg(on ? t.accent : t.raised)
          .text_color(on ? t.accent_foreground : t.muted)
          .child(svg("mods/arc-ext-launcher/arrow.svg").size(16)),
      );
  }

  render() {
    const t = theme();
    const rows = this.rows(t);
    this.rowCount = rows.length;
    const step = shared(STEP) ?? 0;
    if (step !== this.step) {
      const m = Math.max(1, rows.length);
      this.at = (((this.at + (step - this.step)) % m) + m) % m;
      this.step = step;
    }
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));
    const first = Math.max(0, Math.min(this.at - VISIBLE + 1, rows.length - VISIBLE));
    const shown = rows.slice(first, first + VISIBLE);

    return v_flex()
      .id("launcher")
      .w_full()
      .rounded(16)
      .border_1()
      .border_color(t.border)
      .bg(t.popover)
      .shadow_lg()
      .overflow_hidden()
      .when(!this.shown, (el) => el.opacity(0))
      .on_modifiers_changed((e, cx) => {
        if (this.mode !== "panes") return;
        if (e.modifiers.control) this.ctlHeld = true;
        else this.commitMru(rows, cx);
      })
      .on_key_up((e, cx) => {
        if (this.mode === "panes" && e.key === "control") this.commitMru(rows, cx);
      })
      .on_key_down((e, cx) => {
        const ctl = e.modifiers?.control;
        // Ctrl+Esc is Windows' Start menu and never reaches the app: Ctrl+G, Ctrl+C and Ctrl+[ cancel too.
        if (e.key === "escape" || (ctl && (e.key === "g" || e.key === "c" || e.key === "["))) return this.dismiss();
        // Enter can arrive here without the input's submit event (macOS), so act on it directly; go() runs once.
        if (e.key === "enter" || e.key === "return") {
          this.go(rows[this.at]);
          cx.stop_propagation();
          return;
        }
        const n = Math.max(1, rows.length);
        if (e.key === "down" || (ctl && e.key === "n") || (ctl && !e.modifiers.shift && e.key === "tab")) this.at = (this.at + 1) % n;
        else if (e.key === "up" || (ctl && e.key === "p") || (ctl && e.modifiers.shift && e.key === "tab")) this.at = (this.at + n - 1) % n;
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        h_flex()
          .h(68)
          .px(22)
          .gap(14)
          .items_center()
          .child(svg(this.mode === "panes" ? "mods/arc-ext-launcher/split-right.svg" : "mods/arc-ext-launcher/search.svg").size(20).text_color(t.foreground))
          .child(Input.new(this.input).flex_1().h_full().text_size(22).text_color(t.foreground)),
      )
      .child(div().h(1).mx(12).bg(t.border))
      .child(
        v_flex()
          .p(10)
          .gap(2)
          .when(rows.length === 0, (el) => el.child(div().h(ROW).px(14).flex().items_center().text_color(t.muted).child("Nothing matches")))
          .children(
            shown.map((r, k) => {
              const i = first + k;
              const on = i === this.at;
              return h_flex()
                .id(`ln-${i}`)
                .h(ROW)
                .px(12)
                .gap(14)
                .items_center()
                .rounded(10)
                .cursor_pointer()
                .when(on, (el) => el.bg(t.selected))
                .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
                .on_click(() => this.go(r))
                .child(tile(r.icon, r.bg, t))
                .child(div().flex_1().min_w(0).truncate().text_size(15).text_color(t.foreground).when(on, (d) => d.font_semibold()).child(r.name))
                .child(this.hint(r, on, t));
            }),
          ),
      );
  }
}
