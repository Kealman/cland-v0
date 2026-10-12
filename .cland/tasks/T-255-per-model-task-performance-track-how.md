---
id: T-255
kind: task
title: "Per-model task performance: track how each task went by the model that did it, to route tokens across many models"
state: open
status: backlog
labels:
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T06:08:23.359Z
updated: 2026-10-12T09:36:01.233Z
---

Observation from the human (2026-10-12 morning, after v0.1.1), relayed by the stand-in cland-impl.

The goal is to distribute tokens across many models, including the open Chinese ones, so cland must assess how well each model handles tasks of each kind. The run retrospective and the tracker should carry, per task, the model that did it and how the task went.

Candidate proxies: review rounds and QA rounds relative to task complexity; maybe time to clear, suite failures caused, rework after merge. Others to be found.

Starting point: the data already exists in the journal (verdict runs per item, launch records with harness and model), so the first step is an extraction, not new instrumentation.

Shape to be grilled with the human in v0.1.2.

## Comments

### human · 2026-10-12T09:30:40.594Z

Research summary for T-255, written by the Coordinator's research sub-agent (Claude Code, claude-opus-5-5) and posted through the CLI, so the header says "human". Branch `research/model-performance` at `9ff8dde60487c3ca7067d7e0e76e5ea275a5fa1f` (local territory): `docs/research/model-performance.md`, plus `docs/research/model-performance/extract.py` and its CSVs. The extraction ran over a copy of `.cland` taken 2026-10-12T08:46Z, with `dev` at `a5c207b`.

Population: 158 tasks that landed or closed from 2026-10-09 to the copy (147 landed). By run: v0.0.1 29, v0.1.0 105, v0.1.1 24. Each task is joined to its Implementer's launch record (harness, model), its verdicts and writers, its landing commit (diff size), its suite runs and rework candidates.

Per Implementer model (landed tasks):

| Implementer model | tasks | review verdicts, median (mean) | rounds to first clear review, median | first review clear (95 % CI) | not clear per task (finding, suite) | h claim to land, median | lines, median | confirmed rework |
|---|---|---|---|---|---|---|---|---|
| gpt-6.1-sol (Codex) | 140 | 3 (3.22) | 2 | 57/140, 41 % (33–49) | 1.24 (1.01, 0.26) | 1.3 | 402 | 14 |
| claude-opus-5-5 | 6 | 3 (3.33) | 2.5 | 1/6, 17 % (3–56) | 1.83 (1.83, 0.00) | 1.3 | 1001 | 0 |
| claude-sonnet-5-5 | 1 | 4 | 4 | 0/1 (0–79) | 3.00 (3.00, 0.00) | 1.2 | 781 | 0 |

sol by run: first review clear 7/20 (35 %) in v0.0.1, 34/97 (35 %) in v0.1.0, 16/23 (70 %) in v0.1.1. sol by lines changed: under 300, 39/52 (75 %); 300–1,199, 16/77 (21 %); 1,200 and over, 2/11 (18 %). Rank correlation of lines with rounds to the first clear: 0.59.

Findings:
- No model comparison is possible inside v0.1.0 and v0.1.1. Every Implementer and Reviewer launched from 2026-10-10 on was gpt-6.1-sol, and every QA session gpt-6-astra. Opus and sonnet worked only on 2026-10-09 (6 and 1 landed tasks), and their intervals overlap sol's.
- Size dominates. Reviewer sessions on the same model ranged from 24 % to 73 % first-review clear. 37 % of review verdicts came after a task's first clear review, as process: forward merges of `dev` and suite evidence. The run's rules (D16, forward merges, the suite queue, the reviewer pool) moved sol's numbers.
- QA has been per epic since D16: 21 epic QA verdicts, 4 not clear, none naming the task at fault.
- Hub suite jobs exist only from 2026-10-11T01:29Z: 126 jobs, 39 failed, 10 of them only on failures shared by three or more tasks. Rework: 44 candidates; a hand audit confirmed 18, covering 14 tasks.

Proposed metric set (decisions are yours). Per task, compared only within the same ex-ante size class, the same run and the same Reviewer model:
1. First-pass yield: is the first full-scope review clear?
2. Rounds to the first clear review.
3. Reviewer-found defects (`finding` not-clears, by severity), with suite not-clears reported apart.
4. Escaped defects: confirmed rework within a window, from a `regression_of` link.
5. Cost per landed task: tokens, and cost or rate-limit share, for the Implementer and separately for verification.

Recommendation: core metrics 1, 4 and 5, with 2 as a tie-breaker. Routing rule: per size class, the cheapest model within a set margin of the best on first-pass yield and escaped defects. Telling a 20-point difference in first-pass yield takes about 94 tasks per model (170 for 15 points).

Gaps, and what would close them:
- Tokens and cost. The adapters hold per-session usage in memory and publish `session.usage`, but nothing journals it. Close it by journalling a `session-usage` record at `publishUsage` and at stop, then adding a price table or a rate-limit share (T-240).
- Complexity before the work. Only a free-text "Size" note exists, on 72 of 147 landed tasks. Close it with a required `size` field, set before the model is chosen.
- Sub-agent models, and launches with no model named (recorded as null). Close it by recording the model per turn and on the first turn.
- Verdict scope. Full, delta and evidence-only reviews look alike. Close it with a `scope:` header and structured findings.
- Rework links. Today they are prose; the mention-based candidates were 41 % precise. Close it with a `regression_of` relation, and epic QA findings that name the item.
- Model variety. The v0.1.2 crew pins sol again. Close it with a rotation rule per size class and a fixed Reviewer model.

Open questions for the grilling are in section 9 of the doc: the routing objective and unit; who reviews a candidate model; rotation share and which open models (through OpenCode?); who sets the size class; the rework definition and window; verifier metrics; mid-task model changes (T-50, T-51); where the per-task row lives; and whether the Coordinator's model counts.

### human · 2026-10-12T09:36:01.233Z

Decided (2026-10-12): instrumentation only in v0.1.2: session usage journaled at each publication and at stop, a required size field on tasks, a regression_of link, the model of every launch including sub-agents, the verdict scope on verdict records. No model rotation in this build: the human will measure later on another project with many models; the crew stays as decided. The metric set (first-pass yield, rounds to first clear, reviewer-found defects, escaped defects, cost per landed task; compared within size class, run and Reviewer model) is recorded for that later measurement. Recorded in docs/spec/v0.1.2.md §3.12.
