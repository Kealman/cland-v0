---
id: T-1285
kind: task
title: "doctor.test.ts fails in a crew session's shell: three cases inherit the session's CLAND_* variables and hit the scratch hub's credential check"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1282
blocked_by: []
topic: topic-1054
branch: t/T-1285-doctor-test-ts-fails-in-a-crew-session-s
created: 2026-10-25T10:06:40.797Z
updated: 2026-10-25T13:15:29.727Z
closed: 2026-10-25T13:15:29.727Z
---

## Summary

Found by impl-1258 on 2026-10-25 at 10:06Z and reproduced by coord on dev 82cf0f6c (macOS). Run from a crew session's shell, `node --test hub/test/doctor.test.ts` fails 3 of 19:
- "a broken skills symlink fails with the fix";
- "the managed hooks or AGENTS.md block removed: named failures, fixed by cland update";
- "doctor warns about free OpenCode training and its missing OS sandbox without failing".

The error is `fail hub: pid … holds the lock but does not answer on <scratch>/.cland/hub.sock (session "<name>" credential is missing or invalid …)`. With the six inherited CLAND_* variables unset (CLAND_LAUNCH_TOKEN, CLAND_SESSION_NAME, CLAND_SESSION_ID, CLAND_HUB_FILE, CLAND_NODE, CLAND_CLI), it passes 19/19. The doctor child processes don't build their environment through the shared sealed builder (rule 15), so they act as the outer session against the scratch hub (T-1220's credential admission). Droplet verifies pass because they have no CLAND_* variables.

## Acceptance criteria

- [x] C1. doctor.test.ts passes with its original cases plus one regression when run with CLAND_* session variables set in the parent environment; doctor's hub check uses the environment runDoctor receives (fixtureEnvironment in the tests), never the ambient process.env, and a red control shows the old ambient read failing (test).
  - done: impl-1285 · 2026-10-25T12:54:17.945Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1285-final · 2026-10-25T13:09:38.839Z · commit 91a684a148196b963e0b66eeb2053e5ba8416e2d
- [x] C2. The T0 child-environment lint (T-1237's guard) or an equivalent check flags this inheritance pattern in hub/test, with the doctor case as its positive control (test).
  - done: impl-1285 · 2026-10-25T12:54:18.071Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-1285-final · 2026-10-25T13:09:38.839Z · commit 91a684a148196b963e0b66eeb2053e5ba8416e2d

## Comments

### impl-1285 · 2026-10-25T12:50:19.633Z

Inspection: worktree clean. Existing pre-agreed seams are doctor.test.ts's public doctor/update fixture (T2) and lint-child-environment.ts's in-memory compiler controls (T0). Current doctor-fixture.ts update calls runUpdate without an environment seam, allowing ambient crew credentials into its production hub read. Will retain these seams and prove synthetic parent CLAND_* isolation; no production/shared wire contract change.

### impl-1285 · 2026-10-25T12:51:26.611Z

Consumer inventory before changing the local ProjectReaders injection seam: production runDoctor -> checkProject -> checkHub (hub/src/cli/doctor.ts, hub/src/doctor/project.ts); direct checkProject callers hub/test/init-skills-update.test.ts and hub/test/init.test.ts; DoctorReaders.project in hub/test/doctor-fixture.ts. Repository search finds no web/nvim/QA/skills/startup/persisted-reader consumers of ProjectReaders/checkProject. The socket wire and admission policy are unchanged, as are omitted-env defaults. Earlier attribution to update was incorrect: checkHub's askHub silently reads process.env instead of runDoctor's explicit environment.

### rev-34 · 2026-10-25T12:56:02.514Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1285-source1
commit: 91a684a148196b963e0b66eeb2053e5ba8416e2d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear at corrected91a684a1; A-11938 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11938-t-1285-full-source-review-at-91a684a1.md). PreliminaryM1 heading resolved with unchanged docs guard red/green; no remaining findings. Explicit doctor env reaches project hub.status, ps and timeout; omitted-env defaults and credential admission remain. Shared sealed toolchain/provision fixture, ambient-vs-explicit synthetic regression and historical doctor compiler rejection retain original19cases and no new exemptions. Local A-11936 targeted/source limits preserved; C1/C2 remain unverified pending same-head configured proof. Item QA none.

### impl-1285 · 2026-10-25T13:08:15.950Z

Verification receipt: run fa572699-d82b-49a3-a32e-5c7a03d10fea at unchanged reviewed head 91a684a148196b963e0b66eeb2053e5ba8416e2d, A-11956. Linux x64 droplet c-8 lon1; Node v24.21.0; Chrome Headless Shell 156.0.8078.4 (v1248). T0 clear, all T1 + fallback all T2 including Neovim + Web: 3208 pass, 0 fail/cancel/skip. T3/T4 deferred per task policy. Duration budgets report-only. New test `hub/test/doctor.test.ts::doctor uses its fixture environment rather than the parent crew session` passed base in 0.20350938 s; five repetition receipts all pass in 0.230402433, 0.209963267, 0.193307509, 0.223823253, 0.224604368 s. No >=3 s Linux duration allowance required. Existing 19 doctor cases each retain passing receipts. Droplet lifetime 638 s, cost $0.0443. Final evidence review requested from responsible Reviewer role.

### rev-34 · 2026-10-25T13:09:38.839Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-1285-final
commit: 91a684a148196b963e0b66eeb2053e5ba8416e2d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head clear:fa572699/A-11956; audit A-11958 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11958-t-1285-final-evidence-at-91a684a1.md), carrying source1/A-11938. Parsed3208ordinary+5load passes. Doctor20/20 original19plusnew env regression; exact new case ordinary+5/5load retains ambient-vs-explicit admission assertions. HostT0 child-env guard passes with named historical doctor compiler rejection; docs guard3/3 confirmsM1. HostT0/LinuxT1/allT2/Web complete, T3/T4 absent, prepared host check not repeated remotely. Report-only warnings preserved; newcase<3s no allowance. C1/C2 verified, no findings; QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T13:15:29.727Z

Merged 129fca845b8932c30e4bdae17e17d17999dd08c1 onto dev.
