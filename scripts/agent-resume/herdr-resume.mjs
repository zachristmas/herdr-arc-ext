#!/usr/bin/env node
// Keep Herdr terminals resumable across a core stop.
//   herdr-resume.mjs snapshot   label each live agent terminal with agent.kind / agent.session
//   herdr-resume.mjs [--dry]    in every terminal that lost its agent (a plain shell is left), type
//                               the resume command for the labelled session
// Agents: claude (exact id from a SessionStart hook), opencode, pi, copilot (the newest session in
// the terminal's folder that no other terminal owns).
import { execFileSync, execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const mode = args.includes("snapshot") ? "snapshot" : args.includes("sessions") ? "sessions" : "resume";
const home = homedir();
const run = (cmd, a) => execFileSync(cmd, a, { encoding: "utf8", maxBuffer: 1 << 27, stdio: ["ignore", "pipe", "ignore"] });
const hc = (...a) => JSON.parse(run("hc", [...a, "--json"]));
const norm = (p) => String(p ?? "").replaceAll(String.fromCharCode(92), "/").replace(/\/+$/, "").toLowerCase();

const RESUME = {
  claude: (id) => `claude --resume ${id}`,
  opencode: (id) => `opencode -s ${id}`,
  pi: (id) => `pi --session ${id}`,
  copilot: (id) => `copilot --resume ${id}`,
};

// ---- session stores: [{ id, cwd, at }] newest first
const stores = {
  opencode() {
    try {
      return JSON.parse(execSync("opencode session list --format json -n 60", { encoding: "utf8", maxBuffer: 1 << 27, stdio: ["ignore", "pipe", "ignore"] })).map((s) => ({ id: s.id, cwd: norm(s.directory), at: s.updated }));
    } catch { return []; }
  },
  pi() {
    const root = join(home, ".pi", "agent", "sessions");
    const files = [];
    try {
      for (const d of readdirSync(root)) for (const f of readdirSync(join(root, d))) if (f.endsWith(".jsonl")) { const p = join(root, d, f); files.push([p, statSync(p).mtimeMs]); }
    } catch { return []; }
    return files.sort((a, b) => b[1] - a[1]).slice(0, 150).flatMap(([p, at]) => {
      try { const h = JSON.parse(readFileSync(p, "utf8").split("\n", 1)[0]); return h.id ? [{ id: h.id, cwd: norm(h.cwd), at }] : []; } catch { return []; }
    });
  },
  copilot() {
    const root = join(home, ".copilot", "session-state");
    const out = [];
    try {
      for (const d of readdirSync(root)) {
        const y = join(root, d, "workspace.yaml");
        if (!existsSync(y)) continue;
        const t = readFileSync(y, "utf8");
        const cwd = /^cwd:\s*(.+)$/m.exec(t)?.[1]?.trim();
        if (cwd) out.push({ id: d, cwd: norm(cwd.replace(/^['"]|['"]$/g, "")), at: Date.parse(/^updated_at:\s*(\S+)/m.exec(t)?.[1] ?? "") || statSync(y).mtimeMs });
      }
    } catch { return []; }
    return out.sort((a, b) => b.at - a.at).slice(0, 150);
  },
};

const SHELL = /^(pwsh|powershell|bash|zsh|sh|fish|nu|cmd)(\.exe)?$/i;
const kindOf = (argv) => {
  const toks = (argv ?? []).map((t) => basename(String(t)).replace(/\.(exe|cmd|js|mjs)$/i, "").toLowerCase());
  return ["opencode", "copilot", "pi"].find((k) => toks.includes(k)) ?? null;
};

if (mode === "sessions") { // debug: sessions <kind> [cwd]
  const k = args[1], c = args[2] ? norm(args[2]) : null;
  console.log(JSON.stringify(stores[k]().filter((s) => !c || s.cwd === c).slice(0, 8), null, 1));
  process.exit(0);
}

const terms = hc("ls").terminals.filter((t) => t.state === "live" && !t.address.includes("/")).map((t) => hc("get", t.address));

if (mode === "snapshot") {
  const cache = {};
  const claimed = new Set(terms.flatMap((g) => (g.labels?.["agent.session"] ? [g.labels["agent.kind"] + ":" + g.labels["agent.session"]] : [])));
  for (const g of terms) {
    const kind = kindOf(g.foreground?.argv);
    if (!kind) continue;
    const cwd = norm(g.foreground?.cwd ?? g.cwd);
    const list = (cache[kind] ??= stores[kind]());
    const mine = g.labels?.["agent.kind"] === kind ? g.labels["agent.session"] : null;
    let pick = mine && list.find((s) => s.id === mine && s.cwd === cwd);
    // Only sessions touched since this terminal began, so a fresh agent is not matched to an old one.
    pick ??= list.find((s) => s.cwd === cwd && s.at >= (g.created_ms ?? 0) && !claimed.has(kind + ":" + s.id));
    if (!pick) continue;
    claimed.add(kind + ":" + pick.id);
    if (mine === pick.id) continue;
    console.log(`${g.address} ${kind} ${pick.id}`);
    if (!dry) run("hc", ["label", g.address, `agent.kind=${kind}`, `agent.session=${pick.id}`]);
  }
  process.exit(0);
}

let n = 0;
for (const g of terms) {
  const l = g.labels ?? {};
  const kind = l["agent.kind"] ?? (l["claude.session"] ? "claude" : null);
  const id = kind === "claude" ? l["claude.session"] : l["agent.session"];
  if (!kind || !id || !RESUME[kind]) continue;
  const fg = g.foreground?.name ?? "";
  if (!SHELL.test(fg)) { console.log(`${g.address} ${l.where ?? ""}: ${fg} running, skipped`); continue; }
  console.log(`${g.address} ${l.where ?? ""}: ${RESUME[kind](id)}`);
  if (!dry) run("hc", ["send", g.address, RESUME[kind](id)]);
  n++;
}
console.log(`${dry ? "would resume" : "resumed"} ${n}`);
