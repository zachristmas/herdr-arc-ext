import { div, svg } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import * as fs from "fs/promises";
import { props, closeOverlay, exec, appHome, checking, window, theme } from "herdr";
import { PRESET_SETS, MAX_DOTS, themeFor, saveTheme, hexToHsl, radiusOf, moveDots, colors } from "./theme.js";

const PAD_W = 316;
const PAD_H = 300;
const TRACK_W = 220;
const STEPS = 24;
const DIAL = 84;
const RING = 36;
const CX = PAD_W / 2;
const CY = PAD_H / 2;
const R = Math.min(PAD_W, PAD_H) / 2 - 28;
const icon = (name, size) => svg(`mods/arc-ext/${name}.svg`).size(size);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function spot(d) {
  const a = (d.h * Math.PI) / 180;
  return { x: CX + Math.sin(a) * d.r * R, y: CY - Math.cos(a) * d.r * R };
}

function polar(p) {
  const dx = p.x - CX;
  const dy = p.y - CY;
  const h = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return { h, r: clamp(Math.hypot(dx, dy) / R, 0, 1) };
}

function stop(el) {
  return el.on_mouse_down("left", (_e, cx) => cx.stop_propagation());
}

export class Picker {
  constructor() {
    this.space = props().space;
    this.theme = themeFor(this.space);
    this.page = { light: 0, auto: 1, dark: 2 }[this.theme.mode] ?? 1;
    this.drag = null;
    this.tickPath = appHome() + "/mods/arc-ext/.tick";
    this.step = Math.round(this.theme.noise * (STEPS - 1));
    // Trackpad haptics are macOS-only; the shipped helper is a compiled Swift binary.
    if (!checking() && window().platform === "macos") {
      exec(appHome() + "/mods/arc-ext/bin/haptic", [this.tickPath], { timeout: 600000 }).catch(() => {});
    }
  }

  close() {
    fs.writeFile(this.tickPath, "quit").catch(() => {});
  }

  set(cx, patch) {
    this.theme = { ...this.theme, ...patch };
    saveTheme(this.space, this.theme);
    cx.notify();
  }

  grab(kind, e) {
    const l = e.local_position ?? { x: 0, y: 0 };
    this.drag = { kind, origin: { x: e.position.x - l.x, y: e.position.y - l.y } };
  }

  local(e) {
    return { x: e.position.x - this.drag.origin.x, y: e.position.y - this.drag.origin.y };
  }

  dotAt(x, y) {
    let best = null;
    let dist = 30;
    this.theme.dots.forEach((d, i) => {
      const at = spot(d);
      const r = Math.hypot(at.x - x, at.y - y);
      if (r < dist) [best, dist] = [i, r];
    });
    return best;
  }

  movePad(cx, p) {
    const { h, r } = polar(p);
    if (!this.theme.dots.length) {
      this.drag.dot = 0;
      this.set(cx, { dots: [{ h, r }] });
      return;
    }
    this.set(cx, { dots: moveDots(this.theme.dots, this.drag.dot, h, r) });
  }

  moveSlider(cx, p) {
    this.set(cx, { intensity: clamp(p.x / TRACK_W, 0, 1) });
  }

  moveDial(cx, p) {
    const a = Math.atan2(p.y - DIAL / 2, p.x - DIAL / 2) + Math.PI / 2;
    const turn = ((a / (Math.PI * 2)) % 1 + 1) % 1;
    const step = Math.round(turn * STEPS) % STEPS;
    if (step === this.step) return;
    this.step = step;
    fs.writeFile(this.tickPath, String(Date.now())).catch(() => {});
    this.set(cx, { noise: step / (STEPS - 1) });
  }

  move(e, cx) {
    if (!this.drag) return;
    const p = this.local(e);
    if (this.drag.kind === "pad") this.movePad(cx, p);
    else if (this.drag.kind === "slider") this.moveSlider(cx, p);
    else if (this.drag.kind === "dial") this.moveDial(cx, p);
  }

  addDot(cx) {
    const dots = this.theme.dots;
    if (dots.length >= MAX_DOTS) return;
    const p = dots[0] ?? { h: 270, r: 0.6 };
    this.set(cx, { dots: Array.from({ length: dots.length + 1 }, (_, i) => ({ h: (p.h + 120 * i) % 360, r: p.r })) });
  }

  removeDot(cx) {
    this.set(cx, { dots: this.theme.dots.slice(0, -1) });
  }

  preset(cx, hex) {
    const at = { h: hexToHsl(hex).h, r: radiusOf(hex) };
    const dots = this.theme.dots.length ? moveDots(this.theme.dots, 0, at.h, at.r) : [at];
    this.set(cx, { dots });
  }

  render() {
    const th = this.theme;
    const cs = colors(th);
    // The picker is a Herdr popover, so its surface and the text on it come from
    // Herdr's theme. Only what illustrates the space (the dots, the preset
    // swatches) comes from the space's own colours.
    const t = theme();
    const ink = t.foreground;
    const faint = t.muted;
    const panel = t.popover;
    const well = t.raised;
    const empty = th.dots.length === 0;

    const mode = (name, value) =>
      stop(div())
        .id(`th-mode-${value}`)
        .w(40)
        .h(40)
        .rounded(10)
        .flex()
        .items_center()
        .justify_center()
        .cursor_pointer()
        .text_color(th.mode === value ? ink : faint)
        .when(th.mode === value, (el) => el.bg(t.hover))
        .hover((s) => s.text_color(ink))
        .on_click((_e, cx) => {
          this.page = { light: 0, auto: 1, dark: 2 }[value];
          this.set(cx, { mode: value });
        })
        .child(icon(name, 20));

    const dots = th.dots.map((d, i) => {
      const size = i === 0 ? 56 : 36;
      const { x, y } = spot(d);
      return div()
        .id(`th-dot-${i}`)
        .absolute()
        .left(x - size / 2)
        .top(y - size / 2)
        .spring("left", { response: 260, damping: 0.62 })
        .spring("top", { response: 260, damping: 0.62 })
        .w(size)
        .h(size)
        .rounded_full()
        .border(i === 0 ? 5 : 4)
        .border_color(panel)
        .shadow_md()
        .bg(cs[i]);
    });

    const pad = div()
      .id("th-pad")
      .relative()
      .w(PAD_W)
      .h(PAD_H)
      .cursor_pointer()
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.grab("pad", e);
        const p = this.local(e);
        this.drag.dot = this.dotAt(p.x, p.y) ?? 0;
        this.movePad(cx, p);
      })
      .when(empty, (el) =>
        el.child(div().absolute().left(0).right(0).top(PAD_H / 2 - 30).flex().justify_center().text_size(15).font_semibold().text_color(ink).child("Tap to pick a color for this space")),
      )
      .children(dots);

    const plusMinus = h_flex()
      .gap(28)
      .justify_center()
      .text_color(faint)
      .child(stop(div()).id("th-minus").p(4).cursor_pointer().when(!empty, (el) => el.hover((s) => s.text_color(ink))).on_click((_e, cx) => this.removeDot(cx)).child(icon("minus", 22)))
      .child(stop(div()).id("th-plus").p(4).cursor_pointer().hover((s) => s.text_color(ink)).on_click((_e, cx) => this.addDot(cx)).child(icon("plus", 22)));

    const arrow = (id, name, by) =>
      stop(div())
        .id(id)
        .flex_none()
        .p(2)
        .cursor_pointer()
        .text_color(faint)
        .hover((s) => s.text_color(ink))
        .on_click((_e, cx) => {
          this.page = (this.page + by + PRESET_SETS.length) % PRESET_SETS.length;
          cx.notify();
        })
        .child(icon(name, 18));

    const swatches = h_flex()
      .gap(6)
      .items_center()
      .justify_center()
      .child(arrow("th-prev", "chevron-left", -1))
      .children(
        PRESET_SETS[this.page].map((hex) =>
          stop(div())
            .id(`th-p-${hex}`)
            .flex_none()
            .w(26)
            .h(26)
            .rounded_full()
            .border_2()
            .border_color(t.border)
            .bg(hex)
            .cursor_pointer()
            .hover((s) => s.border_color(ink))
            .on_click((_e, cx) => this.preset(cx, hex)),
        ),
      )
      .child(arrow("th-next", "chevron-right", 1));

    const x = th.intensity * TRACK_W;
    const wave = `dial/wave-${Math.round(th.intensity * 10)}`;
    const slider = div()
      .id("th-intensity")
      .relative()
      .w(TRACK_W)
      .h(56)
      .cursor_pointer()
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.grab("slider", e);
        this.moveSlider(cx, this.local(e));
      })
      .child(div().absolute().left(0).right(0).top(20).h(16).rounded_full().bg(well))
      .child(icon(wave, TRACK_W).absolute().left(0).top(8).w(TRACK_W).h(40).text_color(t.border))
      .when(!empty, (el) =>
        el
          .child(div().absolute().left(0).top(8).w(x).h(40).overflow_hidden().child(icon(wave, TRACK_W).w(TRACK_W).h(40).text_color(ink)))
          .child(div().absolute().top(3).left(clamp(x - 12, 0, TRACK_W - 24)).w(24).h(50).rounded(12).bg(ink).shadow_md()),
      );

    const lit = empty ? -1 : this.step;
    const ring = Array.from({ length: STEPS }, (_, i) => {
      const a = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
      return div()
        .absolute()
        .left(DIAL / 2 + Math.cos(a) * RING - 2.5)
        .top(DIAL / 2 + Math.sin(a) * RING - 2.5)
        .w(5)
        .h(5)
        .rounded_full()
        .bg(i <= lit ? ink : faint);
    });
    const dial = div()
      .id("th-noise")
      .relative()
      .w(DIAL)
      .h(DIAL)
      .cursor_pointer()
      .on_mouse_down("left", (e, cx) => {
        cx.stop_propagation();
        this.grab("dial", e);
        this.moveDial(cx, this.local(e));
      })
      .children(ring)
      .child(
        div()
          .absolute()
          .left(DIAL / 2 - 25)
          .top(DIAL / 2 - 25)
          .w(50)
          .h(50)
          .rounded_full()
          .bg(t.raised)
          .border_1()
          .border_color(t.border)
          .shadow_md(),
      )
      .when(!empty, (el) => el.child(svg(`mods/arc-ext/dial/${this.step % STEPS}.svg`).absolute().left(-1).top(-1).w(DIAL + 2).h(DIAL + 2).text_color(ink)));

    return v_flex()
      .id("theme-picker")
      .w_full()
      .p(14)
      .gap(14)
      .rounded(16)
      .border_1()
      .border_color(t.border)
      .bg(panel)
      .shadow_lg()
      .on_mouse_move((e, cx) => this.move(e, cx))
      .on_mouse_up("left", () => {
        this.drag = null;
      })
      .on_key_down((e) => {
        if (e.key === "escape") closeOverlay(props().overlay);
      })
      .child(
        v_flex()
          .id("th-well")
          .relative()
          .items_center()
          .gap(10)
          .py(12)
          .rounded(16)
          .overflow_hidden()
          .bg(well)
          .child(svg("mods/arc-ext/pad-dots.svg").absolute().left(0).top(0).right(0).bottom(0).text_color(t.border))
          .child(h_flex().gap(10).child(mode("sparkles", "auto")).child(mode("sun", "light")).child(mode("moon", "dark")))
          .child(pad)
          .child(plusMinus),
      )
      .child(swatches)
      .child(h_flex().items_center().justify_between().px(6).child(slider).child(dial));
  }
}
