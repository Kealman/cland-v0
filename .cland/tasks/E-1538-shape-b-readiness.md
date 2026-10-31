---
id: E-1538
kind: epic
title: Shape-B readiness
state: open
labels:
  - epic
  - v0.4
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by:
  - E-1531
topic: null
branch: null
created: 2026-10-31T18:22:04.760Z
updated: 2026-10-31T18:22:56.399Z
---

## Goal

0.4.0 carries the hub changes that shape B, the hub in a Kubernetes cluster, will need and that shape A must not contradict. That way the 0.4.x cluster work adds a chart, an image and a provider, not a rework of the hub. The hub lock learns a host identity and a heartbeat, so that two containers on one volume can never both hold it. Every path the hub keeps under `HOME` can live on one volume. The web's session cookie is `Secure` whenever the configured origin is `https`. The transport layer has a declared kind with `ssh` as its only value and a contract test that a second carrier can pass. The executor stops counting a DELETE 404 as proof of deletion. Nothing changes for the human on the Mac. The Kubernetes research found each of these hazards (Q-1516), and the shape-B grilling put them in 0.4.0 (Q-1521 §7).

## Contents

- **The hub lock with a host identity and a heartbeat** (spec §3.10). `.cland/hub.lock` records the hostname and the boot id beside the pid and its start time, and the holder refreshes a heartbeat; a lock written by another host identity is never broken while its heartbeat is fresh; a stale foreign lock is broken only after its heartbeat has lapsed, through the existing break guard. Records without the new fields keep today's rules. Demo: a lock written with another hostname and a fresh heartbeat refuses a second hub even though its pid is not alive locally; the same lock with a lapsed heartbeat is taken over.
- **PVC-safe HOME and paths** (§3.10). Everything the hub keeps under `HOME`, the spend ledger first, resolves through `XDG_STATE_HOME` or `HOME`, with no macOS-only path in the serving path; `procps` stays a declared dependency for the lock. Demo: a hub started with `HOME` and `XDG_STATE_HOME` on one temporary directory writes its ledger and state only there, and a Linux droplet run of the hub's suite is green.
- **Secure cookies under an https origin** (§3.10). The web edge marks the session cookie `Secure` whenever `[web] origin` is `https` and the request's Host matches it, also on a top-level GET without an `Origin` header. Demo: with an `https` origin, the `/auth` response to a GET without `Origin` sets `Secure`; with no origin it does not.
- **The transport layer with `ssh` only** (§3.10). Providers and pools declare a transport kind; `ssh` is the only accepted value, and `outbound` is refused with a message naming 0.4.x. A transport contract test, run against the `ssh` carrier and the fake transport, names the four host-side sockets (`hub.sock`, `spoke.sock`, `git.sock`, `agent.sock`) as the contract. Demo: `transport = "outbound"` in a pool is refused at reload with that message; the contract test passes on both carriers.
- **The executor's DELETE 404 fix** (§3.4, §3.10). The droplet executor's provider wrapper no longer counts a DELETE 404 as success: it confirms with a GET, and reaping retries until the GET answers 404. Demo: against the fake DigitalOcean API, a DELETE 404 with a live GET leaves the lease open and the next reap deletes it.

Not in this epic: the Helm chart, the image, the `kubernetes` provider, the `outbound` transport, `cland attach-cluster` and the cluster docs (0.4.x, spec §3.11); `cland web` printing the Ingress host (0.4.x).

## Order

1. **The hub lock.** Demo: the foreign fresh lock refuses, the lapsed one is taken over.
2. **The executor's DELETE 404 fix.** Demo: the lease stays open until a GET confirms.
3. **PVC-safe paths.** Demo: one temporary directory holds every state file.
4. **Secure cookies.** Demo: the GET without `Origin` under an `https` origin.
5. **The transport kind and its contract test.** Starts once "The SSH transport, the host agent and git through the tunnel" has its carrier; the declaration and the refusal may land earlier. Demo: `outbound` refused; the contract test on both carriers.

## Definition of done

QA runs the demo below on `dev` through the `cland` CLI, the hub's frame protocol and headless Chromium, with the fake DigitalOcean API and the fake transport in the suite, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. No cluster and no real droplet is involved.

In a scratch project QA writes a hub lock with another hostname and a fresh heartbeat and reads a hub start refused, then lets the heartbeat lapse and reads the start succeed. It starts a hub with `HOME` and `XDG_STATE_HOME` on one temporary directory and lists every file the hub and a fake-provider host wrote outside the project. It sets an `https` `[web] origin`, opens a minted link in headless Chromium with a plain navigation and reads the cookie's `Secure` flag. It sets `transport = "outbound"` on a pool and reads the refusal, and reads the transport contract test's report for both carriers. Against the fake DigitalOcean API it makes a droplet DELETE answer 404 while a GET answers 200, and reads the lease kept and the next reap's deletion.

- [ ] C1. The hub lock records a host identity and a heartbeat, and a lock written by another host identity is never broken while its heartbeat is fresh.
- [ ] C2. Every file the hub keeps outside the project resolves under `XDG_STATE_HOME` or `HOME`.
- [ ] C3. The session cookie is `Secure` whenever `[web] origin` is `https` and the Host matches, also on a navigation without an `Origin` header.
- [ ] C4. Pools and providers declare a transport kind, only `ssh` is accepted, and the transport contract test passes on the `ssh` carrier and the fake transport.
- [ ] C5. The executor confirms a droplet or key deletion with a GET and never counts a DELETE 404 as success.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub. Commit on the task branch, push to `origin`, reach `dev` only through `cland merge`; only `cland release` pushes to GitHub. Suites run through `cland verify`. Items through `cland task` only.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig. No new runtime dependency.
- **The lock is critical.** Two hubs on one `hub.db` corrupt a project. The change keeps every existing guarantee (whole-file creation, the break guard, pid reuse detection) and adds the host identity; a test covers each old record shape. A hub restart on the Mac must behave exactly as before.
- **The ledger.** `spend.json` is shared by every project hub of the user; moving its resolution never loses an entry, and the legacy path keeps being reconciled as today. Never delete `~/.cland` or the state directory.
- **The web edge.** Host and exact Origin checks stay as ADR 0003's amendments of 2026-10-20 and 2026-10-21 describe; only the `Secure` condition widens. Forwarded headers are never trusted.
- **ADRs.** 0003 (the web edge's admission); v0.1.2 §3.14 (the provider-agnostic interface).
- **Plan.** The Coordinator drafts the plan with `plan-epic` and approves it itself (spec §4).
- **Order.** After "The Host interface and the local host", in parallel with the hub lane; its transport stage waits for the carrier of "The SSH transport, the host agent and git through the tunnel".

## References

- Spec: `docs/spec/v0.4.md` §3.10 (shape-B readiness), §3.11 (shape B in 0.4.x, for context), §3.4 (deletion confirmed by a GET) and §4.
- Items: R-1530; the map M-1511, round 1 decision 11 and its amendment; Q-1516 (rules 3, 8 and the "What breaks" list); Q-1521 §2 and §7; Q-1517 (decision 19).
- Research: `docs/research/kubernetes-shape.md` on `research/kubernetes-shape` (b7f82197): "What breaks in cland's assumptions" and "Hub changes for shape B".
- Code: `hub/src/hub/lock.ts`, `hub/src/project.ts`, `hub/src/executor/droplet/spend.ts`, `api.ts`, `droplet.ts`, `cleanup.ts`, `hub/src/hub/web-edge.ts`, `web-auth.ts`, `hub/src/web-address.ts`; `docs/adr/0003-*.md`.
- GLOSSARY: Hub, Executor, Lease, Tunnel.
