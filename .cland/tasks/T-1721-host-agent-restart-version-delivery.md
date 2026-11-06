---
id: T-1721
kind: task
title: host-agent-restart "version delivery reconnect" runs at 15–17 s against a 20 s test timeout and times out under load
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1612
found_by: cover
topic: topic-1406
branch: t/T-1721-host-agent-restart-version-delivery
created: 2026-11-06T11:09:04.236Z
updated: 2026-11-06T15:18:41.345Z
closed: 2026-11-06T15:18:41.345Z
---

## Summary

`hub/test/host-agent-restart.test.ts` "C1-C3 version delivery reconnect reads retained table without signalling harness" took 15.4 s in the Linux stage cover A-17045 and 17.1 s in the macOS cover A-17051, both green, against a 20 s test timeout. In impl-1707's preservation batch on 2026-11-06 at 11:08Z, with a host load of about 10, it ran 21.2 s and was cancelled with `test timed out after 20000ms`. The margin is too thin for loaded runs.

## What to build

Find which part of the case is setup (agent restart, delivery, reconnect) and which is the behaviour the test asserts. Setup waits use `testWaitMs()`/`eventually()`, the test timeout sits above its allowance, and the case gets a duration allowance sized from the worst sample. Behaviour bounds stay exact and named; never weaken an assertion. If profiling shows a product slowdown since T-1612, name it instead.

## Acceptance criteria

- [x] C1. The case passes 10/10 on macOS at a one-minute load of 12 or more, with its assertions unchanged (evidence).
  - done: impl-1721 · 2026-11-06T12:24:54.799Z
  - verified: rev-36 [reviewer] · run rev-36-1721-final-1 · 2026-11-06T12:53:57.059Z · commit 9db9541d5efe1e75d2bf1989278fd84a924f6228
- [x] C2. The case's test timeout exceeds its duration allowance, and the allowance is sized at about 1.5 times the worst sample, with the samples in the reason (test-lint or durations check).
  - done: impl-1721 · 2026-11-06T12:31:15.546Z
  - verified: rev-36 [reviewer] · run rev-36-1721-final-1 · 2026-11-06T12:53:57.059Z · commit 9db9541d5efe1e75d2bf1989278fd84a924f6228

## Comments

### coord · 2026-11-06T11:45:43.410Z

More samples (impl-1707, 2026-11-06, macOS arm64, sealed environment). The case took 14.71 s at a peak load of 3.9 and 19.18 s at a peak load of 5.9, against its 20 s timeout. So even moderate load brings it within a second of the timeout, and this is more urgent than "loaded runs only". Earlier: 21.19 s cancelled at a load of about 10 (A-17072); 15.4 s Linux (A-17045); 17.1 s macOS (A-17051).

### impl-1721 · 2026-11-06T11:46:58.389Z

Rule 20 scope audit before edits: host-agent-restart.test.ts has 10 generated cases: kill-agent/version delivery reconnect, corrupt/escaping bundles, close joining installation, held mismatch close/quiesce, compiler-free registry startup, adopted Claude replacement, closed/unresolved downtime recovery. Shared helpers sshHostFixture, eventually/testWaitMs, agentBundle/deliverAgent/retainAgentVersions/agentVersionHandoff, AgentClient, sshHost and ownProcess remain unchanged. Only first loop's version-delivery setup waits and whole-case envelope plus exact duration allowance will change; kill-agent's 5000ms kill-to-retained-table assertion remains exact. No production or wire contract changes; other cases and shared helper consumers unaffected.

### impl-1721 · 2026-11-06T12:21:52.098Z

C1 measured on macOS arm64 local Node24.21.0: ten qualifying native full-file children, each exact10 named cases/pass10/fail0/cancelled0/skipped0/native exit0. Sampled1m load12.1538–17.3965 at250ms; feedback yes burners and owner-checked preservation lock. Version seconds [18.155473459,15.750507917,19.842925292,18.628617833,19.199364208,17.3376325,19.761022375,19.424526875,17.378785125,18.179632458]. Two other all-green children excluded for load windows. Test source SHA pinned in evidence; all50 assertion lines preserved (named5000ms constant resolved for audit). Current/historical profiles12.056/11.161s show repeated handoff/upgrades dominate; no repeatable product regression established. Kept chain together because it proves same worker survival after pruning original supervisor version. C2 allowance32s C-216 expiry2026-11-13, ceil1.5x21.19 historical incomplete observation retained conservatively; reason includes every sample and incomplete distinction. Default timeout90s, exact5s kill behaviour remains. No browser; no duration gate in targeted runs; manifest report mode. T0 npm run check in disposable archive is running; source review follows.

### impl-1721 · 2026-11-06T12:25:07.469Z

Final C2 supersedes prior32s drafting note: committed252f41b26 uses48s = ceil(1.5 x (worst qualifying loaded19.842925292 x Coordinator-directed1.6 Linux projection31.7486804672)); projection is explicitly labelled, no new Linux pass claimed. OwnerC-216, added2026-11-06, expiry2026-11-13;90s default whole-case timeout. Worktree npm run check passed (typecheck/build/static/test lint refusals0). Archive npm run check failed tier classification in unchanged files; Coordinator classified the differing archive run as harness-only and directed the clean worktree rerun. Loaded source SHA unchanged through final commit; only allowance/docs followed measurements. Branch pushed to origin; C1/C2 marked done.

### rev-36 · 2026-11-06T12:29:31.274Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1721-source-1
commit: 252f41b2670deaf2914100524b42a7c41a7c3087
scope: full
findings: [{"severity":"low","text":"Packet summary retains an unqualified old24s/Nov11 allowance while the reviewed version-delivery entry and README use48s/Nov13; correct metadata or explicitly label historical/other-case identity. No source edit/rerun needed for this correction.","file":"/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17109-t-1721-profiling-ten-loaded-full-file-receipts-and-t0/summary.json","line":22}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear at 252f41b2670deaf2914100524b42a7c41a7c3087; no high/medium findings, one low packet-metadata finding. Compared all50 assertion lines after resolving exact5000ms constant; worker/handoff/replay/pruning/third/fourth upgrade chain unchanged. Version setup waits/default90s envelope separate from exact5s kill latency. Raw A-17109 confirms ten qualifying macOS children, each10 named passes/native0/null, sampled1m load12.154–17.396; candidate test SHA matches committed blob. Two load-ineligible green children excluded. Coordinator444219b6 authorizes1.6× projection: ceil(1.5×19.842925292×1.6)=48s, explicitly projected Linux, not measured. C-216/Nov13/reportmode and default90>48 retained. Low: summary.json allowance still24s/Nov11 conflicts with current entry/README; correction requested. C1/C2 remain unverified pending exact-head configured receipt and packet reconciliation. Details A-17111: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17111-t-1721-source-and-loaded-proof-review-at-252f41b26.md. Reviewer ran no tests/probes/lints/load.

### rev-36 · 2026-11-06T12:30:59.474Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1721-source-2
commit: 252f41b2670deaf2914100524b42a7c41a7c3087
scope: full
findings: [{"severity":"medium","text":"New48s allowance duplicates the same allow key at10652; last-key parsing retains old24s/Nov11 object, so the intended48s/Nov13 budget is ignored. Replace the superseded entry and source-review the corrected head.","file":"hub/test/durations.json","line":10539}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrects/supersedes rev-36-1721-source-1. I missed duplicate-key shadowing: exact-head raw-pair read confirms allow entries at10539(48s) and10652(24s), effective last-key value24s. A-17109 summary was reflecting that effective value; prior low metadata-only finding is withdrawn. Actual source defect is medium; C2 failed. Ten qualifying Mac native receipts/unchanged assertions/exact5s behavior remain checked but C1 stays unverified. Implementer already holds verification; corrected head requires fresh source review before a run. Details A-17112: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17112-t-1721-corrected-source-verdict-duplicate-allowance-shadows-48s.md. Reviewer ran no tests/probes/lint.

Criteria: C2 failed (Duplicate version-delivery allowance key shadows new48s/Nov13 with old24s/Nov11 on parse; intended sample-sized allowance is not effective.).

### impl-1721 · 2026-11-06T12:31:28.910Z

Correction at pushed9db9541d5: prior252f41b26 accidentally retained old24s allowance duplicate after new48s key. Removed superseded7-line block, checked every manifest key unique; effective JSON.parse exact version-case allowance is48s/C-216/2026-11-13. Test source/hash and all checked loaded receipts unchanged. Fresh worktree npm run check passed with test lint refusals0. Corrected full packet A-17113 supersedes A-17109 metadata; fresh source review requested and verification remains held until clear.

### rev-36 · 2026-11-06T12:32:30.422Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1721-source-3
commit: 9db9541d5efe1e75d2bf1989278fd84a924f6228
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at9db9541d5efe1e75d2bf1989278fd84a924f6228; no findings. Complete delta removes only superseded7-line allowance. Independently checked all manifest objects for duplicate keys (none); effective version case is48s/C-216/Nov13 and corrected A-17113 summary names/matches it. Prior medium duplicate-shadowing finding resolved. Test SHA/assertion sequence/exact5s kill bound unchanged;28 native TAP/receipt files match prior packet byte-for-byte. Ten qualifying macOS proofs and excluded outcomes retain their measured/source-blob qualifications;48s remains Coordinator-directed1.6× Linux projection, not measured Linux runtime. Default90s envelope>48s. C1/C2 unverified pending configured same-head evidence; prior252f source error/A-17112 remains history, not relabelled. Details A-17114: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17114-t-1721-corrected-allowance-source-review-at-9db9541d5.md. Reviewer ran no tests/probes/lints/load.

### impl-1721 · 2026-11-06T12:53:07.415Z

Configured same-head run709a79c8 passed at9db9541d5: exit0;5177/5177 tests, no failure/cancellation/skip. A-17121. Linux x64 6.8.0-142-generic droplet c-8 nyc1, Node24.21.0, Neovim0.12.5; Web uses downloaded Chrome Headless Shell156.0.8078.4/playwright v1248 per log. T0/T1/fallback-all T2/Web completed; changed T3 file once with10 passing identities, version case13.663s. Remaining T3 deferred to merge batch; T4 unexecuted. Duration/budget gates report-only, no allowance stanzas needed. Droplet lifetime1096s/cost$0.0761. Tree remains clean at reviewed head; Reviewer requested to settle criteria/final verdict with corrected packet A-17113.

### rev-36 · 2026-11-06T12:53:57.059Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1721-final-1
commit: 9db9541d5efe1e75d2bf1989278fd84a924f6228
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged9db9541d5efe1e75d2bf1989278fd84a924f6228. C1: independently checked raw A-17113 Mac ten qualifying whole-file10/10/native0/null receipts, sampled1m load12.154–17.396, exact source-blob hash and50 unchanged assertions/exact5s kill bound; two load-ineligible green children excluded. C2: duplicate allowance removed, effective48s/Nov13, default90s>48; measured Mac19.842925292×Coordinator-authorized projected Linux1.6×1.5 rounds48s, projection labelled. Corrected source/summary reconciled. Exact-head uncached709a79c8/A-17121 overall0,5177pass/0fail/cancel/skip/todo; T0/T1/fallback allT2/changedT3/Web exit0. Independently matched ten Linux native names, version13.662944245s; one execution/no T3 repetitions, broaderT3/T4 unexecuted. Linuxx64 droplet Node24.21/Nvim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4. T0capture-tree8464ff7b not repeated remotely. Budgets/lint/ratchet report-only; old cancellation/archive failure and erroneous252f verdict correction remain history. No per-item QA. Details A-17122: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17122-t-1721-final-timing-and-configured-evidence-at-9db9541d5.md. Reviewer ran no tests/probes/lint/load/browser.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-06T15:18:41.345Z

Merged a43c0a0ccfa8d7647aed50b5b901afac92751e32 onto dev.
