import { readFileSync } from "node:fs";
export const MINT = "76fFhcA142kf9gdg11ahYTmEiZnPXokxJkcF1axupump";
export const OTHER_MINT = "So11111111111111111111111111111111111111112";
export const T = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const T22 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const load = (name) => JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

// a getProgramAccounts item in jsonParsed encoding
export function acct(pubkey, owner, amount, { mint = MINT, program = T22, state = "initialized", extensions, type = "account", decimals = 6 } = {}) {
  const info = { isNative: false, mint, owner, state, tokenAmount: { amount: String(amount), decimals, uiAmount: Number(amount) / 10 ** decimals, uiAmountString: "" } };
  if (extensions) info.extensions = extensions;
  return { pubkey, account: { lamports: 2039280, owner: program, executable: false, rentEpoch: 0, space: 182, data: { program: program === T ? "spl-token" : "spl-token-2022", parsed: { type, info }, space: 182 } } };
}

export const NO_EX = { owners: [], token_accounts: [] };
