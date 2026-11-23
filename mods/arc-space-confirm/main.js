import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, theme } from "herdr";

const DANGER = { bg: "#e5534b", hover: "#f0675f", text: "#ffffff" };

export default class Confirm extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  yes() {
    const p = props();
    closeOverlay(p.overlay);
    run(p.command.name, p.command.args ?? {});
  }

  render() {
    const p = props() ?? {};
    // A Herdr dialog: its surface and the text on it are Herdr's theme colours.
    const t = theme();
    const button = (id, label, bg, hover, fg, onClick) =>
      h_flex()
        .id(id)
        .h(34)
        .px(16)
        .items_center()
        .rounded(9)
        .bg(bg)
        .text_size(13.5)
        .font_semibold()
        .text_color(fg)
        .cursor_pointer()
        .hover((s) => s.bg(hover))
        .on_click(onClick)
        .child(label);
    return v_flex()
      .id("confirm")
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "enter") this.yes();
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.stop_propagation();
      })
      .size_full()
      .min_h(0)
      .p(20)
      .gap(10)
      .rounded(16)
      .border_1()
      .border_color(t.border)
      .bg(t.popover)
      .shadow_lg()
      .child(div().text_size(17).font_semibold().text_color(t.foreground).child(p.title ?? "Are you sure?"))
      .child(div().flex_1().min_h(0).text_size(13.5).text_color(t.muted).child(p.detail ?? ""))
      .child(
        h_flex()
          .justify_end()
          .gap(8)
          .child(button("no", "Cancel", t.raised, t.hover, t.foreground, () => closeOverlay(props().overlay)))
          .child(button("yes", p.confirm ?? "Close", DANGER.bg, DANGER.hover, DANGER.text, () => this.yes())),
      );
  }
}
