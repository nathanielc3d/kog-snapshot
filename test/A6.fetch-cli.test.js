import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fetchAccounts, run } from "../src/index.js";
import { acct, MINT, T, T22 } from "./helpers.js";

const BIN = new URL("../bin/kog-snapshot.js", import.meta.url).pathname;
const SECRET_RPC = "https://rpc.example.test/?api-key=SECRET123";

function fakeRpc(calls, answers = { [T]: { slot: 105, value: [acct("a", "alice", "5", { program: T })] }, [T22]: { slot: 100, value: [acct("b", "bob", "7")] } }) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, method: init.method, body });
    const a = answers[body.params[0]];
    if (a.error) return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: a.error }), { status: 200 });
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { context: { slot: a.slot }, value: a.value } }));
  };
}

test("A6 fetchAccounts sends one getProgramAccounts per token program: jsonParsed, withContext, memcmp on the mint at offset 0", async () => {
  const calls = [];
  const r = await fetchAccounts({ rpcUrl: SECRET_RPC, mint: MINT, fetch: fakeRpc(calls) });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((c) => c.body.params[0]).sort(), [T, T22].sort());
  for (const c of calls) {
    assert.equal(c.method, "POST");
    assert.equal(c.body.method, "getProgramAccounts");
    assert.equal(c.body.jsonrpc, "2.0");
    assert.deepEqual(c.body.params[1], { encoding: "jsonParsed", withContext: true, filters: [{ memcmp: { offset: 0, bytes: MINT } }] });
  }
  assert.equal(r.slot, 100, "lowest context slot");
  assert.deepEqual(r.accounts.map((a) => a.pubkey).sort(), ["a", "b"]);
});

test("A6 an RPC error is reported without the RPC URL", async () => {
  const calls = [];
  await assert.rejects(fetchAccounts({ rpcUrl: SECRET_RPC, mint: MINT, fetch: fakeRpc(calls, { [T]: { error: { code: -32010, message: `excluded from secondary indexes at ${SECRET_RPC}` } }, [T22]: { slot: 1, value: [] } }) }),
    (e) => /RPC error -32010/.test(e.message) && !e.message.includes("SECRET123"));
  await assert.rejects(fetchAccounts({ rpcUrl: SECRET_RPC, mint: MINT, fetch: async () => { throw new Error(`connect ECONNREFUSED ${SECRET_RPC}`); } }), (e) => !e.message.includes("SECRET123"));
});

function tmp() { return mkdtempSync(join(tmpdir(), "kog-")); }

test("A6 the CLI writes the snapshot from a recorded fixture with no network (bin, --out, --top)", () => {
  const d = tmp();
  const out = join(d, "snap.json");
  const r = spawnSync(process.execPath, [BIN, "--mint", MINT, "--exclusions", "fixtures/kog-exclusions.example.json", "--fixture", "fixtures/kog-mainnet-460883219.json", "--top", "5", "--out", out], { encoding: "utf8", env: { PATH: process.env.PATH } });
  assert.equal(r.status, 0, r.stderr);
  const s = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(s.slot, 460883219);
  assert.equal(s.holders.length, 5);
  assert.deepEqual(Object.keys(s), ["mint", "slot", "total", "holders", "hash"]);
});

test("A6 the CLI fetches with --slot as minContextSlot, saves the fixture, prints to stdout, never prints the RPC URL", async () => {
  const d = tmp(), fx = join(d, "fx.json"), ex = join(d, "ex.json");
  writeFileSync(ex, JSON.stringify({ owners: [], token_accounts: [] }));
  const calls = [], out = [], err = [];
  const code = await run(["--mint", MINT, "--exclusions", ex, "--slot", "99", "--save-fixture", fx], { env: { SOLANA_RPC_URL: SECRET_RPC }, fetch: fakeRpc(calls), stdout: (s) => out.push(s), stderr: (s) => err.push(s) });
  assert.equal(code, 0, err.join(""));
  assert.ok(calls.every((c) => c.body.params[1].minContextSlot === 99));
  const snap = JSON.parse(out.join(""));
  assert.deepEqual(snap.holders.map((h) => h.owner), ["bob", "alice"]);
  assert.deepEqual(JSON.parse(readFileSync(fx, "utf8")).slot, 100);
  assert.ok(!out.join("").includes("SECRET123") && !err.join("").includes("SECRET123"));
  // the saved fixture gives the same snapshot offline
  const out2 = [];
  assert.equal(await run(["--mint", MINT, "--exclusions", ex, "--fixture", fx], { env: {}, stdout: (s) => out2.push(s), stderr: () => {} }), 0);
  assert.equal(JSON.parse(out2.join("")).hash, snap.hash);
});

test("A6 the CLI exits 1 with a plain message on bad input", async () => {
  const d = tmp(), ex = join(d, "ex.json"), bad = join(d, "bad.json");
  writeFileSync(ex, JSON.stringify({ owners: [], token_accounts: [] }));
  writeFileSync(bad, "{not json");
  const cases = [
    [[], /--mint is required/],
    [["--mint", "not-a-mint!", "--exclusions", ex], /not a Solana address/],
    [["--mint", MINT], /--exclusions is required/],
    [["--mint", MINT, "--exclusions", join(d, "missing.json"), "--fixture", bad], /cannot read the exclusions file/],
    [["--mint", MINT, "--exclusions", bad, "--fixture", bad], /exclusions file .* is not valid JSON/],
    [["--mint", MINT, "--exclusions", ex, "--fixture", join(d, "nope.json")], /cannot read the fixture file/],
    [["--mint", MINT, "--exclusions", ex, "--fixture", ex], /is not \{slot, accounts\}/],
    [["--mint", MINT, "--exclusions", ex, "--top", "0", "--fixture", ex], /--top must be a whole number/],
    [["--mint", MINT, "--exclusions", ex, "--slot", "abc"], /--slot must be a whole number/],
    [["--mint", MINT, "--exclusions", ex, "--bogus", "1"], /unknown option --bogus/],
    [["--mint", MINT, "--exclusions", ex], /set SOLANA_RPC_URL/],
  ];
  for (const [argv, re] of cases) {
    const err = [];
    const code = await run(argv, { env: {}, stdout: () => {}, stderr: (s) => err.push(s) });
    assert.equal(code, 1, argv.join(" "));
    assert.match(err.join(""), re);
    assert.match(err.join(""), /^kog-snapshot: /);
  }
  const err = [];
  const code = await run(["--mint", MINT, "--exclusions", ex], { env: { SOLANA_RPC_URL: SECRET_RPC }, fetch: async () => new Response("oops", { status: 503 }), stdout: () => {}, stderr: (s) => err.push(s) });
  assert.equal(code, 1);
  assert.match(err.join(""), /HTTP 503/);
  assert.ok(!err.join("").includes("SECRET123"));
  const bin = spawnSync(process.execPath, [BIN, "--mint", MINT], { encoding: "utf8" });
  assert.equal(bin.status, 1);
  assert.match(bin.stderr, /--exclusions is required/);
});
