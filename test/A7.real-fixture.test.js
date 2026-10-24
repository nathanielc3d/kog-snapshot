import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "../src/index.js";
import { load, MINT, T22 } from "./helpers.js";

// fixtures/kog-mainnet-460883219.json: both getProgramAccounts answers for KOG (Token 2022, mint 76fF...pump)
// recorded from Solana mainnet on 24 Oct 2026 with `kog-snapshot --save-fixture`. Expected values below were
// computed by a separate Python implementation of the spec, not by this code.
const fx = load("kog-mainnet-460883219.json");
const ex = load("kog-exclusions.example.json");
const MINT_SUPPLY = "952859465632458"; // getAccountInfo(mint).supply at that time

test("A7 the recorded fixture is a real Token 2022 mint with extensions", () => {
  assert.equal(fx.slot, 460883219);
  assert.equal(fx.accounts.length, 1238);
  assert.ok(fx.accounts.every((a) => a.account.owner === T22 && a.account.data.parsed.info.mint === MINT));
  assert.ok(fx.accounts.filter((a) => (a.account.data.parsed.info.extensions ?? []).some((e) => e.extension === "immutableOwner")).length > 1000);
});

test("A7 without exclusions the total equals the mint supply and the hash matches the independent result", () => {
  const s = buildSnapshot({ mint: MINT, slot: fx.slot, accounts: fx.accounts, exclusions: { owners: [], token_accounts: [] } });
  assert.equal(s.total, MINT_SUPPLY);
  assert.equal(s.holders.length, 100);
  assert.deepEqual(s.holders[0], { rank: 1, owner: "4fJHQGxJViPPqHQDCw7KmSVv7vfTGTXzr4JZ3oJv2ynV", amount: "150000000000000" });
  assert.equal(s.hash, "9d975d5f7a27b5277ec5c61894dd14486a44804db0741ef31fdce887ce244ea9");
  assert.equal(buildSnapshot({ mint: MINT, slot: fx.slot, accounts: fx.accounts, exclusions: {}, top: 10 }).hash, "7ba9cfb6dc024ca65e5b3c8b2174dc07d289006c8d2fd0709ff8acd9eaa0421f");
});

test("A7 with the example exclusions (the PumpSwap pool) and shuffled input", () => {
  const shuffled = [...fx.accounts].sort((a, b) => (a.pubkey < b.pubkey ? 1 : -1));
  const s = buildSnapshot({ mint: MINT, slot: fx.slot, accounts: shuffled, exclusions: ex });
  assert.equal(s.total, "809178133103948");
  assert.ok(!s.holders.some((h) => ex.owners.includes(h.owner)));
  assert.equal(s.hash, "8be87ec9ef03644f154a605045e9f5ed4e58be63af3b19e80d7fc64553f499dc");
});
