# kog-snapshot

A command line tool and a Node library that take a Solana token mint, a slot and an exclusions file, and write a ranked holder list with its sha256. SPL Token and Token 2022 aware, token accounts grouped by owner, reproducible from recorded data. Made for the KOG holder snapshot (KOG is Kognai's Token 2022 mint `76fFhcA142kf9gdg11ahYTmEiZnPXokxJkcF1axupump`), works for any mint.

> **AI disclosure.** Code, tests, fixtures and docs were written by an autonomous AI agent ("Money Machine") run by Nathaniel, for the Kognessium job "KOG holder snapshot tool". The operator is responsible for it.

Node 20 or later, zero runtime dependencies.

- Demo (same code, on the recorded KOG fixture): https://kog-snapshot.moneymachine.workers.dev/?top=10&exclude=C4E4jTqFXTsCYD2UvRTXmSDDjrMuLZtwrnxNJo9XYUJr . Live mode (`?live=1&mint=...`) needs a private `SOLANA_RPC_URL` secret on the Worker, because the public Solana endpoint blocks Cloudflare IPs; the CLI works with the public endpoint from a normal machine.

## CLI

```bash
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com   # read from the environment, never printed
npx github:nathanielc3d/kog-snapshot --mint 76fFhcA142kf9gdg11ahYTmEiZnPXokxJkcF1axupump \
  --exclusions fixtures/kog-exclusions.example.json --top 100 --out kog.json --save-fixture kog-fixture.json

# offline, from recorded data (no network, no SOLANA_RPC_URL needed)
kog-snapshot --mint 76fFhcA142kf9gdg11ahYTmEiZnPXokxJkcF1axupump \
  --exclusions fixtures/kog-exclusions.example.json --fixture fixtures/kog-mainnet-460883219.json --top 3
```

```json
{
  "mint": "76fFhcA142kf9gdg11ahYTmEiZnPXokxJkcF1axupump",
  "slot": 460883219,
  "total": "809178133103948",
  "holders": [
    { "rank": 1, "owner": "4fJHQGxJViPPqHQDCw7KmSVv7vfTGTXzr4JZ3oJv2ynV", "amount": "150000000000000" },
    { "rank": 2, "owner": "Ey8LmXxQ6eQfiKbXYko9RHm51f2bbbfedstxG29oE5uS", "amount": "50095000000000" },
    { "rank": 3, "owner": "6Z8yq4NagD4AZEzuW65Kp557SpCJ5nJdKeQHVgTkUUc", "amount": "25199908561142" }
  ],
  "hash": "f38b38bb9e0f83dc27ff330a58f2b2d217c83b0bb15ed3cd2f66c0240eb37e54"
}
```

`kog-snapshot --mint <address> --exclusions <file> [--slot <n>] [--top <n>] [--out <file>] [--fixture <file>] [--save-fixture <file>]`

- `--slot` is sent as `minContextSlot` (the RPC refuses to answer from an older slot); the snapshot's `slot` is the lowest context slot of the two answers. With `--fixture`, a fixture older than `--slot` is refused.
- `--fixture` reads `{slot, accounts}` (exactly what `fetchAccounts` returns) instead of calling the RPC; `--save-fixture` writes it, so anyone can re-run the same snapshot later and get the same hash.
- `--top` defaults to 100. The snapshot JSON goes to `--out` or stdout.
- Exit code 0 on success, 1 with one plain line on stderr (`kog-snapshot: ...`) on any error: missing or bad mint, missing exclusions, unreadable or invalid file, bad number, unknown option, RPC error or HTTP error. The RPC URL (which may carry an API key) is removed from every message.

Exclusions file: `{"owners": ["<wallet>", ...], "token_accounts": ["<token account>", ...]}`. `fixtures/kog-exclusions.example.json` is an example, not Kognai's official list: it excludes the KOG PumpSwap pool authority (`C4E4jTqF...YUJr`, an account owned by the PumpSwap AMM program, checked on 24 Oct 2026) and the Solana incinerator. Kognai's own list (curve, pools, burn, project wallets) drops in as it is.

Public RPCs may refuse `getProgramAccounts` for very large mints; for KOG (1,238 token accounts on 24 Oct 2026) the public mainnet endpoint answers in under a second.

## Library

```js
import { buildSnapshot, fetchAccounts } from "kog-snapshot";

const { slot, accounts } = await fetchAccounts({ rpcUrl: process.env.SOLANA_RPC_URL, mint, minContextSlot });
const snap = buildSnapshot({ mint, slot, accounts, exclusions: { owners: [], token_accounts: [] }, top: 100 });
// {mint, slot, total, holders: [{rank, owner, amount}], hash}
```

Rules of `buildSnapshot`:

- `accounts` are `getProgramAccounts` items in `jsonParsed` encoding from both token programs. Only items of type `account`, of the mint, with a positive amount count. Mints, multisigs, other mints, zero balances, uninitialized accounts, items owned by another program and non parsed items are ignored. The same token account given twice counts once.
- Token 2022 extensions (transfer fee, immutable owner, memo, CPI guard, ...) do not change anything: an account counts by `tokenAmount.amount`, frozen accounts included.
- Amounts are base units as decimal strings, summed per owner with BigInt (no floats). A non decimal amount is refused.
- An owner in `exclusions.owners` or a token account in `exclusions.token_accounts` is left out (from the ranking and from `total`).
- Ranking: amount descending, ties by owner ascending (plain string comparison, `a < b`); rank starts at 1; `top` (default 100) keeps the first holders; `total` is the sum over all counted owners after exclusions, as a decimal string.
- `hash`: sha256, lowercase hex, of the UTF-8 text with one line per kept holder, `rank,owner,amount`, joined by `\n`, no trailing newline. The same accounts in any order give the same hash.

`fetchAccounts({rpcUrl, mint, fetch?, minContextSlot?})` sends one `getProgramAccounts` JSON-RPC call per token program (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` and `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) with `encoding: "jsonParsed"`, `withContext: true` and a `memcmp` filter on the mint at offset 0, and returns `{slot, accounts}` with the lowest context slot.

## Tests

`npm test` (node:test, no network, 22 tests, CI on Node 20 and 22).

| Item | Test | Status |
|---|---|---|
| A1 grouped by owner across both programs; other mints, zero balances, non token accounts ignored | `test/A1.grouping.test.js` | done |
| A2 exclusions by owner and by token account | `test/A2.exclusions.test.js` | done |
| A3 ranking by amount, ties by owner, top N | `test/A3.ranking.test.js` | done |
| A4 hash rule, order independent | `test/A4.hash.test.js` | done |
| A5 Token 2022 extensions and frozen accounts count by amount | `test/A5.token2022.test.js` | done |
| A6 fetchAccounts sends the two calls; CLI from a fixture offline; exit 1 with a message | `test/A6.fetch-cli.test.js` | done |
| A7 recorded fixtures of a real Token 2022 mint | `test/A7.real-fixture.test.js` on `fixtures/kog-mainnet-460883219.json` (KOG, slot 460883219, 1,238 accounts, 385 holders). Without exclusions the total equals the mint supply; the expected hashes come from a separate Python implementation of the spec | done |

## Licence

MIT. Kognessium job: `cd50ebad-a84d-4c57-8f38-873669dc863a`.
