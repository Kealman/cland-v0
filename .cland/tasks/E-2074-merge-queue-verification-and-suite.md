---
id: E-2074
kind: epic
title: Merge queue, verification and suite reporting (0.4.1 re-triage)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:00:01.516Z
updated: 2026-11-27T19:00:27.933Z
closed: 2026-11-27T19:00:27.933Z
---

## Goal

Verification admits quickly, selects and reports correctly, and the merge queue doesn't rebuild or refuse needlessly.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1945, T-1962, T-1953, T-1942, T-2023, T-2027, T-2037, T-1928, T-2044, T-2045, T-1909, T-1929, T-1936, T-1938, T-2002, T-2003, T-2029, T-2057, T-2065. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261127-2074-1 · 2026-11-27T19:00:21.341Z · commit 5862e24c43f3cff72f396fac36226068f463040e
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261127-2074-1 · 2026-11-27T19:00:21.341Z · commit 5862e24c43f3cff72f396fac36226068f463040e

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2084
        - T-1928
        - T-2037
      - - T-1945
        - T-1962
      - - T-1953
      - - T-1942
      - - T-2027
      - - T-2065
      - - T-2057
        - T-2089
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2044
        - T-2029
      - - T-1936
      - - T-1938
      - - T-1909
      - - T-2045
      - - T-1929
      - - T-2100
      - - T-2112
      - - T-2116
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2023
      - - T-2002
        - T-2003
      - - T-2092
```

## Comments

### qa-1880 · 2026-11-27T19:00:21.341Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261127-2074-1
commit: 5862e24c43f3cff72f396fac36226068f463040e
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M1 | hub-api, local evidence audit | PASS | no open children |
| M2 | hub-api, local evidence audit | PASS | 25 closed; 47/47 current criteria; 25 ancestral landings |
| M3 | hub-api, existing Linux receipt | PASS | A-23861–A-23864 |
| M4 | hub-api, existing macOS receipt | PASS | A-23865/A-23866 |

No high, medium or low findings in scope. Clear; run qa-20261127-2074-1.

Build: 5862e24c43f3cff72f396fac36226068f463040e. Brief source: qa/briefs/E-2074.md at fab0223fc4d1f7b2bd14ea630232206ab3b8850c. Kit pin: 5862e24c43f3cff72f396fac36226068f463040e (last kit change 22ac59c0d4c8a92dec1d54a0c77729995bfb038d). Recorder runtime v24.21.0 satisfies >=24.13.0 <25. Clean detached HEAD equals build; build is ancestral to dev. Later dev files at preparation were only the six briefs and .cland/tasks/T-204. Raw Git tree 739bdea838dc12b93aaab7ae1af7b7f1a662d96d; both cover owners report verification tree f54e3d74a66b1bb4d6853e3a14aaf8de02f3792d.

This run audits existing evidence locally on macOS. No suite, product test, browser or demo lease was launched. The four checks are the entire brief scope; child behavior was not retested. No brief corrections needed.

M3: Linux cover 4bab60dc-3754-425a-b6e4-cbe09b74d10f, log A-23861 (shard logs A-23862/A-23863; coverage map A-23864). Structured result.json for the aggregate and both shards has code 0 and empty cause; each shard has complete exit-0 T0, T1, T2, T3, T4 and Web receipts at the matching verification tree. Provenance: requested full head, branch dev, occasion release, executor droplet, linux x64 6.8.0-149-generic, Node v24.21.0, Neovim v0.12.5, two shards with workers 2. Owner aggregate: 10,121 tests, 10,107 pass, 0 fail, 0 cancelled, 14 skipped, 0 todo. Owner pass accounting explicitly reports 10,110 raw base pass finishes, difference +3, with three finishes without retained starts; these are not added to the aggregate. Both c-8 nyc1 leases are released: shard-1 cland-v0-174827a5 lifetime 3359.420 s, cost $0.2332930556; shard-2 cland-v0-c6b81735 lifetime 2576.059 s, cost $0.1788929861; total $0.4121860417. Lifetime details come from producer lease receipts and include provisioning/cleanup; they are not test-case wall times.

M4: macOS cover 35f47391-a4b5-41b7-922d-a1e655727c97, log A-23865 and coverage map A-23866. Structured result.json has code 0, empty cause and six complete exit-0 T0–T4/Web receipts. Provenance: requested full head, matching verification tree, branch dev, occasion release, executor local, darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5. Owner summary workers 1 (Web phase reports 2). Aggregate: 10,117 tests, 10,115 pass, 0 fail, 0 cancelled, 2 skipped, 0 todo. Owner pass accounting explicitly reports 10,118 raw base pass finishes, difference +3, three finishes without retained starts. Local cost is not applicable.

Both covers are uncached (cached null). Browser binary: playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell on Linux and corresponding chrome-headless-shell-mac-arm64/chrome-headless-shell on macOS; version Google Chrome for Testing 156.0.8078.4. Absolute binary paths remain in source provenance. T4 ran 18 files in base phase only; extra repetitions did not run. Skips remain skips: Linux includes macOS-only checks and unavailable OpenCode/zsh prerequisites; macOS excludes the two Linux identity/procfs checks. Budget, fixed-wait/test lint, condition-wait growth, T3 ratchet and skip-reason checks are report-only, not enforced success claims. No timing comparison or performance conclusion is made.

Commands/observations: live-root task list --under E-2074 --state open/closed and task.view for every child; exact anchored Item trailers in first-parent git log through the requested build; parsed producer results and provenance plus owner suite aggregates in Agents history; demo status E-2074 --commit BUILD --json freshness.current true. M1–M4 were recorded from the clean detached build with qa-record.sh note. Criterion marks requested by this verdict: C1 and C2 only.



Child census:

| child | current verified/total | landing |
| --- | --- | --- |
| T-1909 | 2/2 | f16bf42c06752b592762bf8644ae6086cc4ac7bb |
| T-1928 | 2/2 | cacd3e2af8fd4a7228611e49c1091f3b49d2f08f |
| T-1929 | 2/2 | b3e3f89e8f005a19ee08b76dc19ea4e63da3b175 |
| T-1936 | 1/1 | 4b32771d6f053b481736e3599ff46ace99265fb2 |
| T-1938 | 2/2 | 3527836bcead46d7653e87ab5319561fd9b45fab |
| T-1942 | 2/2 | 3e5371bca5373797311a610cb21285eef12a9327 |
| T-1945 | 2/2 | 2daa0922f1d9597fc109ba69debe2189cb1e7929 |
| T-1953 | 2/2 | 5013bf03f3ae35c0cc55f7a9f5f6cc5de72d1a52 |
| T-1962 | 2/2 | 58104b5599425f85c3b01093eca02e6498e51c2a |
| T-2002 | 1/1 | 4464147fe36de69f2db43d4951c9f138b0e3e397 |
| T-2003 | 3/3 | cf963a7786f795ede6a4be86d1336eff57484752 |
| T-2023 | 3/3 | 8706ce4b1f0c9424c527f3008e7494f842fcc1e0 |
| T-2027 | 2/2 | 5fcabfb42a68e05a1ffafe48ac9aa7a385e2fa6a |
| T-2029 | 2/2 | f7b5a2ab0b58b2c7c316246c34db1e564944e648 |
| T-2037 | 2/2 | f7d158c370d731c12188b2767f795b8e9c1c074b |
| T-2044 | 2/2 | ddc9dc1136c15f46a2d605949a04325cfd00c857 |
| T-2045 | 1/1 | bd61542fd1266825d4c72a0af3dda4a78c201c9e |
| T-2057 | 2/2 | fb9bcf93b113dcbedb3d9e17e8a09b479de880cc |
| T-2065 | 1/1 | 5c77eed4aa937d40b15902e605b3570e3973c8f3 |
| T-2084 | 3/3 | d85fbb5cae6fdc272d64bbb4d5373673d07016a3 |
| T-2089 | 1/1 | 073a7a2f4ef3a038f3c23087c13da746467b6483 |
| T-2092 | 2/2 | 03fe7325e72e623aa51e6cf9b02e32f19315e785 |
| T-2100 | 1/1 | 247e8b3fc4256dfce54ddb7dea0329b0c1ec36f8 |
| T-2112 | 2/2 | f24c4aaf92f63d825ecb53cd974095198d957f0c |
| T-2116 | 2/2 | 9db633e72e4d6a89762494fce17b7e1c5e228e28 |


Full evidence: A-23869, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23869-e-2074-evidence-only-qa-at-5862e24.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-27T19:00:27.933Z

Closed on QA clear qa-20261127-2074-1 at 5862e24c4 (A-23869). C1: all 25 children closed with their landings. C2: Linux release cover 4bab60dc (A-23861) and macOS release cover 35f47391 (A-23865), both green at 5862e24c4.
