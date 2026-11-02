---
id: T-1632
kind: task
title: "Config: merge batches of five, T1+T3 batch tiers and eight remote slots"
state: open
status: ready
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: topic-1336
branch: t/T-1632-config-merge-batches-of-five-t1-t3-batch
created: 2026-11-02T09:40:22.301Z
updated: 2026-11-02T10:01:07.828Z
---

## Summary

Apply the human's 2026-11-02 09:39Z decision (Discord, General): merge batches of up to five items, merge batch tiers T1 and T3, and eight remote droplet slots. The repository config and the test that pins this repository's merge settings change together, so dev never goes red on the pin (as it did with e818d2dc on 2026-11-01, fixed by T-1581).

## What to build

In `.cland/config.toml`: `[merge] batch = 5`, `batch_tiers = ["T1", "T3"]`, `[verification] remote_budget = 8`, each with a dated comment naming the human decision. In `hub/test/init-config.test.ts`, the "this repository" test pins the new values. Rule 6 is already updated (RULES.md, 2026-11-02).

## Acceptance criteria

- [x] C1. `.cland/config.toml` sets `merge.batch = 5`, `merge.batch_tiers = ["T1", "T3"]` and `verification.remote_budget = 8`, each with a comment naming the 2026-11-02 09:39Z human decision.
  - done: impl-1632 · 2026-11-02T09:42:28.585Z
  - verified: rev-35 [reviewer] · run rev-35-1632-source-1 · 2026-11-02T09:43:13.034Z · commit 8f4f5c4075c89554be5b1af4cecc612fbd97be03
  - verified: rev-35 [reviewer] · run rev-35-1632-final-1 · 2026-11-02T10:01:07.598Z · commit 8f4f5c4075c89554be5b1af4cecc612fbd97be03
- [x] C2. `hub/test/init-config.test.ts`'s repository test asserts the new batch tiers and passes; every other config test passes unchanged (test).
  - done: impl-1632 · 2026-11-02T09:42:28.660Z
  - verified: rev-35 [reviewer] · run rev-35-1632-final-1 · 2026-11-02T10:01:07.598Z · commit 8f4f5c4075c89554be5b1af4cecc612fbd97be03
- [x] C3. `cland config` parsing of the repository config reports the three new values (test or recorded command output).
  - done: impl-1632 · 2026-11-02T09:42:28.743Z
  - verified: rev-35 [reviewer] · run rev-35-1632-final-1 · 2026-11-02T10:01:07.598Z · commit 8f4f5c4075c89554be5b1af4cecc612fbd97be03

## Comments

### impl-1632 · 2026-11-02T09:41:13.705Z

Consumer search across hub/test and nvim/test for config.toml, remote_budget/remoteBudget, batch/batchTiers/batch_tiers: repository reads found only init-config.test.ts:173 and merge-queue.test.ts:39 (queue boolean only). Other matches use fixture roots/defaultConfig and remain unchanged. Repository pin now checks all three parsed values; red-first run: 16/17 passed, repository case failed 3 !== 5. Scope is two files; no generated-default/command/schema change, so no help/skill change needed; dated config comments replace superseded project policy.

### rev-35 · 2026-11-02T09:43:13.034Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1632-source-1
commit: 8f4f5c4075c89554be5b1af4cecc612fbd97be03
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. C1 verified: repository merge.batch5/batch_tiers[T1,T3]/verification.remote_budget8, each comment names2026-11-02 09:39Z human Discord decision. Repository test uses production parseConfig and asserts all three; queue/default-off/devT3Every and all other tests unchanged. Two-file scope, no generated default/schema/command/role permission change; matching docs correctly describe unchanged defaults, dated config comments replace project policy. Consumer inventory checked: init-config pin and merge-queue queue-only repository readers; config-reload6 values are isolated fixtures. C2/C3 remain unverified until named exact-head queued outcomes. A-15776 localMac17/38/static reports are targeted, not queued evidence. A-15777 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15777-t-1632-source-review-at-8f4f5c407.md) records standards/spec review. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified.

### rev-35 · 2026-11-02T10:01:07.598Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1632-final-1
commit: 8f4f5c4075c89554be5b1af4cecc612fbd97be03
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear, C1–C3 verified. Independently matched A-15782 same-head init-config17 pass facts including repository parser pin line1984 for all5/[T1,T3]/8 values;16 other config cases unchanged. Merge-queue38/config-reload-component12 pass. C1 dated comments/settings established by source review. Queuedc751ed55 exit0/4712pass/zero fail,cancel,skip,todo; T0/T1/all fallbackT2/Web complete, config unsupported path causes fallback. T3 deferred to batch,T4 unexecuted, no full premerge claim. Treeea8726022934292e9b664bf6ef5ce2cf74ade714; host typecheck at that tree not repeated remotely. Linuxx64 6.8.0-142-generic c8sfo2 Node24.21/Nvim.12.5 workers2; isolatedHeadlessShell1248/ChromeForTesting156.0.8078.4; cache/occasionnull,skips[],skipreasonreport/missing0. Duration/lint/ratchet report-only; executor970s not suite walltime. A-15783 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15783-t-1632-final-evidence-review-at-8f4f5c407.md) records evidence. No findings; reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified.
