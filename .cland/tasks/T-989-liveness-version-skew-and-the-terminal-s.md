---
id: T-989
kind: task
title: Liveness, version skew and the terminal's door
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
  - T-983
topic: topic-795
branch: t/T-989-liveness-version-skew-and-the-terminal-s
created: 2026-10-20T16:50:00.836Z
updated: 2026-10-21T11:11:07.677Z
closed: 2026-10-21T11:11:07.677Z
---

## Summary

The web edge pings its sockets and reports version skew. It also puts the terminal's reservations into code: binary frames are refused, each frame kind has its own size limit, the welcome carries the feature list and the bundle's build stamp, and every adapter declares its `terminal` capability.

## What to build

The web edge pings every 30 seconds, and the existing sweep closes a socket silent for 60 seconds. A binary frame closes the socket with a dedicated close code until streams exist. Each frame kind has its own size limit; JSON frames keep 1 MiB. The welcome carries the bundle's build stamp, so a page that loaded an older bundle can reload. A hello refused for its protocol tells the page to restart the hub. Every adapter declares `terminal: 'none'`, and clients can read it.

## Acceptance criteria

- [x] C1. The web edge pings every 30 seconds, and a socket silent for 60 seconds is closed (fake-clock test).
  - verified: rev-23 [reviewer] · run rev-20261021-989-linux-evidence · 2026-10-21T10:53:00.286Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - verified: rev-23 [reviewer] · run rev-20261021-989-final · 2026-10-21T10:57:04.885Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - done: impl-989 · 2026-10-21T11:01:17.399Z
  - verified: rev-23 [reviewer] · run rev-20261021-989-final-delta · 2026-10-21T11:05:59.617Z · commit a450ff3fa7df24196bdd12da65b59f67c294924b
- [x] C2. A binary frame on the web edge closes the socket with a dedicated close code (test).
  - verified: rev-23 [reviewer] · run rev-20261021-989-linux-evidence · 2026-10-21T10:53:00.286Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - verified: rev-23 [reviewer] · run rev-20261021-989-final · 2026-10-21T10:57:04.885Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - done: impl-989 · 2026-10-21T11:01:17.421Z
  - verified: rev-23 [reviewer] · run rev-20261021-989-final-delta · 2026-10-21T11:05:59.617Z · commit a450ff3fa7df24196bdd12da65b59f67c294924b
- [x] C3. Each frame kind has its own size limit, JSON frames keep 1 MiB, and an oversize frame of a kind is refused (test).
  - verified: rev-23 [reviewer] · run rev-20261021-989-linux-evidence · 2026-10-21T10:53:00.286Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - verified: rev-23 [reviewer] · run rev-20261021-989-final · 2026-10-21T10:57:04.885Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - done: impl-989 · 2026-10-21T11:01:17.443Z
  - verified: rev-23 [reviewer] · run rev-20261021-989-final-delta · 2026-10-21T11:05:59.618Z · commit a450ff3fa7df24196bdd12da65b59f67c294924b
- [x] C4. The welcome carries the feature list and the bundle's build stamp, and a hello refused for its protocol carries the instruction to restart the hub (test).
  - verified: rev-23 [reviewer] · run rev-20261021-989-final · 2026-10-21T10:57:04.885Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - done: impl-989 · 2026-10-21T11:01:17.467Z
  - verified: rev-23 [reviewer] · run rev-20261021-989-final-delta · 2026-10-21T11:05:59.618Z · commit a450ff3fa7df24196bdd12da65b59f67c294924b
- [x] C5. Every adapter declares its `terminal` capability, `none` today, readable by a client (test).
  - verified: rev-23 [reviewer] · run rev-20261021-989-linux-evidence · 2026-10-21T10:53:00.286Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - verified: rev-23 [reviewer] · run rev-20261021-989-final · 2026-10-21T10:57:04.885Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - done: impl-989 · 2026-10-21T11:01:17.497Z
  - verified: rev-23 [reviewer] · run rev-20261021-989-final-delta · 2026-10-21T11:05:59.618Z · commit a450ff3fa7df24196bdd12da65b59f67c294924b
- [x] C6. `hub/README.md` documents the eight reservations as built.
  - verified: rev-23 [reviewer] · run rev-20261021-989-source · 2026-10-21T10:42:53.667Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - verified: rev-23 [reviewer] · run rev-20261021-989-final · 2026-10-21T10:57:04.885Z · commit d71acb93ae77d196915fc6d513fab1acca134c33
  - verified: rev-23 [reviewer] · run rev-20261021-989-source-delta · 2026-10-21T11:00:59.775Z · commit a450ff3fa7df24196bdd12da65b59f67c294924b
  - done: impl-989 · 2026-10-21T11:01:17.522Z
  - verified: rev-23 [reviewer] · run rev-20261021-989-final-delta · 2026-10-21T11:05:59.618Z · commit a450ff3fa7df24196bdd12da65b59f67c294924b

## Comments

### impl-989 · 2026-10-21T10:39:18.724Z

Implemented C1–C6 with TDD at web transport and isolated browser seams. Local Darwin arm64 targeted evidence on current pre-review tree: web-auth.test.ts 28/28; connection-snapshot.test.ts 11/11; web-bundle.test.ts 1/1; isolated Headless Shell connection.test.ts 4/4 (3 sequential subtests, includes stale proxy reload guard); typecheck and static lint passed, test lint report-only with 0 refusals. No queued suite receipt yet; source review precedes mode-free verification. README records the eight terminal reservations and identifies T-986's parallel queue/resume scope explicitly. QA policy is after-stage.

### rev-23 · 2026-10-21T10:42:53.667Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-989-source
commit: d71acb93ae77d196915fc6d513fab1acca134c33
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards0/Spec0 findings. A-8295 records 28-file audit at base3da31f0fb6c7d9f8cc2d4d49c82b34debc646308: raw traffic/pong liveness with30/60s fake-clock receipts, binary4003 and exact UTF8 JSON1MiB/oversize1009, per-welcome served digest plus Vite meta and protocol-runtime hashing, web-only version restart action and browser reload guard, all adapters terminal:none exposed in session.list. Exact local legacy no-feature welcome/spoke paths preserved. Browser tests retain reconnect/secret checks, arm navigation before restart and separately assert final rendered state. C6 docs verified; T-986 queue/resume ownership explicitly qualified. C1–C5 remain execution-dependent. A-8292 targeted Mac summaries are not a queued full/Web/load-gate receipt. Proceed normal mode-free configured verification at this unchanged head; final evidence must retain actual Web/browser coverage and phase limits. If Web unavailable, route disposition to lead/Coordinator; no unavailable-as-pass or unauthorized executor override. No Reviewer runtime/GUI.

Criteria: C6 verified.

### rev-23 · 2026-10-21T10:53:00.286Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-989-linux-evidence
commit: d71acb93ae77d196915fc6d513fab1acca134c33
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Intermediate Linux evidence clear, not final readiness. A-8307 audits exact-head A-8305/run eda77ddb: configured Linux x64 c-8 lon1 T1/all-T2 exit 0, 2259 ordinary passes/343 files plus 35 separate load passes. Seven new socket identities each have five distinct passing finish ids. C1 fake-clock ping/silence/traffic, C2/C3 binary4003/UTF8 JSON1MiB/oversize1009 and C5 all adapters terminal:none via web session.list verified. Existing legacy welcome and bundle-source tests pass. C6 source proof retained. C4 server assertions pass but browser recovery remains unverified: Web explicitly NOT RUN for missing libraries/T-993. Coordinator 6ab9d101-33d0-4065-92a9-1f0c14c548e7 authorizes unchanged-head queued local run 7f84bdf7 for actual macOS Web; it is admitted, not completed. A-8292 supporting context only. No findings. Host typecheck ef6fe2066afea635330c91c3b2047a3f2e360a43 not repeated remotely; lint132/59, duration and ratchet report-only; no T3/T4/stage/QA/browser pass claimed. Lifetime460s, reportedcost$0.0319.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### impl-989 · 2026-10-21T10:56:32.537Z

Queued evidence at unchanged reviewed head d71acb93ae77d196915fc6d513fab1acca134c33: Linux droplet run eda77ddb/A-8305 exit 0, 2259 passed, all T1 + fallback all hub/Neovim T2; Web unavailable (missing libraries), no browser pass attributed. Per Coordinator disposition 6ab9d101, local Darwin arm64 run 7f84bdf7/A-8310 exit 0, 2267 passed, check + all T1 + fallback all T2 + actual Web (2 files). Duration/test lint gates report-only. T3 remains deferred to periodic dev/integrated occasions, absent from configured merge-batch tiers. Reviewer settling C4 and final same-head verdict; no source changes since full source clear.

### rev-23 · 2026-10-21T10:57:04.885Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-989-final
commit: d71acb93ae77d196915fc6d513fab1acca134c33
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; no findings. A-8313 audits authorized queued local A-8310/run7f84bdf7 at unchanged source-reviewed d71acb93: Darwin arm64 check/typecheck local + all T1/T2 both packages + actual Web exit0, 2267 ordinary passes/345 files +35 separate load passes. Web two files/eight passing finishes including parents; connection parent and all three sequential subtests pass. C4 browser reload/persistent-stale guard and Restart hub/no-retry finish records12784/12788 establish actual rendered behavior; no Web load repetitions claimed. This supplements A-8305/A-8307 Linux socket proofs, seven new identities5/5, and C6 source docs. Coordinator6ab9d101 explicitly authorized unchanged-head local run; A-8292 remains context only. Linux Web stayed unavailable, so no Linux browser pass claimed. Lint132/59, durations/ratchet report-only, two local missing baselines. No T3/T4/stage/after-stage QA/manual real-browser GUI pass claimed; no Reviewer execution. All C1–C6 verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-989 · 2026-10-21T10:58:16.019Z

Coordinator authorized one origin/dev merge after ready head d71acb93 conflicted with T-994. Resolved Shell.tsx and connection.ts preserving rail/top-strip/keymap plus reload/restart behavior; pushed a450ff3fa7df24196bdd12da65b59f67c294924b. Local Darwin arm64 targeted web typecheck/build pass; Headless Shell connection 4/4 and shell 7/7. Fresh delta source review requested; new local queued verification waits for source clear.

### rev-23 · 2026-10-21T11:00:59.775Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-989-source-delta
commit: a450ff3fa7df24196bdd12da65b59f67c294924b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; Standards 0 / Spec 0 findings. A-8319 audits both parents and Coordinator-authorized 9ab4c4de merge. Shell retains incoming rail/top-strip/preferences and sole shared physical-code listener, with Restart hub rendering. Connection retains richer facts/subscriptions plus earlier build-stamp reload guard and terminal protocol refusal/no-retry state. Incoming keyboard/map, shell tests and original T-989 server/frame/adapter/browser tests are unchanged from their respective reviewed parents. Matching docs preserve both contracts; C6 verified. C1–C5 execution-dependent at this merged head; old A-8305/A-8310 are historical. A-8315 targeted local summaries are supporting only. Refresh stale C1–C6 done marks and run fresh Coordinator-directed mode-free verify --executor local at this unchanged head, including actual Web, before final settlement. No Reviewer runtime.

Criteria: C6 verified.

### impl-989 · 2026-10-21T11:04:31.633Z

Fresh queued verification at delta-reviewed merged head a450ff3fa7df24196bdd12da65b59f67c294924b: be412df6/A-8321 auto exit 0 on local Darwin arm64, check + all T1 + fallback all hub/Neovim T2 + actual Web (3 files), 2275 passed, 0 failures/skips. Lint/duration/ratchet gates report-only. T3 remains deferred to periodic dev/integrated occasions. All six claimant done marks refreshed at this head before submission; final Reviewer verdict pending.

### rev-23 · 2026-10-21T11:05:59.618Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-989-final-delta
commit: a450ff3fa7df24196bdd12da65b59f67c294924b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head clear; no findings. A-8323 audits A-8321/run be412df6 at unchanged source-reviewed a450ff3f. Coordinator-authorized queued Darwin arm64 local check/typecheck + all T1/T2 both packages + actual Web exit0: 2275 ordinary test passes/347 files plus35 separate load passes. Seven owned socket identities have distinct5/5 passing finishes; C1/C2/C3/C5 transport/adapter assertions pass. C4 actual browser reload/persistent-stale case line12795 and Restart hub/no-retry12799 pass; incoming shell six subtests and smoke also pass, three Web files/15 test finishes including parents. No Web load-repetition claim. C6 retains source proof A-8319; all six individual done marks refreshed11:01:17. Lint132/59, duration/ratchet report-only, four missing baselines. No T3/T4/Linux-browser/stage/after-stage QA/manual GUI or Reviewer runtime claim. Old-head receipts historical. All C1–C6 verified.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-21T11:11:07.677Z

Merged 80f8f94c951b4a14189e650dd4c57b81aa76256f onto dev.
