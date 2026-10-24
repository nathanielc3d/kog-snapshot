// kog-snapshot CLI. Exit 0 on success, 1 with a plain message on any error. SOLANA_RPC_URL is read, never printed.
import { readFileSync, writeFileSync } from "node:fs";
import { buildSnapshot } from "./snapshot.js";
import { fetchAccounts } from "./fetch.js";

export const USAGE = "usage: kog-snapshot --mint <address> --exclusions <file> [--slot <n>] [--top <n>] [--out <file>] [--fixture <file>] [--save-fixture <file>]";
const VALUE_FLAGS = new Set(["--mint", "--exclusions", "--slot", "--top", "--out", "--fixture", "--save-fixture"]);
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i], v;
    if (a === "--help" || a === "-h") { o.help = true; continue; }
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0) { v = a.slice(eq + 1); a = a.slice(0, eq); }
    if (!VALUE_FLAGS.has(a)) throw new Error(`unknown option ${a}`);
    if (v === undefined) { v = argv[++i]; if (v === undefined || (v.startsWith("--") && VALUE_FLAGS.has(v))) throw new Error(`${a} needs a value`); }
    o[a.slice(2).replace("-f", "F")] = v;
  }
  return o;
}

const whole = (name, v, min) => {
  if (!/^[0-9]+$/.test(v) || Number(v) < min || !Number.isSafeInteger(Number(v))) throw new Error(`${name} must be a whole number${min ? ", 1 or more" : ""}`);
  return Number(v);
};

function readJson(file, what) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch (e) { throw new Error(`cannot read the ${what} file ${file}: ${e.code ?? e.message}`); }
  try { return JSON.parse(text); } catch { throw new Error(`the ${what} file ${file} is not valid JSON`); }
}

/** run(argv, {env, fetch, stdout, stderr}) -> exit code. */
export async function run(argv, { env = process.env, fetch: fetchImpl = globalThis.fetch, stdout = (s) => process.stdout.write(s), stderr = (s) => process.stderr.write(s) } = {}) {
  const rpcUrl = env.SOLANA_RPC_URL;
  try {
    const o = parseArgs(argv);
    if (o.help) { stdout(USAGE + "\n"); return 0; }
    if (!o.mint) throw new Error("--mint is required");
    if (!BASE58.test(o.mint)) throw new Error(`--mint ${o.mint} is not a Solana address`);
    if (!o.exclusions) throw new Error("--exclusions is required (a JSON file {\"owners\": [], \"token_accounts\": []})");
    const slot = o.slot === undefined ? undefined : whole("--slot", o.slot, 0);
    const top = o.top === undefined ? 100 : whole("--top", o.top, 1);
    const exclusions = readJson(o.exclusions, "exclusions");

    let recorded;
    if (o.fixture) {
      recorded = readJson(o.fixture, "fixture");
      if (!recorded || typeof recorded.slot !== "number" || !Array.isArray(recorded.accounts)) throw new Error(`the fixture file ${o.fixture} is not {slot, accounts}`);
      if (slot !== undefined && recorded.slot < slot) throw new Error(`the fixture is at slot ${recorded.slot}, before --slot ${slot}`);
    } else {
      if (!rpcUrl) throw new Error("set SOLANA_RPC_URL, or use --fixture <file>");
      recorded = await fetchAccounts({ rpcUrl, mint: o.mint, fetch: fetchImpl, minContextSlot: slot });
    }
    if (o.saveFixture) writeFileSync(o.saveFixture, JSON.stringify({ slot: recorded.slot, accounts: recorded.accounts }) + "\n");

    const snap = buildSnapshot({ mint: o.mint, slot: recorded.slot, accounts: recorded.accounts, exclusions, top });
    const json = JSON.stringify(snap, null, 2) + "\n";
    if (o.out) writeFileSync(o.out, json); else stdout(json);
    return 0;
  } catch (e) {
    let msg = String(e?.message ?? e);
    if (rpcUrl) msg = msg.split(rpcUrl).join("<SOLANA_RPC_URL>");
    stderr(`kog-snapshot: ${msg}\n`);
    return 1;
  }
}
