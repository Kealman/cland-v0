---
id: E-273
kind: epic
title: Release v0.1.2 from the item
state: closed
criterion_seq: 5
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by:
  - E-272
  - E-276
topic: topic-278
branch: null
created: 2026-10-12T11:35:14.174Z
updated: 2026-10-15T08:15:39.224Z
closed: 2026-10-15T08:15:39.224Z
---

## Goal

v0.1.2 "Working with items" ships from its release item T-228: `cland release --item T-228` publishes version 0.1.2 with notes written from the item and its epics, QA checks the tag afterwards, and a retrospective artifact records the run with the per-model data the new records hold. Two pieces of tech debt go with it: T-253 makes the hub fail fast on a tracker storage stall while it serves, and T-254 keeps a cancelled suite attempt from superseding green cache evidence.

## Contents

- **T-254**: a cancelled suite attempt (by its requester, by the requester's death, or by a head change before admission) no longer supersedes green evidence for its tree; a failed attempt (a test failure, a worker crash or a timeout) still does.
- **T-253**: when a tracker storage operation stalls past its deadline while the hub serves, the hub logs the abandoned operation, tells the sessions and the workbench, and exits non-zero, so a supervisor or the human restarts it; no tracker mutation admitted after the stall commits before the exit (D23, accepted in §4).
- **The release** (§4, Definition of done, as for v0.1.1: D16 and D19 of v0.1 §4): every other epic of T-228 closed on its QA demo; T-228's `## Notes` written from the item and its epics; `cland release --item T-228 --dry-run`, its notes and version 0.1.2 shown in an ask; `cland release --item T-228`; QA's post-release check that the tag is on GitHub `main`.
- **The retrospective**: an artifact of the run, as A-96 was for v0, with the per-model data the records of §3.12 allow.

Not in this epic: findings of the QA demos or the release that need the human's decision; they go to Bugs or Follow-ups and wait for the human.

Choices where the spec is silent:

- The epic closes before the release: `cland release --item` refuses a release with an open child (v0.1 §3.1), so QA runs this epic's demo up to the dry run, the epic closes on that verdict, and the release, the post-release check and the retrospective follow on T-228, as v0.1's release epic T-117 closed before v0.1.0 went out (D19).
- T-254 and T-253 are hub work with no tie to the Neovim lane: the Coordinator may take them as soon as "Accounts and limits" closes, while "The explorer and the card" finishes; the release steps wait for every other epic.
- The notes go in T-228's `## Notes`, written by the Coordinator: the goal, one paragraph per epic on what the human can now do, the run's decisions, the checks deferred to a later release, and the known issues filed in the categories.
- The version is the human's recorded 0.1.2 (T-228's `version` and §4); the Coordinator shows the dry run in an ask and releases on the answer, as the `release` skill says.
- One full local suite on macOS on the `dev` tip of the dry run covers the macOS-only cases that remote runs skip ("Remote executors").
- The retrospective is a folder artifact: the report, a script adapted from the research's `extract.py` that also reads the usage, size, `regression_of`, launch-model and verdict-scope records, and its CSVs. It reports the §3.12 metric set where the records allow, within size classes, and names what they cannot show yet: one Implementer model in this build.

## Tracer-bullet order

1. **A cancelled attempt keeps green evidence (T-254).** The suite cache takes the newest attempt for a tree and mode that was not cancelled. Demo: green, then cancelled, then a request on the same tree gives a cache hit naming the green run, while green, then failed, gives a fresh run.
2. **Fail fast on a serving-time stall (T-253).** A tracker storage operation stalled past its deadline while serving makes the hub log it, tell the sessions and the workbench, and exit non-zero. Demo: a held write in a test makes the hub exit with an error naming the operation and the item, and no later mutation is on disk.
3. **The notes and the dry run.** T-228's `## Notes` written from the item and its closed epics, a green local suite on macOS, and the dry run. Demo: `cland release --item T-228 --dry-run` prints version 0.1.2 and the notes, with every other epic of T-228 closed.
4. **The release and its check.** After this epic closes: the ask with the dry run, `cland release --item T-228`, and QA's post-release check of the tag. Demo: tag `v0.1.2` is on GitHub `main`, T-228 is closed, and QA's verdict on T-228 is clear.
5. **The retrospective.** After the release: the folder artifact of the run with the per-model data and the script that made it. Demo: the artifact shows, per role and per model, the tasks, first-pass yield, rounds to the first clear review, findings by severity, escaped defects through `regression_of` and cost per landed task, within size classes.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes, and the release follows it. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project, QA reproduces both pieces of tech debt through the CLI: a green run, a cancelled run and a new request on the same tree give a cache hit naming the green run, and a failed run in place of the cancelled one gives a fresh run; a tracker write held past its deadline while the hub serves makes the hub exit non-zero, naming the operation and the item. On `dev`, `cland task list --under T-228 --state open --json` lists only this epic; QA reads T-228's notes and `cland release --item T-228 --dry-run` with version 0.1.2, and the latest full local suite on macOS is green on that tip.

- [ ] C1. A cancelled attempt no longer supersedes green evidence for its tree, a failed attempt still does, and `hub/README.md`'s cache paragraph states the rule (T-254).
  - verified: qa-27 [qa] · run qa-2026-10-15-27-13 · 2026-10-15T08:15:01.276Z · commit 0d04c4b6086cac32f019c08b68f2e3b25869a38a
- [ ] C2. A stalled tracker storage operation while serving makes the hub exit non-zero with the operation and the item named, no mutation admitted after the stall commits, and `hub/README.md` describes the restart path (T-253).
  - verified: qa-27 [qa] · run qa-2026-10-15-27-13 · 2026-10-15T08:15:01.276Z · commit 0d04c4b6086cac32f019c08b68f2e3b25869a38a
- [ ] C3. Every other epic of T-228 is closed on a clear QA verdict, and no open item other than this epic remains under T-228.
  - verified: qa-27 [qa] · run qa-2026-10-15-27-13 · 2026-10-15T08:15:01.276Z · commit 0d04c4b6086cac32f019c08b68f2e3b25869a38a
- [ ] C4. T-228's `## Notes` describe the release by epic, the run's decisions, the deferred checks and the known issues, and `cland release --item T-228 --dry-run` shows them with version 0.1.2.
  - verified: qa-27 [qa] · run qa-2026-10-15-27-13 · 2026-10-15T08:15:01.276Z · commit 0d04c4b6086cac32f019c08b68f2e3b25869a38a
- [ ] C5. A full local suite on macOS is green on the `dev` tip of the dry run.
  - verified: qa-27 [qa] · run qa-2026-10-15-27-13 · 2026-10-15T08:15:01.276Z · commit 0d04c4b6086cac32f019c08b68f2e3b25869a38a

After the close, the Coordinator shows the dry run in an ask and runs `cland release --item T-228` on the answer; QA checks that tag `v0.1.2` is on GitHub `main` and records its verdict on T-228; the retrospective artifact follows and is linked from T-228.

## Dogfooding

The release runs on what the build shipped: the notes come from the item and its epics as the explorer shows them, the final suites run on droplets, the per-model numbers come from the records "Status, fields and instrumentation" added, and the human follows the release in the inbox and the events view.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **The release.** The Coordinator releases from its own shell through the `release` skill and never delegates it; `cland release --item T-228` is the only push to GitHub in this build.
- **ADRs.** 0004 (Agents work on a local git territory): `cland release` is the one path from the territory to GitHub. 0002 (Tracker files are the source of truth): the notes live in T-228's file.
- **Risks.** T-253's exit must not lose a write it admitted before the stall; a refused release (an open child, a dirty root) is fixed before it is retried, never overridden.
- **Order.** Last: it waits for "Accounts and limits" and "The explorer and the card", the ends of the two lanes.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §4 The release (Definition of done, D23 accepted), §3.12 (the metric set); `docs/spec/v0.1.md` §4 (D16, D19, D22, D23).
- Tickets: T-253 and T-254, children of this epic; T-228, the release item; T-227 (the v0.1.1 release, the model for this one); T-117 (the v0.1 release epic); T-103 (the stall detection T-253 completes).
- Branch: `research/model-performance` (`docs/research/model-performance.md`, `extract.py`).
- Skills: `release`, `retro`, `qa`.
- GLOSSARY: Release, Verdict.

## Plan

```yaml
stages:
  - name: the two pieces of tech debt
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-254
      - - T-253
```

## Comments

### qa-27 · 2026-10-15T08:15:01.276Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-15-27-13
commit: 0d04c4b6086cac32f019c08b68f2e3b25869a38a

| Check | Result | Evidence / observation |
| --- | --- | --- |
| M0 | PASS | task JSON views, merge ancestry and source/README names; dev clean except tracker |
| M1 | PASS | read machine lock listing and verify queue baseline |
| M2 | PASS | node --test hub/test/suite.test.ts; 70 pass, 0 fail/skip/cancel, 363266 ms under impl-454 holder |
| M3 | PASS | node --test hub/test/tracker-async.test.ts; exit 0, all pass with zero skip/cancel |
| M4 | BLOCKED | brief setup: cland init created untracked managed files; helper started hub despite dirty gate; stopped immediately before any verify |
| M4-amended | PASS | Coordinator 9d384b0e: commit init-generated scaffold; clean tree, own lock, restart scratch, empty queue |
| M5-initial | BLOCKED | impl1 verify all --report general --to coord --to impl1 --json: artifact.create refused, no run started |
| M5 | PASS | green G1; requester cancels queued fresh attempt; probe caches G1 and executions stays 1 |
| M6 | PASS | human cancels running attempt: exit143; next request caches G1, executions stays2 |
| M7 | PASS | queued head changes A to B with same tree; cancellation, then G1 cache with original A; executions2 |
| M8 | PASS | failed fresh attempt exit1 supersedes G1; next request executes G2; last probe caches G2; counts3 then4 then4 |
| M9 | PASS | README doc read (script does not accept docs surface): cancelled attempts preserve green; failures supersede |
| M10 | PASS | held comment T-1: 200ms threshold, fatal notice to spoke; abandoned; own exit1; PID gone |
| M11 | PASS | all three CLI writes error/exit1; only T1, unchanged checksum, acknowledged comment retained; release after exit publishes nothing |
| M12 | PASS | README restart: cland hub start; storage healthy, before-stall comment persists, after-restart comment commits |
| M13 | PASS | R228 open descendants exactly E273; nine sibling epics closed with latest nonstage clear QA |
| M14-initial | FAIL | R228 Notes at S omit D23 and incorrectly defer completed T390 C4 |
| M14-amended | PASS | amended Notes e1be3150/0d04c4b6; copied closed plan children and epic override; scratch release preview v0.1.2 exact Notes plus10 deliverables;32 primary known issues open |
| M15 | PASS | A2714 local full dev cover fda3a637:1720hub+387nvim pass,zero fail/cancel/skip; code equal current dev outside .cland |
| M16 | PASS | both scratch hubs stopped, six own drivers/tails terminated; captures copied; owned scratch dirs removed; code freeze empty, Notes unchanged since approved correction |

Verdict: clear under the Coordinator's recorded amendments. Verify C1, C2, C3, C4 and C5 in qa-2026-10-15-27-13.

Build tested: dev 74cddcddc8966998f6890d6206b9142f899bf873 (START). Verdict dev: 0d04c4b6086cac32f019c08b68f2e3b25869a38a. Only authorized tracker/Notes commits e1be3150 and 0d04c4b6 intervened; source-code diff is empty. Notes match the final approved commit and working copy.

Findings, by severity

- Medium, resolved — M14: R-228 Notes omitted D23 and still deferred T-390 C4 despite E-386 M14 / A-2718 confirming it after restart. The original Notes and FAIL are retained. Coordinator e1be3150 added D23 and marked C4 done. 0d04c4b6 also moved T-447's description to its actual R-294 parent and added T-461 under C-325. The amended preview passed. No unresolved product finding.
- Low, brief setup — M4: `cland init` generated untracked .agents/, .claude/, AGENTS.md and docs/ after Initial. The brief's command block started the hub despite its dirty-tree gate; QA failed to break between the commands, then immediately stopped it before any verify. Own lock was configured, queue empty, no live lock path in scratch log. Original BLOCKED/start/stop preserved. Coordinator 9d384b0e authorized committing only the scaffold; clean-tree restart passed.
- Low, brief authorization setup — M5: `impl1 verify all --report general` correctly refused artifact.create. No suite started. Coordinator 7eec4759 authorized a plain scratch topic and delivered request; all subsequent reports use topic-1. Original refusal is preserved.

Evidence and criterion marks

- C1: M2/M5–M9. `node --test hub/test/suite.test.ts`: 70 pass, zero fail/cancel/skip, 363266 ms with impl-454 holding the local suite slot (allowed by brief). The required requester/death/head-change, failure, worker-crash, timeout, expiry and restart tests passed. CLI G1 eb6fd2dc-d1b3-4821-a2ed-19a769fc1017 at A=0de4bae8053deb78d3ada0a9a248615c67e25356 was reused after queued requester cancel, running human cancel and queued head change to B=530633c8767ccf84e5da9c522a1b24bee16eeebe. Tree f0704995d24a07138a472431c2925467f9b1eca0 stayed identical. The failed attempt exited1 and forced fresh G2=2fed23f6-16df-4932-91fd-cf42e7e17a3a, then the control cached G2. Execution counts 1→2→2→3→4→4. README states the same rule.
- C2: M3/M10–M12. `node --test hub/test/tracker-async.test.ts`: 37 pass, zero fail/cancel/skip, 11096 ms. In the live scratch CLI, comment/T-1 started 08:07:48.888Z; threshold200ms recorded stall at49.089Z and fatal at49.090Z. Hub exited1 itself, sent one fatal notice to coordstall and recorded abandonment. Held and both post-stall CLI writes returned exit1. Only T-1 existed; checksum 3ef2bf87f2d67681fc6a7d450599872219b107263e8bc281a7cfd7ca428c76cb stayed unchanged even after gate release. Acknowledged `before stall` survived. README `cland hub start` restored stalled=false, active=null, queued0, and `after restart` committed.
- C3: M13. Only E-273 open under R-228. All nine sibling epics closed with clear non-stage QA by qa-27 [qa]; full run/SHA table in M13-qa.txt.
- C4: M14 amended. Root A-2740 correctly refuses while E-273 is open. Coordinator authorized copying R-228 and the ten epic files into scratch, closing only copied E-273, and previewing there. Its plan also needed exact closed T-253/T-254 files, authorized by 40dc63ff. Scratch dry-run JSON and plain output show v0.1.2 at scratch B, dryRun=true, byte-identical corrected Notes followed by all ten expected epic deliverables. D23–D29, deferred checks and 32 primary known-issue entries checked. All primary entries open under categories except explicitly carried T-447 under R-294. Inline references T-391/T-392 are not entries. Root preview/release and post-release tag QA remain separate after epic close; no root release was run by QA.
- C5: M15. Coordinator cover A-2714 / run b90756d8-c00a-4376-a1ba-3c4ecc4ce27b at fda3a637aae12e5c113308962bd9399c258f3a99, Branch dev, full local darwin arm64, Node24.21.0, Neovim0.12.5. Typecheck passed; hub37+1683=1720 and Neovim387 passed, zero fail/cancel/skip in each phase; Finished exit0, suite918.72s, peak13.32. Code equality from cover to final dev outside .cland is empty, as authorized in the QA request. No QA full suite was started.

Deviations and amendments

Original BLOCKED/FAIL lines remain alongside successful amended segments. Coordinator amendments: request b5553a29 (scratch preview instead of refused root; reuse code-equivalent cover); 9d384b0e (generated scaffold commit); 7eec4759 (delivered request/topic for reports); 08a891c5 and 40dc63ff (corrected Notes and copied closed plan children). Original root refusal is A-2740. Notes freeze compares to final authorized 0d04c4b6, not original S.

Observation helpers only: drivers stayed alive in persistent execution sessions after the brief's background-shell launch did not persist; P2 driver named coordstall to avoid reusing P's coord input/output. History limit50 (tool maximum), preserved full JSON, filtered for suite results. Polls for running execution count/G2 completion were specific to the intended attempt rather than accidentally matching old finished jobs. M9 uses hub-api because qa-record.sh rejects the brief's docs surface. P2 uses existing CLAND_TEST_TRACKER_STALL_MS=200 and STOP_MS=200; no additional fail-fast knob exists. Saved hub PID before exit instead of reading removed discovery afterwards. A shell batch containing rm -f was rejected by automatic approval review before execution; the new gate files were proven absent and the batch ran without deletion. These change no expectations.

Cleanup: both scratch hubs stopped, six owned driver/tail processes terminated, zero such leftovers, all five owned scratch directories removed after captures copied. Live machine-lock files were read only; their changes belong to the crew's holder. No product file was fixed and no real model/droplet launched. The evidence includes the targeted logs, scratch suite artifacts, notices, Notes, previews and all qa-record rows.


Durable evidence: A-2764 — /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2764-e-273-qa-evidence-qa-2026-10-15-27-13-amended-checks-clear (README.md entry). Root refusal A-2740; cover A-2714; carried post-restart confirmation A-2718.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
