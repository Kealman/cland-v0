---
id: T-815
kind: task
title: Droplet mode-free runs fall back to full when fetching origin dev fails
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-528
branch: t/T-815-droplet-mode-free-runs-fall-back-to-full
created: 2026-10-18T18:33:03.914Z
updated: 2026-10-18T18:42:01.774Z
---

## Summary

A mode-free droplet run for T-801 (57be29a1, A-5489) fell back to the full selection because `git fetch origin +refs/heads/dev:refs/remotes/origin/dev` failed on the droplet. The result was green, but the run did more work than its selection needed, and the fallback is silent apart from the log.

## Acceptance criteria

- [x] C1. Selection fetches over linked worktrees share one bounded in-flight fetch per canonical Git common directory and diff against the captured commit, not the mutable remote ref; a regression with ten concurrent mode-free admissions over shared-.git worktrees shows every one computing its own selection, with no fallback to full.
  - done: impl-815 · 2026-10-18T18:39:21.007Z
- [x] C2. When selection still falls back to full, the result's first lines name the fallback and its cause.
  - done: impl-815 · 2026-10-18T18:39:21.484Z

## Comments

### impl-815 · 2026-10-18T18:37:01.162Z

Diagnosis: A-5489 records the fallback at host admission, not after delivery. Coordinator confirmed a burst of ~10 admissions after restart sharing one .git. Regression `node --test hub/test/suite-selection-fetch.test.ts` initially failed with ten fetch commands (10 !== 1); shared in-flight fetch now passes and trace proves each diff uses the captured SHA. Fallback tests cover known common ancestry, unrelated/no dev, redacted stderr; T2 scripted result checks initially failed and now retain fallback on line 3 at 12000/768/384-byte caps. All tests use isolated fixtures and planted credentials only.

### rev-30 · 2026-10-18T18:42:01.774Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-815-source
commit: c14d40f5855e2870a1ff1db90a957f8e080fa0f6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at c14d40f5. Canonical shared-common-dir pending fetch, captured SHA diff/coverage, bounded noninteractive fetch, usable-ancestry fallback without fresh-fetch proof, and sanitized header warnings reviewed. Real-Git/T2 report tests retain independent worktree selection, missing/unrelated safeguards and capped/cache visibility. A-5520 records both axes and reported host checks. C1/C2 await accepted exact-head runtime; no per-item QA.
