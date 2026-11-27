---
id: E-2075
kind: epic
title: Hosts, executor and droplets (0.4.1 re-triage)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:00:15.242Z
updated: 2026-11-27T19:00:51.547Z
closed: 2026-11-27T19:00:51.547Z
---

## Goal

Executor and host code keeps primary errors, probes liveness correctly and notifies only when action is useful.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1940, T-1970, T-2008, T-2071, T-2009, T-1965, T-1978, T-2020. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261127-2075-1 · 2026-11-27T19:00:44.228Z · commit 5862e24c43f3cff72f396fac36226068f463040e
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261127-2075-1 · 2026-11-27T19:00:44.228Z · commit 5862e24c43f3cff72f396fac36226068f463040e

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1940
      - - T-1978
      - - T-2009
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1970
        - T-1965
        - T-2094
      - - T-2020
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2008
        - T-2071
```

## Comments

### qa-1880 · 2026-11-27T19:00:44.228Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261127-2075-1
commit: 5862e24c43f3cff72f396fac36226068f463040e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M1 | hub-api, local evidence audit | PASS | no open children |
| M2 | hub-api, local evidence audit | PASS | 9 closed; 17/17 current criteria; 9 ancestral landings |
| M3 | hub-api, existing Linux receipt | PASS | A-23861–A-23864 |
| M4 | hub-api, existing macOS receipt | PASS | A-23865/A-23866 |

No high, medium or low findings in scope. Clear; run qa-20261127-2075-1.

Build: 5862e24c43f3cff72f396fac36226068f463040e. Brief source: qa/briefs/E-2075.md at fab0223fc4d1f7b2bd14ea630232206ab3b8850c. Kit pin: 5862e24c43f3cff72f396fac36226068f463040e (last kit change 22ac59c0d4c8a92dec1d54a0c77729995bfb038d). Recorder runtime v24.21.0 satisfies >=24.13.0 <25. Clean detached HEAD equals build; build is ancestral to dev. Later dev files at preparation were only the six briefs and .cland/tasks/T-204. Raw Git tree 739bdea838dc12b93aaab7ae1af7b7f1a662d96d; both cover owners report verification tree f54e3d74a66b1bb4d6853e3a14aaf8de02f3792d.

This run audits existing evidence locally on macOS. No suite, product test, browser or demo lease was launched. The four checks are the entire brief scope; child behavior was not retested. No brief corrections needed.

M3: Linux cover 4bab60dc-3754-425a-b6e4-cbe09b74d10f, log A-23861 (shard logs A-23862/A-23863; coverage map A-23864). Structured result.json for the aggregate and both shards has code 0 and empty cause; each shard has complete exit-0 T0, T1, T2, T3, T4 and Web receipts at the matching verification tree. Provenance: requested full head, branch dev, occasion release, executor droplet, linux x64 6.8.0-149-generic, Node v24.21.0, Neovim v0.12.5, two shards with workers 2. Owner aggregate: 10,121 tests, 10,107 pass, 0 fail, 0 cancelled, 14 skipped, 0 todo. Owner pass accounting explicitly reports 10,110 raw base pass finishes, difference +3, with three finishes without retained starts; these are not added to the aggregate. Both c-8 nyc1 leases are released: shard-1 cland-v0-174827a5 lifetime 3359.420 s, cost $0.2332930556; shard-2 cland-v0-c6b81735 lifetime 2576.059 s, cost $0.1788929861; total $0.4121860417. Lifetime details come from producer lease receipts and include provisioning/cleanup; they are not test-case wall times.

M4: macOS cover 35f47391-a4b5-41b7-922d-a1e655727c97, log A-23865 and coverage map A-23866. Structured result.json has code 0, empty cause and six complete exit-0 T0–T4/Web receipts. Provenance: requested full head, matching verification tree, branch dev, occasion release, executor local, darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5. Owner summary workers 1 (Web phase reports 2). Aggregate: 10,117 tests, 10,115 pass, 0 fail, 0 cancelled, 2 skipped, 0 todo. Owner pass accounting explicitly reports 10,118 raw base pass finishes, difference +3, three finishes without retained starts. Local cost is not applicable.

Both covers are uncached (cached null). Browser binary: playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell on Linux and corresponding chrome-headless-shell-mac-arm64/chrome-headless-shell on macOS; version Google Chrome for Testing 156.0.8078.4. Absolute binary paths remain in source provenance. T4 ran 18 files in base phase only; extra repetitions did not run. Skips remain skips: Linux includes macOS-only checks and unavailable OpenCode/zsh prerequisites; macOS excludes the two Linux identity/procfs checks. Budget, fixed-wait/test lint, condition-wait growth, T3 ratchet and skip-reason checks are report-only, not enforced success claims. No timing comparison or performance conclusion is made.

Commands/observations: live-root task list --under E-2075 --state open/closed and task.view for every child; exact anchored Item trailers in first-parent git log through the requested build; parsed producer results and provenance plus owner suite aggregates in Agents history; demo status E-2075 --commit BUILD --json freshness.current true. M1–M4 were recorded from the clean detached build with qa-record.sh note. Criterion marks requested by this verdict: C1 and C2 only.



Child census:

| child | current verified/total | landing |
| --- | --- | --- |
| T-1940 | 2/2 | 65c625080ed78dddc1565c247b405d991f9bb777 |
| T-1965 | 2/2 | 8339b7f06be281cd3500e652bca58be8ef8dbe93 |
| T-1970 | 2/2 | a9fd5decf02423b047297c21338a7531e7d4f47c |
| T-1978 | 2/2 | f027cb3c607c58aeabe9c6e414df755aec04b16e |
| T-2008 | 2/2 | 504cdf8671d29dba0dc7b3f5169666409cca5381 |
| T-2009 | 2/2 | bdfe3be7498c812b0e3771a3e8e542ce5a7bb2a4 |
| T-2020 | 2/2 | b6dbb527d8891c61cc322f308cebb2dc20792547 |
| T-2071 | 2/2 | b9d0624e3b3f0ebd5da93b8b201d58678f3cbcda |
| T-2094 | 1/1 | a6ff2853b872fe41f4862e018d0f692caffb28b9 |


Full evidence: A-23870, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23870-e-2075-evidence-only-qa-at-5862e24.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T19:00:51.547Z

Closed on QA clear qa-20261127-2075-1 at 5862e24c4 (A-23870). C1: all 9 children closed with their landings. C2: Linux release cover 4bab60dc (A-23861) and macOS release cover 35f47391 (A-23865), both green at 5862e24c4.
