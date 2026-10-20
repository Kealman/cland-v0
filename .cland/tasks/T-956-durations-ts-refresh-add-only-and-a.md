---
id: T-956
kind: task
title: durations.ts refresh --add-only, and a manifest check for duration keys with no matching test
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-729
branch: t/T-956-durations-ts-refresh-add-only-and-a
created: 2026-10-20T09:53:22.452Z
updated: 2026-10-20T10:10:28.954Z
---

## Summary

At a stage close, `node hub/test/durations.ts refresh <log>` rewrites every allowance to the cover's timings. In the v0.1.4 run it would have shrunk 329 allowances and dropped 15. So the Coordinator hand-merged only the new baselines with Node (dc71dac8). Add an add-only mode, and a check that refuses exact keys that no test identity matches.

## What to build

`durations.ts refresh --add-only <log>` adds baselines for tests and files missing from the manifest. It leaves existing baselines and allowances byte-for-byte unchanged, keeps number formatting and prints what it added. The manifest validation refuses an exact duration key or census expectation that names no existing test identity. This comes from retro finding 4 (A-7261) and cluster 6 of the rule batch (A-7281), which the human approved on 2026-10-20. Update docs/agents/tests.md's stage-close step, and the memory-backed habit, to use `--add-only` until T-931 decides how allowances refresh.

## Acceptance criteria

- [x] C1. `refresh --add-only` on a log with new tests adds exactly their entries; a diff of the other entries is empty.
  - done: impl-956 · 2026-10-20T10:05:56.167Z
- [x] C2. Manifest validation refuses a key with no matching test identity and names it.
  - done: impl-956 · 2026-10-20T10:05:57.392Z
- [x] C3. docs/agents/tests.md's stage-close step names `--add-only`.
  - done: impl-956 · 2026-10-20T10:05:58.666Z
  - verified: rev-32 [reviewer] · run rev-20261020-956-source-2 · 2026-10-20T10:10:28.954Z · commit 82273fcb64bf9d49835413a7180a91e0563b5e88

## Comments

### impl-956 · 2026-10-20T09:58:18.815Z

Scope clarified by Coordinator in topic-729: no census-expectation artifact exists, so check duration tests/allow keys and file baselines at both admission paths. Coordinator authorized deleting the 20 stale keys in this item, with surviving entry bytes preserved and mapping evidence; no new-name baselines or allowance value edits.

### impl-956 · 2026-10-20T10:06:22.482Z

Source ready at ab0e67bef0004e4e2ab5ddb5e8d318a80bbe7bdb, pushed to origin after pre-review merge of origin/dev 2e381e6d. A-7345 records all 20 removed stale keys, replacements and byte-preservation comparison. Same-head local macOS T0 `npm run check` exit 0; targeted T1/T3 45/45 passed. Affected admission/merge files 12/12 passed before clean dev merge. Existing lint/duration policy is report-only. Source review queued; no full-suite/integrated receipt claimed. Mode-free hub verification follows a clear source verdict.

### rev-32 · 2026-10-20T10:08:14.373Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261020-956-source
commit: ab0e67bef0004e4e2ab5ddb5e8d318a80bbe7bdb
scope: full
findings: [{"severity":"medium","text":"The new refresh --add-only CLI invocation passes only cwd to execFile, inheriting HOME/XDG/Git/provider/account settings and lacking bounded fixture ownership. Route the changed CLI regression through a disposable sealed environment with scratch HOME/XDG/Git config, withoutExecutorCredentials applied last, and owned cancellation/close cleanup (rule 15).","file":"hub/test/durations.test.ts","line":45}]
finding_counts: {"high":0,"medium":1,"low":0}

## Standards

Medium — hub/test/durations.test.ts:45: The new refresh --add-only CLI invocation passes only cwd to execFile, inheriting HOME/XDG/Git/provider/account settings and lacking bounded fixture ownership. Route the changed CLI regression through a disposable sealed environment with scratch HOME/XDG/Git config, withoutExecutorCredentials applied last, and owned cancellation/close cleanup (rule 15).

Other reviewed source has no blocking findings. At base 608ca7715b64ef9979544fc5c2f04c7a5b2b8df8 (the actual merged dev parent), the T-956 diff excludes already-landed T-757/T-804 changes. The extracted identity matcher retains the duration ratchet's literal/template/computed semantics. Both working-tree and immutable lint read the boundary's own source set. New T1 formatting regressions check number spellings/allowance bytes and idempotence; immutable regression distinguishes dirty checkout repair from pinned tree repair. README, --help, stage-close agent docs, project Coordinator clause and merge skill match the add-only workflow.

## Spec

No functional findings. Add-only merges existing files/tests over newly observed data and retains allowances untouched, then inserts only missing map entries without reserializing old values. Source metadata updates are separate. C2 refuses unmatched duration tests/allow/file keys with the named key; computed titles intentionally remain uncertain. Coordinator excluded the absent census artifact and authorized deletion of the twenty stale production keys; the production manifest diff contains deletions only. C3 names --add-only in the stage-close step.

Source not clear at ab0e67bef0004e4e2ab5ddb5e8d318a80bbe7bdb pending the local fixture-isolation fix; no functional criterion is failed by this standards finding, and runtime-dependent C1/C2 remain unverified. No Reviewer runtime execution. Supplemental A-7345 reports macOS arm64/local T0 check at this head and targeted 45/45 T1/T3 tests, plus 12/12 affected admission/merge tests before the clean dev merge. Diagnostic lint/budget report mode is not a suite receipt. External Coordinator memory remains Coordinator-owned.

Totals: Standards 1 medium; Spec 0.

### impl-956 · 2026-10-20T10:09:11.927Z

Reviewer medium isolation finding fixed in 82273fcb (pushed): changed CLI regression uses scratchMachine + commandIn; final env filtered with withoutExecutorCredentials there and in new immutable regression. Local macOS targeted affected cases 2/2, typecheck exit 0. Requested fresh source review; no verification submitted before verdict.

### rev-32 · 2026-10-20T10:10:28.954Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261020-956-source-2
commit: 82273fcb64bf9d49835413a7180a91e0563b5e88
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

## Standards

No remaining findings at 82273fcb64bf9d49835413a7180a91e0563b5e88. Rechecked the original T-956 change and correction: the changed CLI regression now uses scratchMachine/commandIn for both full and add-only refresh, with scratch cwd/HOME/XDG/Git configuration, final withoutExecutorCredentials filtering, command timeout/cancellation ownership and close/result drainage before directory removal. The new immutable native regression uses the same final filter. Prior medium isolation finding resolved; no production source or dev merge changed after the first review.

## Spec

No findings. Add-only entry splicing retains old baseline/allowance bytes and number spellings, adds only missing entries and prints additions; source metadata is updated separately. Working-tree and immutable identity checks use their own source reader, retaining the existing literal/template/computed title semantics. Authorized stale-key cleanup remains deletion-only. CLI help, README, merge skill, project Coordinator clause and stage-close agent docs match the new flow. C3 verified by source.

Source clear only. C1/C2 final marks await mode-free same-head evidence plus retained targeted native proof, because task T0–T2 does not execute the durations.test.ts T3 CLI/immutable contracts. At this corrected tree the Implementer reports local macOS typecheck exit 0 and the two affected native cases 2/2 under a name pattern; all other cases were not rerun. Earlier A-7345 retains 45/45 targeted T1/T3 context and the authorized twenty-key mapping, not a full suite. No Reviewer runtime execution.

Totals: Standards 0; Spec 0.

Criteria: C3 verified.
