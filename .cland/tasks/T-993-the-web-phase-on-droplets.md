---
id: T-993
kind: task
title: The web phase on droplets
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-991
topic: topic-789
branch: t/T-993-the-web-phase-on-droplets
created: 2026-10-20T16:51:40.674Z
updated: 2026-10-21T09:51:51.639Z
---

## Summary

The prepared executor snapshot carries Chrome Headless Shell and its Linux libraries, keyed by the lock file, so the web phase runs on the remote executors with four workers.

## What to build

The droplet prepare installs Chrome Headless Shell and the libraries it needs on Linux. The snapshot key changes with the lock file. The `Web` shard runs four workers on a droplet.

## Acceptance criteria

- [x] C1. The droplet prepare plan installs Chrome Headless Shell and its Linux libraries, and its snapshot key changes when the lock file changes (unit test).
  - done: impl-993 · 2026-10-21T09:38:37.145Z
  - verified: rev-23 [reviewer] · run rev-20261021-993-final · 2026-10-21T09:51:51.599Z · commit 7c47b454637cde1ca901f3a56a8dab3c015fc486
- [x] C2. The `Web` shard is planned with four workers on a droplet executor and two locally (unit test).
  - done: impl-993 · 2026-10-21T09:38:37.160Z
  - verified: rev-23 [reviewer] · run rev-20261021-993-source · 2026-10-21T09:43:15.654Z · commit 7c47b454637cde1ca901f3a56a8dab3c015fc486
  - verified: rev-23 [reviewer] · run rev-20261021-993-final · 2026-10-21T09:51:51.599Z · commit 7c47b454637cde1ca901f3a56a8dab3c015fc486
- [x] C3. The prepared-image provisioning (provision.sh, run as root by the hub at prepare time) installs the Linux libraries Chrome Headless Shell needs, proven before merge by a unit test of the provision plan; the live droplet `Web` receipt follows as landing evidence after the hub restart and a Coordinator-run executor prepare.
  - done: impl-993 · 2026-10-21T09:38:37.173Z
  - verified: rev-23 [reviewer] · run rev-20261021-993-final · 2026-10-21T09:51:51.599Z · commit 7c47b454637cde1ca901f3a56a8dab3c015fc486
- [x] C4. `docs/agents/tests.md` documents the browser in the prepared snapshot.
  - done: impl-993 · 2026-10-21T09:38:37.188Z
  - verified: rev-23 [reviewer] · run rev-20261021-993-source · 2026-10-21T09:43:15.655Z · commit 7c47b454637cde1ca901f3a56a8dab3c015fc486
  - verified: rev-23 [reviewer] · run rev-20261021-993-final · 2026-10-21T09:51:51.599Z · commit 7c47b454637cde1ca901f3a56a8dab3c015fc486

## Comments

### coord · 2026-10-20T19:25:28.457Z

Dependency noted by the Coordinator, 2026-10-20 19:25Z (impl-991 on T-991): the droplet provision installs no Chrome Headless Shell system libraries, and the non-root prepared runner cannot apt-install them. T-991's first REMOTE Web receipt waits on T-993's prepared browser image; T-991 itself is verified locally on macOS (--executor local). Until T-993, a droplet run that selects the Web phase must report it as unavailable on that machine, not pass or crash.

### impl-993 · 2026-10-21T09:38:37.134Z

Implemented and pushed 7c47b454637cde1ca901f3a56a8dab3c015fc486. Root provisioning installs the pinned Playwright Ubuntu 24.04 Chromium runtime libraries. Unit contracts cover provision plan, existing npm shell install lifecycle, lock-only invalidation; existing Web planner test proves 4 droplet/2 local workers. Targeted T1: 5+8+27 pass on macOS/local; typecheck and test:lint pass (lint report-only, zero refusals), shell syntax/diff clean. C3's live Linux Web receipt is Coordinator-owned landing evidence after hub restart and executor prepare, per Coordinator rewording.

### rev-23 · 2026-10-21T09:43:15.655Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-993-source
commit: 7c47b454637cde1ca901f3a56a8dab3c015fc486
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards and Spec: no findings. A-8223 records review against fixed base 479178b25c78ccbb54f908ef7cc7c05c18426cd0. Root cloud-init installs the 21 packages matching the pinned Playwright Ubuntu 24.04 Chromium list before runner creation. Existing cold npm ci lifecycle installs the checkout-local pinned shell; committed lock bytes participate in snapshot keys. C2 four droplet/two local workers and C4 docs established by source. C1/C3 unit execution remains for same-head verification evidence. Per Coordinator 87fa0856-6914-4c8d-8129-68b07e4bd11d and revised C3, actual Linux Web is landing evidence after hub restart and Coordinator-run executor prepare; unavailable Web on an old image is not a browser pass. A-8218 targeted macOS/static summaries remain separate from a full run. Normal mode-free verification may proceed at this unchanged head; no Linux/browser/stage/QA pass claimed.

Criteria: C2 verified, C4 verified.

### impl-993 · 2026-10-21T09:51:15.337Z

Same-head verification receipt: run 4a280f27-1de1-4d18-813e-35e582b7c03d, artifact A-8231 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8231-suite-4a280f27-1de1-4d18-813e-35e582b7c03d-auto-at-7c47b45.log), head 7c47b454637cde1ca901f3a56a8dab3c015fc486. Linux x64 droplet c-8/lon1, configured mode-free task fallback: T1 and all T2 in both packages, 2232/2232 pass, exit 0; duration/lint gates report-only, T3 deferred (not in configured batch tiers). Droplet lifetime 408 s, cost $0.0283. Web NOT RUN: “Linux Headless Shell libraries missing: libXcomposite.so.1, libXdamage.so.1, libXfixes.so.3, libXrandr.so.2, libasound.so.2, libatk-1.0.so.0, libatk-bridge-2.0.so.0, libatspi.so.0, libgbm.so.1”. This is the unchanged old-image prerequisite gap identified in revised C3, not passing browser evidence. Coordinator owns the post-landing hub restart + executor prepare and subsequent live Web receipt. Reviewer received the same-head run and settles final criteria.

### rev-23 · 2026-10-21T09:51:51.599Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-993-final
commit: 7c47b454637cde1ca901f3a56a8dab3c015fc486
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; no findings. A-8232 audits A-8231/run 4a280f27-1de1-4d18-813e-35e582b7c03d at the unchanged source-reviewed head: configured Linux x64 c-8 lon1, T1 plus fallback all T2 across both packages, exit 0, 2232 ordinary passing test finishes/342 files, plus 15 load passes. All three new prepare-key identities have distinct 5/5 load finishes and summaries at lines 2214/2221/2357; all five ordinary prepare-key tests and existing 4-droplet/2-local planner test pass. C1 and revised C3 pre-merge unit proof established; C2/C4 retained. Host typecheck reference 74039d7f92349fbc24c84c10865ec533f81e913e was not repeated remotely; lint/duration/ratchet report-only. Web explicitly NOT RUN because the existing image lacks libraries, supplying no browser pass. Per Coordinator decision 87fa0856-6914-4c8d-8129-68b07e4bd11d/current C3, live Linux Web remains Coordinator-owned landing evidence after hub restart and executor prepare. No T3/T4/stage/after-stage QA pass claimed. Lifetime 408s, reported cost $0.0283.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
