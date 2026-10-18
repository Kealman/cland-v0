---
id: T-622
kind: task
title: Each kept upstream skill records its origin and changes in its header; skills-lock.json and PATCHES.md go
state: open
status: ready
size: S
criterion_seq: 7
labels:
  - v0.1.4
  - skills
assignee: null
parent: E-615
blocked_by:
  - T-620
  - T-621
topic: topic-524
branch: t/T-622-each-kept-upstream-skill-records-its
created: 2026-10-16T15:57:48.844Z
updated: 2026-10-18T17:16:28.345Z
---

## Summary

Replace `skills-lock.json` and `skills/PATCHES.md` with a metadata header in the frontmatter of each of the 15 kept upstream skills: the origin commit in `mattpocock/skills`, the MIT notice, and one line of cland's changes, including the ones PATCHES.md never recorded.

## What to build

Each kept upstream skill's `SKILL.md` frontmatter gains a `metadata` block with two plain strings: `origin`, naming the upstream path and commit the copy was taken from with the MIT notice ("MIT, Copyright (c) 2026 Matt Pocock"), and `changes`, one line listing cland's changes with their tickets. The origins and changes are those of Q-595's table (`docs/research/skills-triage.md` on research/skills-triage, section 2.3), restricted to the 15 kept skills and extended with this epic's own changes: the fallback line pointing at `cland update` (01) and the Codex flag following the frontmatter (02). Skills cland never changed say `none`. The details stay in git history.

`skills-lock.json` and `skills/PATCHES.md` are deleted. `skills/README.md` describes the curated set instead: cland's own skills and the kept upstream ones, edited in place, each upstream skill's origin in its header, and how to take an upstream improvement (a diff of the upstream folder from the origin commit). Claude Code and Codex still load every kept skill with the new frontmatter.

## Acceptance criteria

- [x] C1. Each of the 15 kept upstream skills carries `metadata.origin` with its upstream path, its origin commit and the MIT notice, and `metadata.changes` with one line of cland's changes or `none`.
  - done: impl-622 · 2026-10-18T16:25:23.696Z
  - verified: rev-31 [reviewer] · run rev-20261018-622-source · 2026-10-18T16:29:25.416Z · commit 561d52760b33b9d7b95e62a604d42c0757db10dd
- [x] C2. The changes lines include every change Q-595 found unrecorded: T-156, T-178, T-108 C9 and T-477 in code-review, T-226 in implement, T-335 and T-473 in to-tickets, and the model-invocable change of implement, retro, to-spec, to-tickets, triage and wayfinder.
  - done: impl-622 · 2026-10-18T16:25:25.583Z
  - verified: rev-31 [reviewer] · run rev-20261018-622-source · 2026-10-18T16:29:25.416Z · commit 561d52760b33b9d7b95e62a604d42c0757db10dd
- [x] C3. The changes lines of code-review, to-spec, to-tickets, triage and wayfinder name the fallback pointing at `cland update`.
  - done: impl-622 · 2026-10-18T16:25:29.384Z
  - verified: rev-31 [reviewer] · run rev-20261018-622-source · 2026-10-18T16:29:25.417Z · commit 561d52760b33b9d7b95e62a604d42c0757db10dd
- [x] C4. A new test parses the frontmatter of every kept upstream skill and fails when `metadata.origin` lacks a commit hash or the MIT notice, or when `metadata.changes` is empty.
  - done: impl-622 · 2026-10-18T16:25:30.583Z
  - verified: rev-31 [reviewer] · run rev-20261018-622-final · 2026-10-18T17:16:27.917Z · commit 561d52760b33b9d7b95e62a604d42c0757db10dd
- [x] C5. `skills-lock.json` and `skills/PATCHES.md` no longer exist, and neither `skills/README.md` nor `docs/agents/` names them (the comment in the init code that names them is rewritten by the manifest ticket, 04).
  - done: impl-622 · 2026-10-18T16:25:31.689Z
  - verified: rev-31 [reviewer] · run rev-20261018-622-source · 2026-10-18T16:29:25.417Z · commit 561d52760b33b9d7b95e62a604d42c0757db10dd
- [x] C7. Each kept upstream skill folder also carries the upstream LICENSE file, so the full MIT notice travels with the copies, and the C4 test checks it is present.
  - done: impl-622 · 2026-10-18T16:25:32.739Z
  - verified: rev-31 [reviewer] · run rev-20261018-622-source · 2026-10-18T16:29:25.417Z · commit 561d52760b33b9d7b95e62a604d42c0757db10dd

## Comments

### coord · 2026-10-16T16:00:48.514Z

Coordinator, 2026-10-16: C6 (Claude Code and Codex sessions listing every kept skill after a fresh init) was removed from this ticket. It's verified at E-615's epic demo (DoD C2/C3, read by QA). This ticket's C4 test guards the headers.

### impl-622 · 2026-10-18T16:25:35.039Z

Implemented and pushed 561d52760b33b9d7b95e62a604d42c0757db10dd. Evidence: A-5423 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-5423-t-622-provenance-headers-and-validation.md). T0 guard red/green plus four mutation probes; test:lint and typecheck passed. origin/dev merged before first source review (tracker-only changes). No per-item QA required by qaPolicy. Awaiting source review before mode-free droplet verification.

### rev-31 · 2026-10-18T16:29:25.417Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-622-source
commit: 561d52760b33b9d7b95e62a604d42c0757db10dd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-622 source review

Head: 561d52760b33b9d7b95e62a604d42c0757db10dd
Scope: full. Task diff reviewed against dev parent 0e7f8b6c1cde680b127db79fdd6ddc43389b9f47 (the merge's other parent is the implementation).

Standards: clear. The T0 guard reads repository files, parses YAML frontmatter, rejects absent/invalid origin strings, missing attribution, empty or multiline changes, and absent LICENSE files. It is wired into test:static/test:lint. No process boundary or test-tier mismatch is introduced. All 15 LICENSE copies are byte-identical and contain the complete MIT notice.

Spec: clear. All 15 paths and origin commits match Q-595 section 2.3 and the kept set in v0.1.4 section 3.6. Required previously unrecorded changes, six invocation changes, five fallback adaptations, T-621 and D53 are recorded. Existing skill bodies are byte-identical to the base. Both retired files are absent; README and docs/agents contain no references to them. README describes the curated set and the upstream-folder diff workflow. The init-code comment is explicitly deferred by C5. C6 was explicitly removed by Coordinator and remains epic-level harness evidence.

Findings: none.
Verified by source: C1,C2,C3,C5,C7. C4 execution evidence remains unverified pending exact-head task verification. A-5423 reports a red/green static guard and four rejected mutations; this source pass does not claim the task verification has run.

Evidence: A-5431.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified, C7 verified.

### impl-622 · 2026-10-18T16:30:16.414Z

Source review clear: rev-20261018-622-source at 561d5276, A-5431. Verification submission sent before Coordinator's T-813 hold reached this session; CLI timed out awaiting reply at 15s and subsequent queue read showed no T-622 run. No resubmission; waiting for Coordinator all-clear. Reviewed head unchanged.

### impl-622 · 2026-10-18T17:16:10.880Z

Exact-head droplet verification 9eaf7935-87a3-4508-803a-26e434b4d71b passed at 561d52760b33b9d7b95e62a604d42c0757db10dd: 2631 tests, 2623 pass, 0 fail, 8 skipped. A-5484 line 37 confirms C4 guard execution: 'skill provenance lint: 15 upstream headers and MIT licenses checked'. Linux x64, droplet c-8 lon1, lifetime 1667s, $0.1157. Reviewed head unchanged. Waiting Reviewer evidence/final verdict; no additional run requested.

### rev-31 · 2026-10-18T17:16:27.917Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-622-final
commit: 561d52760b33b9d7b95e62a604d42c0757db10dd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-622 final evidence review

Head: 561d52760b33b9d7b95e62a604d42c0757db10dd, unchanged source-reviewed/pushed head.
Scope: evidence. Run 9eaf7935-87a3-4508-803a-26e434b4d71b / A-5484, full exit0.

C4 execution is positively observed: log line29 runs test:static with lint-skill-provenance.ts, and line37 reports 'skill provenance lint: 15 upstream headers and MIT licenses checked'. The reviewed guard parses all 15 frontmatters and rejects missing origin commit/MIT attribution, empty changes and absent licenses; A-5423 retains the reported red/green and four mutation-probe evidence. This final pass completes C4 alongside current source marks C1/C2/C3/C5/C7 (rev-20261018-622-source/A-5431).

The full run completes2631 ordinary tests:2623 pass,0 fail,0 cancelled,8 availability skips; all three failure arrays empty. Hub free284/284; machine1967 pass+5 skip; Neovim372 pass+3 skip,185.68s. Four unchanged report-only runtime tier trips are outside the task's diff; no global-zero claim. No task-owned guard failure or quarantine substitution.

Linux x64 c-8lon1,workers2,Node24.21.0/Neovim0.12.5; lifetime1667s,cost$0.1157,peak load8.76. Findings:none. C4 verified; all six extant criteria have current verification across source and final passes. C6's removed harness-listing check remains an epic demo responsibility under the recorded Coordinator decision; no per-item QA or additional task run is needed.

Review evidence: A-5486.

Criteria: C4 verified.
