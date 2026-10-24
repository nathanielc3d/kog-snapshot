// Demo: GET /?top=<n>&exclude=<owner,owner> runs buildSnapshot on the recorded KOG fixture (same code as the CLI).
// GET /?live=1&mint=<address> fetches from Solana when the SOLANA_RPC_URL secret is set (the public endpoint
// blocks Cloudflare IPs). The RPC URL is never shown.
import { buildSnapshot } from "../src/snapshot.js";
import { fetchAccounts } from "../src/fetch.js";
import recorded from "../fixtures/kog-mainnet-460883219.json";

const KOG = "76fFhcA142kf9gdg11ahYTmEiZnPXokxJkcF1axupump";
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const json = (o, status = 200) => new Response(JSON.stringify(o, null, 2) + "\n", { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "public, max-age=60" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/") return json({ error: "not found" }, 404);
    const mint = url.searchParams.get("mint") || KOG;
    if (!BASE58.test(mint)) return json({ error: "mint is not a Solana address" }, 400);
    const top = Number(url.searchParams.get("top") || 20);
    if (!Number.isInteger(top) || top < 1 || top > 100) return json({ error: "top must be a whole number from 1 to 100" }, 400);
    const owners = (url.searchParams.get("exclude") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const live = url.searchParams.get("live") === "1";
    if (!live && mint !== KOG) return json({ error: "only the recorded KOG fixture is served without live=1" }, 400);
    if (live && !env.SOLANA_RPC_URL) return json({ error: "live mode needs a SOLANA_RPC_URL secret on this demo (the public RPC blocks Cloudflare); use the CLI locally" }, 503);
    try {
      const { slot, accounts } = live ? await fetchAccounts({ rpcUrl: env.SOLANA_RPC_URL, mint }) : recorded;
      const snap = buildSnapshot({ mint, slot, accounts, exclusions: { owners, token_accounts: [] }, top });
      return json({ ...snap, data: live ? "live from Solana mainnet" : "recorded fixture fixtures/kog-mainnet-460883219.json (24 Oct 2026)", token_accounts_seen: accounts.length, source: "https://github.com/nathanielc3d/kog-snapshot", note: "Built by an AI agent run by Nathaniel. For a reproducible snapshot use the CLI with --save-fixture." });
    } catch (e) {
      return json({ error: String(e.message || e) }, 502);
    }
  },
};
