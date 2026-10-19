---
id: T-627
kind: task
title: A role's skills list in roles.toml can name a skill cland no longer ships, and nothing reports it
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - skills
assignee: null
parent: R-577
blocked_by: []
topic: topic-629
branch: t/T-627-a-role-s-skills-list-in-roles-toml-can
created: 2026-10-16T15:58:21.960Z
updated: 2026-10-19T19:53:52.204Z
closed: 2026-10-19T19:53:52.204Z
---

## Summary

E-615 drops 23 skills from the curated set (T-620). A project's `.cland/roles.toml` can still list a dropped or unknown skill for a role, and neither `cland doctor` nor the clause builder says so. Found while cutting E-615 (the ticket drafter's question 5); kept outside that epic.

## Acceptance criteria

- [x] C1. `cland doctor` warns for each role whose skills list names a skill that isn't in the project's skill set, naming the role and the skill, proved by a doctor test.
  - done: impl-627 · 2026-10-19T19:45:10.105Z
  - verified: rev-30 [reviewer] · run rev-20261019-627-final · 2026-10-19T19:45:44.411Z · commit 89145efaa227661384d6c9c5b02a4ba7ec84e0a0
- [x] C2. The role's clause and launch brief leave out an unknown skill instead of listing it, proved by a clause test.
  - done: impl-627 · 2026-10-19T19:45:11.677Z
  - verified: rev-30 [reviewer] · run rev-20261019-627-final · 2026-10-19T19:45:44.411Z · commit 89145efaa227661384d6c9c5b02a4ba7ec84e0a0

## Comments

### impl-627 · 2026-10-19T19:23:36.612Z

Building on current origin/dev. Agreed seams from C1/C2: doctor's structured report (T2 CLI) and role clause/launch brief output (lowest adequate tier). Will validate against the project's actual .agents/skills set, preserving valid project-owned additions.

### impl-627 · 2026-10-19T19:26:49.448Z

Committed/pushed 5f0ad0e4869820880541396c70428893a698157d; evidence A-6409. New doctor and clause/launch regressions each proved red then green. Targeted doctor 18/18, role components 5/5; typecheck and test:lint exit0 (existing report-only lint findings). Pre-review origin/dev merge current and mandated pre-push fetch/merge-tree exit0. Source review requested through Reviewer role; hub queued it for the next free live verifier. No per-item QA required.

### rev-30 · 2026-10-19T19:28:22.432Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-627-source
commit: 5f0ad0e4869820880541396c70428893a698157d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6415 Standards/Spec source clear. Shared usable project-skill inventory drives per-role doctor warnings and filtered instruction copies across delivered clauses/frames/native launch input; configured role permissions/launch policy unchanged. Local and linked skills retained, empty/broken/missing excluded, empty heading omitted. ExistingT2 seams appropriate, assertions preserved. Reported18/18+5/5 supporting only; C1/C2 await exact-head mode-free evidence.

### impl-627 · 2026-10-19T19:36:29.339Z

Linux run 7229969a/A-6433 exit1 only in the two verify-tool cases covered by the Coordinator's launch-authorized T-891 shared fix. Both T-627 regressions passed ordinary and 5/5 load repetitions. Applied only a7159290 + 67a01b6f as bae9505d + 89145efa; no dev merge or task implementation change. Pushed new head 89145efaa227661384d6c9c5b02a4ba7ec84e0a0 after required fetch/merge-tree exit0 (tree 5a36bc33fea0333175daf9a480eaad4a6d03a965). Requesting fresh source review before verification retry.

### rev-30 · 2026-10-19T19:38:03.928Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-627-shared-fixture-source
commit: 89145efaa227661384d6c9c5b02a4ba7ec84e0a0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6446 Shared-fix source clear: only verify-tool+7/-1, exact finalT891 blob; all original T627source unchanged/assertions retained. PriorA6433red onlyinheritedT891controls; both ownedC1/C2 ordinary+5/5pass audited but historical. No current-head criteria verified until replacement mode-free green.

### impl-627 · 2026-10-19T19:45:19.162Z

Same-head post-review verification ac212ba6 / A-6477 passed at 89145efaa227661384d6c9c5b02a4ba7ec84e0a0: 1634/1634, zero failures/skips; both owned C1/C2 regressions passed ordinary and 5/5 load. Linux x64 droplet c-8 lon1, lifetime340s, cost$0.0236. Queue-enabled T0–T2 proof; T3 remains deferred to integrated occasions per receipt. Claimant done marks recorded for C1/C2; awaiting Reviewer final settlement. Working tree clean; no source changes since review.

### rev-30 · 2026-10-19T19:45:44.411Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-627-final
commit: 89145efaa227661384d6c9c5b02a4ba7ec84e0a0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at exact unchanged 89145efa. Raw mode-free ac212ba6/A-6477 audited:1634/1634 zero fail/cancel/skip/TODO, all47groups5/5, no resource/owned budget rows. C1 doctor .076546190s +5/5max.104364180; C2 actual clause/launch .221726163s +5/5max.203561042, all<T2 2s. C1/C2 verified across A-6415 full source, A-6446 shared delta and A-6479 final audit. Prior A-6433 red historical only. Linux lifetime340s/$0.0236; T3 periodic/integrated, QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T19:46:31.565Z

Citation correction (Coordinator, for rev-30): verdict rev-20261019-627-final names A-6479 in its text; the final audit is A-6481. Head 89145efa, evidence and the clear C1/C2 disposition are unchanged.

### coord · 2026-10-19T19:53:52.204Z

Merged 93dcac022eff1e382f2557fbe1819ea847e1970e onto dev.
