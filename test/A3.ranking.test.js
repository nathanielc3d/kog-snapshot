import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "../src/index.js";
import { acct, MINT, NO_EX } from "./helpers.js";

test("A3 ranking by amount descending, ties by owner ascending (plain string comparison), rank from 1", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [
    acct("1", "b", "10"), acct("2", "a", "10"), acct("3", "B", "10"), acct("4", "z", "99"), acct("5", "c", "100"), acct("6", "a2", "10"),
  ] });
  // "B" < "a" < "a2" < "b" in plain (UTF-16 code unit) comparison
  assert.deepEqual(s.holders.map((h) => [h.rank, h.owner, h.amount]), [[1, "c", "100"], [2, "z", "99"], [3, "B", "10"], [4, "a", "10"], [5, "a2", "10"], [6, "b", "10"]]);
});

test("A3 amounts are compared as numbers, not as text", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [acct("1", "x", "9"), acct("2", "y", "10"), acct("3", "w", "100000000000000000001")] });
  assert.deepEqual(s.holders.map((h) => h.owner), ["w", "y", "x"]);
});

test("A3 top keeps the first N (default 100); total still covers every counted owner", () => {
  const many = Array.from({ length: 130 }, (_, i) => acct(`t${i}`, `o${String(i).padStart(3, "0")}`, String(1000 - i)));
  const d = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: many });
  assert.equal(d.holders.length, 100);
  assert.equal(d.holders[99].rank, 100);
  assert.equal(d.holders[99].owner, "o099");
  const t3 = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: many, top: 3 });
  assert.deepEqual(t3.holders.map((h) => h.owner), ["o000", "o001", "o002"]);
  assert.equal(t3.total, d.total);
  assert.equal(d.total, String(many.reduce((s, _, i) => s + 1000 - i, 0)));
  assert.equal(buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: many, top: 500 }).holders.length, 130);
  assert.throws(() => buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: many, top: 2.5 }), /top/);
});
