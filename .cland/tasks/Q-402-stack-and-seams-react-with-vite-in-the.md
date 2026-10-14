---
id: Q-402
kind: question
title: "Stack and seams: React with Vite in the workspace, serving from the hub, Playwright against the hub with fake harnesses"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-399
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:49.697Z
updated: 2026-10-14T14:04:14.356Z
closed: 2026-10-14T14:04:14.356Z
---

## Question

The stack and the test seams of the web client (spec v0.2 §3.7): React with Vite in a web/ workspace of this npm monorepo on Node 24, TypeScript strict, no UI library, CSS on the canvas tokens; the WebSocket library for the hub (ws or Node's own) and its cost in the hub's process; serving web/dist from the hub with a one-time token link and a cookie; Playwright headless Chromium against the real hub with fake harnesses as the second test seam after the frame protocol: how long a web phase takes, how it shards (T-267 context: the suite's spend), what fixtures it needs; a minimal PWA manifest and what browser notifications need; what Codex and Claude Code agents write most reliably in this stack. Deliver docs/research/web-stack.md on research/web-stack with a measured probe (a hello page served from a scratch hub, one Playwright test, its wall time) and the resolution comment here.

## Comments

### human · 2026-10-14T14:04:09.620Z

## Resolution

The note is `docs/research/web-stack.md` on `research/web-stack` at ec5bd4c. The throwaway probe is in `docs/research/web-stack/probe/` on the same branch and is never merged. Measured on the M4 under the crew's load: the headline numbers are at a 1-minute load of 14–15, with others at 22–41 as noted.

### The stack

- **The workspace.**
  - A `web/` npm workspace with React 19.3, Vite 8.3 (Rolldown) and `@vitejs/plugin-react` 6.1.
  - TypeScript strict with the hub's flags.
  - CSS Modules on custom properties from the canvas tokens, no UI library.
  - `vite build` into `web/dist`: 0.12–0.48 s; the bundle is 223 kB of JS, 70 kB gzipped.
- **The weight:** 22 packages and about 39 MB beyond the TypeScript the hub already has.
- **Lint, if wanted:** oxlint with the React hooks rules (2 packages, 14 MB, 0.2 s), not ESLint (138 packages, 74 MB).
- **A prerequisite for Q-407.** The wire types must become a leaf module.
  - **Today:** importing `hub/src/protocol.ts` from the browser pulls 82 hub sources and `@types/node` into the web typecheck.
  - **Cost:** 4.3–5.8 s instead of 0.9–1.3 s.
  - **The leak:** Node globals reach browser code; `process` and `Buffer` typecheck, and `setTimeout` returns `Timeout`.
- **What the agents write.**
  - **Vendor steering:** both vendors steer their models to React with TypeScript (the OpenAI GPT-5 guide; Anthropic's `web-artifacts-builder` skill).
  - **Their styling defaults are Tailwind and shadcn/ui,** so "tokens only" needs an `AGENTS.md` rule and a hex-colour check.
  - **Strict types catch most model errors:** on average 94% of LLM compile errors are type-check failures (Mündler et al., PLDI 2025).

### The WebSocket entry

- **The library:** `ws`, already a hub dependency at 8.21.3. Node 24 ships a WebSocket client only.
- **The listener:** a separate web listener in the hub process for static `web/dist`, `/auth` and `/ws`.
- **Its cost, measured inside the real daemon:**
  - RSS unchanged at 136 MB;
  - about 16 KB of heap and one file descriptor per subscribed client;
  - a `topic.send` to 51 subscribed web clients in 11 ms.
- **Authentication.** `cland web` gets a one-time token over the Unix socket: 60 s, SHA-256 at rest, spent on first use. `/auth` trades it for a `cland_<port>` cookie (HttpOnly, SameSite=Strict, Secure behind HTTPS). The browser never sees the hub's secret.
- **The upgrade checks:** a Host allow-list (DNS rebinding), Origin equal to the request's own origin (SameSite ignores ports), the cookie, and a client hello only (a spoke hello is refused).
- **Serving:** the shell is served `no-cache` with an ETag, hashed assets `immutable`, with a strict CSP and `frame-ancestors 'none'`. Every one of these is probe-tested.
- **The port must be stable.** The origin carries storage, the notification permission, the PWA and the cookie.
- **`[web] bind`** beyond loopback needs an ADR 0003 amendment.

### The probe's numbers

- **Seam 1, frames without a browser:** 3 tests in 0.88 s median wall.
- **Seam 2, one Playwright test** (open the page through a one-time link, read frame-driven elements, close): **2.75 s median wall (2.23–3.03 s); the test itself 0.2 s.**
- **With a fake Claude Code session** launched, shown idle, and answering the browser's composer: both tests take 4.09 s under Playwright Test and 3.07 s under node:test with `playwright-core`.
- **Scaling:** about 2.6 s fixed per run, then 0.11–0.23 s per extra frame-driven test; 1.7–3.7 s per test that drives a fake harness.
- **The browser download:** Chrome Headless Shell 156 is 99 MiB, 211 MB on disk, 13.0 s. The full Chromium 156 (new headless) is 185.8 MiB, about 378 MB, 16–21 s.
- **Processes:**
  - the browser adds 4 (browser, GPU, network service, renderer) and about 300 MB RSS;
  - a minimal run peaks at 15 processes; with the fake session, 19 and about 1.5 GB RSS, the hook processes included;
  - Node-side spawns per run: 23 for the frame seam, 26 for the minimal browser test, 45–48 with the fake session; 17 `lsof` and 4 `ps` of these are the hub's own start and stop.
- **The web phase.**
  - **Shape:** its own `machine` shard after the hub phase, 2 workers locally, a scratch hub and a browser per file, a fresh context per test.
  - **Cost for about 30 tests:** about 15–40 s on a full run (+2–4%), about 300 extra spawns (under 1%). It runs only for `web/**` or protocol diffs, through a `web-only` selection mode.
  - **Runner, recommended:** node:test with `playwright-core`, as the Neovim phase works. It reuses `startDaemon`, `connectUi`, `fakeClaude` and the cleanup, and costs 1 s less per invocation.
  - **Runner, alternative:** Playwright Test brings web-first assertions, traces and `init-agents` for Claude Code, Codex and OpenCode.
  - **Fixtures it needs:**
    - `web/dist` built once in the verification pre-step;
    - a link minted by a frame;
    - a stub for `Notification`, since the headless shell never grants it;
    - traces saved on failure;
    - short `TMPDIR` paths;
    - browsers closed explicitly, because Chromium leads its own process group.

### PWA and notifications

- **Installable on loopback with no service worker.** The minimum is a manifest (name, `start_url`, `display: standalone`, 192 and 512 px icons plus a maskable one) and `<link rel=manifest>`. Chromium 156 reports only the automation's `in-incognito`. Cost XS.
- **A phone over plain-HTTP LAN** gets a working page but no secure context: `not-from-secure-origin`, no service worker, and notification permission `denied`. It needs HTTPS through the human's tunnel; Tailscale Serve keeps the hub on loopback.
- **Notifications by case:**
  - **Desktop, page open:** `new Notification` after a permission asked on a gesture. Cost S.
  - **Android, page open:** only through a service worker's `showNotification`, so HTTPS and a 13-line `sw.js`. Cost S after the tunnel.
  - **iOS 16.4+:** only as a Home Screen app.
  - **Closed page:** Web Push through vendor push services, a policy question and not 0.2.0.

### Risks and open questions

- **For Q-407:**
  - the leaf wire module;
  - the edge's stable port and bind;
  - which human frames a browser may send, since an XSS would act as the human;
  - a `web.link` frame, and sessions stored in `hub.db` and revocable;
  - tunnel origins;
  - backpressure through `bufferedAmount`, with catch-up from sequence numbers;
  - version skew between the hub and the bundle;
  - a separate binary path for the later terminal.
- **For Q-409:**
  - which runner;
  - where `web/dist` comes from for a git-installed cland (proposed: `prepare`, the verification pre-step and a doctor row);
  - lint;
  - keeping agents on the tokens;
  - the phone's HTTPS route;
  - the notification scope;
  - the droplet snapshot (headless shell, `install-deps` for 21 Chromium libraries plus 12 tool and font packages);
  - whether Codex's sandbox can run Chromium (untested);
  - the Vite dev-server origin;
  - a time budget for the web phase;
  - **a side finding:** TypeScript 7 typechecks the hub in 1.6 s against 18–26 s, worth its own ticket.

### human · 2026-10-14T14:04:14.356Z

Resolved: see the resolution comment; docs/research/web-stack.md on research/web-stack
