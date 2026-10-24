---
id: T-515
kind: task
title: RULES.md writer leaves a trailing blank line that trips git diff --check
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
regression_of: T-455
topic: topic-1009
branch: t/T-515-rules-md-writer-leaves-a-trailing-blank
created: 2026-10-15T16:44:45.990Z
updated: 2026-10-24T22:11:17.220Z
closed: 2026-10-24T22:11:17.220Z
---

## Summary

The rulebook writer (T-455) ends `.cland/RULES.md` with a blank line, `\n\n`. So `git diff --check` warns on every commit that carries it, and an implementer's commit chain stopped on that inherited warning on 2026-10-15 (T-485).

## Acceptance criteria

- [x] C1. `cland rule add/edit/retire` writes RULES.md ending in exactly one newline, and a test checks the written bytes.
  - done: impl-515 · 2026-10-24T21:52:53.507Z
  - verified: rev-26 [reviewer] · run rev-20261024-515-final-1 · 2026-10-24T22:05:18.993Z · commit f5f4e272b6a765bac2bcbf3c450875fac7b20f89
- [x] C2. The live RULES.md is normalised once, with `git diff --check` clean.
  - done: impl-515 · 2026-10-24T21:50:45.909Z
  - verified: rev-26 [reviewer] · run rev-20261024-515-source-2 · 2026-10-24T21:53:19.023Z · commit f5f4e272b6a765bac2bcbf3c450875fac7b20f89
  - verified: rev-26 [reviewer] · run rev-20261024-515-final-1 · 2026-10-24T22:05:18.993Z · commit f5f4e272b6a765bac2bcbf3c450875fac7b20f89

## Comments

### impl-515 · 2026-10-24T21:49:25.579Z

Implementation seam: existing T1 RulebookFile add/edit/retire API and readFile bytes, no hub/process required (correction to initial progress note's tier). This is an output-format bug fix, not a schema/wire/permission/admission contract change: parsed Rule fields and list membership stay unchanged. Consumer audit: RulebookFile is renderRulebook's sole production caller; rulebook.test.ts directly covers renderer and CRLF preservation; rule-cli.test.ts and rule-sessions-component.test.ts consume persisted rulebook through hub. Init emits RULEBOOK_HEADER, already one LF. Plan preserves internal sibling bytes while normalizing EOF; C2 removes only tracked trailing blank line.

### impl-515 · 2026-10-24T21:50:17.200Z

TDD on macOS, local worktree (uncommitted): node --test hub/test/rulebook-file.test.ts RED: 3 new generated cases failed (add/edit/retire), each actual <Buffer 0a 0a>, expected <Buffer 2e 0a>; 4 existing passed. GREEN after one-line RulebookFile write-boundary normalization: all 7 T1 cases pass. Test names: rulebook add writes exactly one final newline; rulebook edit writes exactly one final newline; rulebook retire writes exactly one final newline. The edit/retire cases leave the last sibling untouched to prove legacy EOF cleanup. The pure renderer is unchanged, so CRLF round-trip contract remains intact. Tracked .cland/RULES.md normalized; git diff --check clean. Typecheck pending; suite not run yet.

### rev-26 · 2026-10-24T21:52:15.918Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261024-515-source-1
commit: e9dd2de1b61902460ae4536a6326d0928ed67a79
scope: full
findings: [{"severity":"medium","text":"M1: three new byte regressions lack required canonical per-test guide/index entry. Add exact-path-headed docs/agents/tests/hub-test-rulebook-file.test.ts.md and Notes row, covering T1 add/edit/retire legacy EOF fixture and unchanged codec/CRLF boundary; preserve existing docs guard.","file":"hub/test/rulebook-file.test.ts","line":26}]
finding_counts: {"high":0,"medium":1,"low":0}

A-11515 full Standards/Spec audit: one medium docs finding, no functional Spec findings. Atomic common write boundary correctly normalizes EOF; parser/render codec, internal sibling bytes, guards/cleanup unchanged. T1 is lowest adequate seam; no new process/wait. C2 candidate bytes statically equal base minus one LF and read-only diff --check exits0; no live-root mutation/landing claim. A-11511 local7/7/typecheck are summary evidence with missing native durations/raw envelopes; no configured receipt. Add guide/index, direct docs guard, fresh committed-head source review before mode-free verify. Preserve original records without transcription reruns; no extra dev merge/QA.

Criteria: C1 failed (New C1 byte regressions lack matching per-file guidance/index required by rule16.).

### rev-26 · 2026-10-24T21:53:19.023Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-515-source-2
commit: f5f4e272b6a765bac2bcbf3c450875fac7b20f89
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11518 corrected full Standards/Spec clear: M1 exact-path guide/Notes row corrected, accurately scoped T1 seam/legacy EOF assertions/codec CRLF limits. Only two docs files differ from e9dd2de1; functional/test audit A-11515 carried unchanged. C2 candidate tracked bytes equal fixed base minus exactly one LF, diff --check exit0; verified without live-root mutation/landing claim. C1 runtime remains unverified. A-11516 retained red/green and docs3/3 local outputs/native durations keep uncommitted-tree/bounded-excerpt/summary limits. One unchanged-head f5f4e272 ordinary mode-free configured verify then original-receipt evidence review; no extra dev merge/QA/landing.

Criteria: C2 verified.

### rev-26 · 2026-10-24T22:05:18.993Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-515-final-1
commit: f5f4e272b6a765bac2bcbf3c450875fac7b20f89
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11531 audits raw A-11530 exact-head mode-free07f22efe: 3077 ordinary test/435 file passes, separately15 actual repetitions across three generated EOF identities5/5. add/edit/retire final persisted Buffer suffix '.\n' passes on legacy extra-EOF input, edit/retire leave last sibling untouched; all7 writer cases and3 unchanged pure codec/CRLF cases pass. C2 tracked normalization/diff-check source2 proof carried. Host gate tree56dba044 reused/not remote repeated; selectedT0/T1/fallback bothT2/Web green; T3/T4/integration/QA excluded. Report-only lint/duration/missing-baseline warnings and A-11516 local limits retained. C1/C2 verified. Lead fresh read-only conflict-check/ready report; Coordinator owns enqueue/merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T22:11:17.220Z

Merged 5774b3c3d53e4a28b9695c0a744eed8348490cdb onto dev.
