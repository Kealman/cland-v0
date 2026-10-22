---
id: T-1145
kind: task
title: Skill provenance 'changes' line forces a merge conflict on every ticket that edits a skill
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-377
blocked_by: []
topic: topic-859
branch: t/T-1145-skill-provenance-changes-line-forces-a
created: 2026-10-22T16:09:09.611Z
updated: 2026-10-22T16:33:05.558Z
---

## Summary

The skill provenance lint requires each skill's `metadata.changes` to be one line, and tickets append their own entry to that line in `.agents/skills/implement/SKILL.md`. Any two tickets in flight that both touch the skill therefore conflict. On 2026-10-22 T-1116 and T-1117 each needed a dev merge, a delta review and a fresh verify after T-1109 and T-1116 landed, purely for this line.

## What to build

Per-ticket provenance entries no longer share one line. For example, `changes` keeps a short stable summary and the entries move to a per-skill list whose lines append independently (a union-merged file, or one entry per line). The lint still requires a provenance record for cland's edits, and existing entries move over unchanged.

## Acceptance criteria

- [x] C1. Two branches that each add a provenance entry to the same skill merge without a conflict (test).
  - verified: rev-26 [reviewer] · run rev-20261022-1145-final-1 · 2026-10-22T16:30:46.110Z · commit 7b6f984a23289fc4fa505a38ad56482d28d23219
  - done: impl-1145 · 2026-10-22T16:32:12.024Z
- [x] C2. The provenance lint still fails a skill with cland edits and no provenance entry, and passes every current skill after the migration (test).
  - verified: rev-26 [reviewer] · run rev-20261022-1145-final-1 · 2026-10-22T16:30:46.110Z · commit 7b6f984a23289fc4fa505a38ad56482d28d23219
  - done: impl-1145 · 2026-10-22T16:32:12.092Z

## Comments

### impl-1145 · 2026-10-22T16:10:50.775Z

Implementing conflict-free provenance with a per-skill CHANGES file and local .gitattributes (merge=union). Test-first seams: native sealed Git merge after skill provisioning (C1), provenance gate rejection/current-skill acceptance (C2).

### impl-1145 · 2026-10-22T16:15:21.421Z

Committed and pushed 7b6f984a23289fc4fa505a38ad56482d28d23219. C1/C2 done; source review requested from Reviewer in topic-859. Evidence A-9287 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9287-t-1145-provenance-migration-and-test-first-evidence.md. Targeted macOS checks passed; full exact-head verification awaits clear source verdict.

### rev-26 · 2026-10-22T16:19:07.346Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1145-source-1
commit: 7b6f984a23289fc4fa505a38ad56482d28d23219
scope: full
findings: [{"severity":"low","text":"L1: Scope the CHANGES/union-attribute wording to the 15 kept upstream skills; cland-owned curated skills do not carry those files. The opening init/skills.ts comment repeats the same overbroad wording.","file":"hub/README.md","line":1697}]
finding_counts: {"high":0,"medium":0,"low":1}

Source clear at 7b6f984a; A-9294 records both axes. All 15 original provenance strings are preserved verbatim, with stable pointers and portable union attributes. Native Git test matches merge-tree/one-parent squash operations after provisioning; isolation, cleanup and T1/T3 membership are appropriate. L1 is documentation scope wording only. C1/C2 remain run-dependent and unverified pending unchanged-head configured evidence plus attributable native Git T3 execution; A-9287 is qualified precommit development evidence, not final proof.

### impl-1145 · 2026-10-22T16:29:44.450Z

Exact reviewed head 7b6f984a23289fc4fa505a38ad56482d28d23219: configured mode-free verify 94aa4b25-a20e-4712-842e-69dba0c1b561 completed exit 0 on local darwin arm64 (droplet size unavailable fallback), Node v24.21.0 / Neovim v0.12.5, T0 plus all T1 and fallback all T2 across both packages plus Web. Hub reports 2468 tests passed, none failed/cancelled/skipped/todo. Budget and test-lint diagnostics report-only, 0 lint refusals; no full T3/T4 or Linux claim. Log A-9312: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9312-suite-94aa4b25-a20e-4712-842e-69dba0c1b561-auto-at-7b6f984.log. Separate targeted C1 native-Git T3 exact-head pass retained in A-9295. Awaiting Reviewer final settlement; head unchanged.

### rev-26 · 2026-10-22T16:30:46.110Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1145-final-1
commit: 7b6f984a23289fc4fa505a38ad56482d28d23219
scope: evidence
findings: [{"severity":"low","text":"L1 retained: scope CHANGES/union-attribute wording to the 15 kept upstream skills; cland-owned curated skills do not carry those files. The opening init/skills.ts comment repeats this wording.","file":"hub/README.md","line":1697}]
finding_counts: {"high":0,"medium":0,"low":1}

Final evidence clear; C1/C2 verified. A-9314 settles unchanged-head configured94aa4b25/A-9312 (2468/2468 ordinary passes, T0/allT1/all-fallbackT2/Web, local Darwin arm64 after c-8 capacity fallback) plus A-9295's exact-head single native Git T3 pass. C2 includes the all15 provenance gate and actual five distinct load-gate passes. Report-only lint/duration warnings and source L1 retained. No Linux/fullT3/T4/integrated-cover/QA claim; no merge performed.

Criteria: C1 verified, C2 verified.

### impl-1145 · 2026-10-22T16:32:12.159Z

Coordinator-authorized dev merge pushed as 84dc2a9ad107b98c340e815715a11a03cf02cc8d. Exactly one incoming provenance entry moved unchanged: human kinds and queued withdrawal (T-1117). Stable pointer retained. Post-resolution lint all15 passed; exact committed-head targeted C1/C2 tests passed (2/2) local macOS, retained A-9315 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9315-t-1145-authorized-dev-merge-and-exact-head-regression-receipt.md. Delta review requested; fresh configured verification follows source clear.

### rev-26 · 2026-10-22T16:33:05.558Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1145-source-2
commit: 84dc2a9ad107b98c340e815715a11a03cf02cc8d
scope: delta
findings: [{"severity":"low","text":"L1 retained, follow-up T-1146: CHANGES/union-attribute wording applies to the 15 kept upstream skills, not every cland-owned curated skill; init/skills.ts opening comment repeats it.","file":"hub/README.md","line":1697}]
finding_counts: {"high":0,"medium":0,"low":1}

Delta source clear; A-9317 records the Coordinator-authorized merge and both-parent comparison. All prior task CHANGES entries survive; exactly one incoming T-1117 entry is preserved verbatim in CHANGES, with its body guidance retained and stable pointer unchanged. Owned lint/tests byte-identical; incoming accepted T-1117 code is unmodified. Existing low L1 remains tracked as T-1146. A-9315 supplies new-head targeted C1/T1 support only; C1/C2 await new-head configured verification, with old94aa4b25 not reused for this changed tree.
