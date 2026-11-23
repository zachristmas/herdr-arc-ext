import { exec } from "herdr";

// Run one app command and read its JSON answer. `run()` is fire-and-forget and
// returns nothing, so commands whose result matters (a new tab's id, a new
// space's) go through the CLI instead.
export async function herdr(command, args) {
  const r = await exec("herdr-app", ["do", command, JSON.stringify(args)]);
  return JSON.parse(r.stdout);
}
