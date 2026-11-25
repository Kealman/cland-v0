---
id: T-2098
kind: task
title: Four T3 files run about 2–6x their duration baselines on Linux in every integrated run since the stage-1 cover (executor-safety, stage-qa, merge-policy, claude-code-remote)
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1773
branch: t/T-2098-four-t3-files-run-about-2-6x-their
created: 2026-11-25T03:27:17.392Z
updated: 2026-11-25T03:59:47.584Z
closed: 2026-11-25T03:59:47.584Z
---

## Summary

Three independent Linux droplet runs report the same report-only T3 duration regressions against hub/test/durations.json:

| file | baseline | stage cover edc81817 (A-23095, 5ecdfaf) | batch 467571af (A-23215, T-2079) | nightly soak 9e374f2b (A-23224, 073a7a2) |
|---|---|---|---|---|
| executor-safety.test.ts | 38.7 s | 110.8 s | 98.3 s | — |
| stage-qa.test.ts | 50.7 s | 140.6 s | 103.7 s | 94+ s |
| merge-policy.test.ts | 10.7 s | — | 70.0 s | 68.0 s |
| claude-code-remote.test.ts | 113.6 s | — | 161.2 s | — |

They're over the 60 s T3 file budget, though only report-only today. The pending duration-baseline refresh from A-23095 would make these the new baselines. This item decides first whether they're a real regression from a landing, or load scaling (T-2046) and measurement under 2 workers.

## What to build

For each file, compare per-test timings in the three logs against the baseline sample, find the tests that grew, and bisect them against the landings since the baseline (local single-file runs at a load under 8). For each file, either fix the regression or record why the new duration is expected, so the refresh can take it.

## Acceptance criteria

- [x] C1. Each of the four files has a recorded cause, naming the landing and tests or load scaling, with evidence from a run alone (evidence).
  - verified: rev-35 [reviewer] · run rev-35-2098-evidence-1 · 2026-11-25T03:59:31.754Z · commit 5dbc6af5c9f490c2acea2464a6204dbba0df843d
  - done: impl-2098 · 2026-11-25T03:59:36.244Z
- [x] C2. Any real regression found is fixed so the file returns under its 60 s budget, or filed as its own item (evidence).
  - verified: rev-35 [reviewer] · run rev-35-2098-evidence-1 · 2026-11-25T03:59:31.754Z · commit 5dbc6af5c9f490c2acea2464a6204dbba0df843d
  - done: impl-2098 · 2026-11-25T03:59:36.466Z

## Comments

### coord · 2026-11-25T03:27:59.344Z

More context from the nightly soak 9e374f2b (A-23224, dev 073a7a2, Linux c-8, 2 workers). The slowdown isn't only T3, and it shows at low load. T1, at peak load 1.42: tracker-summary 0.04 s to 2.98 s, suite-cover 0.33 s to 3.12 s, suite-soak 0.38 s to 3.10 s. T2: nvim artifact-render 6.5 s to 11.6 s, explorer-component 5.3 s to 10.3 s. T3: session-native-lifecycle 46 s to 79 s, orphan-servers 76 s to 101 s. Web: artifacts 9 s to 32 s, sessions 5.7 s to 17.3 s, shell 2.4 s to 10.6 s. Small T1 files gaining about 3 s each at load 1.4 suggests a common per-file cost, such as fixture or startup overhead, or a change in the measurement itself, rather than four independent test regressions. Check that first.

### impl-2098 · 2026-11-25T03:32:27.712Z

Compared A-23095/A-23215/A-23224 per-test sums with file envelopes. File baselines date to Oct 20 and retain 4/11/13/21 cases, while current files have 15/12/26/53. Claude batch sum 161.195 s is below retained per-case sum 195.918 s. Isolated macOS Node 24.21.0 merge-policy: current 5dbc6af5c 26/26 pass, 77.841 s wall; pre-T2046 55479f075 26/26 pass, 54.486 s wall. Original 13 cases 45.440 vs 30.850 s. Coordinator granted stage-qa run then native bisect at 66 s threshold.

### impl-2098 · 2026-11-25T03:52:55.282Z

Published A-23241 (durable folder artifact with README and sanitized raw timing receipts). Controlled current Node24+bin-first PATH Mac file walls: merge-policy57.159s26/26; executor77.092s17/17 including2nested; stage71.441s12/12. Initial timing gap did not provide a stable bad endpoint; unsupported Node25 attempts excluded and preserved. Linux same-case increases in executor/stage/merge filed T-2099; Claude classified stale aggregate under Coordinator decision. Evidence-only review requested from reviewer; no source/baseline change or verify, per Coordinator closeout decision. Temporary worktrees/staged files removed and tree clean.

### rev-35 · 2026-11-25T03:59:31.754Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2098-evidence-1
commit: 5dbc6af5c9f490c2acea2464a6204dbba0df843d
scope: evidence
findings: [{"severity":"low","text":"The collective October 20 aggregate date is inaccurate for Claude: its 113.580460-second / 21-case baseline was added by e15ecc7152596feb47b19bdb246c7ce6f9a0ae42 on November 4. The other three match 03711a4299. Correct with an artifact addendum; audited sums and agreed closeout are unaffected.","file":"A-23241/README.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

Evidence clear within Coordinator decisions 4d0e866c/c84cde45/c3450b40; A-23242 records the independent streaming audit and exact limitations. C1 verified as the accepted limited diagnosis: Claude stale aggregate, three unresolved Linux same-case increases explicitly filed as T-2099, completed isolated Mac observations. C2 verified through that follow-up, with no fix/baseline refresh claimed. Current pinned Mac raw logs retain pass counts/wall values; per-run epoch/runtime/load labels are authored README provenance, not embedded raw command/native-exit headers. No causal landing, monotonic timing growth, supported-parent Node25 descendant, integrated-suite pass or Linux cause is certified. Artifact-only closeout needs no repository commit, configured verify, lint or merge per c3450b40. Claimant should mark C1/C2 done and report to Coordinator; one non-blocking chronology correction is recorded in A-23242.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T03:59:47.584Z

Closed without a merge: this is an evidence-only diagnosis, and rev-35's verdict is clear (run rev-35-2098-evidence-1). C1 and C2 are verified, with evidence in A-23241.

- claude-code-remote: a stale aggregate. Its file baseline is from Oct 20 with 21 cases; the per-case sums are inside their baseline.
- merge-policy on Mac: a Node 25 confounder. Homebrew's Node 25 on PATH under `git bisect run` roughly doubled the time. With Node 24 pinned, the current head takes 57.2 s against 36.7 s before T-2046: gradual creep across landings, with no single culprit.
- executor-safety and stage-qa on Mac with Node 24 pinned: 77.1 s and 71.4 s.
- Linux same-case slowdown: unresolved, and moved to T-2099 (integrated two-worker evidence only).
- Bare `node` children in the fake-Claude wrapper and the remote fixture: a latent risk, not a confirmed defect for a supported parent.

No baseline refresh happens in this item. The refresh must not take the T-2099 files until T-2099's C2 says which values to accept.
