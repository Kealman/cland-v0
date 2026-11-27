---
id: E-2072
kind: epic
title: Load and timing flakes, cleanup fences (0.4.1 re-triage)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T08:59:42.733Z
updated: 2026-11-27T18:58:46.117Z
closed: 2026-11-27T18:58:46.117Z
---

## Goal

Load- and timing-sensitive tests stop reddening covers, and fixture cleanup is fenced so a failed teardown can't leak processes or restore seams early.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-2001, T-2016, T-2060, T-1918, T-2017, T-2031, T-1955, T-1979, T-2022, T-1963, T-2067, T-1997, T-2018, T-1994. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261127-2072-1 · 2026-11-27T18:58:39.141Z · commit 5862e24c43f3cff72f396fac36226068f463040e
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261127-2072-1 · 2026-11-27T18:58:39.142Z · commit 5862e24c43f3cff72f396fac36226068f463040e

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2001
      - - T-1918
      - - T-2018
      - - T-1994
      - - T-1955
        - T-2067
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2079
      - - T-2016
      - - T-2060
      - - T-2017
      - - T-1979
        - T-2096
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2031
      - - T-1963
      - - T-1997
      - - T-2022
      - - T-2099
      - - T-2114
      - - T-2115
```

## Comments

### qa-1880 · 2026-11-27T18:58:39.142Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261127-2072-1
commit: 5862e24c43f3cff72f396fac36226068f463040e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M1 | hub-api, local evidence audit | PASS | no open children |
| M2 | hub-api, local evidence audit | PASS | 20 closed; 37/37 current child criteria; 19 ancestral landings; T-2098 recorded reason |
| M3 | hub-api, existing Linux receipt | PASS | A-23861, A-23862, A-23863, A-23864 |
| M4 | hub-api, existing macOS receipt | PASS | A-23865, A-23866 |

No high, medium or low findings in this brief's scope. Clear; run qa-20261127-2072-1.

Build: 5862e24c43f3cff72f396fac36226068f463040e. Brief source: qa/briefs/E-2072.md at fab0223fc4d1f7b2bd14ea630232206ab3b8850c. Kit pin: 5862e24c43f3cff72f396fac36226068f463040e (last kit change 22ac59c0d4c8a92dec1d54a0c77729995bfb038d). Recorder runtime v24.21.0 satisfies >=24.13.0 <25. Clean detached HEAD equals build; build is ancestral to dev. Later dev files at preparation were only the six briefs and .cland/tasks/T-204. Raw Git tree 739bdea838dc12b93aaab7ae1af7b7f1a662d96d; both cover owners report verification tree f54e3d74a66b1bb4d6853e3a14aaf8de02f3792d.

This run audits existing evidence locally on macOS. No suite, product test, browser or demo lease was launched. The four checks are the entire brief scope; child behavior was not retested. No brief corrections needed.

M3: Linux cover 4bab60dc-3754-425a-b6e4-cbe09b74d10f, log A-23861 (shard logs A-23862/A-23863; coverage map A-23864). Structured result.json for the aggregate and both shards has code 0 and empty cause; each shard has complete exit-0 T0, T1, T2, T3, T4 and Web receipts at the matching verification tree. Provenance: requested full head, branch dev, occasion release, executor droplet, linux x64 6.8.0-149-generic, Node v24.21.0, Neovim v0.12.5, two shards with workers 2. Owner aggregate: 10,121 tests, 10,107 pass, 0 fail, 0 cancelled, 14 skipped, 0 todo. Owner pass accounting explicitly reports 10,110 raw base pass finishes, difference +3, with three finishes without retained starts; these are not added to the aggregate. Both c-8 nyc1 leases are released: shard-1 cland-v0-174827a5 lifetime 3359.420 s, cost $0.2332930556; shard-2 cland-v0-c6b81735 lifetime 2576.059 s, cost $0.1788929861; total $0.4121860417. Lifetime details come from producer lease receipts and include provisioning/cleanup; they are not test-case wall times.

M4: macOS cover 35f47391-a4b5-41b7-922d-a1e655727c97, log A-23865 and coverage map A-23866. Structured result.json has code 0, empty cause and six complete exit-0 T0–T4/Web receipts. Provenance: requested full head, matching verification tree, branch dev, occasion release, executor local, darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5. Owner summary workers 1 (Web phase reports 2). Aggregate: 10,117 tests, 10,115 pass, 0 fail, 0 cancelled, 2 skipped, 0 todo. Owner pass accounting explicitly reports 10,118 raw base pass finishes, difference +3, three finishes without retained starts. Local cost is not applicable.

Both covers are uncached (cached null). Browser binary: playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell on Linux and corresponding chrome-headless-shell-mac-arm64/chrome-headless-shell on macOS; version Google Chrome for Testing 156.0.8078.4. Absolute binary paths remain in source provenance. T4 ran 18 files in base phase only; extra repetitions did not run. Skips remain skips: Linux includes macOS-only checks and unavailable OpenCode/zsh prerequisites; macOS excludes the two Linux identity/procfs checks. Budget, fixed-wait/test lint, condition-wait growth, T3 ratchet and skip-reason checks are report-only, not enforced success claims. No timing comparison or performance conclusion is made.

Commands/observations: live-root task list --under E-2072 --state open/closed and task.view for every child; exact anchored Item trailers in first-parent git log through the requested build; parsed producer results and provenance plus owner suite aggregates in Agents history; demo status E-2072 --commit BUILD --json freshness.current true. M1–M4 were recorded from the clean detached build with qa-record.sh note. Criterion marks requested by this verdict: C1 and C2 only.

T-2098 closes as evidence-only diagnosis by Coordinator comment 2026-11-25T03:59:47.584Z, reviewer rev-35-2098-evidence-1, artifacts A-23241/A-23242. It claims no source fix or causal landing; unresolved Linux same-case slowdown was filed as T-2099, whose landing is included. The existing reviewer chronology correction is retained in A-23242 and does not change closure eligibility.

Child census and ancestral landings:

| child | current verified/total | landing |
| --- | --- | --- |
| T-1918 | 1/1 | a177d474db53b80d8415d9c2bb792ce7a11737bf |
| T-1955 | 2/2 | 729550515ca5be097262c573543000af04dc6bb1 |
| T-1963 | 2/2 | 05d708e41a481972fd807239c2dacb583a0e66b3 |
| T-1979 | 2/2 | 820dd4e04ddb4f75cf9b58e514857b1b45b0a327 |
| T-1994 | 2/2 | 9b74cd0990529b09c06d2b3439864ca88300bc30 |
| T-1997 | 3/3 | 2fb380581061e4c77005e62735d6d0dc37a68d91 |
| T-2001 | 2/2 | 2b2113df9f7c583201aa937c7699c133582f9bea |
| T-2016 | 2/2 | a6bc51f0ab6c1da35ddac9110ede48984d39243d |
| T-2017 | 2/2 | b7252dbab1c4e4f60e868056fb2545bd019b311a |
| T-2018 | 1/1 | faff3e3809c5f7ba6bcc0ea3b60c1c7499e0aef9 |
| T-2022 | 2/2 | 54e4f8cd82d4648daf0f2386893b79a15b6012a1 |
| T-2031 | 2/2 | 2db9e2a4416b4e58aeae8749036fbcad568bc17f |
| T-2060 | 2/2 | 43b8fa8063d2171005bb01f362914a1127525649 |
| T-2067 | 2/2 | 5bcb33850d46f33b2a1822296262b733e11aa818 |
| T-2079 | 1/1 | 5dbc6af5c9f490c2acea2464a6204dbba0df843d |
| T-2096 | 2/2 | 33cefd2a3dc0b3624fe0debea7f1d3b9cb59be8f |
| T-2098 | 2/2 | recorded evidence-only closure |
| T-2099 | 2/2 | 8c5d3374d2bf7fb6612e668b5a90452837a91db8 |
| T-2114 | 2/2 | e3772f8eeb09a6a8ead0f9149324ea15061dfed4 |
| T-2115 | 1/1 | 50dbdb4cd1470b2f9e9f7b98acc66ce5a88339fe |


Full evidence: A-23867, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23867-e-2072-evidence-only-qa-at-5862e24.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T18:58:46.117Z

Closed on QA clear qa-20261127-2072-1 at 5862e24c4 (A-23867). C1: 20 children closed: 19 with landings, plus T-2098 as an evidence-only closure with a recorded reason. C2: Linux release cover 4bab60dc (A-23861) and macOS release cover 35f47391 (A-23865), both green at 5862e24c4.
