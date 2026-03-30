# Verix — AI Context Document

> **One-liner:** "Verix is the trust layer for AI agent commerce — payment locks in XRPL escrow, releases only when task output is cryptographically verified. No middleman. No scripts. Just math."

---

## What Is Verix?

Verix is a **trust and settlement middleware layer for AI agent commerce**, built natively on the XRP Ledger. It solves one specific problem:

> When one AI agent hires another to complete a task, how do you release payment only when the task is cryptographically proven complete — with no middleman?

**Answer:** Output-hash-based crypto conditions on XRPL escrows, combined with agent DIDs for identity and on-chain audit logs for accountability.

**Context:** Built for the Ripple Student Builder Residency.

---

## The Core Problem — The Handshake Problem

AI agents are increasingly hiring other agents to complete tasks (fetch data, run computations, generate reports). The payment layer is broken:

- Pay upfront → worker agent can vanish or return garbage
- Pay after → buyer agent can refuse to pay for completed work
- Traditional escrow → often relies on a human or platform arbitrator for disputes, which breaks hands-off autonomy

**Is this actually a problem?** Yes, in the sense of **mechanism design**, not AI hype: the same **two-sided commitment** (hold-up) structure applies whenever a buyer and seller do not trust each other—machines inherit it. What *is* new is scale and speed: agents can fire thousands of delegated calls; small frictions in payment or verification compound.

**Evidence:**

- **Cross-org agent commerce assumes “no pre-existing trust.”** [EIP-8004 (ERC-8004: Trustless Agents)](https://eips.ethereum.org/EIPS/eip-8004) states that while MCP lists capabilities and A2A handles task lifecycle, those protocols “don’t inherently cover agent discovery and trust,” and proposes on-chain identity, reputation, and validation for “open-ended agent economies” across organizational boundaries.
- **Payment rails ≠ verified delivery.** HTTP-native agent payment stacks (e.g. **x402**) focus on machine-readable pay-per-request settlement ([Coinbase x402 repo](https://github.com/coinbase/x402), [docs](https://docs.cdp.coinbase.com/x402/docs/http-402)); they do not by themselves prove that a *task* was completed to spec—hence the gap your table calls out. Ecosystem commentary flags gaps such as **dispute handling** and refund edge cases on instant settlement—i.e. verification of *correct work* is a separate layer from payment.
- **Enterprise trajectory (context only):** Analyst forecasts (e.g. Gartner-style projections cited widely for **2026**—agentic features in a large share of enterprise apps) imply more delegated automation, not less. Exact percentages vary by source; treat as directional.

**Nuance:** On-chain or smart-contract escrow can release on **objective** conditions (e.g. hash preimage) without a person in the loop for the happy path. The pain point for fully autonomous systems is usually **subjective** “was this good work?” disputes—or proving **schema-correct** output at scale—unless the contract encodes a verifiable condition (what Verix targets).

**The Handshake Problem:** Two agents need to transact without trusting each other and without a central authority.

Scripts cannot solve this. A script handles "if X then Y." An agent task requires:
1. Lock payment
2. Define expected output
3. Verify output matches
4. Release payment automatically

The verification and trustless release **must** be enforced at the protocol level, not by either party. This is exactly what XRPL's crypto condition escrows were built for.

### Why Existing Solutions Don't Cover This

| Solution | What It Does | What It Misses |
|---|---|---|
| **x402 (Coinbase)** | Agent-to-agent micropayments | Does NOT verify task was completed correctly |
| **AP2 (Google)** | Centralized mandate framework | Requires Google as trust authority, not permissionless |
| **Nevermined** | Chain-agnostic agent payment rails | Not XRPL-native, no output verification layer |
| **Stripe/ACP** | Fiat payment rails | No on-chain proof of task completion |

**Nobody has built output-hash verification tied to XRPL escrow finalization. That is Verix.**

---

## The Solution — Three Components

### 1. Agent Identity (XLS-40 DIDs)
Every agent (buyer or worker) gets a unique XRPL Decentralized Identifier. This is their persistent on-chain identity, carrying reputation across sessions and platforms.

- Unlike just using an account address, DIDs are designed to combine with Verifiable Credentials
- Gives agents provable claims about their capabilities and track record
- Worker agent signs its output with its DID private key
- Public key is anchored on-chain via XLS-40 — buyer can verify signature without trusting the worker

### 2. Proof-of-Output Escrow (Core Innovation)

**When buyer agent posts a task:**
1. Defines the **expected output schema** (e.g. `{ asset: string, price: number, timestamp: string }`)
2. Hashes that schema + task parameters to create a **crypto condition**
3. Locks payment in an XRPL native escrow against that condition

**When worker agent completes the task:**
1. Returns a signed JSON output
2. Verix validates: schema match + signature validity + hash match
3. All pass → `EscrowFinish` executes automatically, payment releases
4. Fail → `EscrowCancel` returns funds to buyer

No human. No arbitrator. The ledger enforces the contract.

### 3. On-Chain Audit Trail
Every validation event (pass or fail, with reasoning) is logged as an XRPL transaction memo. Creates an immutable, queryable history that regulators, developers, or other agents can verify — years later.

---

## The Demo — 60-Second End-to-End Flow

**Scenario:** A hiring agent pays a worker agent to fetch ETH/USD price and return structured JSON. Payment releases only when output is cryptographically verified.

```
STEP 1 — BUYER AGENT
Posts task: "Fetch ETH/USD price, return JSON"
Locks 1 RLUSD in XRPL escrow
Escrow condition = hash(expected output schema)

STEP 2 — WORKER AGENT
Picks up task
Calls CoinGecko API
Returns: { asset: "ETH", price: 2841.22, timestamp: "2026-03-30T..." }
Signs the output with its DID private key

STEP 3 — VERIX MIDDLEWARE
Validates:
  ✓ Schema matches expected format
  ✓ Signature is valid (worker DID verified)
  ✓ Output hash matches escrow crypto condition

STEP 4 — XRPL LEDGER
EscrowFinish executes automatically
1 RLUSD released to worker agent wallet
Audit log written on-chain as transaction memo
Reputation score updated for both agents

DASHBOARD SHOWS:
✓ Task completed  ✓ Payment released  ✓ Proof on-chain
→ View transaction on XRPL explorer
```

**UI:** Three animated panels (Buyer Agent | Verix Middleware | Worker Agent). Single "Run Demo" button triggers the whole flow. Each step highlights as it completes.

---

## Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | React + dashboard |
| Backend | TypeScript/Node (`server.ts` + `XAG` class) |
| Agent Identity | XLS-40 DIDs |
| Trustless Payment | XRPL Native Escrows + crypto conditions |
| Stablecoin | RLUSD |
| Audit Trail | XRPL Transaction Memos |
| Price Data | CoinGecko API (free, no auth needed for demo) |
| Schema Validation | AJV JSONSchema |

### The Missing Piece — `verifyAndSettle()`

The existing repo already has: agent creation, escrow initiation, escrow fulfillment, reputation scoring, logging, negotiation flows.

**The one missing piece:** output hash validation middleware that bridges the escrow crypto condition to the actual task output.

```typescript
// New function to add to XAG class
async verifyAndSettle(
  taskOutput: object,
  expectedSchema: JSONSchema,
  escrowHash: string,
  workerDID: string,
  workerSeed: string
): Promise<{ verified: boolean; txHash?: string; reason?: string }>
```

This function:
1. Validates output against JSONSchema (AJV)
2. Hashes the output
3. Checks hash against escrow condition
4. If match → calls existing `fulfillTrade()`
5. Logs result on-chain via existing `log()` method

### New API Endpoint

```
POST /api/verify-and-settle
Body:    { taskOutput, expectedSchema, escrowHash, workerDID, workerSeed }
Response: { verified: boolean, txHash, complianceScore, auditUrl }
```

### Demo Frontend — Three-Panel Layout

- **Left panel (Buyer Agent):** Task posting, escrow creation, RLUSD locked
- **Center panel (Verix Middleware):** Validation steps animating in real time (schema ✓, sig ✓, hash ✓)
- **Right panel (Worker Agent):** API call, output returned, RLUSD received

---

## XRPL Primitives Used

| Primitive | Purpose |
|---|---|
| **XLS-40 DIDs** | Persistent agent identity, signed output verification |
| **Native Escrows + crypto conditions** | Trustless payment release on output hash match |
| **RLUSD** | Stablecoin for predictable micropayment pricing |
| **Transaction Memos** | Immutable on-chain audit logs |

Note: Using RLUSD native escrow for the demo (maximum XRPL primitive usage = 30% of rubric). x402 via MPP SDK is Phase 2 for high-frequency production operations.

---

## What NOT to Build (Scope Guard)

**Do NOT build for the residency:**
- General-purpose verification for arbitrary task types
- Multi-task type handling
- ZK proofs for sensitive outputs
- Hooks integration
- XLS-80 permissioned domains

All of the above are post-residency. **Ship the one flow, perfectly.**

---

## Market Context

- AI agents market: **$7.84B (2025) → $52.62B (2030)** at 46.3% CAGR
- Agentic AI dev SDK/infrastructure: **$2.40B (2025) → $16B (2030)**
- Agentic commerce (Bain estimate): **$300–500B by 2030** (15–25% of all e-commerce)
- Only 10% of enterprises successfully deploy generative AI agents in production — inadequate output verification is the leading cause of failure
- 88% of executives plan to increase AI budgets specifically for agentic AI
- 45% of Fortune 500 companies are actively piloting agentic systems in 2025

### Key XRPL Momentum (2026)
- Ripple + t54.ai $5M seed (Feb 2026): validates agent commerce + identity infrastructure thesis
- XRPL agent commerce launch (March 2026): x402 payments, escrowed jobs, evaluator verification
- XLS-80 permissioned domains (Feb 2026 mainnet): institutional compliance primitive live
- RLUSD stablecoin: predictable pricing for agent micropayments

### Competitive Positioning
No one has built output-hash-based trustless settlement on XRPL. Nevermined (closest competitor) is chain-agnostic with no verification layer. ERC-8004 + x402 is the Ethereum equivalent — being built there but **not on XRPL**. Verix is that primitive for the XRPL ecosystem.

---

## Post-Residency Startup Path

### Phase 1 — Residency (now)
Demo. One use case (freelance agent task settlement). Working XRPL integration.

### Phase 2 — Months 1–3
npm/pip SDK. Dead simple API: `verix.verify(output, schema)` → returns proof + releases escrow. First 10 developer users.

### Phase 3 — Months 4–12
- Agent marketplace integrations
- Reputation scoring as a service
- XRPL grants application ($10k–$50k range)
- Potentially: ZK proofs for sensitive outputs, XLS-80 permissioned domains for institutional use

### Revenue Model
- $49/month per agent deployment
- 1,000 developers = ~$588k ARR
- Infrastructure pricing (not per-transaction) to protect margins from micropayment economics

### Moat
- XRPL-native, deep crypto condition integration
- On-chain reputation that compounds over time — the longer an agent uses Verix, the more valuable its reputation score becomes
- Switching cost grows with usage

---

## Key Design Decisions & Mentor Q&A

### Who is the verifier?
The cryptographic hash itself, enforced by the XRPL ledger. The buyer agent commits to an expected output hash at escrow creation. The worker agent's output either matches that hash or it doesn't. No trusted third party. The condition is the verifier.

### What about enterprises that don't have agent workflows yet?
This is infrastructure, not enterprise SaaS. Like how Stripe didn't need companies to have online stores before building payment rails — it built the rails that made online stores viable. Verix builds the trust layer that makes agent commerce viable. The developer who builds the first serious XRPL agent marketplace will use Verix. That developer is the customer.

### What about x402 / MPP integration?
Phase 2. Demo uses RLUSD native escrow for simplicity and maximum XRPL primitive usage (30% of rubric). x402 via Maxime's MPP SDK is the natural extension for high-frequency production.

---

## Research Backing

- **Production deployment study (arxiv:2512.12791, 2025):** "deviations from expected policies or validation flows remained undetected by existing assessment methods as they surfaced only during runtime execution rather than in static validation phases."
- **KDD 2025 LLM agent evaluation survey:** "missing enterprise requirements including multistep granular evaluation and focus on safety and compliance" is the primary gap preventing production deployment.
- **x402 vs AP2 comparative study (Oct 2025):** "x402 does not natively answer whether the agent should have made that payment" — confirms the gap Verix fills.
- Chainstack (Nov 2025): "Payment infrastructure was built for humans clicking checkout buttons. That model breaks when AI agents start transacting autonomously."
