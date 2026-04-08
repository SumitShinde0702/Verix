# Verix

Trustless task settlement for AI agents on the **XRP Ledger (XRPL)**. Verix wires buyer and worker agents to **native XRPL escrow**, **crypto-conditions**, **JSON Schema validation**, and **signed outputs**, then anchors **audit and reputation** data on-chain via memos—so payment releases only when the agreed checks pass.

There is no native [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)–style agent registry on XRPL; Verix implements an analogous flow using XRPL primitives (`did:xrpl` identities, escrow, on-ledger memos).

## What it does

- **Identity**: Agents get `did:xrpl:1:<address>` DIDs registered on XRPL testnet.
- **Settlement**: Buyer locks test XRP in escrow; funds release via `EscrowFinish` only when verification succeeds (schema + signature + hash pipeline).
- **Reputation**: Score updates and credentials can be anchored and queried (see API and in-app docs).
- **Demo UI**: Live SSE demo of the full path, with optional “bad worker” modes to show protected funds vs. successful settlement.

## Repository layout

| Path | Role |
|------|------|
| `backend/` | Express + TypeScript server, XRPL (`xrpl` JS), verification and escrow orchestration |
| `frontend/` | React + Vite + Tailwind demo and marketing pages |
| `sdk/verix-sdk/` | Optional npm client for streaming the demo and calling HTTP APIs |
| `.env` | Configuration (expected at **repo root**; backend loads it from there) |

## Prerequisites

- **Node.js** 18+ and npm
- **XRPL testnet XRP** for the wallets Verix uses (fund via [XRPL Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html) if you create fresh agents)
- **DeepSeek API key** for the AI agent path that chooses assets and builds task output ([DeepSeek Platform](https://platform.deepseek.com/))

## Quick start

1. **Clone and install**

   ```bash
   git clone <your-repo-url> verix
   cd verix
   npm run install:all
   ```

2. **Environment**

   Copy the example file and fill in secrets:

   ```bash
   copy .env.example .env
   ```

   On macOS/Linux use `cp .env.example .env`.

3. **Run backend + frontend together**

   ```bash
   npm run dev
   ```

   - API: `http://localhost:3001` (see [Health](#health))
   - UI: `http://localhost:5173` (Vite proxies `/api` and `/health` to the backend)

## Environment variables

Defined in `.env` at the **repository root** (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `XRPL_NODE` | WebSocket endpoint (default: public XRPL testnet) |
| `PORT` | Backend port (default `3001`) |
| `FRONTEND_URL` | CORS allowed origin(s) for the UI; comma-separated for multiple (default `http://localhost:5173`) |
| `COINGECKO_API` | Base URL for market data (default CoinGecko v3) |
| `DEEPSEEK_API_KEY` | Required for AI-driven demo steps |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install `backend` and `frontend` dependencies |
| `npm run dev` | Run backend (nodemon + `ts-node`) and frontend (Vite) concurrently |
| `npm run build` | `tsc` in backend, production build in frontend |

Backend only: `npm run dev`, `npm run build`, `npm start` inside `backend/`.  
Frontend only: `npm run dev`, `npm run build`, `npm run preview` inside `frontend/`.

## Frontend routes

| URL | Page |
|-----|------|
| `/` | Landing |
| `/demo` | Interactive demo (SSE stream to `/api/demo/run`) |
| `/docs` | API playground and documentation |

## API overview

Base URL: `http://localhost:3001` (or your deployed host).

- `GET /health` — Liveness and XRPL connection status  
- `POST /api/create-agent` — Create buyer or worker agent (`name`, `type`: `buyer` \| `worker`)  
- `GET /api/resolve-did/:address` — Resolve on-ledger DID document  
- `GET /api/reputation/:address` — Reputation for an address  
- `GET /api/reputation-history?did=...` or `?address=...` — History + current score  
- `GET /api/assets` — Supported price-feed symbols  
- `POST /api/verify-and-settle` — Verify output against schema and settle escrow  
- `GET /api/demo/run` — **Server-Sent Events**: full demo stream (query params: `query`, `failAt`: `none` \| `schema` \| `signature`)  

For request/response shapes and curl examples, use the in-app **Docs** page at `/docs`.

## SDK

The package under `sdk/verix-sdk/` wraps the HTTP and SSE APIs for Node or browser clients. See [`sdk/verix-sdk/README.md`](sdk/verix-sdk/README.md).

## Development notes

- **CORS** uses `FRONTEND_URL` (one origin or a comma-separated list). Include every UI origin (for example `https://your-app.vercel.app` and `http://localhost:5173` while developing against a hosted API).
- **Demo state** for persisted agent keys lives under `backend/data/` (e.g. `demo-state.json`); treat as local secrets on testnet.
- **Production**: Vercel (and similar) only host the **static** frontend. The **Express backend** must run somewhere else (Railway, Render, Fly.io, a VPS, etc.). In the **Vercel** project, set build env `VITE_API_BASE_URL` to that API origin with **no** trailing slash (for example `https://verix-api.example.com`). On the **backend**, set the same secrets as locally plus `FRONTEND_URL` including your live site origin. Then run `npm run build` and start `node backend/dist/server.js` (or your host’s start command) with `PORT` provided by the host.

---

Built for the Ripple ecosystem — trustless agent settlement without custodial middleware.
