---
id: E-617
kind: epic
title: Release v0.1.4 from the item
state: closed
criterion_seq: 6
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by:
  - E-612
  - E-613
  - E-611
  - E-614
  - E-615
  - E-616
  - E-424
  - E-482
  - E-578
  - E-579
topic: topic-703
branch: null
created: 2026-10-16T15:34:18.937Z
updated: 2026-10-20T09:35:31.370Z
closed: 2026-10-20T09:35:31.370Z
---

## Summary

v0.1.4 ships from its release item R-577 once every other epic has closed on its QA demo: two end-to-end demos on this Mac, the newcomer's first page, the green suites, the version bump and the dry run close this epic, and the release, its check and the retrospective follow. The release is the build's only push to GitHub.

## Goal

v0.1.4, "cland on a new project", ships from its release item: `cland release --item R-577` publishes version 0.1.4 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective records the run. Before it, QA takes both paths a newcomer takes, on this Mac, from the first command to a crew at work: an empty folder, and a clone of an existing public repository. The build of v0.2, the web workbench (R-377), follows.

## Contents

- **The demos** (Q-601 resolution 4), run by QA on this Mac with its real harnesses:
  - a fresh folder, then `cland init`, `cland setup` and the onboarding of an empty project, with the Coordinator taking the first task to a merge;
  - a clone of a public repository, then `cland init`, `cland setup` and the onboarding, with the import of its open issues and a first release from "what next".
- **The other epics.** The six theme epics closed on their demos; the carried-over E-424, E-482, E-578 and E-579 done, or re-carried by the human's decision; R-577's own tasks (T-609 and T-610 at this writing) done, moved under an epic, or re-carried.
- **The docs.** `hub/README.md`'s first page, the READMEs, `docs/agents/tests.md` and the templates `cland init` writes describe v0.1.4 as built.
- **The version bump.** An ordinary commit sets the root `package.json` version to 0.1.4 before the dry run, since `cland release` refuses a version that differs (Q-599 resolution 7).
- **The release.** R-577's `## Notes` written from the item and its epics; `cland release --item R-577 --dry-run`, with its notes and version 0.1.4 shown in an ask; `cland release --item R-577`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective**: an artifact of the run, as for v0.1.3.

Not in this epic: findings of the demos or the release that need the human's decision, which go to Bugs or Follow-ups and wait for the human; the one-command install (deferred, Q-592); the build of v0.2.

As in E-426:

- **The epic closes before the release.** `cland release --item` refuses a release while a child is open, so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on R-577.
- **The version** is R-577's recorded 0.1.4. The Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- **The suites.** A full suite on the dry run's tip, sharded on droplets as a release run, and one full local run on macOS for the macOS-only cases.
- **The carried-over epics** run in the lanes' gaps, at the Coordinator's discretion (Q-601 resolution 2).

## Tracer-bullet order

1. **The empty-folder demo.** Demo: in a fresh folder on this Mac, `cland init`, `cland setup` and the onboarding lead to a first release, and the Coordinator takes its first task through review and verify to a merge on `dev`.
2. **The existing-project demo.** Demo: in a clone of a public repository, `cland init`, `cland setup` and the onboarding import its open issues and file a first release from "what next".
3. **The docs, the bump, the notes and the dry run.** Demo: the dry run prints version 0.1.4 and the notes, with every other child of R-577 closed and the root `package.json` at 0.1.4.
4. **The release and its check.** After this epic closes: the ask, `cland release --item R-577`, and QA's check of the tag. Demo: tag `v0.1.4` is on GitHub `main`, R-577 is closed, and QA's verdict on R-577 is clear.
5. **The retrospective.** After the release: the artifact of the run.

## Definition of done

QA runs the demo below on `dev` on this Mac, playing the human through a terminal, the `cland` CLI and a headless workbench, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it.

In a fresh folder, QA follows `hub/README.md`'s first page through `cland init` and `cland setup` into the onboarding of an empty project, answers the Aide, gives its ok to the start, and watches the Coordinator take the first task to a merge on `dev`. In a clone of a public repository with open issues, QA follows the same page into the onboarding, confirms the import and reads a first release filed from "what next". On `dev`, `cland task list --under R-577 --state open --json` lists only this epic; QA reads the root `package.json` version, R-577's notes and `cland release --item R-577 --dry-run` with version 0.1.4, and the latest full suites on that tip, sharded on droplets and local on macOS, are green.

- [ ] C1. Every other epic of R-577 is closed on a clear QA verdict, or re-carried by the human's decision, and no open item other than this epic remains under R-577.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T09:35:08.645Z · commit 7916d5f71b99d937331e31618ffdcbab799b5393
- [ ] C2. In a fresh folder on this Mac, `cland init`, `cland setup` and the onboarding of an empty project end with the Coordinator taking the first task to a merge on `dev`.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T09:35:08.645Z · commit 7916d5f71b99d937331e31618ffdcbab799b5393
- [ ] C3. In a clone of a public repository, `cland init`, `cland setup` and the onboarding import its open issues and file a first release from "what next".
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T09:35:08.645Z · commit 7916d5f71b99d937331e31618ffdcbab799b5393
- [ ] C4. `hub/README.md`'s first page takes a newcomer from the checkout install to the workbench, and the docs and the templates `cland init` writes describe v0.1.4 as built.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T09:35:08.645Z · commit 7916d5f71b99d937331e31618ffdcbab799b5393
- [ ] C5. The root `package.json` is at 0.1.4 on `dev`, R-577's `## Notes` describe the release by epic, and `cland release --item R-577 --dry-run` shows them with version 0.1.4.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T09:35:08.645Z · commit 7916d5f71b99d937331e31618ffdcbab799b5393
- [ ] C6. A full suite is green on the `dev` tip of the dry run, sharded on droplets as a release run, with a local run on macOS for the macOS-only cases.
  - verified: qa-676 [qa] · run qa-2026-10-20-2 · 2026-10-20T09:35:08.645Z · commit 7916d5f71b99d937331e31618ffdcbab799b5393

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item R-577` on the answer; QA checks that tag `v0.1.4` is on GitHub `main` and records its verdict on R-577; the retrospective artifact follows and is linked from R-577.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item R-577` is the only push to GitHub in this build.
- **ADRs.** 0004 (Agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (Tracker files are the source of truth): the notes live in R-577's file.
- **Risks.**
  - The demos run this Mac's real harnesses on the human's logins and spend real model calls. The trust step adds the scratch folders to the human's harness configurations, and the accounts question is answered No, so `~/.config/cland/accounts.toml` stays as it is.
  - No demo step pushes to the public repository: its remote is `github`, and only `cland release` pushes there, which never runs in a demo project.
  - A refused release (an open child, a dirty root, a version that differs) is fixed before it is retried, never overridden.
- **Order.** Last: blocked by the six theme epics and by E-424, E-482, E-578 and E-579. These edges stay `blocked_by`, since the release needs every other epic closed, not only merged.

## Links

- Spec: `docs/spec/v0.1.4.md`, §4 (The cut and the definition of done) and §3.8 (Hygiene); `docs/spec/v0.1.md` §4 (D16).
- Items: R-577, the release item; Q-601 (the cut, the lanes and the definition of done); E-426, the v0.1.3 release epic and the model for this one; E-424, E-482, E-578 and E-579, the carried-over epics; T-609 and T-610, R-577's own tasks.
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.

## Plan

```yaml
stages:
  - name: release readiness
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-798
      - - T-940
      - - T-941
      - - T-943
      - - T-944
      - - T-945
      - - T-948
```

## Comments

### coord · 2026-10-20T05:55:41.133Z

Disposition D75 (stand-in under D24, ask 9b54b5fa, 2026-10-20 ~05:58Z; the stand-in proposed numbering it D74, which E-677 C7 already holds). Applying D71's reasoning, C2 and C3 are demonstrated end to end on fake harnesses:
- C2: a fresh folder → `cland init` → `cland setup` → onboarding of an empty project → the Coordinator takes the first task to a merge on `dev`.
- C3: a clone of a public repository → `cland init` → `cland setup` → onboarding → issue import → a first release filed from "what next".
QA plays the human through the terminal, the CLI and a headless workbench, with the fake Claude, Codex and OpenCode binaries in an isolated HOME. No real model calls; nothing added to the human's own harness configs or trust lists. The live newcomer demos on the human's logins stay the human's choice after the release, offered in the release ask. C1, C4, C5 and C6 are judged as written.

### qa-676 · 2026-10-20T09:35:08.645Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-2
commit: 7916d5f71b99d937331e31618ffdcbab799b5393
findings: [{"severity":"low","text":"E1/X1 accounts expected skip; isolated single-profile machines correctly return ok/no new signed-in profiles, ask nothing and create no accounts.toml. Requester ruling 0aedd533 accepts behavior.","file":"qa/briefs/E-617.md","line":222},{"severity":"low","text":"E5 prescribed Implementer verify --report general is refused by artifact topic authorization. Corrected under requester f3c46212 to own bound item topic at the unchanged reviewed head; original refusal retained.","file":"qa/briefs/E-617.md","line":287},{"severity":"low","text":"CLI lacks topic create, so the faithful scratch Implementer replay needed shared/socket-client askHubFrame topic.create with item T-6, under unchanged impl-1 identity. Authorized by requester 1985e26a; CLI follow-up is to be filed by Coordinator.","file":"hub/src/cli/usage.ts","line":165},{"severity":"low","text":"E4/X3 immediate fake job-log grep races asynchronous brief delivery: first read 0, later same log 1 without relaunch/resend. Check delivered log state rather than launch acknowledgement.","file":"qa/briefs/E-617.md","line":267},{"severity":"low","text":"X2 says gh.log contains only import API calls, but X0 explicitly adds --version. Actual log has that probe plus only the expected open-issues API; no PR/all-issue/comment reads.","file":"qa/briefs/E-617.md","line":378},{"severity":"low","text":"R4 expected-deliverables shell appends a colon to E-578/E-579 despite absent Goal text; actual preview correctly emits title only. All 14 epic deliverables match semantically.","file":"qa/briefs/E-617.md","line":438},{"severity":"low","text":"F2 initial process count 1 came from QA intermediate shutdown omitting resumed impl-1. Restarted scratch hub correctly tracked PID53951 as running; session stop cleared it and child68777. Final count0, roots removed. Run hygiene only per requester 0e9efeb5; no product orphan or signal workaround."}]
finding_counts: {"high":0,"medium":0,"low":7}

| Check | Surface | Result | Evidence |
| --- | --- | --- | --- |
| G0 | local macOS / hub-api or retained logs | PASS | G0-build.txt |
| G1 | local macOS / hub-api or retained logs | PASS | G1-gates.txt, G1-epic.json |
| G2 | local macOS / hub-api or retained logs | PASS | G1-epic.json |
| G3 | local macOS / hub-api or retained logs | PASS | G3-scripts.txt, G3-holder.txt, G3-locks.txt |
| H0 | local macOS / hub-api or retained logs | PASS | H0-before.txt |
| T1 | local macOS / hub-api or retained logs | PASS | T1-summary.txt, T1-open.json, T1-all.json |
| T2 | local macOS / hub-api or retained logs | PASS | T2-verdicts.txt |
| E0 | local macOS / hub-api or retained logs | PASS | E0-build.txt, G3-holder.txt |
| E1 | local macOS / hub-api or retained logs | PASS | E1-result.txt, E1-init.txt, E1-setup.txt, E1-accounts.txt, E1-sessions.json |
| E2 | local macOS / hub-api or retained logs | PASS | E2-result.txt |
| E3 | local macOS / hub-api or retained logs | PASS | E3-result.txt |
| E4 | local macOS / hub-api or retained logs | PASS | E4a-result.txt, E4b-result.txt, E4-delivery-reread.txt |
| E5 | local macOS / hub-api or retained logs | PASS | E5-verify.json, E5-topic-create.json, E5-topic-bound.json, E5-verify-corrected.json, E5-suites.txt, E5-merge.json, E5-landing.txt, brief-corrections.md |
| E6 | local macOS / hub-api or retained logs | PASS | E6-result.txt, E6-templates |
| X0 | local macOS / hub-api or retained logs | PASS | X0-result.txt, X0-network-guard.txt |
| X1 | local macOS / hub-api or retained logs | PASS | X1-result.txt, X1-setup.txt, X1-accounts.txt |
| X2 | local macOS / hub-api or retained logs | PASS | X2-result.txt, X2-import.txt, X2-open.json |
| X3 | local macOS / hub-api or retained logs | PASS | X3a-result.txt, X3b-result.txt, X3-delivery-reread.txt |
| D1 | local macOS / hub-api or retained logs | PASS | D1-first-page.txt |
| D2 | local macOS / hub-api or retained logs | PASS | D2-walk.txt, D2-reopen.txt |
| D3 | local macOS / hub-api or retained logs | PASS | D3-matrix.txt, D3-fixed-lines.txt, D3-budget-section.txt |
| D4 | local macOS / hub-api or retained logs | PASS | D4-templates.txt, E6-templates |
| R1 | local macOS / hub-api or retained logs | PASS | R1-version.txt |
| R2 | local macOS / hub-api or retained logs | PASS | R2-notes.md, R2-epics.txt, R2-known-items.txt |
| R3 | local macOS / hub-api or retained logs | PASS | R3-root-dry-run.txt |
| R4 | local macOS / hub-api or retained logs | PASS | R4a-result.txt, R4b-result.txt, R4-preview.txt, R4-preview.json, R4-validation.txt, R4-deliverables-check.txt |
| H1 | local macOS / hub-api or retained logs | PASS | H0-before.txt, H1-after.txt, H1-comparison.txt, H1-isolation.json |
| F2 | local macOS / hub-api or retained logs | PASS | F2-processes.txt, F2-recovery-sessions.json, F2-recovery-stop.txt, F2-owned-pids-after.json, F2-processes-after.txt, F2-cleanup.txt |
| S1 | local macOS / hub-api or retained logs | PASS | S1-release.json, A-7251-suite-9bbe4fc1-1cc4-4146-8ccb-bc7a07d1be35-all-at-7916d5f.log, A-7252-suite-9bbe4fc1-1cc4-4146-8ccb-bc7a07d1be35-shard-1-at-7916d5f.log, A-7253-suite-9bbe4fc1-1cc4-4146-8ccb-bc7a07d1be35-shard-2-at-7916d5f.log |
| S2 | local macOS / hub-api or retained logs | PASS | S2-mac.json, A-7247-suite-2881edee-eac6-44eb-9353-4f55df0b3bb7-all-at-7916d5f.log |
| S3 | local macOS / hub-api or retained logs | PASS | S3-heads.txt |
| S4 | local macOS / hub-api or retained logs | PASS | S4-scenarios.json |
| F1 | local macOS / hub-api or retained logs | PASS | F1-summary.txt, F1-status.json, F1-locks.txt |

## Findings, ranked

No high or medium findings remain. These low findings do not represent unmet criteria; the requester corrected the brief where noted.

1. **Low** — qa/briefs/E-617.md:222. E1/X1 accounts expected skip; isolated single-profile machines correctly return ok/no new signed-in profiles, ask nothing and create no accounts.toml. Requester ruling 0aedd533 accepts behavior.

2. **Low** — qa/briefs/E-617.md:287. E5 prescribed Implementer verify --report general is refused by artifact topic authorization. Corrected under requester f3c46212 to own bound item topic at the unchanged reviewed head; original refusal retained.

3. **Low** — hub/src/cli/usage.ts:165. CLI lacks topic create, so the faithful scratch Implementer replay needed shared/socket-client askHubFrame topic.create with item T-6, under unchanged impl-1 identity. Authorized by requester 1985e26a; CLI follow-up is to be filed by Coordinator.

4. **Low** — qa/briefs/E-617.md:267. E4/X3 immediate fake job-log grep races asynchronous brief delivery: first read 0, later same log 1 without relaunch/resend. Check delivered log state rather than launch acknowledgement.

5. **Low** — qa/briefs/E-617.md:378. X2 says gh.log contains only import API calls, but X0 explicitly adds --version. Actual log has that probe plus only the expected open-issues API; no PR/all-issue/comment reads.

6. **Low** — qa/briefs/E-617.md:438. R4 expected-deliverables shell appends a colon to E-578/E-579 despite absent Goal text; actual preview correctly emits title only. All 14 epic deliverables match semantically.

7. **Low** — run hygiene. F2 initial process count 1 came from QA intermediate shutdown omitting resumed impl-1. Restarted scratch hub correctly tracked PID53951 as running; session stop cleared it and child68777. Final count0, roots removed. Run hygiene only per requester 0e9efeb5; no product orphan or signal workaround.

## Criteria and explicit substitutes

- **C1:** live R-577 tree contains only E-617 open; all 13 other epics closed on clear QA. Exact prior runs/commits retained in T2-verdicts.txt. Coordinator root dry run A-7250 refuses only E-617.
- **C2:** fresh-folder init → setup → fake Aide onboarding replay → reviewed/verified first task → Coordinator merge. Scratch T-6 review head `a4c2e20f1075a86f4e097f5a9d26d58f40f6ce1c`; task verify `261993ff-c0e3-4741-88f9-492371fa0397` finished code0/reported; merge `34663c8674893539969c0acd399a0cf47c44999d`, C1 verified, task closed and branch/worktree removed. **D75 fake harnesses**, QA plays each role's acts through the scratch CLI. **Workbench substitute:** stand-in launcher receives Aide/root; the release/Mac logs supply real Neovim scenario evidence.
- **C3:** two-commit full local clone with fixture GitHub URL, fake gh open-issues API and `GIT_ALLOW_PROTOCOL=file`. Exactly two issues imported, pull request skipped, both planned under R-7 “What next”; original files/upstream unchanged. **Local public-clone substitute:** no real GitHub clone or issue-study command. Fake Aide/Coordinator under D75; same workbench substitute as C2.
- **C4:** first page, all required matrix cells, corrected T-943 documentation, generated config/roles/AGENTS/docs and 21 skills match S8. Reopen/stop walkthrough passes. **Install line read-only:** tag install belongs to a separate post-release request; not executed here.
- **C5:** package/lock/CLI 0.1.4; committed R-577 Notes cover every epic. Coordinator root refusal A-7250 retained. **Scratch preview substitute:** v0.1.4 at `8c642f8deb1503ce6e5d1b10bdf0a314e7dde993`, exact committed Notes prefix and all 14 epic deliverables; fixture remote retains only Initial main/no tag. Scratch T3 proof uses the release tests' fixture receipt and does not prove the real gate; C6 is independent real-suite evidence. No real-project release or push was run.
- **C6:** fresh two-shard Linux **release** receipt A-7251, shard logs A-7252/A-7253; Mac full A-7247 and Linux stage A-7243, all exact S8. No cache receipt used. Earlier cached release attempt A-7249 is excluded; Coordinator filed T-950. All 11 supporting scenarios have actual ✔ lines in the fresh release and Mac logs.

## Executor receipts

| Receipt | Platform / machine | Result | Duration / lifetime | Cost |
| --- | --- | --- | --- | --- |
| A-7252 release shard 1 | Linux droplet cland-v0-cffe3503, c-8 lon1 | 1716 pass, 4 platform skips, 0 fail/cancel | 912.75 s / 905 s | $0.0629 |
| A-7253 release shard 2 | Linux droplet cland-v0-f9910fa9, c-8 lon1 | 1473 pass, 4 platform skips, 0 fail/cancel | 806.75 s / 807 s | $0.0560 |
| A-7251 merged release | two shards, occasion release | 3189 pass / 3197 tests, 8 platform skips | **932.47 s total wall** | **$0.1189 total** |
| A-7247 local full | macOS darwin arm64 27.0.0; Node24.21.0; Neovim0.12.5 | **3197/3197 pass**, no failure/cancel/skip | retained full local log | n/a |
| A-7243 stage support | two Linux c-8 lon1 droplets | 3189 pass, 8 platform skips | 943.74 s overall; shards 943.51/880.79 s; lifetimes906/868 s | $0.1232 |

Each release shard ends `Finished: exit 0`; no shard failure or skipped sharding. All eight Linux skips are macOS sandbox/inhibitor or unavailable real-OpenCode cases; each exact test name has a Mac pass line (S2-mac.json). Report-mode budget diagnostics are retained, not counted as failures (D73). No QA demo lease or extra full suite; only the scratch project's one-file test was submitted locally.

## Freshness and cleanup

Final dev is exact S8, code/Notes comparison diffs are empty, and demo freshness is `current:true`. All scratch sessions stopped and all fixture roots/tmpdirs removed; final process count0 and leftover tracked PIDs explicitly confirmed gone. The detached QA build is removed after verdict. The human's Claude config mtime changed with identical size while other live sessions ran; all scratch commands used isolated env/HOME and no scratch log references real-HOME config paths. Metadata was read, never contents. D75/D76 and the requester's corrective rulings are preserved in the evidence.

The actual release, post-release tag check and live model-backed newcomer demos are outside this verdict.

Evidence: A-7256 report; A-7255 complete captures. Criteria marks: C1,C2,C3,C4,C5,C6 verified under qa-2026-10-20-2 at 7916d5f71b99d937331e31618ffdcbab799b5393.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-20T09:35:31.370Z

Closed on qa-676's clear at release candidate 8, 7916d5f7 (run qa-2026-10-20-2, A-7256 / A-7255): C1–C6 verified, 33/33 checks. C2/C3 run on fake harnesses under D75. Release run A-7251 (droplets, 3189 passed / 0 failed) and macOS A-7247 (3197/3197) are green at S8.
