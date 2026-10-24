import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "../src/index.js";
import { acct, MINT } from "./helpers.js";

const accounts = [acct("ta-curve", "curve", "900"), acct("ta-a1", "alice", "100"), acct("ta-a2", "alice", "50"), acct("ta-pool", "pool", "500"), acct("ta-b", "bob", "70")];

test("A2 an excluded owner is left out of the ranking and of the total", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, accounts, exclusions: { owners: ["curve", "pool"], token_accounts: [] } });
  assert.deepEqual(s.holders.map((h) => h.owner), ["alice", "bob"]);
  assert.equal(s.total, "220");
});

test("A2 an excluded token account is left out, the owner's other accounts still count", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, accounts, exclusions: { owners: [], token_accounts: ["ta-a1", "ta-curve"] } });
  assert.deepEqual(s.holders, [{ rank: 1, owner: "pool", amount: "500" }, { rank: 2, owner: "bob", amount: "70" }, { rank: 3, owner: "alice", amount: "50" }]);
  assert.equal(s.total, "620");
});

test("A2 both kinds together; missing lists mean none; a malformed file is refused", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, accounts, exclusions: { owners: ["pool"], token_accounts: ["ta-curve"] } });
  assert.equal(s.total, "220");
  assert.equal(buildSnapshot({ mint: MINT, slot: 1, accounts, exclusions: {} }).total, "1620");
  assert.throws(() => buildSnapshot({ mint: MINT, slot: 1, accounts, exclusions: { owners: "curve" } }), /exclusions.owners/);
  assert.throws(() => buildSnapshot({ mint: MINT, slot: 1, accounts, exclusions: [] }), /exclusions must be an object/);
});
