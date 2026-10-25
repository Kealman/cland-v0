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
updated: 2026-10-25T01:16:22.371Z
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
- [ ] C2. An OpenCode Reviewer and an OpenCode QA session each complete a real request with a verdict the hub accepts, recorded in the same artifact.
  - verified: qa-677 [qa] · run qa-dod-2026-10-25-677 · 2026-10-25T01:15:45.105Z · commit 4decf43e2a44fff25b25b1c60e8de277240929eb
- [ ] C3. Each run's token use and cost are visible in cland's usage view for the OpenCode session.
  - failed: qa-677 [qa] · 2026-10-25T01:15:45.200Z · note All six archived phase-1 OpenCode Implementer rows lack usage totals; free model identity does not establish per-run recorded tokens or cost.

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
