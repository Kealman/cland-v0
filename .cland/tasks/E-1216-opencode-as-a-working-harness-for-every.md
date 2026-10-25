---
id: E-1216
kind: epic
title: OpenCode as a working harness for every role
state: open
criterion_seq: 3
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-1015
branch: null
created: 2026-10-24T09:04:26.967Z
updated: 2026-10-25T05:15:22.119Z
---

## Goal

Code gets written through OpenCode on cheap models, in this project and in others: the human calls this cland's main killer feature (General, 2026-10-24 08:56Z). Every role (Implementer, Reviewer, QA) runs real tasks on OpenCode end to end, as reliably as on Codex, without the Coordinator stepping in. Qualification model: DeepSeek V4.1 Flash, the free variant (human, answer to ask adc5c04a, 09:03Z); exact OpenCode model id pending. Free model, so the spend cap is $0 for the qualification; a paid variant needs the human's approval first.

Today: the OpenCode adapter exists (hub/src/adapters/opencode.ts; E-424 closed), OpenCode 2.0.24 is installed, and no role has run real tasks on it.

## Approach

1. Qualification: 4–6 real XS/S backlog tasks run end to end by an OpenCode Implementer, with review kept on Codex; then Reviewer and QA trials on OpenCode. Measured per run: reaches ready without help, process discipline (TDD, hub `send`, `cland verify`, stays in its worktree, literal rm), review rounds, wall time, token use and cost. Every failure becomes a ticket under this epic.
2. Fixes from the qualification, including T-619 (role clause across compaction via OpenCode instructions).
3. Re-qualification on fresh tasks.

## Definition of done

- [ ] C1. An OpenCode Implementer takes three consecutive XS/S tasks from claim to merge with no Coordinator intervention beyond ordinary briefs and answers, recorded per run in a qualification artifact.
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T01:15:45.036Z · commit 4decf43e2a44fff25b25b1c60e8de277240929eb
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T03:37:48.515Z · commit 7a9c741569a64a785b2db4da20bb0a41716b485e
- [ ] C2. An OpenCode Reviewer and an OpenCode QA session each complete a real request with a verdict the hub accepts, recorded in the same artifact.
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T01:15:45.105Z · commit 4decf43e2a44fff25b25b1c60e8de277240929eb
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677-2 · 2026-10-25T03:37:48.594Z · commit 7a9c741569a64a785b2db4da20bb0a41716b485e
- [ ] C3. Each run's token use and cost are visible in cland's usage view for the OpenCode session.
  - failed: qa-677 [qa] · 2026-10-25T03:37:48.667Z · note Persistence fix passes, but six original qualifying Implementers plus oc-qa-1 and oc-1269 still lack visible usage; fresh examples do not establish each qualification run.

## Plan

```yaml
stages:
  - name: qualification on OpenCode
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1020
        - T-1209
        - T-522
      - - T-1063
        - T-1105
        - T-1092
      - - T-1219
      - - T-619
      - - T-1263
  - name: durable usage
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1269
  - name: re-qualification with durable usage
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1271
      - - T-1266
```

## Comments

### qa-677 · 2026-10-25T01:15:45.200Z

verdict: qa
result: not clear
by: qa-677 [qa]
run: qa-dod-2026-10-25-677
commit: 4decf43e2a44fff25b25b1c60e8de277240929eb
findings: [{"severity":"medium","text":"C3: session list --archived --json retains all six phase-1 OpenCode Implementer rows but no usage objects. They are archived, not pruned. R1/Q1 totals exist, but each-run usage visibility is not established."},{"severity":"low","text":"A-11567 overstates six intervention-free runs: initial T-1020/T-1063 required shell-identity and evidence-review corrections. C1 is supported by the four later runs; T-1209's lifecycle recovery followed the actual merge."}]
finding_counts: {"high":0,"medium":1,"low":1}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| QUALIFICATION / C1 | hub-api | PASS | A-11568: six exact-head review/verify pairs and pinned-dev Item trailers; four later consecutive runs qualify |
| ROLE-VERDICTS / C2 | hub-api | PASS | T-1267 and E-1197 hub-source verdict writers match OpenCode process identities and roles |
| USAGE / C3 | hub-api | FAIL | Six archived Implementer rows have no usage; R1/Q1 totals exist |
| FRESHNESS | hub-api | PASS | demo status freshness.current=true at full tested SHA |

Medium: C3 lacks per-run tokens/cost for oc-1020, oc-1063, oc-1105, oc-1209, oc-522, oc-1092. The archived rows explicitly retain OpenCode/free-model identities; missing usage is not zero. Current oc-rev-1: 4,053,100 tokens/$0.05086320599999999; oc-qa-1: 9,328,777/$0.08374005600000001. Root cause not diagnosed.

Low: A-11567's six-run/no-model-caused-intervention wording does not match the strict criterion. Initial identity/workflow corrections are excluded; four later runs establish C1. T-1092's window is an allowed answer; T-1209's ps failure/recovery happened after its recorded merge. Report includes message IDs and exact boundaries.

C1/C2 verified separately in this run; C3 failed. Local macOS read-only evidence audit under Coordinator-authorized message brief cc2a473f/1d1d6ed9. No runtime tests, suites, browser, probe or demo lease ran; no new droplet cost. This checks prior receipt linkage, not fresh test coverage. Full evidence and limits: A-11568, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11568-e-1216-qa-audit-c1-c2-confirmed-phase-1-usage-missing.md. Four manual audit records appended to runs.jsonl; outputs secret-scanned.

Criteria: C3 failed (All six archived phase-1 OpenCode Implementer rows lack usage totals; free model identity does not establish per-run recorded tokens or cost.).

### qa-677 · 2026-10-25T03:37:48.667Z

verdict: qa
result: not clear
by: qa-677 [qa]
run: qa-dod-2026-10-25-677-2
commit: 7a9c741569a64a785b2db4da20bb0a41716b485e
findings: [{"severity":"medium","text":"C3 qualification-evidence gap: archived session list still lacks usage for the six original Implementer runs, oc-qa-1 and oc-1269. oc-1270 and current oc-rev-1 demonstrate post-fix records, not the complete each-run cohort. No new persistence defect is alleged."}]
finding_counts: {"high":0,"medium":1,"low":0}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| C1 qualification | hub-api | PASS | Original six review/verify pairs and landings reconfirmed; A-11568 four-later-run classification stands |
| C2 role verdicts | hub-api | PASS | Original hub-source OpenCode Reviewer/QA identities retained; T-1270 adds two clear OpenCode reviews |
| C3 persistence | hub-api | PASS | Five generated identities pass in both A-11582/A-11586; first two each have five passing load repeats per platform; asserted exact restart/stop/archive facts checked |
| C3 fresh usage | hub-api | PASS, limited | Archived oc-1270 5,579,954 tokens/$0.050566764; current oc-rev-1 4,123,219/$0.047691018 |
| C3 each run | hub-api | FAIL | Six original Implementers, oc-qa-1, oc-1269 have no usage object |
| Freshness | hub-api | PASS | current=true at full requested SHA |

Medium finding: C3 still says each run. Fresh post-fix usage for T-1270 and current Reviewer activity does not supply the lost qualification records; no post-fix QA qualification run is supplied. This is an evidence gap, not a finding that T-1269 failed. Historical totals captured in A-11568 are not currently visible for oc-qa-1; absent totals are not zero. Recover actual visible run totals or supply a replacement cohort with preserved per-run usage; a future live restart alone will not recover historical loss.

C1/C2 reverified separately in this run; C3 failed. A-11592 contains exact case names, original log line numbers, source assertions, source-delta limits and current snapshots. Covers ran at ad67ef5593ae84e5a699354a2a6741fc89769e22; usage implementation/tests unchanged through audit SHA, apart from a Sessions comment. T0–T4/Web covers completed; budgets/lint report-only; T4 repetitions skipped. Linux two droplets: lifetimes 1336s/$0.0928 and 1136s/$0.0789, recorded total $0.1716. macOS local Darwin arm64 27.0.0. These are prior cover receipts, not new QA execution.

This run is a local macOS read-only audit under message brief 8e8488c9. No new tests/suite/browser/demo lease or live restart/archive mutation. Six manual audit records saved; evidence secret-scanned. Artifact A-11592: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11592-e-1216-qa-re-audit-persistence-passes-per-run-qualification-usage-incomplete.md

Criteria: C3 failed (Persistence fix passes, but six original qualifying Implementers plus oc-qa-1 and oc-1269 still lack visible usage; fresh examples do not establish each qualification run.).

### oc-qa-2 · 2026-10-25T05:15:22.119Z

verdict: qa
result: clear
by: oc-qa-2 [qa]
run: qa-2026-10-25-1216s3
commit: 0021ad47372493db52ae48386023fac9411e2031
stage: re-qualification with durable usage
stage_hash: cd65ea0f1a1c0fe4fbc0b82d407e43dfb193e1312b482da619f4b4ff729679d4
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| M1 | hub-api | PASS | .cland/qa/E-1216/qa-2026-10-25-1216s3/M1.out |
| M2 | hub-api | PASS | .cland/qa/E-1216/qa-2026-10-25-1216s3/M2.out |
| M3 | hub-api | PASS | .cland/qa/E-1216/qa-2026-10-25-1216s3/M3.out |
| M4 | hub-api | PASS | .cland/qa/E-1216/qa-2026-10-25-1216s3/M4.out |
| M5 | hub-api | PASS | .cland/qa/E-1216/qa-2026-10-25-1216s3/M5-archived.json, M5-cohort.json |
| BUILD | hub-api | PASS | .cland/qa/E-1216/qa-2026-10-25-1216s3/BUILD-before.txt, BUILD-after.txt, plan-show.txt, own-session.json |

Stage: re-qualification with durable usage. Result clear: every check in the stage brief passed.

What ran: a clean detached worktree at dev 0021ad47372493db52ae48386023fac9411e2031 with node_modules symlinked from the project root; root hub/node_modules does not exist under the npm-workspaces install, so no such symlink was made (hub resolves through the root tree). HEAD, refs/heads/dev and origin/dev all equalled 0021ad47 before and after; worktree status empty. T-1271 (8b7a4bfa) and T-1266 (44211a6d) each carry an Item: trailer on dev. task plan show E-1216 reports this stage open with its cover complete; plan output retained in plan-show.txt.

- M1: node --test hub/test/verifier-resolver.test.ts — exit 0, 6 pass; the case "a first line that continues after the item is one verifier request, never a role broadcast" passed (verifier-resolver.test.ts:122 verified by grep at this build).
- M2: node --test hub/test/lead-permissions-component.test.ts — exit 0, 4 pass.
- M3: node --test hub/test/heartbeat.test.ts — exit 0, 17 pass; the case "bare and prefixed continued requests suppress the missing-review row while an unrelated review stays stale" passed (heartbeat.test.ts:347).
- M4: node --test --test-name-pattern="demo recorder scans parsed JSON metadata" hub/test/skills-qa.test.ts — exit 0, 1 test run and passed, reported case duration 759.996542 ms, under the report-only 2 s T2 budget (skills-qa.test.ts:146).
- M5 (read-only live hub): cland session list --archived --json shows all three harness-opencode Implementer rows archived with a numeric usage.total: oc-1270 5,579,954 tokens / $0.050566764 (archived 03:34:55Z), oc-1271 20,020,342 / $0.139729416, oc-1266 9,655,966 / $0.104000406 (both archived 04:48:13Z).

Platform: macOS Darwin arm64, node v24.21.0, local executor, one test file at a time; no droplet, no cost. No full suite ran here (the stage cover pair e2a5f207 Linux / 75391db6 macOS covers T3/T4), and no browser, demo lease or provider call was used. Wall time: hold taken 05:12:52Z, last record 05:15:02Z (~2 min 10 s).

QA session own usage (session list --json, read 05:14Z): oc-qa-2, harness opencode, model opencode-go/deepseek-v4.1-flash#default, usage.total 1,414,590 tokens, cost $0.016582386.

Findings: none. Stage verdicts carry no epic criterion marks; the epic Definition of done remains a separate run.
