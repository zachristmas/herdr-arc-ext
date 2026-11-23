// A space's icon, picked like Zen Browser's workspace icon picker: an Emoji tab
// with a search box (matched against each emoji's name and tags), an Icons tab
// with Zen's set of line glyphs (Ionicons, MIT), and a None button.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { props, closeOverlay, theme, shared, setShared, readTextFile, appHome, openOverlay } from "herdr";
import { ICON_NAMES } from "../lib/icon-names.js";

const ICONS = "arc-ext.icons"; // { [spaceId]: { kind: "emoji" | "icon", value } }
const SHOWN = 360; // grid cells drawn at once; search narrows the rest

export const iconOf = (spaceId) => (shared(ICONS) ?? {})[spaceId] ?? null;

function saveIcon(spaceId, value) {
  const all = { ...(shared(ICONS) ?? {}) };
  if (value) all[spaceId] = value;
  else delete all[spaceId];
  setShared(ICONS, all);
}

// What a space shows in its chip: its icon, else `fallback` (its first letter).
export function glyph(spaceId, fallback, size, color) {
  const i = iconOf(spaceId);
  if (i?.kind === "emoji") return div().text_size(size).child(i.value);
  if (i?.kind === "icon") return svg(`mods/arc-ext/icon-set/${i.value}.svg`).size(size).text_color(color);
  return fallback;
}

export function iconMenu(spaceId) {
  openOverlay({ mod: "arc-ext", kind: "popup", width: 356, height: 440, frame: "none", props: { view: "icons", space: spaceId } });
}

export class IconPicker {
  init(cx) {
    this.space = props().space;
    this.tab = iconOf(this.space)?.kind === "icon" ? "icons" : "emoji";
    this.query = "";
    this.emojis = null;
    this.input = InputState.new({ placeholder: "Search emojis" });
    this.input.on("change", (_e, cx) => {
      this.query = this.input.value().trim().toLowerCase();
      cx.notify();
    });
    this.input.focus();
    cx.timer.after(200, () => this.input.focus());
    cx.spawn(async (cx) => {
      try {
        this.emojis = JSON.parse(await readTextFile(appHome() + "/mods/arc-ext/emojis.json"));
      } catch {
        this.emojis = [];
      }
      cx.notify();
    });
  }

  pick(value) {
    saveIcon(this.space, value);
    closeOverlay(props().overlay);
  }

  button(id, label, on, action, S) {
    return div()
      .id(id)
      .h(28)
      .px(12)
      .flex()
      .items_center()
      .rounded(8)
      .cursor_pointer()
      .text_size(12.5)
      .font_semibold()
      .text_color(on ? S.text : S.dim)
      .when(on, (el) => el.bg(S.hover))
      .hover((s) => s.bg(S.hover).text_color(S.text))
      .on_click(action)
      .child(label);
  }

  cell(id, child, action, S) {
    return div()
      .id(id)
      .flex_none()
      .w(36)
      .h(36)
      .rounded(8)
      .flex()
      .items_center()
      .justify_center()
      .cursor_pointer()
      .hover((s) => s.bg(S.hover))
      .on_click(action)
      .child(child);
  }

  render(cx) {
    const t = theme();
    const S = { panel: t.popover, edge: t.border, text: t.foreground, dim: t.muted, hover: t.hover };
    const current = iconOf(this.space);
    let cells;
    if (this.tab === "emoji") {
      const q = this.query;
      const list = (this.emojis ?? []).filter(([, tags]) => !q || q.split(/\s+/).every((w) => tags.includes(w)));
      cells = list.slice(0, SHOWN).map(([e], i) =>
        this.cell(`em-${i}`, div().text_size(20).child(e), () => this.pick({ kind: "emoji", value: e }), S),
      );
      if (!cells.length) cells = [div().p(10).text_size(12.5).text_color(S.dim).child(this.emojis ? "No emoji matches." : "Loading…")];
    } else {
      cells = ICON_NAMES.map((n) =>
        this.cell(`ic-${n}`, svg(`mods/arc-ext/icon-set/${n}.svg`).size(18).text_color(S.text), () => this.pick({ kind: "icon", value: n }), S),
      );
    }
    return v_flex()
      .id("icon-picker")
      .size_full()
      .p(10)
      .gap(8)
      .rounded(12)
      .border_1()
      .border_color(S.edge)
      .bg(S.panel)
      .shadow_lg()
      .child(
        h_flex()
          .flex_none()
          .gap(2)
          .items_center()
          .child(this.button("tab-emoji", "Emoji", this.tab === "emoji", () => { this.tab = "emoji"; cx.notify(); }, S))
          .child(this.button("tab-icons", "Icons", this.tab === "icons", () => { this.tab = "icons"; cx.notify(); }, S))
          .child(div().flex_1())
          .when(Boolean(current), (el) => el.child(this.button("none", "None", false, () => this.pick(null), S))),
      )
      .when(this.tab === "emoji", (el) =>
        el.child(div().flex_none().h(34).rounded(8).border_1().border_color(S.edge).px(8).flex().items_center().child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(S.text))),
      )
      .child(v_flex().id("icon-grid").flex_1().min_h(0).overflow_y_scroll().child(h_flex().flex_wrap().gap(2).children(cells)));
  }
}
