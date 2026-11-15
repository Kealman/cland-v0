---
id: T-1836
kind: task
title: Doctor's sign-in mode line
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1829
topic: topic-1517
branch: t/T-1836-doctor-s-sign-in-mode-line
created: 2026-11-12T10:07:22.789Z
updated: 2026-11-15T05:56:23.890Z
closed: 2026-11-15T05:56:23.890Z
---

## Summary

`cland doctor` reports the sign-in mode. In users mode it also gives the number of users and of admins, read from the running hub.

## What to build

One line in doctor's shape, with `--json`. In single mode it reads `ok`, "sign-in mode single". In users mode it reads `ok`, naming the mode, the number of users by state, and the number of admins, from `user.list` on the running hub. Without a hub, the line reads the mode from config and says "hub not running" for the counts, with `cland hub start`. A users-mode project with no active admin is `warn`, with `cland user invite <name>`. No invite link, passkey material or password material appears in the output.

## Acceptance criteria

- [x] C1. In single mode doctor prints one `ok` line naming the sign-in mode (test).
  - done: impl-1836 · 2026-11-15T04:28:55.006Z
  - verified: rev-35 [reviewer] · run rev-35-1836-final-1 · 2026-11-15T05:06:01.913Z · commit 5d2f6fd812795235d696fe0d0c1babf1c606a699
- [x] C2. In users mode doctor names the mode with the number of users by state and of admins from a running hub, and "hub not running" with `cland hub start` without one (test).
  - done: impl-1836 · 2026-11-15T04:36:22.226Z
  - verified: rev-35 [reviewer] · run rev-35-1836-final-1 · 2026-11-15T05:06:01.913Z · commit 5d2f6fd812795235d696fe0d0c1babf1c606a699
- [x] C3. A users-mode project with no active admin reads `warn` with `cland user invite <name>` (test).
  - done: impl-1836 · 2026-11-15T04:28:55.551Z
  - verified: rev-35 [reviewer] · run rev-35-1836-final-1 · 2026-11-15T05:06:01.913Z · commit 5d2f6fd812795235d696fe0d0c1babf1c606a699
- [x] C4. No invite link, passkey or password material appears in the text or the `--json` output (test).
  - done: impl-1836 · 2026-11-15T04:28:55.774Z
  - verified: rev-35 [reviewer] · run rev-35-1836-final-1 · 2026-11-15T05:06:01.913Z · commit 5d2f6fd812795235d696fe0d0c1babf1c606a699

## Blocked by

- E-1536 (closed)
- T-1829 (the doctor check list)

## Notes

- Hot files: `hub/src/doctor/users.ts` (new), `hub/src/cli/doctor.ts`.
- Tests: new `hub/test/doctor-users.test.ts` (T2, `projectHub` in both modes).
- Serves the Contents' users stage (doctor's mode line); no checkbox names it.

## Comments

### impl-1836 · 2026-11-15T04:23:13.366Z

Rule 20 sweep: searched doctor/runDoctor/checkHosts, checks/summary, user.list and auth.mode across hub/src, hub/test (all tiers via tiers manifest), nvim, web, setup, shipped skills, QA briefs and docs/site. CLI runDoctor/report renders generic Check[]; preserve {root,version,checks,summary} and existing rows, add only sign-in mode Check. Neovim/web have no doctor-report parser (Neovim README only). Setup imports shared probe/report types, not runDoctor; unchanged. doctor.test/doctor-cli assert generic envelope and dynamic lengths; host/remotes tests filter names. E-1537 stage 3/4 briefs select host rows and retain their literal expectations; unchanged. Existing user.list consumers cli/auth, web user UI and auth tests remain unchanged (no wire change). Previous hub refusal will be tested as unknown, never zero. Seam prescribed by item: T2 doctor text/JSON with projectHub, plus previous-hub refusal fixture.

### rev-35 · 2026-11-15T04:34:13.221Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1836-source-1
commit: 93460ad358844a121c935e31a22cb8d7d53200f5
scope: full
findings: [{"severity":"medium","text":"HubTimeout does not prove hub offline: a live accepted user.list can simply not reply. Keep timeout counts unknown/unavailable rather than hub-not-running/start guidance, with a held-live-reply regression and matching docs.","file":"hub/src/doctor/users.ts","line":39},{"severity":"medium","text":"Frozen DOCTOR_USAGE lacks the newly added sign-in mode help line; unchanged byte-compatibility and full-help composition consumers cannot match. Refresh the owning fixture row and retain guards.","file":"hub/test/fixtures/cli-usage/commands.json","line":21}]
finding_counts: {"high":0,"medium":2,"low":0}

Complete source pass not clear, A-19495: Standards1medium/Spec1medium. Coordinator4324006e config-mode/hub-count/refusal policy checked; normal count/no-admin/metadata-only paths otherwise match and envelope unchanged. Both findings confirmed by lead; fix together after this hold release, then fresh exact-head source review before mode-free verify. A-19493 preserves honest candidate producer excerpts/consumer dispositions and capture limits; no runtime/provenance rerun. C1/C3/C4 remain unverified pending corrected-head positives; T3/T4/after-stageQA separate.

Criteria: C2 failed (A timed-out live hub is incorrectly labelled hub not running; no positive-down receipt or accepting disposition exists.).

### impl-1836 · 2026-11-15T04:35:53.661Z

Review corrections: timeout now retains unavailable counts (no positive offline receipt), with held-live user.list test and injected transport clock. DOCTOR_USAGE frozen commands.json owning row migrated; compatibility1/1 and real CLI help9/9 passed locally. Expanded consumers include direct legacy fake callers doctor-{remotes,hosts,users}, setup-hosts and remote-cli tests (new users/holdUsers options opt-in); generic CLI/native doctor callers doctor-cli, orphan-sweep-lock, telegram-liveness, territory-cli, web-edge, fixture-orphans, hub-priority, doctor-isolation remain unchanged and locally unexecuted. They are planned via diff selection/fallback or deferred T3 stage coverage, not claimed passes. A-19493 records original tool excerpts and provenance limits.

### rev-35 · 2026-11-15T04:38:10.208Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1836-source-2
commit: 5d2f6fd812795235d696fe0d0c1babf1c606a699
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at clean5d2f6fd812795235d696fe0d0c1babf1c606a699/treea7ac321c4bf58df3f4a0d24dd6aa74776c1433c6. A-19505 records Standards0/Spec0remaining: both A-19495 findings resolved. Timeout counts stay unavailable/reload; positive offline evidence retains start. Held-live regression observes request before injected-clock advance, exact warning and live listener, with failure-path work/socket cleanup before roots. Frozen DOCTOR_USAGE owning bytes equal pure export; compatibility controls unchanged. Seven-case candidate evidence/A-19502 and A-19493 capture limits stay qualified. C1-C4 remain unverified pending same-head configured positives; normal mode-free verify may proceed. No Reviewer runtime/provenance rerun; unchanged remainingT3/T4/stageQA separate.

### rev-35 · 2026-11-15T05:06:01.913Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1836-final-1
commit: 5d2f6fd812795235d696fe0d0c1babf1c606a699
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; C1-C4 verified. A-19536 independently audits A-19535/e1282e0d at clean5d2f6fd81/tree44c32d2f: all7 exact doctor-users base cases pass, each5 load test/file pairs (35matched), ordinary file15042pass5.030s; base case sum~3.68s distinct. Frozen-help compatibility952/955 and full-help12174 positive; doctor/legacy callers allselectedpositive.6325ordinary tests/696files plus195separate load tests/files, no negative finishes;220T1+422T2+54Web accounted zero missing. Provenance36192 Linux droplet Node24.21/nvim.12.5 actual HeadlessShell1248/CfT156.0.8078.4 no cache/skips,1484s/$0.1031. Both source findings resolved; report-only warnings, candidate capture limits and265T3/17T4/after-stageQA separate occasions explicit. No Reviewer runtime/provenance rerun.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-15T05:56:23.890Z

Merged d3a71302558a61b8c353cb7ef9777f49b75e5dcf onto dev.
