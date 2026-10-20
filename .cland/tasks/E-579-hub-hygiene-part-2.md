---
id: E-579
kind: epic
title: Hub hygiene, part 2
state: closed
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
topic: topic-663
branch: null
created: 2026-10-16T06:36:01.807Z
updated: 2026-10-20T05:58:38.645Z
closed: 2026-10-20T05:58:38.645Z
---

## Summary
Carried over from E-425 in v0.1.3 by the human's decision on 2026-10-16 (ask 396ec11a). It takes the verify-queue hygiene stage: tracker-only commits on dev must not cancel or invalidate an integrated run (T-379), and cover-quiet enforced by the hub while the Coordinator's cover holds the slot (T-475). Both were mitigated during v0.1.3 by running covers from detached worktrees and by the posted cover-quiet rule.

## Definition of done
- [ ] C1. (D1) A tracker-only commit on dev during an integrated run leaves the run and its evidence valid (T-379).
  - verified: qa-3 [qa] · run qa-20261020-3g · 2026-10-20T05:58:21.620Z · commit 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b
- [ ] C2. (D2) While a Coordinator cover holds the slot, the hub refuses other test admissions on the machine (T-475).
  - verified: qa-3 [qa] · run qa-20261020-3g · 2026-10-20T05:58:21.620Z · commit 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b
- [ ] C3. (D3) A rulebook commit (`.cland/RULES.md`) on dev during an integrated run keeps the run, and its result covers the new head (moved from E-426 C2, the human, ask 6085e249, 2026-10-16).
  - verified: qa-3 [qa] · run qa-20261020-3g · 2026-10-20T05:58:21.620Z · commit 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b

## Plan

```yaml
stages:
  - name: queue hygiene
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-379
        - T-475
  - name: demo fixes
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-933
```

## Comments

### hub · 2026-10-20T04:05:54.940Z

demo ca5caebe-3da5-4445-a759-1321ae5b7fa0 created: droplet cland-v0-ca5caebe, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T05:19:52.424Z.

### hub · 2026-10-20T04:08:40.803Z

demo ca5caebe-3da5-4445-a759-1321ae5b7fa0 destroyed: lifetime 214923 ms; cost $0.0149.

### qa-3 · 2026-10-20T04:11:25.914Z

verdict: qa
result: not clear
by: qa-3 [qa]
run: qa-20261020-3e
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"medium","text":"R5 duplicates literal .cland/tasks/.cland/RULES.md exclusions rather than deriving them from verification-tree.ts:10; violates single-definition requirement and risks drift. Runtime checks pass today.","file":"hub/src/executor/droplet/run.ts","line":118},{"severity":"low","text":"R4 says candidate excludes only .cland/tasks, contradicting rulebook exclusion in source, tests, README2490 and same document182.","file":"docs/agents/tests.md","line":808}]
finding_counts: {"high":0,"medium":1,"low":1}

| Case | Result | Method and evidence |
|---|---|---|
| G0 | PASS | [local read-only] clean detached S, ancestor of dev, committed brief, Node24.21.0, jq installed; G0.txt |
| G1 | PASS | [local read-only] E579 open with C1-C3; T379/T475 closed under E579; both merges ancestors of S; G1-epic.json, G1-children.json, G1-ancestors.txt |
| G2 | PASS | [hub-api] task hold E579; qa-3 QA hold confirmed; G1-epic.json |
| D0 | PASS | [droplet] demo start at requested S; one lease active with deadline; D0-start.json, D0-status.json |
| D1 | PASS | [droplet] clean SHA824105c5, Node24.21.0, Linux x86_64; D1-build.txt |
| S1 | PASS | [droplet scratch] identity-stripped cland init/hub start exit0; branchdev; own lock_path and executorlocal each exactly1; S1-scratch.txt |
| D2 | PASS | [droplet scratch] candidateTree across commits: tracker/rulebook/dirty tracker preserve; docs/source change; dirty source null; explicit task head strict null. TMPDIR=Q keeps all commits under /tmp/qa-E579.; D2-tree.txt, tree.mjs |
| D3 | PASS | [droplet scratch] assertTestAdmission six cases: ordinary admitted, cover unrelated refused10ms, own worker admitted10ms, wrongtoken refused9ms, nohub admitted, released admitted; no override set; D3-cover.txt, cover.mjs |
| D4 | PASS | [droplet] verification-tree.test.ts9/9 pass, no skip; overlapping tracker/rulebook/source/strict/dirty races and shared path definition; D4-tree.log, targeted-summary.txt |
| D5 | PASS | [droplet] suite-candidate.test.ts5/5 pass; queued/running results cover new heads after .cland/tasks/note.md and .cland/RULES.md commits; source commit rejected; D5-candidate.log |
| D6 | PASS | [droplet] suite-candidate-remote.test.ts1/1 pass; submitted remote bundle preserved across tracker/rulebook commits; D6-remote.log |
| D7 | PASS | [droplet] cover-quiet.test.ts15/15 pass no skip; hub/Neovim entry refusals before fixtures, real integrated worker admits own harness, human override only in test fixture; D7-cover-quiet.log |
| D8 | PASS | [hub read-only] fetched origin; dev unchanged; demo freshness current=true; D8-dev.txt, D8-status.json |
| D9 | PASS | [droplet cleanup] scratch hub stop exit0, cwd process scan[], scratch removed; hub lease released214923ms/$0.014925208333333334; creation/destruction comments present; D9-cleanup.txt, D9-stop.json, D9-after.json, D9-comments.txt |
| R1 | PASS | [records] T379 closed C1-C3 current verified; narrowed tracker+rulebook paths, docs remain suite inputs; R1-T379.json, R1-criteria.txt |
| R2 | PASS | [records] A3938/A3943/A3949/A3958 read: overlap race found then corrected with regression; T379 droplet697aca2b/A4043 passed at621bbf2b, log exit0; R2-history.txt, G1-children.json |
| R3 | PASS | [records] T475 closed C1-C3 current verified; earlier review findings preserved; admission compatibility entry now test-support/admission.ts uses typed AdmissionTimeout; C2 current runtime tests pass; R3-T475.json, R3-criteria.txt, R3-old-findings.json, R3-timeout-source.txt |
| R4 | FAIL | [records] FAIL docs/agents/tests.md:808 says candidate excludes only .cland/tasks; contradicts correct rulebook exclusion at182 and README2490. Document-topic matrix captured; cover-quiet behavior/override docs present in tests.md and Implementer clause.; R4-matrix.md, R4-doc-lines.txt |
| R5 | FAIL | [records] FAIL hub/src/executor/droplet/run.ts:118 duplicates literal tracker/rulebook exclusion list from verification-tree.ts:10 in host-gate tree calculation; violates one-definition requirement. Shared candidatePathspec used for other checks.; R5-finding.txt, R5-all-source.txt |

Findings, ranked by severity:

- **Medium — R5, hub/src/executor/droplet/run.ts:118.** `rg -n 'excludedPaths|candidatePathspec|\.cland/RULES.md' hub/src` finds `excludedPaths` in verification-tree.ts:10 and a second literal list in the droplet host-gate shell: `git rm --quiet -r --cached --ignore-unmatch -- '.cland/tasks' '.cland/RULES.md'`. That list is not derived from the shared definition, unlike the adjacent status pathspec at line112. This violates T-379 C2 and brief R5's single-definition requirement. Both lists match today and the runtime tests pass; the finding is duplicate policy and drift risk, not a reproduced incorrect hash. Evidence: R5-finding.txt, R5-all-source.txt. Size XS, category Tech debt/follow-up of merged work; Coordinator will file the combined fix under E-579.
- **Low — R4, docs/agents/tests.md:808.** The cache paragraph says the candidate excludes only `.cland/tasks`, but `.cland/RULES.md` is also excluded. This contradicts the same document's line182, hub/README.md:2490 and the passing D2/D4/D5 behavior. `sed -n '798,813p' docs/agents/tests.md` shows the stale statement. Evidence: R4-matrix.md and R4-doc-lines.txt. Size XS, category Bugs (documentation).

Coordinator decision8d1a28fc-a928-4eca-b33c-2e2d4fe71328, 2026-10-20T04:09:05.333Z, confirms no disposition applies to either finding and requests not clear. The fix will land after the other open demos finish, followed by a delta QA request at the new head. No source or documentation fixes were made by QA.

Criterion marks for this verdict:

| Criterion | Evidence | Mark |
|---|---|---|
| C1 tracker-only commits | Direct scratch candidate identity and fake-run queued/running/remote tests all pass, including hash-overlap races. R5 violates the single-definition requirement; R4 misstates candidate paths. | failed: R5 duplicated host-gate exclusions and R4 stale input documentation |
| C2 cover-quiet | Six live scratch admission cases pass;15 cover-quiet tests pass including actual entry points and integrated worker. Typed AdmissionTimeout and required tests.md/Implementer refusal/override text are present. | Behavior passes; no verified mark in this not-clear verdict |
| C3 rulebook-only commits | Scratch identity and queued/running/remote retention pass; R4 incorrectly omits rulebook from the cache exclusions. | failed: R4 docs/agents/tests.md:808 contradicts rulebook exclusion |

Full run qa-20261020-3e by qa-3 at824105c5a2a56b3495e9215cc88d60c4c129df6c. Result not clear:17 checks PASS, R4/R5 FAIL, none blocked/inconclusive. All30 targeted tests pass with zero skips/failures/reruns (verification-tree9, suite-candidate5, suite-candidate-remote1, cover-quiet15). Their complete outputs and named assertions are retained in targeted-summary.txt and individual logs.

Behavioral proof uses exactly the brief's safe substitutes: direct production candidateTree on a scratch repository, plus real hub/runner fixtures with fake packages and commits while the run is pending/running. No integrated suite ran against this project's live hub and no commit was made on its dev. Tracker/rulebook and uncommitted tracker changes preserve identity; explicit task heads stay strict; docs/source changes alter identity; dirty source returns null. Scratch cover refused unrelated admission in10ms and wrong-token admission in9ms; own worker, no-hub and released slot admitted. The human override was not set by QA; it is exercised only inside the authorized cover-quiet test fixture.

R1/R2 verified closed T-379/current C1–C3 marks and read A-3938/A-3943/A-3949/A-3958, preserving the original overlap race and correction. Historical droplet697aca2b/A-4043 exited0 at621bbf2bae30c0d1e41cc9bb0f29afe52a880391; this historical receipt is not a new run at S. R3 verified closed T-475/current C1–C3 marks and the prior copied-helper/timeout findings; current admission lives in test-support/admission.ts with typed AdmissionTimeout in test-support/admission-outcome.ts, behind the compatibility entry in hub/src/test-admission.ts. Read-only path probes initially used older brief path names, then followed the compatibility exports; no code was changed. R4-matrix.md records exact document/topic coverage, including missing literal cells; refusal/override text is correctly distributed in tests.md and Implementer clause, while the concrete incorrect line808 is the failure.

Coordinator's same-S integrated suite receipts A-7022(Linux) and A-7026(macOS) are green(exit0); no verify was submitted by QA. Linux merged receipt includes two c-8 lon1 shards: cland-v0-1d139ca1 duration1222.07s/lifetime1215s/$0.0843, cland-v0-23418384 duration1592.07s/lifetime1584s/$0.1100; total1615.43s/$0.1944. These logs support the overall candidate but do not erase the R4/R5 audit findings.

All behavioral checks ran on isolated Linux x86_64/Node24.21.0. Local activity was read-only gates, item/artifact/source/docs inspection. Scratch commands stripped session identity and tokens. TMPDIR was explicitly set to /tmp/qa-E579 for the provided scripts, keeping their mkdtemp commits and no-hub directory inside the brief's required scratch root. No live hub session was launched. Scratch hub stop exited0, cwd-based process scan found[], and the full scratch root was removed. The probe reads process cwd only, not command lines or environments. No local machine suite lock was touched.

Demo leaseca5caebe-3da5-4445-a759-1321ae5b7fa0; machine cland-v0-ca5caebe; created2026-10-20T04:04:54.091Z; deadline2026-10-20T05:19:52.424Z; state released; final lifetime214923ms; final cost$0.01492521. Hub created/destroyed comments are preserved in D9-comments.txt. Freshness current=true at S. Total QA elapsed wall through report368.8s; QA remote cost$0.01492521.

Published folder A-7039: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7039-e-579-qa-evidence-at-824105c5-qa-20261020-3e (README.md). QA note A-7040: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7040-e-579-qa-not-clear-r4-documentation-and-r5-duplicate-exclusions.md.

Criteria: C1 failed (R5: host gate duplicates candidate exclusions at hub/src/executor/droplet/run.ts:118; R4 tests.md:808 misstates inputs.), C3 failed (R4: docs/agents/tests.md:808 says only tracker paths excluded, omitting the rulebook.).

### hub · 2026-10-20T05:52:13.122Z

demo 3ed6be93-b2e3-4354-bc5a-dbdec7638ba5 created: droplet cland-v0-3ed6be93, commit 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b, deadline 2026-10-20T07:06:07.996Z.

### hub · 2026-10-20T05:55:48.326Z

demo 3ed6be93-b2e3-4354-bc5a-dbdec7638ba5 destroyed: lifetime 265392 ms; cost $0.0184.

### qa-3 · 2026-10-20T05:58:21.620Z

verdict: qa
result: clear
by: qa-3 [qa]
run: qa-20261020-3g
commit: 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b
findings: [{"severity":"low","text":"R4 says every document×topic cell must be filled, but guidance is intentionally distributed. README lacks refusal/override; Implementer clause lacks exclusion paths/docs-as-inputs. All topics are covered without contradiction and T-475 C3 placements hold. Coordinator d75e0339 explicitly clarified distributed coverage; empty cells are retained in the matrix.","file":"qa/briefs/E-579.md"}]
finding_counts: {"high":0,"medium":0,"low":1}

| Case | Where | Result | Evidence |
|---|---|---|---|
| G0 | local reads | PASS | Clean detached S2, on dev, brief committed, Node24 |
| G1 | records | PASS | T-379/T-475/T-933 closed; merge ancestors; C1–C3 read |
| G2 | hub API | PASS | QA hold |
| D0 | droplet | PASS | One S2 lease |
| D1 | droplet | PASS | Clean S2, Linux x86_64, 8 cores, Node24.21.0 |
| D2 | droplet | PASS | Tracker/rulebook/dirty tracker preserve identity; strict head/docs/source/dirty source controls correct |
| D3 | droplet | PASS | All six admission outcomes correct; unrelated refusal12ms, wrong token10ms |
| D4 | droplet | PASS | verification-tree9/9, including commit-during-hash controls |
| D5 | droplet | PASS | suite-candidate5/5, queued/running metadata commits and source rejection |
| D6 | droplet | PASS | suite-candidate-remote1/1, submitted bundle retained |
| D7 | droplet | PASS | cover-quiet15/15, pre-fixture guards and real integrated worker |
| D8 | hub API | PASS | Freshness current; no dev delta |
| D9 | hub API | PASS | Scratch stopped, process count0, three roots removed, lease released |
| R1 | records | PASS | T-379 current criteria and input boundary |
| R2 | records | PASS | Original overlap finding, correction and exact-head green receipt |
| R3 | records/source | PASS | T-475 corrected history; current shared typed timeout |
| R4 | docs at S2 | PASS | Distributed coverage and required placements, per d75e0339 |
| R5 | source at S2 | PASS | One shared exclusion definition; host gate imports it |

All18 checks pass. Criteria marks: C1,C2,C3 verified in qa-20261020-3g. This is a full fresh run at 9b2cb19466abfd8f0c0b20bffe50d9d2419c3e2b; previous qa-20261020-3e is history only, with no runtime evidence reused.

Findings: no high or medium findings; one low brief ambiguity in R4. The literal document×topic matrix has cells empty by design: README lacks cover-quiet/override wording, and the Implementer clause lacks exclusion paths/docs-as-inputs. All topics are present across the three documents without contradiction. Refusal and human-only override appear in both tests.md and the Implementer clause as T-475 C3 requires. Coordinator decision d75e0339-d42b-4935-b9df-34104fa90e22 explicitly confirms distributed coverage. Exact quotes and missing cells remain in R4-matrix.md; no product waiver or QA edit.

Both previous findings are resolved by T-933 merge058a389446c4e7b20c0e193a29535ccf977a309e, an ancestor of S2:
- R4: docs/agents/tests.md:808–809 now names both .cland/tasks and .cland/RULES.md, agreeing with README:2483–2496.
- R5: verification-tree.ts:10 exports the sole excludedPaths array; executor/droplet/run.ts:19 imports it and line118 builds host-gate git rm with excludedPaths.map(quote). The duplicated literals are gone. Derived pathspec, local hashing, validation and remote delivery share the definition. Other RULES.md literals concern override policy/help.

Fresh execution: 30/30 targeted tests, zero failures/skips/retries. D2 gives all six true identity controls and null for an explicit stale task head. D3: no cover admitted8ms; unrelated refused12ms with cover-quiet and qa-cover-run; inherited worker admitted10ms; wrong token refused10ms; no-hub admitted0ms; released slot admitted2ms. D4 proves overlapping tracker/rulebook preservation and source/dirty/strict rejection. D5 runs real fixture hubs with fake packages. D6 preserves original remote bundle provenance. D7 includes the real integrated worker. This is the brief's safe substitute: no live integrated run was interrupted and no live dev commit was made.

Stage gates: fresh task.view confirms original queue-hygiene and new demo-fixes stages closed. Both covers are at S2:
- Linux A-7105, run14b674ab-2d7e-4833-824c-3701b44bf284:3165pass,0fail,8platformskips. c-8 lon1 shard1 cland-v0-57497c77 duration1007.62s/lifetime998s/$0.0693; shard2 cland-v0-d762d069 duration910.62s/lifetime910s/$0.0632. Total wall1027.56s, cost$0.1325.
- macOS A-7109, runbfb912c4-b764-4ee0-93ca-0de31357e51b:3173/3173, exit0. Phase runner durations25.75/168.33/964.99/48.46s, not an end-to-end wall; local cost not applicable.
These are Coordinator stage receipts read by QA, not new suite submissions.

Demo accounting: Linuxx86_64,c-8,Node24.21.0; machinecland-v0-3ed6be93; lease3ed6be93-b2e3-4354-bc5a-dbdec7638ba5; created05:51:10.052Z, deadline07:06:07.996Z. Confirmed released, lifetime265392ms, cost$0.01843. Scratch stop exit0; zero scoped processes; all three scratch roots removed. Final freshness.current=true; clean worktree. No local tests/suites/stress, source fixes, override setting, second lease, dev commit, push or merge enqueue.

Evidence report A-7115: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7115-e-579-qa-clear-at-s2-both-findings-fixed-fresh-30-30.md
Complete fresh bundle A-7114: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7114-e-579-fresh-s2-qa-evidence-qa-20261020-3g
Includes complete logs, scripts, matrix, source diff/references, stage receipts, case records, cleanup and cost receipts, source artifact hashes.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-20T05:58:38.645Z

Closed on qa-3's clear at release candidate 2, 9b2cb194 (fresh run qa-20261020-3g, A-7115 / A-7114). C1–C3 verified. T-933 fixed the earlier R4/R5 findings.
