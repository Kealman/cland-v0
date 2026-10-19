---
id: T-861
kind: task
title: Synchronous territoryGit trims -z output, so path censuses can rewrite a whitespace-prefixed filename before path policy
state: open
status: review
size: S
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-601
branch: t/T-861-synchronous-territorygit-trims-z-output
created: 2026-10-19T08:23:21.387Z
updated: 2026-10-19T15:01:23.799Z
---

## Summary

The synchronous `territoryGit` runner trims Git's output, including `-z` NUL-delimited output, so a path census can rewrite a first filename that starts with whitespace (for example ` docs/input.ts` → `docs/input.ts`) before path policy is applied. Path policy could then wrongly allow or refuse a path.

## Evidence

Found aside by impl-831 on 2026-10-19 while fixing source-review finding M1 of T-831. T-831 fixes the async adapter used by batch comparison and its async callers; the synchronous runner and other delimited Git consumers are not covered.

## Acceptance criteria

- [ ] C1. The synchronous territory Git runner and every remaining consumer of `-z` or otherwise delimited Git output keep paths byte-exact (no trimming of path content); the audit lists each consumer in the commit, and a regression test with a whitespace-prefixed and a whitespace-suffixed filename fails before the fix.

## Comments

### impl-861 · 2026-10-19T14:52:14.677Z

Implementation audit found unconditional trimming in territoryGit and tracker/verdict-git.gitIn, plus non-NUL duration diff/worktree/sync-conflict path parsing. Added native Git regression with leading/trailing whitespace and newline filenames; before fix it fails with ' leading.ts' rewritten to 'leading.ts'. Updated streams preserve -z/--null; targeted adapter regression and T1 duration-context file are green. Full audit inventory will be included in commit.

### rev-31 · 2026-10-19T15:01:23.799Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-861-source
commit: 5bcd25f3119c44b8eda8dede7bb3bfe235443678
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-6123 records the full two-axis pinned consumer audit. Three Git adapters preserve -z/--null stdout, scalar trimming remains; worktree porcelain and sync conflicts use NUL fields without normalizing filename content; duration diffs now use -z. Existing init, merge/queue/batch, epic surfaces, selection/shards and tree-source consumers independently checked against A-6106/commit audit. Native regressions cover leading/trailing spaces, newline paths, original path-policy input, --null config/scalar compatibility and newline worktree roots; T1 regression covers exact duration-source paths. No original assertions removed or new hub/harness starts/sleeps. Supplied targeted files green. Candidate manifest remains report mode; independently read Coordinator28fe56da supersedes751ce049 and accepts two native T3 identities (measured0.311s/0.155s) without allowance, preserving assertions. No unresolved findings. C1 final execution verification pending same-head mode-free gate; native T3 Linux remains landing/batch evidence.
