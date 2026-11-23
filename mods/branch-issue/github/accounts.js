// Which gh login a repository's SSH host alias stands for, from ~/.config/herdr-app/gh-accounts.json
// ({ "github-cic": "zchristmas-cic", ... }). No file, or an alias not in it: null, and the active gh account is used.
import { appHome, readTextFile } from "herdr";

export async function accountForRemote(url) {
  const m = /^(?:(?:https?|git|ssh):\/\/(?:[^@/]+@)?([^/:]+)|git@([^:/]+):)/.exec(String(url ?? "").trim());
  const host = (m?.[1] ?? m?.[2] ?? "").toLowerCase();
  if (!host) return null;
  let map = {};
  try {
    map = JSON.parse((await readTextFile(`${appHome()}/gh-accounts.json`)) ?? "{}");
  } catch {
    return null;
  }
  const login = map[host];
  return typeof login === "string" && /^[A-Za-z0-9-]{1,39}$/.test(login) ? login : null;
}
