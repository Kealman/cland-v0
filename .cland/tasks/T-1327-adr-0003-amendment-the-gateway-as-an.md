---
id: T-1327
kind: task
title: "ADR 0003 amendment: the gateway as an outbound-only edge of the one frame protocol"
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by: []
topic: topic-1076
branch: t/T-1327-adr-0003-amendment-the-gateway-as-an
created: 2026-10-26T02:28:47.687Z
updated: 2026-10-26T02:46:02.617Z
closed: 2026-10-26T02:46:02.617Z
---

## Summary

ADR 0003 (the hub is a per-project daemon) gains an amendment naming the gateway: an edge of the one frame protocol inside the hub process, connecting out only, with its own authority table.

## What to build

A dated amendment section in `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, following the domain-modeling skill's ADR conventions. It names the gateway and its outbound-only connections. It references the authority table and the identity `human` (ADR 0001), and links GLOSSARY's Gateway, Remote and Outbox and spec §3.1.

## Acceptance criteria

- [x] C1. ADR 0003 carries a dated amendment naming the gateway as an outbound-only, in-process edge of the one frame protocol with its own authority table, acting as `human`, and the docs links it adds resolve (docs lint or test).
  - done: impl-1327 · 2026-10-26T02:32:31.048Z
  - verified: rev-26 [reviewer] · run rev-20261026-1327-evidence-1 · 2026-10-26T02:45:54.899Z · commit a428cc8465275a275089143a2e4f517d7070ac65

## Comments

### impl-1327 · 2026-10-26T02:30:35.080Z

Read E-1307, docs/spec/v0.3.md §3.1, GLOSSARY Gateway/Remote/Outbox, ADR 0001 and domain-modeling ADR conventions. Scope is one dated ADR 0003 amendment recording the decision, not current implementation. No runtime or shared contract changes. C1 uses docs lint (content checklist and local Markdown target/anchor resolution); no runtime test file is needed for this docs-only item.

### rev-26 · 2026-10-26T02:33:41.300Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1327-source-1
commit: a428cc8465275a275089143a2e4f517d7070ac65
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR; A-12244 at tree 533b8cb4483e53298302739b6ae1a7e51f809def. Standards 0 / Spec 0 findings. One dated 28-line ADR amendment matches E-1307/spec §3.1 and domain-modeling ADR format: in-process outbound-only one-frame edge, human identity, exact narrow authority, lifecycle/no listener or hub secret, and clear decision-versus-unbuilt-implementation wording. All six file/heading/glossary links resolve in the reviewed tree, including existing web-authority.ts. A-12243 reports local docs red/green, typecheck/wording checks, not configured evidence; preserve original output/exits/capture limits. C1 claimant done remains; final configured verification pending one ordinary mode-free same-head result after any active Coordinator quiet window ends. No new tests/full run or QA claim; reviewer performed immutable reads only.

### rev-26 · 2026-10-26T02:45:54.899Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1327-evidence-1
commit: a428cc8465275a275089143a2e4f517d7070ac65
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence CLEAR; A-12248 carries source1/A-12244 and original 19648666/A-12247 exit 0. Deduplicated ordinary 3323 test passes / 446 file passes, no fail/skip/cancel/todo or actual load executions. T0/all T1/fallback all T2/Web complete; ADR coverage fallback, T3/T4 absent/deferred. Linux c-8 lon1, Node24.21.0/Neovim0.12.5, Headless Shell156.0.8078.4/v1248, workers2, executor lifetime638s/$0.0443. Host prepared-tree typecheck gate not remotely repeated; lint/budget/ratchet warnings remain report-only. C1 dated ADR/content/six links established by immutable source plus A-12243 docs validation; no unbuilt gateway implementation claim. Standards/Spec no findings; C1 verified. Coordinator owns enqueue/landing and epic QA. Reviewer reads only.

Criteria: C1 verified.

### coord · 2026-10-26T02:46:02.617Z

Merged cbe9a747c4d0c45fbea0db5518f65a0f1d39957a onto dev.
