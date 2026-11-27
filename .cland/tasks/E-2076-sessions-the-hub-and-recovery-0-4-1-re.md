---
id: E-2076
kind: epic
title: Sessions, the hub and recovery (0.4.1 re-triage)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:00:21.102Z
updated: 2026-11-27T19:01:16.135Z
closed: 2026-11-27T19:01:16.135Z
---

## Goal

Session stop and landing follow-ups, delivery, hub storage and recovery paths stay correct and bounded under load.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1912, T-1926, T-1961, T-1971, T-1972, T-1995, T-2043, T-2005, T-2062, T-1959, T-1989, T-2014. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261127-2076-1 · 2026-11-27T19:01:08.252Z · commit 5862e24c43f3cff72f396fac36226068f463040e
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261127-2076-1 · 2026-11-27T19:01:08.252Z · commit 5862e24c43f3cff72f396fac36226068f463040e

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1995
        - T-2043
        - T-2088
      - - T-2014
      - - T-1961
      - - T-1971
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1912
      - - T-1959
      - - T-2062
      - - T-1926
        - T-1989
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1972
      - - T-2005
```

## Comments

### qa-1880 · 2026-11-27T19:01:08.252Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261127-2076-1
commit: 5862e24c43f3cff72f396fac36226068f463040e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M1 | hub-api, local evidence audit | PASS | no open children |
| M2 | hub-api, local evidence audit | PASS | 13 closed; 25/26 current criteria; 12 ancestral landings; recorded closure exception |
| M3 | hub-api, existing Linux receipt | PASS | A-23861–A-23864 |
| M4 | hub-api, existing macOS receipt | PASS | A-23865/A-23866 |

No high, medium or low findings in scope. Clear; run qa-20261127-2076-1.

Build: 5862e24c43f3cff72f396fac36226068f463040e. Brief source: qa/briefs/E-2076.md at fab0223fc4d1f7b2bd14ea630232206ab3b8850c. Kit pin: 5862e24c43f3cff72f396fac36226068f463040e (last kit change 22ac59c0d4c8a92dec1d54a0c77729995bfb038d). Recorder runtime v24.21.0 satisfies >=24.13.0 <25. Clean detached HEAD equals build; build is ancestral to dev. Later dev files at preparation were only the six briefs and .cland/tasks/T-204. Raw Git tree 739bdea838dc12b93aaab7ae1af7b7f1a662d96d; both cover owners report verification tree f54e3d74a66b1bb4d6853e3a14aaf8de02f3792d.

This run audits existing evidence locally on macOS. No suite, product test, browser or demo lease was launched. The four checks are the entire brief scope; child behavior was not retested. No brief corrections needed.

M3: Linux cover 4bab60dc-3754-425a-b6e4-cbe09b74d10f, log A-23861 (shard logs A-23862/A-23863; coverage map A-23864). Structured result.json for the aggregate and both shards has code 0 and empty cause; each shard has complete exit-0 T0, T1, T2, T3, T4 and Web receipts at the matching verification tree. Provenance: requested full head, branch dev, occasion release, executor droplet, linux x64 6.8.0-149-generic, Node v24.21.0, Neovim v0.12.5, two shards with workers 2. Owner aggregate: 10,121 tests, 10,107 pass, 0 fail, 0 cancelled, 14 skipped, 0 todo. Owner pass accounting explicitly reports 10,110 raw base pass finishes, difference +3, with three finishes without retained starts; these are not added to the aggregate. Both c-8 nyc1 leases are released: shard-1 cland-v0-174827a5 lifetime 3359.420 s, cost $0.2332930556; shard-2 cland-v0-c6b81735 lifetime 2576.059 s, cost $0.1788929861; total $0.4121860417. Lifetime details come from producer lease receipts and include provisioning/cleanup; they are not test-case wall times.

M4: macOS cover 35f47391-a4b5-41b7-922d-a1e655727c97, log A-23865 and coverage map A-23866. Structured result.json has code 0, empty cause and six complete exit-0 T0–T4/Web receipts. Provenance: requested full head, matching verification tree, branch dev, occasion release, executor local, darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5. Owner summary workers 1 (Web phase reports 2). Aggregate: 10,117 tests, 10,115 pass, 0 fail, 0 cancelled, 2 skipped, 0 todo. Owner pass accounting explicitly reports 10,118 raw base pass finishes, difference +3, three finishes without retained starts. Local cost is not applicable.

Both covers are uncached (cached null). Browser binary: playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell on Linux and corresponding chrome-headless-shell-mac-arm64/chrome-headless-shell on macOS; version Google Chrome for Testing 156.0.8078.4. Absolute binary paths remain in source provenance. T4 ran 18 files in base phase only; extra repetitions did not run. Skips remain skips: Linux includes macOS-only checks and unavailable OpenCode/zsh prerequisites; macOS excludes the two Linux identity/procfs checks. Budget, fixed-wait/test lint, condition-wait growth, T3 ratchet and skip-reason checks are report-only, not enforced success claims. No timing comparison or performance conclusion is made.

Commands/observations: live-root task list --under E-2076 --state open/closed and task.view for every child; exact anchored Item trailers in first-parent git log through the requested build; parsed producer results and provenance plus owner suite aggregates in Agents history; demo status E-2076 --commit BUILD --json freshness.current true. M1–M4 were recorded from the clean detached build with qa-record.sh note. Criterion marks requested by this verdict: C1 and C2 only.

T-2088 is closed with a recorded fixed-elsewhere reason, not a verified child criterion (0/1). Coordinator closing comment 2026-11-24T15:36:20.401Z names canonical fix d28203f1a5951f44a17e1c14cd1b3391526ed57c, first landed via T-1918 cherry-pick in a177d474db53b80d8415d9c2bb792ce7a11737bf. Both commits are ancestors of the requested build. Earlier comment identifies A-22992 with failed-before/passed-after evidence. No new T-2088 criterion mark or fresh behavior test is claimed; C1 expressly permits this recorded reason.

Child census:

| child | current verified/total | landing |
| --- | --- | --- |
| T-1912 | 2/2 | b66ecd5af98d08836f95cd61b20897a305c8af85 |
| T-1926 | 2/2 | 3ad39cff160d4a18de27c1dfb2c4dee0add121a2 |
| T-1959 | 2/2 | 2da68b2b8971882eea65d874bfd2357695182d99 |
| T-1961 | 2/2 | e7c9859cebfdf9490ef30d2cb17f66e26753f2ff |
| T-1971 | 2/2 | 35dbe5d37f76c3475cc6334f29d45ad1889900bd |
| T-1972 | 3/3 | d193c2311eabbe4bc22f192db3f65bf8679d7e45 |
| T-1989 | 2/2 | fea51c19883d2021303c9d4861131da492b54532 |
| T-1995 | 2/2 | 7e117f8bb8f10e8225d1189386ad5fa7cf03eb18 |
| T-2005 | 2/2 | 768cc3cf200c834fb3d67f732632b29349592ba6 |
| T-2014 | 2/2 | 77dfa0b631d5b5a1d5b564b513ede0f6397cd6b1 |
| T-2043 | 1/1 | 73d0427447a7810f9a6fd22748e0937146191b45 |
| T-2062 | 3/3 | 14c7ad020034840c670c03bd3507e6e9b5782d06 |
| T-2088 | 0/1 | recorded closure reason |


Full evidence: A-23871, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23871-e-2076-evidence-only-qa-at-5862e24.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T19:01:16.135Z

Closed on QA clear qa-20261127-2076-1 at 5862e24c4 (A-23871). C1: 13 children closed: 12 with landings, plus T-2088, fixed on dev by d28203f1a with its reason recorded. C2: Linux release cover 4bab60dc (A-23861) and macOS release cover 35f47391 (A-23865), both green at 5862e24c4.
