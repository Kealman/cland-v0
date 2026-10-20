---
id: E-614
kind: epic
title: Verification for any stack
state: closed
criterion_seq: 5
labels:
  - epic
  - v0.1.4
  - ready-for-agent
assignee: null
parent: R-577
blocked_by:
  - E-611
topic: topic-666
branch: null
created: 2026-10-16T15:34:18.662Z
updated: 2026-10-20T04:14:47.780Z
closed: 2026-10-20T04:14:47.780Z
---

## Summary

`cland verify` runs the project's own commands, `prepare`, `check` and `test` from `[verification]` in `.cland/config.toml`, instead of this repository's npm scripts, locally and on a droplet, so a project in any stack has verification. Coverage selection stays with cland's own node commands.

## Goal

The stack is the human's or the crew's choice, and verification follows it. Today `cland verify` is hard-wired to cland's own repository: the suite worker runs `npm run typecheck`, then `npm test` (or `npm test --workspace hub`, or `npm run test:nvim`); the host gate runs the typecheck again; the droplet prepares with `npm ci` and the Neovim pin, and each run compares `package-lock.json` and `nvim/NVIM_VERSION` with its snapshot; coverage selection assumes `node --test` and V8 coverage. A project in another stack has no verification, and during the live try the onboarding Aide chose a stack to fit verify instead of the project (Q-600 question 11, Q-596).

## Contents

- **Three commands** (Q-600 resolution 5). `[verification] prepare`, `check` and `test` in `.cland/config.toml`: `prepare` installs what the checks need, `check` is the fast gate that today's typecheck is, and `test` is the suite.
- **The suite worker and the host gate** run `check` and `test` where they run the npm scripts today.
- **The droplet executor** runs the same `prepare` where it runs `npm ci` and the Neovim pin today.
- **Coverage selection** applies only to cland's own node commands; another project's run runs its `test` in full.
- **This project** names its own commands in its `config.toml`, so its verification, with its modes, shards and covers, works as before.
- **Recording the commands.** `cland config set verification.<key>` (from "The Aide's reach and the settings commands") writes them, and the onboarding records them with the stack, in the stack step of the `onboarding` skill that "The onboarding skill and the newcomer's first page" ships.
- **Docs.** `hub/README.md`, `docs/agents/tests.md` and the `config.toml` that `cland init` writes describe the three commands.

Not in this epic: coverage selection or sharding for other stacks.

Left to the spec (§3.7) and the plan:

- How cland's own modes (`hub`, `nvim`, full) and its shards map onto the three commands.
- What a project without the commands gets, and what tells the droplet that `prepare` must run again (today `package-lock.json` and `nvim/NVIM_VERSION`).
- Whether a local run runs `prepare`.

## Tracer-bullet order

1. **The keys and the local run.** The three keys, the suite worker and the host gate. Demo: a scratch project in another stack verifies green locally with its own commands, and red with the test's output when a test fails.
2. **The droplet.** `prepare` in the droplet executor. Demo: the same project verifies on a droplet after its `prepare` ran there.
3. **This project and coverage.** Demo: this repository's `cland verify` on `dev` selects by coverage and passes as before, from its own `[verification]` values.
4. **The docs.** Demo: QA follows `hub/README.md` to set the three commands with `cland config set` in a scratch project.

## Definition of done

QA runs the demo below on `dev`, locally on this Mac and on a droplet through the executor, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes.

In a scratch project in a stack other than Node, QA sets `prepare`, `check` and `test` with `cland config set`, as `hub/README.md` says, and runs `cland verify` locally and on a droplet: both pass, and a planted failing test turns each red with its output. In this repository, `cland verify` at the `dev` tip selects by coverage and passes as before.

- [ ] C1. `cland verify` runs `[verification] check` and `test` from `config.toml`, locally and on a droplet, where it ran this repository's npm scripts, and the host gate runs `check`.
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:14:34.473Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C2. The droplet executor runs `[verification] prepare` where it ran `npm ci` and the Neovim pin.
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:14:34.473Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C3. A project in another stack verifies with its own commands locally and on a droplet, and a failing test turns its run red with the test's output.
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:14:34.473Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C4. Coverage selection applies only to cland's own node commands, and this repository's verification, its modes, shards and covers, works as before from its own values.
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:14:34.473Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C5. `hub/README.md`, `docs/agents/tests.md` and the `config.toml` that `cland init` writes describe the three commands, and `cland config set verification.<key>` sets them.
  - verified: qa-676 [qa] · run qa-2026-10-20-1 · 2026-10-20T04:14:34.473Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The DigitalOcean token is never stored.
- **Tests.** The suite worker and the droplet executor are tested with another stack's commands in a temporary project, the droplet through E-271's fake DigitalOcean API and fake machine (`hub/test/fakes/digitalocean/`); a real droplet is QA's check, never part of `npm test`.
- **Risks.**
  - This epic changes the verification the build itself runs on: this project's commands land in the same merge that makes verify read them, so the build's own verification never stops.
  - The onboarding's stack step writes the keys this epic adds. If "The onboarding skill and the newcomer's first page" lands first, its step already names the keys, and its demo waits for this epic's merge.
- **Order.** In the hub lane, beside "Init: roots, the first commit, managed settings, categories" and "Setup: the guided step ending in the workbench": blocked by "The Aide's reach and the settings commands" only.

## Links

- Spec: `docs/spec/v0.1.4.md`, §3.7 (Verification for any stack) and §4 (The cut).
- Items: map M-591, Not yet specified (verification for any stack); Q-600 (question 11 and resolution 5); Q-596 (the Aide fitting the stack to verify).
- Code: `hub/src/hub/suite-worker.ts`, `hub/src/hub/suites.ts` (the host gate), `hub/src/executor/droplet/prepare.ts`, `hub/src/executor/droplet/run.ts`, `hub/src/executor/local.ts`, `hub/src/suite-coverage.ts`, `hub/src/suite-selection.ts`, `hub/src/init/config.ts`, `hub/src/hub/configuration.ts`.
- Docs: `docs/agents/tests.md`, `hub/README.md`.
- GLOSSARY: Executor, Lease.

## Plan

```yaml
stages:
  - name: commands, keys and the local run
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-663
        - T-666
        - T-667
        - T-668
      - - T-664
        - T-665
      - - T-669
  - name: the droplet's prepare and the docs
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-670
        - T-671
```

## Comments

### coord · 2026-10-16T16:36:06.234Z

Coordinator decisions on the ticket cut (D51), 2026-10-16, all as the drafter recommended: (1) the commands come from the candidate worktree's config.toml, else the hub root's; (2) test is required, and verify refuses without it, naming the cland config set line; check and prepare are optional; no implicit npm default; (3) a local run never runs prepare; (4) prepare runs at every droplet delivery, idempotently, with CLAND_PREPARE_KEY so it may skip work; (5) 'cland's own suite' means the candidate carries hub/test/run-suite.ts; (6) one test line for every mode, with mode and shard in CLAND_SUITE_SELECTION; (7) prepare runs as runner without root, other toolchains install at user level (root for apt: a later release); (8) T-664 stores a string key's argument verbatim, confirmed against T-633 at merge; (9) E-616's stack-step ticket gets a criterion to record prepare/check/test through cland config set, with no npm wording; (10) launch waits for D52's flake measures (T-657, T-658), not for E-611's close; (11) cland verify hub/nvim in another project is refused with the reason; (12) commands run under /bin/sh -c (POSIX sh); (13) QA's toy stack is python3 (compileall, unittest), with no test depending on prepare.

### hub · 2026-10-20T04:04:43.085Z

demo d0f178e4-abd5-45c1-aba7-a9d2924ed93d created: droplet cland-v0-d0f178e4, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T05:18:38.755Z.

### hub · 2026-10-20T04:09:35.138Z

demo d0f178e4-abd5-45c1-aba7-a9d2924ed93d destroyed: lifetime 343420 ms; cost $0.0238.

### qa-676 · 2026-10-20T04:14:34.473Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-2026-10-20-1
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"low","text":"D2/L1 prepare grep counts the configuration header; standalone marker is zero and no prepare execution step exists locally. Updated template wording matches D51. Requester4f340804 corrects both brief expectations.","file":"qa/briefs/E-614.md"},{"severity":"low","text":"L1 broad literal-path process grep counted control shells. Metadata-only follow-up found zero product processes; cleanup completed. Requester43ca2ad5 accepts cleanup and identifies the self-matching probe defect.","file":"qa/briefs/E-614.md"},{"severity":"low","text":"L2 looks in suite.log for successful prepare output, which is retained separately in delivery.log. Both real stage shard logs independently confirm prepare execution; c40fa19f supplies correct evidence location.","file":"qa/briefs/E-614.md"},{"severity":"low","text":"R2 expected prepare in verify usage from T-671 title. T-671 C3 and E-614 C5 require the observed check/test usage and documented three commands elsewhere. Requesterfe1a0085 corrects the brief; no follow-up needed.","file":"qa/briefs/E-614.md"}]
finding_counts: {"high":0,"medium":0,"low":4}

| Check | Executor / surface | Result and evidence |
| --- | --- | --- |
| G0 | local metadata | PASS: clean detached S, on dev, brief committed, Node 24.21.0, Python 3.13.5 |
| G1 | records | PASS: C1–C5 match; all nine children closed and landed, including T-670 0f8cb85b and T-671 d3aac7af |
| G2 | hub API | PASS: QA hold acquired |
| G3 | hub API / Git | PASS: live hub started 02:32:43Z, after newest hub code at S (02:17:08Z) |
| D0/D1 | Linux droplet | PASS: one lease at clean S, Node 24.21.0, Python 3.12.3, Linux x86_64 |
| D2 | Linux scratch hub | PASS: init template, verbatim setters, isolated lock, green Python run; prepare metadata allowed, no execution |
| D3 | Linux scratch hub | PASS: planted assertion makes run red with the assertion in the summary |
| D4 | Linux scratch hub | PASS: failed check gates test; hub/nvim phases and missing test refused; hub stopped, process count 0 |
| D5a–e | Linux droplet | PASS: commands 14, summary 4, submission 6, check 3, suite 18 tests |
| D6a–c | Linux droplet | PASS: executor-run 19, prepare 5, prepare-key 2 tests; prepare-delivery cases present |
| D7a–g | Linux droplet | PASS: selection 8, close 7, dry-run 4, config-set 10, init-config 9, init 13, reload 5 tests |
| D8 | Linux scratch | PASS: scratch folder removed, count 0 |
| D14 | hub API | PASS: fetched dev; freshness current, also confirmed before verdict |
| D15 | hub API | PASS: lease released, hub destruction comment retained |
| L1 | macOS scratch hub | PASS: same green/red/check/refusal behavior; zero product processes and scratch removed under corrected probe rule |
| L2 | retained stage logs | PASS: same S, own commands, host gate reuse, T1–T4 and green receipts; actual prepare output in both separate delivery logs |
| L3 | live hub dry run | PASS: coverage-selected hub mode, A-7027, exit 0; mine 0→0 and atS 0→0 |
| L4 | local Git | PASS: plant worktree and branch removed, origin QA refs 0, dev unchanged |
| R1 | records | PASS: own prepare/check/test and T1–T4 shell commands configured |
| R2 | records | PASS: README/tests docs/init template/setters correct; usage meets T-671 C3 (check/test), brief corrected |
| R3 | local replay | PASS: 40/40 landings, 7 hub-selected, 0 own/historical/total misses, exit 0 |

Findings: none high or medium. Four low brief findings, all disclosed and resolved against the stated criteria; no product fix made.

1. **Low — D2/L1, qa/briefs/E-614.md.** The broad `grep -c QA-PREPARE-RAN` returns 1 from the configuration header `Prepare: echo QA-PREPARE-RAN`; it is not execution. Both complete green logs have zero standalone marker lines and only check/test execution steps. The template also now describes prepare on the droplet builder and before every run, rather than the brief's old prepared-image wording. Requester decision **4f340804-617e-4556-b93c-48f69dde399c**, 04:05:22Z, accepts behavior under D51(3)/(4) and corrects both expectations. See D2-L1-ruling.txt and L1-prepare-counts.txt.
2. **Low — L1 cleanup, qa/briefs/E-614.md.** The literal-path `ps | grep` printed 2 because control-shell arguments contain the scratch path. Immediate metadata-only follow-up found only the inspection shell (pid 9766, ppid 53617, elapsed 00:00, basename bash), no scratch hub/worker. No process was killed. Requester **43ca2ad5-eae4-41db-822c-ddfab9d148f4**, 04:10:25Z, accepts zero product processes; clean removed the folder. Preserve the raw count and avoid matching the probe's process tree in later briefs. See M-D4.txt, L1-process-followup.json, M-clean.txt.
3. **Low — L2 prepare evidence, qa/briefs/E-614.md.** The successful prepare output is in each shard's `delivery.log`, while the suite log has only configuration metadata. Failure output is appended to the suite log. Requester **c40fa19f-ddd0-4f19-8d4d-7546e94907aa**, 04:11:46Z, supplied the two retained paths. QA independently read both and the delivery source. Each prints `dependencies match snapshot` and `Neovim pin matches snapshot`, proving the configured script executed. See L2-shard-1-delivery.log, L2-shard-2-delivery.log and L2-delivery-source.txt.
4. **Low — R2 usage, qa/briefs/E-614.md.** The brief expected all three commands in the verify usage, taking the expectation from T-671's title. T-671 C3 actually asks for the project's check/test wording, which the help supplies; E-614 C5 names README, tests.md, init config and setters, all correct. QA read T-671 C3 independently. Requester **fe1a0085-b013-4b20-b0b1-9a03e525c5fb**, 04:12:19Z, corrects the brief; no follow-up ticket needed. See R2-usage-ruling.txt and R2-docs-expanded.txt.

Run **qa-2026-10-20-1** at **824105c5a2a56b3495e9215cc88d60c4c129df6c**, brief v2 committed at 5a9c868b. Result **clear**. Verify **C1,C2,C3,C4,C5**; none failed, blocked or deferred. All 34 recorded checks pass. Supporting tests: **127/127**, 15 files, zero failures/skips/retries. The planted Python assertion and syntax-error runs intentionally finish red and establish expected behavior; they are not failed QA checks.

Behavior exercised on Linux and macOS:

- Commands set through `cland config set`: prepare `echo QA-PREPARE-RAN`, check `python3 -m compileall -q calc tests`, test `python3 -m unittest discover -s tests -v`; values read back verbatim. Template documents empty optional commands, POSIX shell execution and required test/tier setup.
- Each scratch project uses an isolated HOME/XDG environment, empty provider token, scratch suite lock and QA Git identity. The scratch runner is local to its machine. No live-project verify was submitted and no provider secret was copied.
- Green runs: Linux **60b80a02-ca83-4ad2-9e6f-cdf11abd3a89**, Mac **075a1d9c-f7c7-4cee-a351-311f08868a61**. Check precedes the single passing unittest; full project selection, no coverage/load-gate plan. Local prepare is not executed.
- Planted assertion: Linux **bc66ab2c-0b00-4c04-8974-afed98ed6878**, Mac **6225b8ef-6ae6-46c2-9bc7-814e04d41fca**. Exit 1, one failed assertion among two tests; summary includes `planted assertion failed: expected green`.
- Planted syntax failure: Linux **d07a49db-e41a-486b-b180-471eef254402**, Mac **395e7a4a-a285-4b39-81ff-f142e41b17db**. Check exits 1; zero unittest execution lines. Repair follows, then hub/nvim phase refusals and missing-test submission/dry-run refusals all exit 1 with the required explanations.
- Both scratch hubs stop normally. Remote cleanup prints 0; Mac cleanup prints 0 after the corrected process probe. No scratch hub, fixture or provider lease remains.

C2 delivery evidence:

D6 contains successful tests named `droplet delivery uses recorded shell lines after the project config changes`, `shell project prepares its snapshot before rebuilding ignored outputs`, `delivery prepare retains failed command output before remote checks`, `delivery prepare rejects unignored outputs before remote checks`, and `a project without pins prepares a reusable snapshot for delivery`. All titles are retained in D6-prepare-case-titles.txt.

The repository at S sets prepare=`node hub/bin/verify-prepare.ts`, check=`npm run check`, test=`npm test`, and tier commands `node hub/test/run-suite.ts --tier T1` through T4. In **both** stage shard delivery logs, dependencies and Neovim-pin match output proves actual prepare execution at S. The one checkout/prepare step in run.ts precedes setting delivered and starting tests. The suite receipt reuses host gate tree `0d238d6975c594f33ffd694997697f749ea4ae20`, with no remote npm check/typecheck repetition.

C4 selection evidence:

L3 plant **78c2e3347646ebe2e6ddc97fdbd3323157a30264** adds one comment to verification-commands.ts only on the throwaway branch. Dry run exits 0 within its deadline, reports `mode hub-selected; function coverage selects hub tests`, uses coverage **A-7027** at S, and plans T1/T2/T3. It queues nothing: mine 0→0, atS 0→0. Plant branch/worktree removed without pushing. R3 uses 61 retained maps and 1030 retained run logs: **40/40 landings, 7 hub-selected, 0 own misses, 0 historical misses**. The complete replay is retained; projected timing shares are not claimed as measured wall time.

Criterion mapping and explicit substitutes:

- **C1**: D2–D6, L1/L2/R1. Local own-command behavior directly exercised. The on-droplet half is **verified by substitute**: a scratch hub on the leased Linux droplet, fake-DigitalOcean executor tests, and this repository's real same-S stage droplet receipt.
- **C2**: D6/L2/R1, **verified by substitute**: fake-machine other-stack prepare proofs plus retained real repository delivery logs. No second live project was given the provider token.
- **C3**: D2/D3/D5/D6/L1; remote half **verified by the same declared substitute**, including planted-red output on both machines.
- **C4**: D2/D4/D7/L2/L3/R1/R3; other stack runs whole commands without cland phases, own repository retains tiers, shards and coverage selection.
- **C5**: D2/D7/R2; setters and generated template exercised, docs read against their actual criteria. Scratch example uses explicit calc/tests discovery paths; README examples use compileall `.` and plain unittest. D7's config-set test covers the exact README examples.

Stage evidence (read, not resubmitted): **A-7022**, Linux run51b982ae-ecdc-4e59-a786-b2294bd999ea, and **A-7026**, macOS run40c55103-93ef-41fc-ac26-b818dd91c44a, both at S and green, T1–T4. Linux has 3159 pass/0 fail/8 skips; macOS 3167 pass/0 fail/0 skip. Linux shards: cland-v0-1d139ca1, duration1222.07s/lifetime1215s/cost$0.0843; cland-v0-23418384, duration1592.07s/lifetime1584s/cost$0.1100; merged wall1615.43s/cost$0.1944. Report-only budget lines are not failures under D73.

One demo lease **d0f178e4-abd5-45c1-aba7-a9d2924ed93d**, machine **cland-v0-d0f178e4**, Linux x86_64. Created04:03:40.356Z, deadline05:18:38.755Z. Hub confirms destroyed/released: **343420ms, $0.023848611111111112** total demo cost. All tests sequential, no second lease; local scratch checks have no droplet cost. Final freshness is current, build tree clean, dev unchanged. Build worktree removal follows accepted verdict; Coordinator owns epic closure.

Evidence finalized 2026-10-20T04:14:07.617236+00:00.

Total wall from QA hold through evidence finalization: 677.56s, including provisioning, read-only investigations and requester replies.

Final report A-7044: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7044-e-614-qa-clear-c1-c5-explicit-remote-substitutes-and-brief-corrections.md
Complete evidence A-7043: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7043-e-614-qa-complete-evidence-at-824105c5-qa-2026-10-20-1

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-20T04:14:47.780Z

Closed on qa-676's clear at the release candidate 824105c5 (run qa-2026-10-20-1, A-7044 / A-7043): C1–C5 verified; four low brief findings retained.
