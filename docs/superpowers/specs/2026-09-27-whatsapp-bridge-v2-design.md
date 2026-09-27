# WhatsApp Personal Bridge v2 — Design

Date: 2026-09-27
Branch: `codex/whatsapp-bridge-v2`

## Goal

Rebuild the existing Cloudflare Worker bridge so that it stays reachable from apps, exposes clear public health information, keeps all send/control operations protected, and persists authorization plus queued messages across requests and Worker restarts.

## Current defects

1. The current Worker stores `authorized`, `executor`, and `queue` only in JavaScript memory inside `createBridge()`. A new bridge instance is created for every request, so state can disappear immediately.
2. Protected endpoints return `401 Unauthorized` when opened directly in a browser without an Authorization header, which makes a healthy Worker look broken.
3. There is no dedicated public `/health` endpoint.
4. Cross-origin application access is incomplete because CORS/OPTIONS behavior is not explicitly handled.
5. The current queue does not provide durable persistence, claim/ack semantics, or an explicit executor heartbeat.

## Architecture

### 1. Edge Worker API

Keep one Cloudflare Worker as the public API entry point.

Public endpoints:
- `GET /` — human-readable service landing response.
- `GET /health` — JSON health response with service name, version, and availability only. No secrets and no protected state.
- `OPTIONS *` — CORS preflight.

Protected endpoints, all requiring `Authorization: Bearer <BRIDGE_TOKEN>`:
- `POST /authorize` — enable sending.
- `POST /stop` — disable sending and optionally clear queued work.
- `GET /status` — return authorization state, executor state, heartbeat age, and queue metrics.
- `POST /send` — validate recipient/message and enqueue a durable message.
- `GET /queue` — compatibility/debug view of pending messages.
- `POST /executor/heartbeat` — executor reports that it is online.
- `POST /queue/claim` — executor atomically claims pending messages.
- `POST /queue/ack` — executor marks a claimed message delivered or failed.

### 2. Durable Object state store

Use a single named Durable Object instance (`whatsapp-bridge-state`) as the coordinator for this personal bridge.

Persist important state in Durable Object storage, not class properties:
- authorization state
- queued messages
- message status: pending / claimed / delivered / failed
- timestamps and retry metadata
- latest executor heartbeat

A Durable Object is chosen because this bridge needs serialized coordination plus strongly consistent persistent state. Cloudflare documentation explicitly warns that in-memory Durable Object state can be lost on eviction or restart, so all important state will be written to persistent storage.

### 3. Authentication

`BRIDGE_TOKEN` remains a Cloudflare secret and is never committed to GitHub.

Authentication behavior:
- Missing Authorization header -> `401` JSON with error code `AUTH_REQUIRED`.
- Wrong token -> `401` JSON with error code `AUTH_INVALID`.
- Correct token but sending disabled -> `403` JSON with error code `SENDING_NOT_AUTHORIZED`.
- Public `/` and `/health` never require a token.

No token is accepted through a query string.

### 4. CORS

Handle preflight requests explicitly.

Default design:
- allow `Authorization` and `Content-Type` headers
- allow `GET`, `POST`, `OPTIONS`
- expose no secrets in responses
- configurable origin allowlist through an environment variable such as `ALLOWED_ORIGINS`
- do not use permissive `*` together with credentials

For initial compatibility, requests without an `Origin` header (server-to-server/plugin calls) are allowed.

### 5. Message lifecycle

1. A trusted client calls `/authorize` once.
2. A trusted client calls `/send` with `to` and `message`.
3. The Durable Object stores the message as `pending` and returns `202 Accepted` with a message id.
4. The executor sends heartbeat requests so `/status` can distinguish online/offline.
5. The executor calls `/queue/claim` to atomically claim work.
6. After WhatsApp delivery attempt, the executor calls `/queue/ack` with `delivered` or `failed`.
7. `/status` exposes counts without leaking message content unless a protected diagnostic endpoint explicitly requests it.

## WhatsApp execution boundary

The Cloudflare Worker is the API and durable coordinator. It cannot by itself click a logged-in WhatsApp Web browser. Actual delivery still requires one of:

- a persistent executor running Playwright/browser automation on a machine or server with an authorized WhatsApp Web session, or
- the official WhatsApp Cloud API.

The v2 bridge will make that executor integration reliable by adding heartbeat plus claim/ack semantics.

## Files to change

- `src/bridge.mjs` — Worker routing, auth, CORS, Durable Object proxying.
- `src/bridge-state.mjs` or equivalent exported Durable Object class — persistent bridge state and queue logic.
- `wrangler.toml` — Durable Object binding and migration; no real token values.
- `test/bridge.test.mjs` — update existing API tests.
- new state/queue tests — persistence, claim/ack, heartbeat, auth errors, CORS.
- `README.md` — complete setup, secret, deployment, endpoint and executor instructions.

## Compatibility

Keep the existing core endpoint names `/authorize`, `/stop`, `/status`, `/send`, and `/queue` so existing callers need minimal changes. New executor-specific endpoints are additive.

Phone normalization keeps support for Egyptian local `01...` numbers and international E.164-like inputs already accepted by the project.

## Tests and acceptance criteria

The implementation is acceptable only when all of the following are verified:

1. `GET /` returns 200 without a token.
2. `GET /health` returns 200 without a token.
3. Protected endpoints reject missing and incorrect tokens.
4. CORS preflight returns the correct allowed methods/headers.
5. Authorization persists across separate Worker requests.
6. Queued messages persist across separate requests/state object reloads.
7. `/send` cannot queue while authorization is disabled.
8. Claiming work is atomic and does not return the same pending message twice concurrently.
9. Ack transitions a claimed message to delivered/failed.
10. `/stop` immediately disables future sends and clears pending/claimed work according to the documented behavior.
11. Executor heartbeat changes `/status` from offline to online and ages back to offline after the configured timeout.
12. Existing phone-number normalization behavior remains covered by tests.
13. `BRIDGE_TOKEN` is absent from committed files.
14. Deployment is smoke-tested against the actual Worker URL after publish.

## Deployment sequence

1. Implement and run unit tests on `codex/whatsapp-bridge-v2`.
2. Review diff and secret leakage.
3. Deploy a preview/new Worker version first when available.
4. Set or confirm `BRIDGE_TOKEN` as a Cloudflare secret.
5. Smoke-test `/`, `/health`, protected auth behavior, authorize, send, queue/claim/ack, stop.
6. Only after successful verification, promote the new Worker deployment.

## Non-goals

- Do not commit WhatsApp credentials, cookies, QR session data, or Cloudflare API tokens.
- Do not make `/send` public.
- Do not silently bypass explicit send authorization.
- Do not claim the Cloudflare Worker alone performs WhatsApp Web delivery.
