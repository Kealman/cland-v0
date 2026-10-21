---
id: T-1080
kind: task
title: AGENTS.md and web/README.md still describe the key map and Linux Web libraries as future work
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: topic-816
branch: t/T-1080-agents-md-and-web-readme-md-still
created: 2026-10-21T17:54:44.347Z
updated: 2026-10-21T18:22:52.427Z
closed: 2026-10-21T18:22:52.427Z
---

## Summary

Two documents still carry forward-looking wording from before their slices landed (E-415 DoD QA, DOD-19 at 128444a0). `AGENTS.md`'s web rule says the physical-code key map is something "the shell-key slice adds", but the map exists. `web/README.md`'s Browser tests section says "Until T-993 supplies Linux libraries", but T-993 is closed and every Web file passes on Linux droplets.

## Acceptance criteria

- [x] C1. `AGENTS.md`'s web rule names the existing key map (`web/src/keymap.ts`) without "the shell-key slice adds it".
  - done: impl-1080 · 2026-10-21T18:08:56.185Z
  - verified: rev-23 [reviewer] · run rev-20261021-1080-source · 2026-10-21T18:09:58.363Z · commit 02235a4b0d60e4066ee2e9704418a762a7a2677d
  - verified: rev-23 [reviewer] · run rev-20261021-1080-final · 2026-10-21T18:18:36.900Z · commit 02235a4b0d60e4066ee2e9704418a762a7a2677d
- [x] C2. `web/README.md`'s Browser tests section describes the current Linux and macOS Web phase without the T-993 caveat.
  - done: impl-1080 · 2026-10-21T18:08:56.199Z
  - verified: rev-23 [reviewer] · run rev-20261021-1080-source · 2026-10-21T18:09:58.363Z · commit 02235a4b0d60e4066ee2e9704418a762a7a2677d
  - verified: rev-23 [reviewer] · run rev-20261021-1080-final · 2026-10-21T18:18:36.900Z · commit 02235a4b0d60e4066ee2e9704418a762a7a2677d

## Comments

### impl-1080 · 2026-10-21T18:08:38.295Z

Scope confirmed: only the AGENTS.md keyboard-map sentence and web/README.md Browser tests prerequisite paragraph. Existing keymap.ts, Linux cloud-init library provisioning and Web phase docs checked; no behavior or test changes planned.

### rev-23 · 2026-10-21T18:09:58.363Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1080-source
commit: 02235a4b0d60e4066ee2e9704418a762a7a2677d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8602, Standards0/Spec0. Exact origin02235a4b/treeafce00c5, fixed parent e616887357be105d30684dec508b0291994b1ca4, two docs only6add/5delete; diff check clean. C1 verified: AGENTS names existing physical-code map web/src/keymap.ts, used by keyboard resolver/Shell; no future-slice wording, existing single-map rule retained outside managed block. C2 verified: current Darwin/Linux prerequisite layouts, sealed bounded Linuxldd probe, Ubuntu24.04 runtime install in droplet provision.sh and configured image match README; unavailable machines retain Web-not-run/no-passing-receipt and no-installed-browser-fallback. No behavior/test/dependency/permission changes or skill metadata edits needed. Both criteria source-verifiable; no runtime/suite/Web pass claimed. Source clear permits unchanged-head mode-free verify; final evidence settlement awaits that receipt. QA none/no brief or criteria; Reviewer read only.

Criteria: C1 verified, C2 verified.

### rev-23 · 2026-10-21T18:18:36.900Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1080-final
commit: 02235a4b0d60e4066ee2e9704418a762a7a2677d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified, no findings. A-8607 records A-8606/2767d0a5 exact unchanged02235a4b:2328ordinarytest/356filepasses, actual Linuxx64droplet T1/allfallbackT2hub+nvim/Web5files exit0, nofail/skip/cancel; source A-8602 retained. Host436fc0dc reusednotremote,T2workers2/Web4; lint132/59,duration/ratchet report-only,1missingbaseline and Web4s-budget overages retained. NoT3/T4/integrated/QA claim; QA none, no Reviewer runtime.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-21T18:22:52.427Z

Merged 6e1a68e5cf31d7f189ed32153a8ecd5d4ffccfb8 onto dev.
