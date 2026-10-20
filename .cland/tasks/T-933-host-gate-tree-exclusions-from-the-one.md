---
id: T-933
kind: task
title: Host-gate tree exclusions from the one shared definition, and tests.md names the rulebook exclusion
state: open
status: ready
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
  - qa-found
assignee: null
parent: E-579
blocked_by: []
topic: topic-686
branch: t/T-933-host-gate-tree-exclusions-from-the-one
created: 2026-10-20T04:09:20.206Z
updated: 2026-10-20T04:18:43.788Z
---

## Summary

E-579's DoD demo (qa-3, run qa-20261020-3e, at 824105c5) found two defects. First, hub/src/executor/droplet/run.ts (~line 118) repeats the literal exclusions `.cland/tasks` and `.cland/RULES.md` when it builds the host-gate tree, instead of using the shared definition in verification-tree.ts (~line 10). The brief's R5 requires one definition. Second, docs/agents/tests.md (~line 808) says the candidate tree excludes only `.cland/tasks`. That contradicts its own line ~182 and hub/README.md (~line 2490), which say the rulebook is excluded too.

## What to build

The host-gate tree in the droplet run builds its exclusions from the shared verification-tree definition, so a later change to the excluded paths reaches every caller. tests.md says in every place that both the tracker and the rulebook are excluded.

## Acceptance criteria

- [x] C1. No literal `.cland/tasks` or `.cland/RULES.md` exclusion remains outside the shared verification-tree definition in hub/src (a grep shows one definition), and the droplet host-gate tree uses it; its existing tests pass.
  - done: impl-933 · 2026-10-20T04:10:48.462Z
  - verified: rev-31 [reviewer] · run rev-20261020-933-source · 2026-10-20T04:12:08.346Z · commit c6f503f61cdc83148cb510180e1dd28fb911be6f
  - verified: rev-31 [reviewer] · run rev-20261020-933-final · 2026-10-20T04:18:41.930Z · commit c6f503f61cdc83148cb510180e1dd28fb911be6f
- [x] C2. docs/agents/tests.md describes the candidate tree excluding both `.cland/tasks` and `.cland/RULES.md` consistently with hub/README.md.
  - done: impl-933 · 2026-10-20T04:10:49.135Z
  - verified: rev-31 [reviewer] · run rev-20261020-933-source · 2026-10-20T04:12:08.346Z · commit c6f503f61cdc83148cb510180e1dd28fb911be6f
  - verified: rev-31 [reviewer] · run rev-20261020-933-final · 2026-10-20T04:18:41.930Z · commit c6f503f61cdc83148cb510180e1dd28fb911be6f
- [x] C3. A mode-free `cland verify` at the reviewed head is green.
  - done: impl-933 · 2026-10-20T04:18:27.101Z
  - verified: rev-31 [reviewer] · run rev-20261020-933-final · 2026-10-20T04:18:41.930Z · commit c6f503f61cdc83148cb510180e1dd28fb911be6f

## Blocked by

None. Land it only after the open v0.1.4 demos (E-482, E-614, E-578) record their verdicts. A dev commit before then makes their builds stale.

## Comments

### impl-933 · 2026-10-20T04:10:48.450Z

Implemented at c6f503f61cdc83148cb510180e1dd28fb911be6f: droplet host-gate git rm derives its arguments from the shared excludedPaths; cache docs name tracker and rulebook exclusions. Typecheck and targeted tree (9/9) and remote host-gate (1/1) tests pass. origin/dev already up to date; branch pushed. Source review next, then exact-head mode-free verification. Merge remains unqueued per freeze.

### rev-31 · 2026-10-20T04:12:08.346Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-933-source
commit: c6f503f61cdc83148cb510180e1dd28fb911be6f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7042: source clear,no findings. Remote host-gate git rm now derives quote-escaped arguments from shared excludedPaths,byte-equivalent to prior literals;local pathspec/tree already use same list. Fullhub/srcgrep finds soleverification-exclusion definition; unrelated tracker/override literals do not duplicate it. Docs candidate cache/release descriptions consistently name tracker andrulebook. A-7041original targeted receipts9/9tree,file5.868884250s,and1/1remotehostgate,case6.823467167s,file7.116405333s;exit0/no skips,reportedmatchingcommitcontent,no reruns. C1/C2verified,C3pendingconfiguredmode-freegreen at unchangedhead. No identity/allowance changes;QA none. Devfreeze/do-not-merge remains;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified.

### impl-933 · 2026-10-20T04:18:27.673Z

Mode-free verification f8332573-f59e-4dae-a08d-48c37db43cfd is green at reviewed c6f503f61cdc83148cb510180e1dd28fb911be6f: 1920/1920, T0–T2; docs change caused all-T2 fallback. Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5; droplet c-8 lon1, lifetime 337s, cost $0.0234. Host gate reused tree 8bca9994199a14c7fd656b2c6cc54780f91f2d1a. Durable log A-7045. T3 remains deferred per configured policy; original targeted T3 tree and remote host-gate receipts are retained in A-7041. Awaiting final Reviewer verdict; no merge requested.

### rev-31 · 2026-10-20T04:18:41.930Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-933-final
commit: c6f503f61cdc83148cb510180e1dd28fb911be6f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7046: final clear at unchanged reviewed/pushedc6f503f6. WholeA-7045 audit1920/1920ordinarypasses,zero nonpasses/loadgroups/durationfailures/resource mismatches;hostcheck/allT1/fallbackallT2bothpackagesgreen. Knownheartbeatfilebaseline notice report-only,not failure. C1sharedexclusions/targetednative9/9+1/1 and C2docs sourceA-7042remaincurrent;C3freshgreen established. Allclaimantdone,no findings. QA none;devfreeze/do-not-merge remains separate;no Reviewer tests/edits.

Criteria: C1 verified, C2 verified, C3 verified.
