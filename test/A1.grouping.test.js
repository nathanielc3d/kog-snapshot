import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "../src/index.js";
import { acct, MINT, OTHER_MINT, T, T22, NO_EX } from "./helpers.js";

test("A1 token accounts are grouped by owner across both token programs", () => {
  const s = buildSnapshot({ mint: MINT, slot: 10, exclusions: NO_EX, accounts: [
    acct("ta1", "alice", "100", { program: T }),
    acct("ta2", "alice", "250", { program: T22 }),
    acct("ta3", "bob", "300", { program: T22 }),
  ] });
  assert.deepEqual(s.holders, [{ rank: 1, owner: "alice", amount: "350" }, { rank: 2, owner: "bob", amount: "300" }]);
  assert.equal(s.total, "650");
  assert.equal(s.mint, MINT);
  assert.equal(s.slot, 10);
});

test("A1 other mints, zero balances and items that are not token accounts are ignored", () => {
  const mintItem = { pubkey: MINT, account: { owner: T22, data: { program: "spl-token-2022", parsed: { type: "mint", info: { decimals: 6, supply: "999", mintAuthority: null } } } } };
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [
    acct("ta1", "alice", "5"),
    acct("ta2", "carol", "1000", { mint: OTHER_MINT }),
    acct("ta3", "dave", "0"),
    acct("ta4", "erin", "7", { type: "multisig" }),
    mintItem,
    { pubkey: "raw", account: { owner: T22, data: ["AAAA", "base64"] } },
    { pubkey: "sys", account: { owner: "11111111111111111111111111111111", data: { program: "system", parsed: { type: "account", info: { mint: MINT, owner: "frank", tokenAmount: { amount: "9" } } } } } },
    null,
    {},
  ] });
  assert.deepEqual(s.holders, [{ rank: 1, owner: "alice", amount: "5" }]);
  assert.equal(s.total, "5");
});

test("A1 amounts use BigInt: sums above 2^53 stay exact", () => {
  const big = "9007199254740993"; // 2^53 + 1
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [acct("a", "x", big), acct("b", "x", big)] });
  assert.equal(s.holders[0].amount, "18014398509481986");
  assert.equal(typeof s.holders[0].amount, "string");
});

test("A1 the same token account given twice counts once; a bad amount is refused", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [acct("a", "x", "4"), acct("a", "x", "4")] });
  assert.equal(s.total, "4");
  assert.throws(() => buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [acct("a", "x", "1.5")] }), /not a decimal string/);
  assert.throws(() => buildSnapshot({ slot: 1, accounts: [] }), /mint is required/);
});
