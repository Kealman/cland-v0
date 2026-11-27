---
id: E-2073
kind: epic
title: Test fixture ownership and tier hygiene (0.4.1 re-triage)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T08:59:52.591Z
updated: 2026-11-27T18:59:35.648Z
closed: 2026-11-27T18:59:35.648Z
---

## Goal

Test fixtures own their resources through the shared helpers, and each test file runs in the tier its process use requires.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1944, T-2013, T-1910, T-1913, T-1946, T-1977, T-1996, T-2000, T-2007, T-2010, T-1917, T-1998. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261127-2073-1 · 2026-11-27T18:59:28.742Z · commit 5862e24c43f3cff72f396fac36226068f463040e
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261127-2073-1 · 2026-11-27T18:59:28.742Z · commit 5862e24c43f3cff72f396fac36226068f463040e

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1910
      - - T-1946
      - - T-1917
      - - T-1977
        - T-1996
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1913
      - - T-2010
      - - T-1998
      - - T-2013
        - T-2097
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1944
      - - T-2000
      - - T-2007
```

## Comments

### qa-1880 · 2026-11-27T18:59:28.742Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261127-2073-1
commit: 5862e24c43f3cff72f396fac36226068f463040e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M1 | hub-api, local evidence audit | PASS | no open children |
| M2 | hub-api, local evidence audit | PASS | 13 closed; 22/22 current child criteria; every landing ancestral |
| M3 | hub-api, existing Linux receipt | PASS | A-23861–A-23864 |
| M4 | hub-api, existing macOS receipt | PASS | A-23865/A-23866 |

No high, medium or low findings in scope. Clear; run qa-20261127-2073-1.

Build: 5862e24c43f3cff72f396fac36226068f463040e. Brief source: qa/briefs/E-2073.md at fab0223fc4d1f7b2bd14ea630232206ab3b8850c. Kit pin: 5862e24c43f3cff72f396fac36226068f463040e (last kit change 22ac59c0d4c8a92dec1d54a0c77729995bfb038d). Recorder runtime v24.21.0 satisfies >=24.13.0 <25. Clean detached HEAD equals build; build is ancestral to dev. Later dev files at preparation were only the six briefs and .cland/tasks/T-204. Raw Git tree 739bdea838dc12b93aaab7ae1af7b7f1a662d96d; both cover owners report verification tree f54e3d74a66b1bb4d6853e3a14aaf8de02f3792d.

This run audits existing evidence locally on macOS. No suite, product test, browser or demo lease was launched. The four checks are the entire brief scope; child behavior was not retested. No brief corrections needed.

M3: Linux cover 4bab60dc-3754-425a-b6e4-cbe09b74d10f, log A-23861 (shard logs A-23862/A-23863; coverage map A-23864). Structured result.json for the aggregate and both shards has code 0 and empty cause; each shard has complete exit-0 T0, T1, T2, T3, T4 and Web receipts at the matching verification tree. Provenance: requested full head, branch dev, occasion release, executor droplet, linux x64 6.8.0-149-generic, Node v24.21.0, Neovim v0.12.5, two shards with workers 2. Owner aggregate: 10,121 tests, 10,107 pass, 0 fail, 0 cancelled, 14 skipped, 0 todo. Owner pass accounting explicitly reports 10,110 raw base pass finishes, difference +3, with three finishes without retained starts; these are not added to the aggregate. Both c-8 nyc1 leases are released: shard-1 cland-v0-174827a5 lifetime 3359.420 s, cost $0.2332930556; shard-2 cland-v0-c6b81735 lifetime 2576.059 s, cost $0.1788929861; total $0.4121860417. Lifetime details come from producer lease receipts and include provisioning/cleanup; they are not test-case wall times.

M4: macOS cover 35f47391-a4b5-41b7-922d-a1e655727c97, log A-23865 and coverage map A-23866. Structured result.json has code 0, empty cause and six complete exit-0 T0–T4/Web receipts. Provenance: requested full head, matching verification tree, branch dev, occasion release, executor local, darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5. Owner summary workers 1 (Web phase reports 2). Aggregate: 10,117 tests, 10,115 pass, 0 fail, 0 cancelled, 2 skipped, 0 todo. Owner pass accounting explicitly reports 10,118 raw base pass finishes, difference +3, three finishes without retained starts. Local cost is not applicable.

Both covers are uncached (cached null). Browser binary: playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell on Linux and corresponding chrome-headless-shell-mac-arm64/chrome-headless-shell on macOS; version Google Chrome for Testing 156.0.8078.4. Absolute binary paths remain in source provenance. T4 ran 18 files in base phase only; extra repetitions did not run. Skips remain skips: Linux includes macOS-only checks and unavailable OpenCode/zsh prerequisites; macOS excludes the two Linux identity/procfs checks. Budget, fixed-wait/test lint, condition-wait growth, T3 ratchet and skip-reason checks are report-only, not enforced success claims. No timing comparison or performance conclusion is made.

Commands/observations: live-root task list --under E-2073 --state open/closed and task.view for every child; exact anchored Item trailers in first-parent git log through the requested build; parsed producer results and provenance plus owner suite aggregates in Agents history; demo status E-2073 --commit BUILD --json freshness.current true. M1–M4 were recorded from the clean detached build with qa-record.sh note. Criterion marks requested by this verdict: C1 and C2 only.

Child census:

| child | current verified/total | landing |
| --- | --- | --- |
| T-1910 | 1/1 | f08a3c337e3671cc24d9f7d22f03f1295bb7705f |
| T-1913 | 2/2 | e94dcff8ab42a707149ea2e940570c808ca7adc9 |
| T-1917 | 1/1 | 7cd724ba14bf58c11a8bcf65c9ed367ca6ef0085 |
| T-1944 | 2/2 | 831f9f63e16e62b5bfff6380c0136771eae1838b |
| T-1946 | 1/1 | 0bded5946d01b2e669c315b93a37d429959c7472 |
| T-1977 | 2/2 | a0ea738142de654f5d7bd968f02d4ba594c1f5d5 |
| T-1996 | 2/2 | 9af601700e0c35969467ffbca5b05e8ac37a1499 |
| T-1998 | 2/2 | a64d45fed56b8156231727b82df5b9a64cb598bb |
| T-2000 | 2/2 | f72b000e9878adb1c4416d3c9d7e0fc8e2c32f98 |
| T-2007 | 2/2 | e2d09a6149aced6bdd5b8cc0d8c699ed0d9fd1b9 |
| T-2010 | 2/2 | b653afb17ed4d598627efbe4d7408a1d5354bb1b |
| T-2013 | 2/2 | 09c8a70bf0324bcdf8571114956f2fb8697805be |
| T-2097 | 1/1 | c903f2d11ab988034a1745576c1e1099eefcae1c |


Full evidence: A-23868, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23868-e-2073-evidence-only-qa-at-5862e24.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T18:59:35.648Z

Closed on QA clear qa-20261127-2073-1 at 5862e24c4 (A-23868). C1: all 13 children closed, each with its own landing. C2: Linux release cover 4bab60dc (A-23861) and macOS release cover 35f47391 (A-23865), both green at 5862e24c4.
