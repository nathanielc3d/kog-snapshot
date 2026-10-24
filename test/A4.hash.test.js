import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildSnapshot, holderLines } from "../src/index.js";
import { acct, MINT, NO_EX } from "./helpers.js";

const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");
const accounts = [acct("1", "alice", "350"), acct("2", "bob", "300"), acct("3", "carol", "300"), acct("4", "dave", "1")];

test("A4 the hash is sha256 hex of rank,owner,amount lines joined by a newline, no trailing newline", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts, top: 3 });
  const text = "1,alice,350\n2,bob,300\n3,carol,300";
  assert.equal(holderLines(s.holders), text);
  assert.equal(s.hash, sha(text));
  assert.match(s.hash, /^[0-9a-f]{64}$/);
  assert.notEqual(s.hash, sha(text + "\n"));
});

test("A4 the same accounts in any order give the same hash", () => {
  const base = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts }).hash;
  const perms = [[...accounts].reverse(), [accounts[2], accounts[0], accounts[3], accounts[1]], [accounts[1], accounts[3], accounts[0], accounts[2]]];
  for (const p of perms) assert.equal(buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: p }).hash, base);
});

test("A4 an empty list hashes the empty string", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [] });
  assert.equal(s.hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(s.total, "0");
});
