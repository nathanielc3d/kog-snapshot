// buildSnapshot: rank the holders of one SPL Token / Token 2022 mint from getProgramAccounts items (jsonParsed).
// Pure and deterministic: BigInt math, no floats, no network. Built by an AI agent (Money Machine, operated by Nathaniel).
import { createHash } from "node:crypto";

export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const PROGRAMS = new Set([TOKEN_PROGRAM, TOKEN_2022_PROGRAM]);
const PARSED_PROGRAMS = new Set(["spl-token", "spl-token-2022"]);
const DECIMAL = /^[0-9]+$/;

/** The text that is hashed: one line per kept holder, `rank,owner,amount`, joined by "\n", no trailing newline. */
export function holderLines(holders) {
  return holders.map((h) => `${h.rank},${h.owner},${h.amount}`).join("\n");
}

/** sha256 in lowercase hex of the UTF-8 holder lines. */
export function hashHolders(holders) {
  return createHash("sha256").update(holderLines(holders), "utf8").digest("hex");
}

/** Returns the parsed token account info when the item counts for `mint`, else null. */
export function tokenAccountInfo(item, mint) {
  const account = item?.account;
  if (!account || typeof account !== "object") return null;
  if (account.owner != null && !PROGRAMS.has(account.owner)) return null;
  const data = account.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null; // not jsonParsed
  if (data.program != null && !PARSED_PROGRAMS.has(data.program)) return null;
  const parsed = data.parsed;
  if (!parsed || parsed.type !== "account") return null; // mints, multisigs and others
  const info = parsed.info;
  if (!info || info.mint !== mint || typeof info.owner !== "string") return null;
  if (info.state === "uninitialized") return null;
  const raw = info.tokenAmount?.amount;
  if (typeof raw !== "string" || !DECIMAL.test(raw)) throw new Error(`token account ${item.pubkey} has an amount that is not a decimal string`);
  const amount = BigInt(raw);
  if (amount <= 0n) return null;
  return { owner: info.owner, amount };
}

function checkExclusions(exclusions) {
  const e = exclusions ?? {};
  if (typeof e !== "object" || Array.isArray(e)) throw new Error("exclusions must be an object {owners, token_accounts}");
  const list = (k) => {
    const v = e[k] ?? [];
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new Error(`exclusions.${k} must be a list of addresses`);
    return new Set(v);
  };
  return { owners: list("owners"), tokenAccounts: list("token_accounts") };
}

/**
 * buildSnapshot({mint, slot, accounts, exclusions, top = 100})
 *   -> {mint, slot, total, holders: [{rank, owner, amount}], hash}
 */
export function buildSnapshot({ mint, slot, accounts, exclusions, top = 100 } = {}) {
  if (typeof mint !== "string" || !mint) throw new Error("mint is required");
  if (!Array.isArray(accounts)) throw new Error("accounts must be a list of getProgramAccounts items");
  if (!Number.isInteger(top) || top < 0) throw new Error("top must be a whole number, 0 or more");
  const ex = checkExclusions(exclusions);

  const byOwner = new Map();
  const seen = new Set();
  for (const item of accounts) {
    const pubkey = item?.pubkey;
    if (typeof pubkey === "string") {
      if (seen.has(pubkey)) continue; // the same token account given twice counts once
      seen.add(pubkey);
      if (ex.tokenAccounts.has(pubkey)) continue;
    }
    const info = tokenAccountInfo(item, mint);
    if (!info || ex.owners.has(info.owner)) continue;
    byOwner.set(info.owner, (byOwner.get(info.owner) ?? 0n) + info.amount);
  }

  const ranked = [...byOwner.entries()].sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const total = ranked.reduce((s, [, v]) => s + v, 0n);
  const holders = ranked.slice(0, top).map(([owner, amount], i) => ({ rank: i + 1, owner, amount: amount.toString() }));
  return { mint, slot, total: total.toString(), holders, hash: hashHolders(holders) };
}
