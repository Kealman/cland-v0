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
topic: topic-1346
branch: null
created: 2026-10-31T18:22:04.760Z
updated: 2026-11-03T11:13:08.150Z
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

## Plan

```yaml
stages:
  - name: lock, deletion and paths
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1615
        - T-1616
        - T-1617
      - - T-1618
        - T-1619
        - T-1620
      - - T-1621
        - T-1622
        - T-1623
  - name: secure cookie and the transport contract
    qa:
      scope: full
      when: after-stage
    lanes:
      - - T-1624
      - - T-1625
```

## Comments

### qa-678 · 2026-11-03T00:08:45.737Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-life1-2026-11-03-qa678-1
commit: 986afe46b587899bcf9ebb3f51781d3491a904ca
stage: lock, deletion and paths
stage_hash: 4373b89084a495b6bc2259b6f72fc7374fc6b35010563b0bd80d1bc0d63283ec
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| S0 | hub-api · local macOS | PASS | [S0-env.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/S0-env.txt), [S0-helpers.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/S0-helpers.txt), [S0-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/S0-build.txt) |
| E1538S1-00 | hub-api · local macOS | PASS | [E1538S1-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-00.txt), [E1538S1-00-plan.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-00-plan.json) |
| E1538S1-01 | hub-api · local macOS | PASS — brief correction (declaration count), coord-authorised | [E1538S1-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-01.txt), [E1538S1-01-transport-matches.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-01-transport-matches.txt), [E1538S1-01-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-01-correction.txt), [readers-source.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/readers-source.txt) |
| E1538S1-02 | hub-api · local macOS | PASS | [E1538S1-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-02.txt), [E1538S1-02-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-02-init.txt) |
| E1538S1-03 | hub-api · local macOS | PASS | [E1538S1-03.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-03.txt), [timing-diagnostic.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/timing-diagnostic.txt), [timing-queue.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/timing-queue.json) |
| E1538S1-04 | hub-api · local macOS | PASS | [E1538S1-04.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-04.txt) |
| E1538S1-05 | hub-api · local macOS | PASS — brief correction (decoy lifetime), coord-authorised | [E1538S1-05-original.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-05-original.txt), [E1538S1-05-fixture-note.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-05-fixture-note.txt), [E1538S1-05-original-hublog.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-05-original-hublog.txt), [E1538S1-05-rerun.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-05-rerun.txt), [E1538S1-05-correction.sh](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-05-correction.sh) |
| E1538S1-06 | hub-api · local macOS | PASS — brief correction (assertion scope), coord-authorised | [E1538S1-06.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-06.txt), [E1538S1-06-ps-calls.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-06-ps-calls.txt), [E1538S1-06-trace.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-06-trace.json), [E1538S1-06-source-trace.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-06-source-trace.txt) |
| E1538S1-07 | hub-api · local macOS | PASS | [E1538S1-07.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-07.txt) |
| E1538S1-08 | hub-api · local macOS | PASS — brief correction (assertion scope), coord-authorised | [E1538S1-08.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-08.txt), [E1538S1-08-ps-calls.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-08-ps-calls.txt), [E1538S1-08-trace.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-08-trace.json) |
| E1538S1-09 | hub-api · local macOS | PASS | [E1538S1-09.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-09.txt) |
| E1538S1-10 | hub-api · local macOS | PASS | [E1538S1-10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-10.txt) |
| E1538S1-11 | hub-api · local macOS | PASS | [E1538S1-11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-11.txt), [E1538S1-11-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-11-init.txt) |
| E1538S1-12 | hub-api · local macOS | PASS | [E1538S1-12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-12.txt) |
| E1538S1-13 | hub-api · local macOS | PASS | [E1538S1-13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-13.txt), [E1538S1-13-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-13-init.txt) |
| E1538S1-14 | hub-api · local macOS | PASS | [E1538S1-14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-14.txt) |
| E1538S1-15 | hub-api · local macOS | PASS | [E1538S1-15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-15.txt) |
| E1538S1-16 | hub-api · local macOS | PASS | [E1538S1-16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-16.txt), [E1538S1-16b.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-16b.txt) |
| E1538S1-17 | hub-api · local macOS | PASS | [E1538S1-17.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-17.log), [required-tests.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/required-tests.json), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/generated-required.json) |
| E1538S1-18 | hub-api · local macOS | PASS | [E1538S1-18.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-18.log) |
| E1538S1-19 | hub-api · local macOS | PASS — brief correction (build precondition), coord-authorised | [E1538S1-19.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-19.log), [E1538S1-19-doctor-rerun.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-19-doctor-rerun.log), [E1538S1-19-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-19-build.txt), [E1538S1-19-build-stamp.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-19-build-stamp.json), [E1538S1-19-receipt-correction.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-19-receipt-correction.txt) |
| E1538S1-20 | hub-api · local macOS | PASS | [E1538S1-20.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-20.log), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/generated-required.json) |
| E1538S1-21 | hub-api · local macOS | PASS | [E1538S1-21.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-21.log) |
| E1538S1-22 | hub-api · local macOS | PASS | [E1538S1-22.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-22.log), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/generated-required.json) |
| E1538S1-23 | hub-api · local macOS | PASS | [E1538S1-23.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-23.log), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/generated-required.json) |

Clear: all 25 scoped case results pass (S0 and E1538S1-00–23). No product findings.

Stage: **lock, deletion and paths**. Build: `986afe46b587899bcf9ebb3f51781d3491a904ca`. Run: `qa-life1-2026-11-03-qa678-1`. Committed brief: `qa/briefs/E-1538-stage-1.md` at that SHA. Fresh detached worktree; dev matched before and after; all nine stage items have landings. No epic criterion marks.

Executed locally on macOS 27.0.1 (26A434), arm64, Node v24.21.0; no browser binary was launched. Local cost/lifetime is not applicable. 295 tests across 34 files passed in the final evaluated evidence, with no remaining failures, cancellations or skips. An additional original doctor-cli execution ran 9 tests (5 passed, 4 failed including the parent) before the authorised build-precondition correction; it is retained and excluded from the passing total. This was targeted execution: 6 T1 files, 18 T2 files and 10 T3 files, not complete tiers. T0, full suites, T4/soak, Web and real remote-host execution did not run in this QA pass. Queue admission and one-minute load <=10 were enforcing gates; captures retain the readings. The timing samples describe only the explicit local heartbeat/contender waits, excluding prep, admission and any remote time. No overall wall-time claim.

Required tests were checked by generated case names and recorded TAP facts, separately from exit codes. See [test-summary.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/test-summary.json), [generated-required.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/generated-required.json) (55 generated required names), [required-tests.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/required-tests.json) (literal names), and [test-tiers.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/test-tiers.json).

- E1538S1-17: 31 tests in 2 files.
- E1538S1-18: 66 tests in 5 files.
- E1538S1-19: 69 tests in 5 files.
- E1538S1-20: 21 tests in 5 files.
- E1538S1-21: 64 tests in 7 files.
- E1538S1-22: 8 tests in 3 files.
- E1538S1-23: 36 tests in 7 files.

The plan records the Coordinator-owned stage cover pair at tree `74864003f8cd0c5c19fd70dc3fa805437beb5478`: Linux droplet `7953ccfc-d51a-43c0-a578-a60d30cd77c5`, macOS local `f124d237-f63a-4905-a30d-bdb11e0031c3`, missing platforms `[]`. These are external cover evidence, not runs launched or timed by this QA session; remote lifetime/cost were not collected here. See [plan evidence](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-00-plan.json).

Five rows use Coordinator-authorised brief corrections, separately from product results: 01 declaration count; 05 detached decoy lifetime and one full rerun; 06 and 08 holder-specific PID assertion scope; 19 web build precondition and doctor-cli-only rerun. Original captures remain, and row05 original no-signal fact is not counted. Parent CLI attribution for the two process censuses is from source, not a recorded parent PID. See [correction details](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/brief-corrections.md), [original helpers](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/original-helpers.sh), [row05 corrected launcher](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-05-correction.sh), and [source trace](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-06-source-trace.txt). No product source was changed.

Recorder correction: there are 27 raw receipt lines for 25 effective cases. The row19 PASS receipt at 2026-11-03T00:03:57Z is INVALID (QA shell continued after validator failure). It is superseded by the explicit INCONCLUSIVE receipt at 2026-11-03T00:04:19Z and the final corrected PASS after the authorised rerun. Both historical lines are retained verbatim in [receipts.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/receipts.jsonl); only [effective-receipts.jsonl](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/effective-receipts.jsonl) is counted. See [receipt correction](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/E1538S1-19-receipt-correction.txt).

Fixture isolation, process cleanup and secret/file scans passed with positive controls. Only declared evidence is exported; no HOME, environment file, cookies, raw credentials, database or one-use link is included. Final build and publication scan evidence is in [final-checks.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/final-checks.txt).

Evidence artifact: A-16022, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16022-e-1538-lock-deletion-and-paths-qa-at-986afe46/report.md

### qa-678 · 2026-11-03T11:13:08.150Z

verdict: qa
result: clear
by: qa-678 [qa]
run: qa-s2-2026-11-03-qa678-1
commit: 3b391058e664d82f58be134c9ffa8012f3dcaad6
stage: secure cookie and the transport contract
stage_hash: a7d8eb61543effa95a4906859b4039105197f713ba4656311998ba7ce75abc43
findings: [{"severity":"low","text":"Found aside — XS Follow-ups: clarify T-1625 C2's 0700 wording as the agent-owned run directory permission. The contract asserts directory 0700 and socket nodes; the fixture sets stub sockets 0600. E1538S2-01/-10/-12 meet the explicit brief expectations. Coordinator is filing the wording clarification; no failed stage assertion.","file":"hub/test/transport-contract.ts","line":32}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Surface / executor | Result | Evidence |
| --- | --- | --- | --- |
| S0 | hub-api / local macOS | PASS | [S0-env.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/S0-env.txt), [S0-build.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/S0-build.txt) |
| E1538S2-00 | hub-api / local macOS | PASS | [E1538S2-00.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-00.txt) |
| E1538S2-01 | hub-api / local macOS | PASS | [E1538S2-01.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-01.txt) |
| E1538S2-02 | hub-api / local macOS | PASS | [E1538S2-02.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-02.txt) |
| E1538S2-03 | hub-api / local macOS | PASS | [E1538S2-03.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-03.txt), [E1538S2-03-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-03-init.txt) |
| E1538S2-04 | web-terminal / local macOS | PASS | [E1538S2-04.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-04.txt), [E1538S2-04.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-04.png), [served-build-stamp.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/served-build-stamp.txt) |
| E1538S2-05 | hub-api / local macOS | PASS | [E1538S2-05.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-05.txt) |
| E1538S2-06 | web-terminal / local macOS | PASS | [E1538S2-06.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-06.txt), [E1538S2-06.png](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-06.png) |
| E1538S2-07 | hub-api / local macOS | PASS | [E1538S2-07.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-07.txt) |
| E1538S2-08 | hub-api / local macOS | PASS | [E1538S2-08.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-08.txt) |
| E1538S2-09 | hub-api / local macOS | PASS | [E1538S2-09.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-09.log), [E1538S2-09.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-09.txt), [E1538S2-09-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-09-validation.json) |
| E1538S2-10 | hub-api / local macOS | PASS | [E1538S2-10.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-10.log), [E1538S2-10.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-10.txt), [E1538S2-10-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-10-validation.json) |
| E1538S2-11 | hub-api / local macOS | PASS — labelled brief correction | [E1538S2-11.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-11.log), [E1538S2-11.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-11.txt), [E1538S2-11-helper-original.tap](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-11-helper-original.tap), [E1538S2-11-helper-observation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-11-helper-observation.json) |
| E1538S2-12 | hub-api / local macOS | PASS | [E1538S2-12.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-12.log), [E1538S2-12.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-12.txt) |
| E1538S2-13 | hub-api / local macOS | PASS — labelled brief correction | [E1538S2-13.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-13.txt), [E1538S2-13-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-13-init.txt), [corrections.md](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/corrections.md) |
| E1538S2-14 | hub-api / local macOS | PASS | [E1538S2-14.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-14.txt), [E1538S2-14-init.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-14-init.txt) |
| E1538S2-15 | hub-api / local macOS | PASS | [E1538S2-15.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-15.log), [E1538S2-15.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-15.txt), [E1538S2-15-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-15-validation.json) |
| E1538S2-16 | hub-api / local macOS | PASS | [E1538S2-16.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-16.log), [E1538S2-16.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-16.txt), [E1538S2-16-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-16-validation.json) |
| E1538S2-17 | hub-api / local macOS | PASS | [E1538S2-17.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-17.log), [E1538S2-17.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-17.txt), [E1538S2-17-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-17-validation.json) |
| E1538S2-18 | hub-api / local macOS | PASS | [E1538S2-18.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-18.log), [E1538S2-18.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-18.txt), [E1538S2-18-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-18-validation.json) |
| E1538S2-19 | hub-api / local macOS | PASS | [E1538S2-19.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-19.log), [E1538S2-19.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-19.txt), [E1538S2-19-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-19-validation.json) |
| E1538S2-20 | hub-api / local macOS | PASS | [E1538S2-20.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-20.log), [E1538S2-20.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-20.txt), [E1538S2-20-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-20-validation.json) |
| E1538S2-21 | hub-api / local macOS | PASS | [E1538S2-21.log](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-21.log), [E1538S2-21.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-21.txt), [E1538S2-21-validation.json](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-21-validation.json) |
| E1538S2-22 | hub-api / local macOS | PASS | [E1538S2-22.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-22.txt) |
| E1538S2-23 | hub-api / local macOS | PASS | [E1538S2-23.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-23.txt), [E1538S2-23b.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/E1538S2-23b.txt), [cleanup-identity.txt](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/cleanup-identity.txt) |

High / medium findings: none. Low, found aside (XS, Follow-ups): T-1625 C2 ambiguously attaches 0700 to the sockets. The contract asserts the agent-owned run directory at 0700 and the endpoint nodes as Unix sockets (hub/test/transport-contract.ts:32–37); its fixture sets stub nodes to 0600 (transport-contract-fixture.ts:80). E1538S2-01 source observation and E1538S2-10/-12 execution meet the explicit brief expectation. The Coordinator is filing the wording clarification; this is not a failed stage assertion.

Clear for **secure cookie and the transport contract**, E-1538, full tested SHA `3b391058e664d82f58be134c9ffa8012f3dcaad6`, run `qa-s2-2026-11-03-qa678-1`. All 25 scoped checks passed. This stage verdict carries no epic or item criterion marks. Both stage members had one dev landing, stage 1 was closed/current clear, and the requested SHA remained HEAD and dev. The Coordinator owns the stage cover pair; it was not rerun here.

Platform/executor: local macOS 27.0.1 arm64; Node v24.21.0; pinned Neovim v0.12.5. Isolated Chrome Headless Shell revision 1248, binary `node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell`, version 156.0.8078.4. [Runtime and source build stamp](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/runtime-build-stamp.txt); [served stamp comparison](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/served-build-stamp.txt) matched the built stamp. Web prerequisites ran in report-only mode; the bundle build passed separately. The two screenshots were visually inspected, both workbenches were Live and both browser group censuses ended at zero. No real browser, real tunnel certificate, real messenger, real provider or real SSH host was used. No remote executor or lease: lifetime and cost not applicable.

Cookie evidence: no-origin HTTP navigation stored a non-Secure cookie; configured HTTPS navigation through the run-made loopback TLS tunnel sent no Origin, used fetch mode navigate, received Secure, stored the Secure cookie and admitted the workbench WebSocket. Matching and uppercase Host values confer Secure; loopback and forwarded-only headers do not; disallowed and port-less hosts are refused. Invite and password cookies use the same helper. Authenticated WebSocket/upload/sign-in positive controls and exact-Origin refusals were evaluated separately from command exit codes. The tunnel certificate was accepted explicitly for this isolated test; real tunnel TLS is out of scope.

Transport evidence: both named entry files passed the shared four-endpoint byte/reconnect/no-TCP/kind contract, and each entry passed five isolated replays. Both use sshContractFixture with the production SshTransport and fake SSH peer; this does not claim a second production carrier exists. The unmodified external control passed; removing the drop failed with `replacement carrier and all four endpoints answer: not within 8000 ms`, planting a TCP listener failed with `hub stubs and host/carrier processes bind no TCP listeners`, and reporting outbound failed with `outbound transport requires 0.4.x`. These three expected failures prove the controls; they are not product failures. The native listener branch executed here is macOS lsof; Linux /proc is external cover evidence, not local execution.

Named-file result: 433 passing tests across 52 serial targeted file invocations (51 distinct files), with no failures, skips, cancellations or todos. Separately: 10 passing contract replay tests; two helper file wrappers (not contract test cases); four mutation-control tests (one baseline pass, three expected failures). Required literal and generated names were checked against source and recorded TAP, retained in [required names](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/required-test-names.json) and each row validation JSON. This was not a full suite, T4 soak or load-stress run. Each named file passed cover-quiet admission and the <=10 load gate. [CPU sample](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/cpu-idle-sample.txt) is diagnostic, not a performance result; no overall wall-time or speed claim is made.

Stage-1 regression: every named stage-1 test row 17–23 reran at the requested build. Live native heartbeat advanced across two samples 25 seconds apart; fresh foreign ownership refused start/stop without changing the records or signalling the local decoy, and lapsed ownership was replaced. Doctor passed with real ps and gave the specified procps guidance when ps was made to fail. ssh/default transport starts passed; outbound/tcp starts and outbound reload were refused, and the prior config digest stayed unchanged. The stage-1 source changes were exactly the four named commits in the brief (lock T-1654, daemon T-1597, CLI T-1595 and doctor T-1593). Unchanged provider/state-path behavior was exercised by the referenced files, not replayed as the earlier live manual journeys.

Two Coordinator-authorised brief corrections, with original captures retained: (1) E1538S2-11 helper-module count: exactly two top-level file wrappers, no nested subtests or contract case names (5b44c783); (2) E1538S2-13 synchronous serving-hub lock shape excludes optional startedUtc, per daemon.ts:96 and lock.ts:352–356 (19930a8d). [Correction details](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/corrections.md). No product source or test assertions were changed. [Controller disclosure](/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/controller-notes.txt) records a supplemental TAP-validator false positive on zero skipped/todo summary lines; the test capture was unchanged and no test rerun was needed.

Cleanup and publication: the fixture-owned PID census and scratch-path census in E1538S2-23 establish process cleanup; E1538S2-23b rechecks the root and frozen dev SHA. The secret scan passed its positive controls for cookie, hub-secret, invite, link and password with no evidence-file hit. The unchanged publication scanner also passed its positive control. The 97-PID fixture census and scratch-path census were empty after cleanup; the tunnel reported four connections. Exported evidence contains declared captures, screenshots and receipts, never scratch HOME, environment files, private keys, cookies or links. Exact private helpers remain outside the exported directory.

Out of scope: Linux native listener inspection locally; real droplets/providers/SSH/sshd; real HTTPS tunnel TLS; live LAN binds; passkey cookie navigation under configured origin (shared helper and passkey tests were checked); stage-1 long real-time contender/lost-lock/provider manual journeys (their named regression files ran); full suites, T4 soak and live project mutation.

Evidence artifact A-16255: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16255-e-1538-stage-2-secure-cookie-and-transport-qa-at-3b391058/report.md.
