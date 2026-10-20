---
id: T-915
kind: task
title: Switch duration budgets from report to enforce before the v0.1.4 release build (D71, E-678 C6)
state: closed
status: done
size: L
criterion_seq: 5
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by:
  - T-919
  - T-922
topic: topic-672
branch: t/T-915-switch-duration-budgets-from-report-to
created: 2026-10-19T22:37:49.124Z
updated: 2026-10-20T00:41:45.529Z
closed: 2026-10-20T00:41:45.529Z
---

## Summary

D71 (2026-10-19 22:37Z): E-678 C6 counts the budget-enforce mechanism, and switching `hub/test/durations.json` from report to `"budget": { "mode": "enforce" }` is a separate v0.1.4 task before the release build. Today every run prints "budget (report only): would fail …" lines and "budget missing baselines: 55".

## What to build

- Refresh `hub/test/durations.json` from the green stage-cover logs (Linux and macOS) at the stage-cover-#2 tree, so no test file lacks a baseline.
- For every test or file over its tier budget in those logs, either make it faster or add an allowance with a reason and an owner, following the existing allowance format and the legacy-allowance rules.
- Set `budget.mode` to `"enforce"`. Show that a task verify at the head shows `budget` lines (not "report only") and passes.

## Acceptance criteria

- [x] C1. At the head, a mode-free task verify and a dry run show enforce-mode budget lines with zero failures and zero missing baselines.
  - done: impl-915 · 2026-10-20T00:36:41.455Z
  - verified: rev-31 [reviewer] · run rev-20261020-915-final · 2026-10-20T00:37:11.279Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
- [x] C2. A planted over-budget T2 test without an allowance fails its run, and a planted T3 growth without an allowance is refused with `merge-budget` (throwaway branches, never merged), with receipts in the report.
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-corrected · 2026-10-20T00:10:59.111Z · commit 6b2cc3d435e47141b1ae393dcad00632fff46b35
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-finite · 2026-10-20T00:28:01.444Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
  - done: impl-915 · 2026-10-20T00:36:41.923Z
  - verified: rev-31 [reviewer] · run rev-20261020-915-final · 2026-10-20T00:37:11.280Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
- [x] C3. The task report lists every allowance added, with its reason and measured seconds.
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-corrected · 2026-10-20T00:10:59.111Z · commit 6b2cc3d435e47141b1ae393dcad00632fff46b35
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-finite · 2026-10-20T00:28:01.444Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
  - done: impl-915 · 2026-10-20T00:36:42.495Z
  - verified: rev-31 [reviewer] · run rev-20261020-915-final · 2026-10-20T00:37:11.280Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
- [x] C4. Every allowance owned by E-677 or E-482 (both close in v0.1.4) is re-owned to E-880 with values unchanged, and converted or new allowances carry owner E-880 and expire 2026-11-19 (Coordinator decision on T-915's question, D71).
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-corrected · 2026-10-20T00:10:59.111Z · commit 6b2cc3d435e47141b1ae393dcad00632fff46b35
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-finite · 2026-10-20T00:28:01.444Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
  - done: impl-915 · 2026-10-20T00:36:42.965Z
  - verified: rev-31 [reviewer] · run rev-20261020-915-final · 2026-10-20T00:37:11.280Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
- [x] C5. D72: the duration lint reads the legacy owner from budget.legacyOwner in hub/test/durations.json (default E-677; set to E-880), legacy-owner dated allowances may span at most 31 days while other owners keep 7, with lint tests and docs/agents/tests.md updated and every other lint rule unchanged.
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-corrected · 2026-10-20T00:10:59.111Z · commit 6b2cc3d435e47141b1ae393dcad00632fff46b35
  - verified: rev-31 [reviewer] · run rev-20261020-915-source-finite · 2026-10-20T00:28:01.444Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a
  - done: impl-915 · 2026-10-20T00:36:43.542Z
  - verified: rev-31 [reviewer] · run rev-20261020-915-final · 2026-10-20T00:37:11.280Z · commit 84af3de46e13e02d73b5d01f1ae897d102fa696a

## Comments

### impl-915 · 2026-10-19T23:45:10.424Z

Starting from T-919 baseline additions at 2c79d42a. Will replay A-6792/A-6795/A-6796 through production budget checks, add bounded E-677 allowances for every observed overage, switch enforce, and prove C2 only on throwaway branches. No QA brief present; checking effective policy before review.

### impl-915 · 2026-10-19T23:50:02.131Z

Implemented/pushed aebfa97990702c3ae4e6c7cfb28baddad3eb36d9: D71 enforcement plus D72 policy/ownership migration. Production replay A-6831 shows Linux28→0, macOS10→0, periodic2→0 enforce failures, missing0 throughout; 29 caps (6 new,16 converted legacy,7 existing dated), all original entries and 182 owner changes retained. Counts E-677177/E-4822/E-6133 → E-880188. A-6836 is self-contained replay script; C2 A-6833 runner exit1 and A-6834 production immutable merge predicate refusal on unmerged throwaway branches, A-6835 proof recipe. Local check/tiers lint and targeted tests pass. Hosting hub dry-run refused old seven-day lint; no workaround. Coordinator split prerequisite T-922 for policy-only code/tests/docs, followed by authorized hub restart; T-915 holds until then, will merge origin/dev once as explicitly requested and request first full source review before exact-head verification. qaPolicy scope none; no QA brief or QA criteria.

### rev-31 · 2026-10-20T00:08:49.272Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-915-source
commit: db1b55c569dd091da55714d4dfb54297b6b7542f
scope: full
findings: [{"severity":"high","text":"M1/C1: Replay uses raw scenario tier descriptors instead of normalized tier names, silently skipping four scenario budgets. Real assignment semantics leave Linux3/Mac3/periodic1 failures (droplet-verify two cases, setup, ticket-flow cache); update exact allowances from normalized raw replay and correct report.","file":"hub/test/durations.json","line":5851},{"severity":"medium","text":"M2/C1: Current T1 project-layout.test.ts has no file/test baseline; A-6848:43007 already reports its .003s file missing, so C1 zero-missing cannot pass. Add observed baseline provenance without changing existing values.","file":"hub/test/durations.json","line":1}]
finding_counts: {"high":1,"medium":1,"low":0}

A-6859 contains full Standards/Spec review and exact raw uncovered keys/peaks. High M1 at durations.json:5851/5858/5886/5900: A-6836 supplies object scenario descriptors to functions expecting tier names; durationBudgetContext normalizes them, exposing four uncovered scenario identities and 31→3/13→3/3→1 before/after failures. Medium M2 at durations.json:1: current T1 project-layout missing file baseline is visible in A-6848:43007 and violates C1 zero-missing. Other checks: all29 reported cap changes independently match raw peaks and original records; all182 original entries re-owned/retained,188totalE-880; new/converted dates and unchanged metadata match authorized scope. C2 raw T2 runner exit1 and immutable production merge-budget refusal inspected, both unmerged throwaway commits/checker parity confirmed. C3 report/C4 ownership/C5 inherited policy otherwise match scope. No separate Standards findings. Do not verify this source head; publish corrected normalization, allowances, current baseline and report then request fresh review.

Criteria: C1 failed (Normalized scenario replay still has 3/3/1 enforce failures, and current T1 project-layout lacks its required baseline.).

### impl-915 · 2026-10-20T00:09:58.072Z

Addressed source findings A-6859 in 6b2cc3d4, pushed. Corrected replay uses production readTierAssignments, validates all observed tier strings and includes descriptor scenarios. Production before/after normalized failures Linux31→0/Mac13→0/periodic3→0; missing0. Four scenario caps raised to observed peak×1.25 rounded .1s, old reasons/dates retained. Current T1 project-layout file+sole test baseline .002921 from A-6848, provenance appended; all old baseline values preserved and all current non-T4 files covered. A-6860 complete corrected JSON, A-6861 script, A-6862 all33 allowance report, A-6863 targeted test. Tiers lint passes. Requested fresh source review; dry-run/verify remain held until clear.

### rev-31 · 2026-10-20T00:10:59.111Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-915-source-corrected
commit: 6b2cc3d435e47141b1ae393dcad00632fff46b35
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6866 establishes M1/M2 resolved. Independent normalized raw replay agrees with A-6860: Linux31→0, Mac13→0, periodic3→0. Four scenario caps match measured peaks/headroom; all33 changes checked (6new,16legacy→dated,11updated dated), corrected A-6862 lists every peak/reason. One current T1 file/test baseline .002921 from raw A-6848 .002920952, identical source blob; no old baseline changed and no current non-T4 file baseline missing. All182 owner changes retained,188totalE-880 confirmed open; new/converted dates and unchanged metadata conform to authorization. C2 retained unmerged negative probes apply: production T2 runner exit1, immutable production merge-budget predicate refuses +10s; checker/runner/tiers/budgets unchanged and added scenario caps/T1 baseline cannot exempt planted identities/growth. C3/C4/C5 source/evidence established. C1 remains pending exact-head dry-run and configured mode-free green, zero budget failures/missing baselines; historical failed mark reconciles on final evidence. No findings; this exact head is source-clear for dry-run/verify.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### rev-31 · 2026-10-20T00:20:04.049Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-915-evidence-preview
commit: 6b2cc3d435e47141b1ae393dcad00632fff46b35
scope: evidence
findings: [{"severity":"medium","text":"M3/C1: Exact-head dry-run A-6868 still predicts duration failures from old observed baselines; thread oracle10.987651s>T2 2s is observed in all three authorized logs at1.463/.749/.889s, so it is not an exempt unobserved ambiguous identity. Refresh as Coordinator3771b8e5 authorized, without stale-title allowances/checker changes.","file":"hub/test/durations.json","line":5219}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6870 independently audits complete A-6869: exact reviewed head,1915 ordinary passes,0nonpasses,0resource/duration/missing diagnostics,0new load groups; enforce labels and host check pass. Actual T0–T2 gate is green. C1 remains not clear because A-6868 exact-head preview shows ten ranked duration-budget diagnostics. M3 identifies an actually observed exact identity, outside Coordinator's exception for retained unobserved ambiguous identities. Primary3771b8e5 authorizes observed medians refresh, statically confirmed retirements only, all allowances/metadata retained, then fresh full source review/dry-run/verify. Source M1/M2 remain resolved and C2–C5 source marks remain valid; no other findings.

Criteria: C1 failed (Actual run passes1915/1915 with zero diagnostics, but exact-head preview still has canonical duration-budget failures from stale observed baselines.).

### impl-915 · 2026-10-20T00:23:23.885Z

a451b137 completed at6b2cc3d4: enforce runtime green1915/1915, zero duration/resource/missing diagnostics, Linux c-8 lon1 lifetime447s cost$0.0310 (A-6869). Applied Coordinator3771b8e5 refresh only afterward, pushed178e8b6c. Updated2681 measured timings/431 file totals from authorized per-log medians/across-log medians; removed173 statically confirmed retired timing identities; retained11 unobserved ambiguous Claude session identities. All188 allowances/source/version/budget metadata unchanged. Full preview83→10 diagnostics solely retained ambiguous history, explicitly listed per authorized C1 exception. Three-log actual replays0/0/0/missing0, all current non-T4 files baselined. A-6871 full receipt/source audit, A-6872 recipe, A-6873 complete updated report/all allowance table/exception list. Manifest lint passed. Fresh full source review requested before new exact-head dry-run/verify.

### rev-31 · 2026-10-20T00:25:40.168Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261020-915-source-refresh
commit: 178e8b6ceda2cbd424305f3e88a466a16f0e1a0f
scope: full
findings: [{"severity":"medium","text":"M4/C1: All11 retained Claude session keys are statically retired: source:179 conditional selects two literal titles, alongside four direct literals, no unknown registration. Their ten preview diagnostics are not within Coordinator's ambiguity exception. Enumerate both branches, retire unmatched keys and recalculate truthful file total/provenance.","file":"hub/test/durations.json","line":232}]
finding_counts: {"high":0,"medium":1,"low":0}

A-6874: Independent medians confirm all2681changed test values (7additions),431file totals and173retirements across40source files; all188allowances/metadata unchanged, normalized three-log replay0failures/0missing, every non-T4file baselined. M3 observed stale baseline refresh is correct. Sole remaining M4: conditional registration's two literal branches are statically enumerable; six exact current titles,11retained keys match none. Current six baseline values total.965138s, not zero. Complete the retirements/aggregate (explicit provenance for additional measurements), then fresh source review before dry-run/verify. Prior C2–C5 evidence otherwise remains applicable but this head is not source-clear. Standards0;Spec1medium.

Criteria: C1 failed (Ten preview duration diagnostics arise from statically knowable retired Claude session keys, not exempt ambiguous identities.).

### impl-915 · 2026-10-20T00:27:15.501Z

M4 fixed at pushed84af3de4: statically enumerate both literal conditional titles; retire11 additional old Claude timing keys. Per final Coordinator8b671288, six current three-log medians remain exactly unchanged, file total0.965138s/6tests, no A-6869 import/source reference. All other timings,188 allowances, source/version/budget metadata unchanged from178e8b6c. Full baseline preview now duration failures0/missing0; three actual authorized log replays remain0. Total184 static retirements across refresh. A-6875 finite census/receipt, A-6876 recipe, A-6877 final consolidated report. Manifest lint passed. Fresh full source review requested before dry-run/new mode-free verify.

### rev-31 · 2026-10-20T00:28:01.444Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-915-source-finite
commit: 84af3de46e13e02d73b5d01f1ae897d102fa696a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6878 full source review confirms M1–M4 resolved. Final delta exactly11statically retired Claude keys removed and file aggregate34.995910s/17→.965138s/6; six current values unchanged and independently match authorized three-log medians. No A-6869 import, all188allowances/metadata preserved per primary8b671288. Prior complete medians/source-census audit remains applicable;184total retirements now proven. Independent normalized stored-baseline preview and all three raw replays give zero duration failures/zero missing baselines, no ambiguity exception needed. C2 negative production runner/immutable merge-budget evidence and C3 inventory/C4 ownership/C5 policy remain valid at current head; unchanged checker not weakened. C1 awaits fresh exact-head hosting dry-run and configured mode-free green; prior A-6869 is for earlier6b2cc3d4 and cannot settle this head. No findings; source-clear to dry-run/verify84af3de4.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### impl-915 · 2026-10-20T00:36:44.234Z

Exact-source-reviewed84af3de4 final configured mode-free cea98e21 passed1915/1915 (fail/cancel/skip/TODO0), no budget/resource/missing diagnostics; allT1+fallbackallT2 bothpackages, T0 host gate passed. Linux x64 c-8 lon1 lifetime450s cost$0.0313, raw A-6880. Exact-head dry-run A-6879 also failures0/missing0 with enforce labels/ratchet equalbase. C1–C5 marked done. Consolidated completion report artifact in topic retains all33 caps,182 owner changes,184 source-confirmed timing retirements and C2 proofs. Reviewed head84af3de46e13e02d73b5d01f1ae897d102fa696a clean/unchanged. Awaiting Reviewer final evidence verdict; T3 deferred to periodic/integrated since batchesT1only.

### rev-31 · 2026-10-20T00:37:11.280Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-915-final
commit: 84af3de46e13e02d73b5d01f1ae897d102fa696a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6882 independently audits full A-6880 and hosting A-6879 at unchanged source-clear84af3de4. C1 now complete: mode-free cea98e21 exits0,1915ordinary passes,zero nonpasses/resource/duration/overage/missing-baseline diagnostics;0new load groups appropriate to manifest/doc-only change. Host check passes. Exact-head dry-run has zero budget failures/overages/missing baselines;T1 projected18.346622<120,T2 194.989172<480,missing0both. Both receipts show enforce labels,E-880,ratchet2112.415=base. No ambiguity exception needed; historical C1 failure reconciled. C2–C5 source/evidence from A-6878 remains current: production negative runner/immutable merge-budget proofs,33cap inventory,188E-880 allowances and bounded dates, unchanged D72 policy/docs;184statically proven retirements and medians refresh unchanged. All claimant done marks confirmed. C1–C5 verified at exact commit; no remaining findings. Native T3 remains periodic/integrated, not claimed by this task run.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-20T00:41:45.529Z

Merged 03711a4299e87bac9dbb9e19a03f6e32c2669ed7 onto dev.
