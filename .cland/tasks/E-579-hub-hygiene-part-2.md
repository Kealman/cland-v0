---
id: E-579
kind: epic
title: Hub hygiene, part 2
state: open
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: R-577
blocked_by: []
topic: topic-663
branch: null
created: 2026-10-16T06:36:01.807Z
updated: 2026-10-20T04:11:25.914Z
---

## Summary
Carried over from E-425 in v0.1.3 by the human's decision on 2026-10-16 (ask 396ec11a). It takes the verify-queue hygiene stage: tracker-only commits on dev must not cancel or invalidate an integrated run (T-379), and cover-quiet enforced by the hub while the Coordinator's cover holds the slot (T-475). Both were mitigated during v0.1.3 by running covers from detached worktrees and by the posted cover-quiet rule.

## Definition of done
- [ ] C1. (D1) A tracker-only commit on dev during an integrated run leaves the run and its evidence valid (T-379).
  - failed: qa-3 [qa] · 2026-10-20T04:11:25.914Z · note R5: host gate duplicates candidate exclusions at hub/src/executor/droplet/run.ts:118; R4 tests.md:808 misstates inputs.
- [ ] C2. (D2) While a Coordinator cover holds the slot, the hub refuses other test admissions on the machine (T-475).
- [ ] C3. (D3) A rulebook commit (`.cland/RULES.md`) on dev during an integrated run keeps the run, and its result covers the new head (moved from E-426 C2, the human, ask 6085e249, 2026-10-16).
  - failed: qa-3 [qa] · 2026-10-20T04:11:25.914Z · note R4: docs/agents/tests.md:808 says only tracker paths excluded, omitting the rulebook.

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
