// Folder popups: a folder's menu, the "add this tab to a folder" picker, and the
// name box used to create and rename folders.
import { div } from "gpui-kit";
import { h_flex, v_flex, InputState, Input } from "gpui-base";
import { spaces, run, theme, openOverlay, props, closeOverlay } from "herdr";
import { surface, menuPanel, menuItem, rule } from "./menu.js";
import { herdr } from "../lib/herdr.js";
import { foldersOf, newFolder, renameFolder, deleteFolder, moveToFolder } from "../lib/organize.js";

export function folderMenu(folderId, spaceId) {
  openOverlay({ mod: "arc-ext", kind: "popup", width: 230, height: 22 + 3 * 35 + 9, frame: "none", props: { view: "folder-menu", folder: folderId, space: spaceId } });
}

export function folderMenuView() {
  const { folder, space, overlay } = props();
  const S = surface(theme());
  return menuPanel(
    [
      menuItem(overlay, "new-tab", "New Tab in Folder", async () => {
        const made = await herdr("tab.new", { space });
        if (made?.tab) moveToFolder(space, made.tab, folder);
      }, false, S),
      menuItem(overlay, "rename", "Rename Folder…", () => folderName({ space, folder }), false, S),
      rule(S),
      menuItem(overlay, "delete", "Delete Folder", () => deleteFolder(space, folder), true, S),
    ],
    S,
  );
}

export function folderPick(tab, spaceId) {
  const rows = foldersOf(spaceId).length + 1;
  openOverlay({ mod: "arc-ext", kind: "popup", width: 240, height: 22 + 26 + rows * 35 + 9, frame: "none", props: { view: "folder-pick", tab, space: spaceId } });
}

export function folderPickView() {
  const { tab, space, overlay } = props();
  const S = surface(theme());
  const items = foldersOf(space).map((f) => menuItem(overlay, `to-${f.id}`, f.name, () => moveToFolder(space, tab, f.id), false, S));
  items.push(menuItem(overlay, "new", "New Folder…", () => folderName({ space, tab }), false, S));
  return menuPanel([div().px(12).pt(6).pb(4).text_size(11).font_semibold().text_color(S.dim).child("ADD TO FOLDER"), ...items], S);
}

// folderName({ space, tab }) makes a folder (and puts `tab` in it); with { space, folder } renames it.
export function folderName(p) {
  openOverlay({ mod: "arc-ext", kind: "popup", width: 280, height: 112, frame: "none", props: { view: "folder-name", ...p } });
}

export class FolderName {
  init(cx) {
    const { space, folder } = props();
    this.renaming = Boolean(folder);
    const current = folder ? foldersOf(space).find((f) => f.id === folder)?.name ?? "" : "";
    this.input = InputState.new({ placeholder: "Folder name" });
    if (current) this.input.set_value(current);
    this.input.on("submit", () => this.done());
    this.input.focus();
    cx.timer.after(200, () => this.input.focus());
  }

  done() {
    const { space, folder, tab, overlay } = props();
    const name = this.input.value().trim();
    if (name) {
      if (folder) renameFolder(space, folder, name);
      else newFolder(space, name, tab);
    }
    closeOverlay(overlay);
  }

  render() {
    const S = surface(theme());
    return v_flex()
      .id("folder-name")
      .size_full()
      .p(12)
      .gap(10)
      .rounded(12)
      .border_1()
      .border_color(S.edge)
      .bg(S.panel)
      .shadow_lg()
      .child(div().text_size(12).font_semibold().text_color(S.dim).child(this.renaming ? "RENAME FOLDER" : "NEW FOLDER"))
      .child(div().flex_none().h(34).rounded(8).border_1().border_color(S.edge).px(8).flex().items_center().child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(S.text)))
      .child(
        h_flex().justify_end().child(
          div().id("fn-ok").h(28).px(14).flex().items_center().rounded(8).cursor_pointer().text_size(12.5).font_semibold().text_color(S.text).hover((s) => s.bg(S.hover)).on_click(() => this.done()).child("Done"),
        ),
      );
  }
}
