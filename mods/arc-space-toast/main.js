import { View, div, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, run, theme } from "herdr";

const DOT = { error: "blocked", warning: "working", success: "done", info: "accent" };

export default class Toast extends View {
  render() {
    // A toast is a Herdr surface: its panel and the text on it are theme colours.
    const t = theme();
    const p = props() ?? {};
    const login = /^([a-z0-9][a-z0-9_.-]{0,31}) needs login; run hc machine login \1$/.exec(p.body ?? "");
    const command = login ? `hc machine login ${login[1]}` : null;
    const mark = p.icon
      ? image(p.icon).w(18).h(18)
      : div().size(8).rounded_full().bg(t[DOT[p.level] ?? "accent"]);
    return h_flex()
      .id("toast")
      .size_full()
      .px(14)
      .gap(12)
      .items_center()
      .rounded(12)
      .border_1()
      .border_color(t.border)
      .bg(t.popover)
      .shadow_lg()
      .cursor_pointer()
      .hover((s) => s.bg(t.hover))
      .on_click(() => {
        if (p.action?.name) run(p.action.name, p.action.args ?? {});
        closeOverlay(p.overlay);
      })
      .child(div().flex_none().w(30).h(30).rounded(8).bg(t.raised).flex().items_center().justify_center().child(mark))
      .child(
        v_flex()
          .flex_1()
          .min_w(0)
          .gap(1)
          .child(div().truncate().font_semibold().text_size(13.5).text_color(t.foreground).child(login ? `${login[1]} needs a login: run` : p.title ?? ""))
          .when(!login && Boolean(p.body), (el) => el.child(div().truncate().text_size(12.5).text_color(t.muted).child(p.body ?? "")))
          .when(Boolean(login), (el) =>
            el.child(
              h_flex()
                .gap(8)
                .items_center()
                .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(command))
                .child(
                  div()
                    .id("toast-login-copy")
                    .flex_none()
                    .px(8)
                    .py(3)
                    .rounded(6)
                    .bg(t.raised)
                    .text_size(12)
                    .text_color(t.foreground)
                    .cursor_pointer()
                    .hover((s) => s.bg(t.hover))
                    .on_click((_e, cx) => {
                      cx.stop_propagation();
                      cx.write_to_clipboard(command);
                      this.copied = true;
                      cx.notify();
                    })
                    .child(this.copied ? "Copied" : "Copy"),
                ),
            ),
          ),
      )
      .when(Boolean(p.action?.name), (el) => el.child(svgArrow(t)));
  }
}

function svgArrow(t) {
  return div().flex_none().w(26).h(26).rounded(7).bg(t.raised).flex().items_center().justify_center().text_color(t.muted).child("›");
}
