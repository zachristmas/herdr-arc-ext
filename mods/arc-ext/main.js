import { View, div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { spaces, panes, run, theme, appHome, openOverlay, nextCommand, checking, settings, shared, setShared, props, readTextFile, layout, machines, closeOverlay, exec, notify, window as win } from "herdr";
import { Picker } from "./picker.js";
import { Tips } from "./tip.js";
import { snapshot, recordClosed, reopenLast } from "./reopen.js";
import { themeFor, palette, apply, backgrounds, find } from "./theme.js";
import { JOB, MENU_OPEN, COLLAPSED, WIDTH, RECENT_PANES, LAUNCHER_OPEN, LAUNCHER_MODE, LAUNCHER_STEP, LAYOUT } from "./lib/state.js";
import { tabMenu, spaceMenu, tabMenuView, tabPickView, menuView, editTheme, closeTab, machineMenu, machineMenuView } from "./views/menu.js";
import { hint, isMac } from "./lib/keys.js";
import { IconPicker, glyph, iconMenu } from "./views/icons.js";
import { FolderName, folderMenu, folderMenuView, folderPickView, folderName } from "./views/folders.js";
import { arrange, toggleFolder, isPinned, pinTab, unpinTab } from "./lib/organize.js";
import { LAST_SPACE, machineOf, machineLabel, machineNames, switchMachine } from "./lib/machine.js";
import { folder, lead, label, paneLabel, tile, badge, own, windowButton, iconButton, row } from "./views/rows.js";
import { JobQueue } from "./lib/jobqueue.js";

// A failure the person can see: the log always gets the error, the toast does
// not repeat itself. Same body at most every 30 s, so a failing loop (a theme
// write on every render) cannot flood the window with notifications.
let lastNotice = "";
let lastNoticeAt = 0;

function report(body, err) {
  console.log(`arc-space: ${body}`, err);
  const now = Date.now();
  if (body === lastNotice && now - lastNoticeAt < 30000) return;
  lastNotice = body;
  lastNoticeAt = now;
  notify({ title: "Arc Space", body, level: "error", timeout: 4000 });
}

function closeButton(id, command, args, C) {
  return own(div())
    .id(id)
    .flex_none()
    .p(3)
    .rounded(5)
    .text_color(C.dim)
    .cursor_pointer()
    .hover((s) => s.bg(C.hover).text_color(C.text))
    .on_click((_e, cx) => {
      cx.stop_propagation();
      if (command === "tab.close") closeTab(args.id, spaces().find((s) => s.tabs.some((t) => t.id === args.id))?.id);
      else run(command, args);
    })
    .child(svg("mods/arc-ext/close.svg").size(13));
}

const PUSH_STEPS = 11;
const FAST = 130;
const STEP = 14;
const THEME_MS = 150;

const pause = (later, ms) => new Promise((done) => later(ms, done));

// Panes by tab, built once per render: the tab list, the address and the
// snapshot all read it instead of rescanning every pane for every tab.
// A helper called without it still works and scans; that path is only for
// calls outside render.
function indexPanes(all) {
  const byTab = new Map();
  for (const p of all) {
    const mine = byTab.get(p.tab);
    if (mine) mine.push(p);
    else byTab.set(p.tab, [p]);
  }
  return byTab;
}

function tabPanes(index, id) {
  return index ? index.get(id) ?? [] : panes().filter((q) => q.tab === id);
}

function openPalette() {
  openOverlay({ mod: "arc-ext-palette", kind: "dialog", frame: "none", width: 640, height: 520 });
}

function launch() {
  const open = shared(LAUNCHER_OPEN);
  if (open) {
    closeOverlay(open);
    setShared(LAUNCHER_OPEN, null);
    return;
  }
  openOverlay({ mod: "arc-ext-launcher", kind: "dialog", frame: "none", width: 720, height: 500 });
}

function launchMachines() {
  const open = shared(LAUNCHER_OPEN);
  if (open) {
    const was = shared(LAUNCHER_MODE);
    closeOverlay(open);
    setShared(LAUNCHER_OPEN, null);
    if (was === "machines") return;
  }
  openOverlay({ mod: "arc-ext-launcher", kind: "dialog", frame: "none", width: 720, height: 500, props: { mode: "machines" } });
}

function switchPanes(back) {
  const open = shared(LAUNCHER_OPEN);
  if (open && shared(LAUNCHER_MODE) === "panes") {
    setShared(LAUNCHER_STEP, (shared(LAUNCHER_STEP) ?? 0) + (back ? -1 : 1));
    return;
  }
  if (open) closeOverlay(open);
  openOverlay({ mod: "arc-ext-launcher", kind: "dialog", frame: "none", width: 720, height: 500, props: { mode: "panes", reverse: Boolean(back) } });
}

export default class TerminalsSide extends View {
  init(_props, cx) {
    if (props()?.role === "status") {
      this.status = true;
      this.exts = [];
      cx.spawn(async (cx) => {
        try {
          this.exts = JSON.parse((await readTextFile(appHome() + "/mods/arc-ext/extensions.json")) ?? "[]");
        } catch {
          this.exts = [];
        }
        cx.notify();
      });
      return;
    }
    if (props()?.view === "folder-name") {
      this.folderName = new FolderName();
      this.folderName.init(cx);
      return;
    }
    if (props()?.view === "icons") {
      this.icons = new IconPicker();
      this.icons.init(cx);
      return;
    }
    if (props()?.view === "theme") {
      this.picker = new Picker();
      return;
    }
    if (props()?.view === "menu") {
      this.menu = true;
      setShared(MENU_OPEN, props().overlay);
      return;
    }
    if (props()?.view === "tab-menu" || props()?.view === "tab-pick" || props()?.view === "machine-menu" || props()?.view === "folder-menu" || props()?.view === "folder-pick") {
      this.view = props().view;
      setShared(MENU_OPEN, props().overlay);
      return;
    }
    this.cmd = false;
    this.numbers = false;
    this.press = 0;
    this.hovered = null;
    this.anim = 0;
    this.shift = 0;
    this.shiftAt = 0;
    this.turn = 0;
    this.entering = new Set();
    this.enteringAt = 0;
    this.ghosts = [];
    this.jobs = new JobQueue();
    this.tips = new Tips((ms, fn) => this.later(ms, fn), () => Boolean(shared(MENU_OPEN)));
    this.out = Boolean(shared(COLLAPSED));
    this.themeDue = false;
    if (checking()) return;
    this.jobs.start(cx);
    cx.spawn(async () => {
      for (;;) {
        await new Promise((wake) => (this.themeWake = wake));
        const th = this.pending;
        try {
          const tree = JSON.parse(await readTextFile(appHome() + "/layouts/arc-ext.json"));
          if (!find(tree, "tint")) {
            report("The arc-space layout has no tint block; the theme was not applied");
            continue;
          }
          run("layout.set", { layout: apply(tree, th, shared(COLLAPSED) ? 0 : this.full()) });
        } catch (err) {
          report("Could not apply the theme to the layout", err);
        }
      }
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "launch") launch();
        else if (c === "toggle") this.toggle(cx);
        else if (c === "palette") openPalette();
        else if (c === "panes") switchPanes(false);
        else if (c === "panes-prev") switchPanes(true);
        else if (c === "machine") launchMachines();
        else if (c === "machine-prev") switchMachine(-1);
        else if (c === "reopen")
          cx.spawn(async () => {
            try {
              await reopenLast();
            } catch (err) {
              report("Could not reopen the last tab", err);
            }
          });
        else if (c === "job") this.runJob(cx, shared(JOB));

        else if (c === "theme") editTheme(spaces().find((p) => p.active)?.id);
        else if (c === "pin") {
          const sp = spaces().find((p) => p.active);
          const tab = sp?.tabs.find((c) => c.active);
          if (tab) (isPinned(sp.id, tab.id) ? unpinTab : pinTab)(sp.id, tab.id);
        } else if (c === "folder-new") {
          const sp = spaces().find((p) => p.active);
          folderName({ space: sp?.id, tab: sp?.tabs.find((c) => c.active)?.id });
        } else if (c === "icon") iconMenu(spaces().find((p) => p.active)?.id);
        else if (/^tab[1-9]$/.test(c)) this.selectTab(Number(c.slice(3)));
        else if (/^space[1-9]$/.test(c)) this.selectSpace(Number(c.slice(5)));
      }
    });
  }

  hover(id) {
    return (on, cx) => {
      if (on) this.hovered = id;
      else if (this.hovered === id) this.hovered = null;
      cx.notify();
    };
  }

  modifiers(e, cx) {
    const down = (isMac() ? e.modifiers.platform && !e.modifiers.control : e.modifiers.control && !e.modifiers.platform) && !e.modifiers.shift && !e.modifiers.alt;
    if (down === this.cmd) return;
    this.cmd = down;
    const press = ++this.press;
    if (down) {
      cx.timer.after(350, (cx) => {
        if (this.press !== press || !this.cmd) return;
        this.numbers = true;
        cx.notify();
      });
    } else if (this.numbers) {
      this.numbers = false;
      cx.notify();
    }
  }

  chip(t, c, q, compact) {
    const C = this.C;
    const on = c.active && q.focused;
    const id = `pane-${q.pane}`;
    const hovered = this.hovered === id;
    const x = closeButton(`tm-x-${q.pane}`, "pane.close", { pane: q.pane }, C);
    return this.tips.wrap(
      id,
      own(h_flex())
        .id(`tm-pane-${q.pane}`)
        .relative()
        .flex_1()
        .min_w(0)
        .h(32)
        .px(compact ? 0 : 8)
        .gap(8)
        .items_center()
        .when(compact, (el) => el.justify_center())
        .rounded(8)
        .border_1()
        .cursor_pointer()
        .when(on, (el) => el.bg(C.selected).border_color(C.selectedEdge).shadow_sm())
        .when(!on, (el) => el.bg(C.chip).border_color("#00000000").hover((s) => s.bg(C.hover)))
        .active((s) => s.bg(C.pressed).shadow_none().pt(2))
        .on_hover(this.hover(id))
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          this.tips.hideAll();
          cx.notify();
          tabMenu(c.id, spaces().find((p) => p.active)?.id, q.pane);
        })
        .on_click(() => {
          run("tab.select", { id: c.id });
          run("pane.focus", { pane: q.pane });
        })
        .child(tile(t, q, C))
        .when(!compact, (el) => el.child(div().flex_1().min_w(0).truncate().text_color(on ? C.text : C.soft).child(paneLabel(q))))
        .when(!compact && (hovered || on), (el) => el.child(x))
        .when(compact && hovered, (el) =>
          el.child(div().absolute().top(-6).right(-6).rounded_full().bg(C.dot).border_1().border_color(C.selectedEdge).child(x)),
        ),
      paneLabel(q),
      null,
      "grow",
    );
  }


  tab(t, index, space, c, i) {
    const C = this.C;
    const mine = tabPanes(index, c.id);
    const split = mine.length > 1;
    const p = lead(mine);
    return row(`tm-${c.id}`, C)
      .when(split, (el) => el.h(42).px(4).gap(4).bg(c.active ? C.split : "#00000000").when(c.active, (e) => e.shadow_md()))
      .when(!split && c.active, (el) => el.bg(C.selected).border_1().border_color(C.selectedEdge).shadow_md())
      .when(!split && !c.active, (el) => el.hover((s) => s.bg(C.hover)))
      .on_click(() => run("tab.select", { id: c.id }))
      .on_mouse_down("right", (_e, cx) => {
        this.tips.hideAll();
        cx.notify();
        tabMenu(c.id, space.id);
      })
      .when(split, (el) => el.children(mine.map((q) => this.chip(t, c, q, mine.length > 2))))
      .on_hover(this.hover(c.id))
      .when(!split, (el) =>
        el.child(tile(t, p, C)).child(div().flex_1().min_w(0).truncate().text_color(c.active ? C.text : C.soft).child(label(c, p))),
      )
      .when(!split && !this.numbers && (c.active || this.hovered === c.id), (el) =>
        el.child(this.tips.wrap(`x-${c.id}`, closeButton(`tm-x-${c.id}`, "tab.close", { id: c.id }, C), "Close tab", hint("closeTab"))),
      )
      .when(this.numbers && i < 9, (el) => el.child(badge(i + 1, C)));
  }

  full() {
    return shared(WIDTH) ?? 240;
  }

  toggle(cx) {
    const collapsed = Boolean(shared(COLLAPSED));
    const full = this.full();
    const [from, to] = collapsed ? [0, full] : [full, 0];
    const anim = ++this.anim;
    if (collapsed) setShared(COLLAPSED, false);
    for (let i = 1; i <= PUSH_STEPS; i++) {
      cx.timer.after(i * 16, () => {
        if (this.anim !== anim) return;
        const k = i / PUSH_STEPS;
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        run("layout.resize", { id: "sidebar", px: Math.round(from + (to - from) * e) });
        if (i === PUSH_STEPS && !collapsed) setShared(COLLAPSED, true);
      });
    }
  }

  async keepUntil(terminal, place, done) {
    let lastErr;
    for (let i = 0; i < 20; i++) {
      await pause((ms, fn) => this.later(ms, fn), 150);
      if (done()) return true;
      try {
        await exec("herdr-app", ["do", "terminal.keep", JSON.stringify({ terminal, place })]);
        lastErr = undefined;
      } catch (err) {
        // Expected while the core is still applying an earlier change; the
        // loop retries. Only a run of failures, below, is a real failure.
        lastErr = err;
      }
      await pause((ms, fn) => this.later(ms, fn), 300);
      if (done()) return true;
    }
    report("Could not keep a terminal in its new place", lastErr);
    return false;
  }

  runJob(cx, spec) {
    if (!spec) return;
    setShared(JOB, null);
    cx.spawn(async () => {
      if (spec.kind === "separate") {
        const rest = panes().filter((q) => q.tab === spec.tab && q.terminal).slice(1);
        for (const q of rest) {
          run("terminal.park", { terminal: q.terminal });
          await this.keepUntil(q.terminal, "tab", () => panes().some((p) => p.terminal === q.terminal && p.tab !== spec.tab));
        }
      } else if (spec.kind === "merge") {
        const target = lead(panes().filter((q) => q.tab === spec.into));
        const moving = panes().filter((q) => q.tab === spec.from && q.terminal);
        if (!target) return;
        run("tab.select", { id: spec.into });
        for (const q of moving) {
          run("pane.focus", { pane: target.pane });
          run("terminal.park", { terminal: q.terminal });
          await this.keepUntil(q.terminal, "right", () => panes().some((p) => p.terminal === q.terminal && p.tab === spec.into));
        }
        run("tab.select", { id: spec.into });
      }
    });
  }

  selectSpace(n) {
    const here = machineOf(spaces().find((s) => s.active));
    const space = spaces().filter((s) => machineOf(s) === here)[n - 1];
    if (space && !space.active) run("space.select", { id: space.id });
  }

  carousel(space, cx) {
    // Safety net: if a transition's reset job is ever lost, the rows would sit
    // at opacity 0 (this.shift) or height 0 (this.entering) for good. Neither
    // may outlive a frame or two, whatever happens to the job queue.
    if (this.shift && Date.now() - (this.shiftAt ?? 0) > 250) this.shift = 0;
    if (this.entering.size && Date.now() - (this.enteringAt ?? 0) > 250) this.entering.clear();
    if (this.spaceId && this.spaceId !== space.id) {
      const ids = spaces().map((p) => p.id);
      const dir = ids.indexOf(space.id) > ids.indexOf(this.spaceId) ? 1 : -1;
      this.shift = dir * 28;
      this.shiftAt = Date.now();
      const at = ++this.turn;
      this.later(16, () => {
        if (this.turn === at) this.shift = 0;
      });
    }
    this.spaceId = space.id;
  }

  watchClosed(index) {
    const snap = snapshot(index);
    if (this.snap) recordClosed(this.snap, snap);
    this.snap = snap;
  }

  later(ms, fn) {
    this.jobs.later(ms, fn);
  }

  track(space, cx) {
    const ids = space.tabs.map((c) => c.id);
    if (this.listSpace === space.id && this.listIds) {
      const added = ids.filter((id) => !this.listIds.includes(id));
      const gone = this.listIds.filter((id) => !ids.includes(id));
      if (added.length) {
        added.forEach((id) => this.entering.add(id));
        this.enteringAt = Date.now();
        this.later(16, () => added.forEach((id) => this.entering.delete(id)));
      }
      for (const id of gone) {
        const ghost = { id, at: this.listIds.indexOf(id), h: this.heights?.[id] ?? 38, closing: false, born: Date.now() };
        this.ghosts.push(ghost);
        this.later(16, () => (ghost.closing = true));
        this.later(FAST + 40, () => (this.ghosts = this.ghosts.filter((g) => g !== ghost)));
      }
    } else {
      this.ghosts = [];
    }
    this.listSpace = space.id;
    this.listIds = ids;
  }

  stagger(el, i, id, h) {
    const entering = this.entering.has(id);
    const delay = Math.min(i, 10) * STEP;
    return el
      .relative()
      .flex_none()
      .h(entering ? 0 : h)
      .left(this.shift)
      .opacity(entering || this.shift ? 0 : 1)
      .transition("height", { duration: FAST, easing: "ease-out" })
      .transition("left", { duration: FAST, delay, easing: "ease-out" })
      .transition("opacity", { duration: FAST, delay: entering ? 0 : delay, easing: "ease-out" });
  }

  list(t, index, space) {
    const C = this.C;
    this.heights = {};
    const arr = arrange(space);
    let n = 0;
    // One tab row with the grow/shrink wrapper the rest of the list uses.
    const tabRow = (c, indent) => {
      const split = tabPanes(index, c.id).length > 1;
      const h = split ? 42 : 38;
      this.heights[c.id] = h;
      const i = n++;
      return this.stagger(div().id(`tm-w-${c.id}`).overflow_hidden(), i + 1, c.id, h).child(
        div().w_full().min_w(0).pl(indent).child(this.tab(t, index, space, c, i)),
      );
    };
    const out = [];
    if (arr.pinned.length) {
      out.push(
        h_flex().id("tm-pins").flex_none().flex_wrap().gap(6).px(10).pb(6).children(
          arr.pinned.map((c) => {
            const mine = tabPanes(index, c.id);
            const p = lead(mine);
            n++;
            return this.tips.wrap(`pin-${c.id}`, own(div())
              .id(`tm-pin-${c.id}`)
              .flex_none().w(46).h(46).rounded(12)
              .flex().items_center().justify_center().cursor_pointer()
              .when(c.active, (el) => el.bg(C.selected).border_1().border_color(C.selectedEdge).shadow_md())
              .when(!c.active, (el) => el.bg(C.chip).hover((s) => s.bg(C.hover)))
              .on_click(() => run("tab.select", { id: c.id }))
              .on_mouse_down("right", (_e, cx) => { this.tips.hideAll(); cx.notify(); tabMenu(c.id, space.id); })
              .child(tile(t, p, C)), label(c, p));
          }),
        ),
      );
    }
    for (const f of arr.folders) {
      out.push(
        row(`tm-f-${f.id}`, C)
          .h(34)
          .text_color(C.soft)
          .hover((s) => s.bg(C.hover).text_color(C.text))
          .on_click(() => toggleFolder(space.id, f.id))
          .on_mouse_down("right", (_e, cx) => { this.tips.hideAll(); cx.notify(); folderMenu(f.id, space.id); })
          .child(div().flex_none().w(12).text_size(13).text_color(C.soft).child(f.open ? "▾" : "▸"))
          .child(svg("mods/arc-ext/icon-set/folder.svg").size(15).text_color(C.dim))
          .child(div().flex_1().min_w(0).truncate().font_semibold().child(f.name))
          .child(div().flex_none().text_size(11).text_color(C.dim).child(String(f.tabs.length))),
      );
      if (f.open) for (const c of f.tabs) out.push(tabRow(c, 14));
      else for (const c of f.tabs) n++;
    }
    if (arr.pinned.length || arr.folders.length) out.push(div().flex_none().mx(10).my(4).h(1).bg(C.rule));
    const rows = arr.rest.map((c) => tabRow(c, 0));
    this.ghosts = this.ghosts.filter((g) => Date.now() - g.born < FAST + 170);
    for (const g of [...this.ghosts].sort((a, b) => a.at - b.at)) {
      rows.splice(Math.min(g.at, rows.length), 0,
        div().id(`tm-g-${g.id}`).flex_none().h(g.closing ? 0 : g.h).transition("height", { duration: FAST, easing: "ease-out" }));
    }
    return [...out, ...rows];
  }

  selectTab(n) {
    const space = spaces().find((p) => p.active);
    const tab = space ? arrange(space).ordered.filter((c) => !c.settled)[n - 1] : null;
    if (tab) run("tab.select", { id: tab.id });
  }

  address(index, space) {
    const C = this.C;
    const active = space.tabs.find((c) => c.active);
    const p = active ? tabPanes(index, active.id).find((q) => q.focused) : undefined;
    const path = folder(p?.cwd) || folder(space.folder);
    return row("tm-address", C)
      .flex_none()
      .h(42)
      .px(10)
      .bg(C.chip)
      .hover((s) => s.bg(C.hover))
      .on_click(launch)
      .on_mouse_down("right", () => spaceMenu(space.id))
      .child(
        div()
          .flex_none()
          .w(22)
          .h(22)
          .rounded_full()
          .bg(C.selected)
          .flex()
          .items_center()
          .justify_center()
          .text_size(11)
          .font_semibold()
          .text_color(C.text)
          .child(glyph(space.id, ([...space.name][0] ?? "?").toUpperCase(), 14, C.text)),
      )
      .child(div().flex_none().max_w(110).truncate().font_semibold().text_color(C.text).child(space.name))
      .when(Boolean(path) && path !== space.name, (el) => el.child(div().flex_1().min_w(0).truncate().text_size(11).text_color(C.dim).child(path)));
  }

  // Extension buttons (extensions.json): each toggles a layout node, a side panel.
  extButtons(cx, C) {
    const find = (n, id) => (n?.id === id ? n : (n?.children ?? []).map((c) => find(c, id)).find(Boolean));
    const tree = layout();
    return (this.exts ?? []).map((x) => {
      const on = find(tree, x.node) && !find(tree, x.node).hidden;
      return own(div())
        .id(`tm-ext-${x.node}`)
        .flex_none().h(20).px(8).gap(6).rounded(6)
        .flex().items_center().cursor_pointer().text_size(11).font_semibold()
        .when(on, (el) => el.bg(C.selected).text_color(C.text))
        .when(!on, (el) => el.bg(C.chip).text_color(C.dim).hover((s) => s.bg(C.hover).text_color(C.text)))
        .on_click(() => run("layout.toggle", { id: x.node }))
        .child(svg(x.icon).size(13))
        .child(x.label);
    });
  }

  spacesBar() {
    const C = this.C;
    return h_flex()
      .flex_none()
      .h(40)
      .gap(2)
      .items_center()
      .child(this.tips.wrap("keys", iconButton("tm-keys", "command", openPalette, C), "Commands", hint("palette")))
      .child(div().flex_1())
      .children(
        spaces().filter((p) => machineOf(p) === machineOf(spaces().find((s) => s.active))).map((p, i) =>
          this.tips.wrap(`s-${p.id}`, own(div())
            .id(`tm-s-${p.id}`)
            .flex_none()
            .w(26)
            .h(26)
            .rounded_full()
            .flex()
            .items_center()
            .justify_center()
            .text_size(11)
            .font_semibold()
            .cursor_pointer()
            .when(p.active, (el) => el.bg(C.selected).text_color(C.text))
            .when(!p.active, (el) => el.text_color(C.dim).hover((s) => s.bg(C.hover).text_color(C.text)))
            .on_click(() => run("space.select", { id: p.id }))
            .on_mouse_down("right", () => spaceMenu(p.id))
            .child(glyph(p.id, ([...p.name][0] ?? "?").toUpperCase(), 15, p.active ? C.text : C.dim)), p.name, i < 9 ? hint("space", i + 1) : null),
        ),
      )
      .child(div().flex_1())
      .child(this.tips.wrap("new-space", iconButton("tm-new-space", "plus", () => run("space.new"), C), "New space"));
  }

  // Called on every render with the space's theme. Only a change of the
  // background fingerprint does anything, and a change schedules at most one
  // write: `pending` keeps the latest theme, so a drag of the dial or the
  // wheel writes once per THEME_MS with the value it ended on.
  applyTheme(th) {
    if (shared(LAYOUT) !== "arc-ext" || !this.themeWake) return;
    const key = JSON.stringify(backgrounds(th));
    if (key === this.applied) return;
    this.applied = key;
    this.pending = th;
    if (this.themeDue) return;
    this.themeDue = true;
    this.later(THEME_MS, () => {
      this.themeDue = false;
      if (!this.pending || !this.themeWake) return;
      this.themeWake();
    });
  }

  async close() {
    this.picker?.close();
    if ((this.menu || this.view) && shared(MENU_OPEN) === props()?.overlay) setShared(MENU_OPEN, null);
  }

  // The full-width bottom bar (layout node "status"): machine on the left, room for more segments.
  statusBar(cx) {
    const space = spaces().find((s) => s.active);
    if (!space) return div();
    const C = palette(themeFor(space.id));
    const all = machineNames();
    const here = machineOf(space);
    const branch = panes().find((p) => p.focused)?.branch;
    const seg = (id, label, on, icon) =>
      own(div())
        .id(id)
        .flex_none().h(20).px(8).rounded(6).truncate()
        .flex().items_center().text_size(11).font_semibold().text_color(C.text).bg(C.chip)
        .when(Boolean(on), (el) => el.cursor_pointer().hover((s) => s.bg(C.hover)).on_click(on))
        .when(Boolean(icon), (el) => el.gap(6).child(svg(icon).size(13)))
        .child(label);
    return h_flex()
      .id("tm-status")
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .child(seg("tm-st-machine", `${machineLabel(here)}${all.length > 1 ? "  ·  " + hint("machine") : ""}`, all.length > 1 ? () => machineMenu() : null))
      .when(Boolean(branch), (el) => el.child(seg("tm-st-branch", branch, null, "mods/arc-ext/branch.svg")))
      .child(div().flex_1())
      .children(this.extButtons(cx, C));
  }

  render(cx) {
    if (this.status) return this.statusBar(cx);
    if (this.folderName) return this.folderName.render();
    if (this.icons) return this.icons.render(cx);
    if (this.picker) return this.picker.render();
    if (this.menu) return menuView();
    if (this.view === "tab-menu") return tabMenuView();
    if (this.view === "tab-pick") return tabPickView();
    if (this.view === "machine-menu") return machineMenuView();
    if (this.view === "folder-menu") return folderMenuView();
    if (this.view === "folder-pick") return folderPickView();
    const t = theme();
    const index = indexPanes(panes());
    const space = spaces().find((p) => p.active);
    if (!space) return div();
    const th = themeFor(space.id);
    const activeTab = space.tabs.find((c) => c.active);
    const now = activeTab ? tabPanes(index, activeTab.id).find((q) => q.focused)?.pane : undefined;
    const recent = shared(RECENT_PANES) ?? [];
    if (now && recent[0] !== now) setShared(RECENT_PANES, [now, ...recent.filter((id) => id !== now)].slice(0, 50));
    this.C = palette(th);
    const C = this.C;
    {
      const key = machineOf(space);
      const mem = shared(LAST_SPACE) ?? {};
      if (mem[key] !== space.id) setShared(LAST_SPACE, { ...mem, [key]: space.id });
    }
    this.applyTheme(th);
    this.carousel(space, cx);
    this.track(space, cx);
    const w = win() ?? {};
    const mac = w.platform === "macos" && w.titlebar === "none" && !w.fullscreen;

    const full = this.full();
    const fade = (el) => el;

    const top = fade(
      h_flex()
        .id("tm-top")
        .flex_none()
        .w(full)
        .h(34)
        .pr(10)
        .items_center()
        .when(mac, (el) => el.pl(68))
        .child(this.tips.wrap("toggle", iconButton("tm-toggle", "sidebar", (_e, cx) => this.toggle(cx), C), "Toggle sidebar", hint("toggle")))
        .child(div().flex_1())
        .when(Boolean(w.buttons), (el) =>
          el.gap(6)
            .child(windowButton("tm-min", "win-min", "window.minimize", C))
            .child(windowButton("tm-max", w.maximized ? "win-restore" : "win-max", "window.maximize", C))
            .child(windowButton("tm-close", "win-close", "window.close", C)),
        ),
    );

    const body = v_flex()
      .id(`tm-body-${space.id}`)
      .absolute()
      .top(0)
      .bottom(0)
      .w(full)
      .pr(10)
      .gap(6)
      .right(0)
      .child(this.stagger(div().id(`tm-a-${space.id}`), 0, "address", 42).child(this.tips.wrap("address", this.address(index, space), "Search tabs and agents", hint("launch"), true)))
      .child(
        v_flex()
          .id("tm-list")
          .flex_1()
          .min_h(0)
          .pt(6)
          .gap(2)
          .overflow_y_scroll()
          .children(this.list(t, index, space))
          .child(div().flex_none().mx(10).my(6).h(1).bg(C.rule))
          .child(
            row("tm-new", C)
              .text_color(C.dim)
              .hover((s) => s.bg(C.hover).text_color(C.text))
              .on_click(() => run("tab.new", { space: space.id }))
              .child(svg("mods/arc-ext/plus.svg").size(16))
              .child(div().child("New Tab")),
          )
          .child(
            row("tm-new-folder", C)
              .text_color(C.dim)
              .hover((s) => s.bg(C.hover).text_color(C.text))
              .on_click(() => folderName({ space: space.id }))
              .child(svg("mods/arc-ext/icon-set/folder.svg").size(16))
              .child(div().child("New Folder")),
          ),
      );

    const root = v_flex()
      .id("tm-root")
      .size_full()
      .gap(6)
      .overflow_hidden()
      .on_modifiers_changed((e, cx) => this.modifiers(e, cx))
      .child(top)
      .child(div().id("tm-stage").on_mouse_down("right", () => spaceMenu(space.id)).relative().flex_1().min_h(0).w_full().overflow_hidden().child(body))
      .child(h_flex().id("tm-bottom").flex_none().w_full().justify_end().overflow_hidden().child(div().flex_none().w(full).pr(10).child(this.spacesBar())));
    // The reopen snapshot follows the render cycle (tabs and panes changing is
    // what redraws), so there is no polling timer. It only records until the
    // first render has happened, and recordClosed writes only on a removal.
    if (!checking()) this.watchClosed(index);
    return root;
  }
}
