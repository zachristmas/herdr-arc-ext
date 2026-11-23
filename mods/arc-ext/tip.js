import { div } from "gpui-kit";
import { window } from "herdr";
import { h_flex, Popup } from "gpui-base";

const GLYPH = window()?.platform === "macos"
  ? { cmd: "⌘", shift: "⇧", ctrl: "⌃", alt: "⌥", enter: "↵" }
  : { cmd: "Win", shift: "Shift", ctrl: "Ctrl", alt: "Alt", enter: "↵" };
const DELAY = 450;
const FADE = 120;
const INSET = 6;

function cap(k) {
  return div()
    .flex_none()
    .rounded(5)
    .bg("#7fa6b6")
    .pb(2)
    .shadow_sm()
    .child(
      div()
        .min_w(18)
        .h(17)
        .px(4)
        .rounded(5)
        .bg("#d3e8f0")
        .border_t(1)
        .border_color("#ffffff")
        .flex()
        .items_center()
        .justify_center()
        .text_size(10.5)
        .font_semibold()
        .text_color("#173a47")
        .child(GLYPH[k] ?? k.toUpperCase()),
    );
}

function pill(id, label, keys, visible) {
  return h_flex()
    .id(`tipc-${id}`)
    .pl(10)
    .pr(keys ? 4 : 10)
    .h(26)
    .gap(6)
    .items_center()
    .rounded(13)
    .rounded_tl(3)
    .bg("#0f2a33f5")
    .border_1()
    .border_color("#ffffff24")
    .shadow_md()
    .text_size(12)
    .font_semibold()
    .text_color("#e9f1f4")
    .opacity(visible ? 1 : 0)
    .transition("opacity", { duration: FADE, easing: "ease-out" })
    .child(div().flex_none().child(label))
    .when(Boolean(keys), (el) => el.child(h_flex().gap(3).children(keys.split("-").map(cap))));
}

export class Tips {
  constructor(later, muted) {
    this.later = later;
    this.muted = muted ?? (() => false);
    this.want = null;
    this.open = null;
    this.visible = false;
  }

  hideAll() {
    this.want = null;
    this.open = null;
    this.visible = false;
  }

  hide(id) {
    if (this.want === id) this.want = null;
    if (this.open !== id) return;
    this.visible = false;
    this.later(FADE, () => {
      if (this.open === id && !this.visible) this.open = null;
    });
  }

  hover(id) {
    return (on, cx) => {
      if (!on) {
        this.hide(id);
        cx.notify();
        return;
      }
      if (this.muted()) return;
      this.want = id;
      this.later(DELAY, () => {
        if (this.want !== id) return;
        this.open = id;
        this.visible = false;
        this.later(16, () => {
          if (this.open === id) this.visible = true;
        });
      });
    };
  }

  wrap(id, trigger, label, keys, full) {
    const open = this.open === id && !this.muted();
    const spot = div().absolute().right(INSET).bottom(INSET).w(1).h(1);
    return div()
      .relative()
      .flex()
      .when(full === true, (el) => el.w_full())
      .when(full === "grow", (el) => el.flex_1().min_w(0))
      .child(trigger.on_hover(this.hover(id)).on_mouse_down("left", () => this.hide(id)).on_mouse_down("right", () => this.hideAll()))
      .child(Popup.new(`tip-${id}`, spot).anchor("top_left").when(open, (el) => el.content(pill(id, label, keys, this.visible))));
  }
}
