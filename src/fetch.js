// fetchAccounts: one getProgramAccounts call per token program, jsonParsed, withContext, memcmp on the mint at offset 0.
// The RPC URL may hold an API key: it is never put in an error message or a log.
import { TOKEN_PROGRAM, TOKEN_2022_PROGRAM } from "./snapshot.js";

export const PROGRAMS = [TOKEN_PROGRAM, TOKEN_2022_PROGRAM];

export function gpaRequest(programId, mint, id, minContextSlot) {
  const config = { encoding: "jsonParsed", withContext: true, filters: [{ memcmp: { offset: 0, bytes: mint } }] };
  if (minContextSlot != null) config.minContextSlot = minContextSlot;
  return { jsonrpc: "2.0", id, method: "getProgramAccounts", params: [programId, config] };
}

const redact = (text, rpcUrl) => (rpcUrl ? String(text).split(rpcUrl).join("<SOLANA_RPC_URL>") : String(text));

/** fetchAccounts({rpcUrl, mint, fetch?, minContextSlot?}) -> Promise<{slot, accounts}> */
export async function fetchAccounts({ rpcUrl, mint, fetch: fetchImpl = globalThis.fetch, minContextSlot } = {}) {
  if (!rpcUrl) throw new Error("no RPC URL: set SOLANA_RPC_URL");
  if (!mint) throw new Error("mint is required");
  const answers = await Promise.all(PROGRAMS.map(async (programId, i) => {
    let res;
    try {
      res = await fetchImpl(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(gpaRequest(programId, mint, i + 1, minContextSlot)) });
    } catch (e) {
      throw new Error(`RPC request failed: ${redact(e?.message ?? e, rpcUrl)}`);
    }
    let body;
    try { body = await res.json(); } catch { throw new Error(`RPC answered HTTP ${res.status} without JSON`); }
    if (body?.error) throw new Error(`RPC error ${body.error.code ?? ""}: ${redact(body.error.message ?? "unknown", rpcUrl)}`.replace("error :", "error:"));
    if (!res.ok) throw new Error(`RPC answered HTTP ${res.status}`);
    const r = body?.result;
    if (!r || typeof r.context?.slot !== "number" || !Array.isArray(r.value)) throw new Error("RPC answer is not a getProgramAccounts result with context");
    return r;
  }));
  return { slot: Math.min(...answers.map((a) => a.context.slot)), accounts: answers.flatMap((a) => a.value) };
}
