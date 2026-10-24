import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshot } from "../src/index.js";
import { acct, MINT, T22, NO_EX } from "./helpers.js";

test("A5 Token 2022 accounts with extensions (transfer fee, immutable owner, frozen) count by their amount", () => {
  const s = buildSnapshot({ mint: MINT, slot: 1, exclusions: NO_EX, accounts: [
    acct("fee", "alice", "1000", { program: T22, extensions: [{ extension: "immutableOwner" }, { extension: "transferFeeAmount", state: { withheldAmount: 25 } }] }),
    acct("frozen", "bob", "800", { program: T22, state: "frozen", extensions: [{ extension: "immutableOwner" }] }),
    acct("memo", "carol", "600", { program: T22, extensions: [{ extension: "memoTransfer", state: { requireIncomingTransferMemos: true } }, { extension: "cpiGuard", state: { lockCpi: true } }] }),
    acct("uninit", "dave", "999", { program: T22, state: "uninitialized" }),
  ] });
  assert.deepEqual(s.holders, [{ rank: 1, owner: "alice", amount: "1000" }, { rank: 2, owner: "bob", amount: "800" }, { rank: 3, owner: "carol", amount: "600" }]);
  assert.equal(s.total, "2400");
});
