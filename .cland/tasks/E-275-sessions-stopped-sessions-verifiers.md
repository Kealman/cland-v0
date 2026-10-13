---
id: E-275
kind: epic
title: "Sessions: stopped sessions, verifiers' items, the queue line"
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by:
  - E-274
topic: null
branch: null
created: 2026-10-12T11:35:14.436Z
updated: 2026-10-13T06:08:50.133Z
closed: 2026-10-13T06:08:50.280Z
---

## Goal

The sessions panel stays short and tells the truth: a stopped session resumes with its context or goes to the archive, stopped sessions archive themselves by a rule, a verifier shows the item it works on, and the verify line summarises the suite queue. Today stopped sessions pile up in the background fold ("more (206)"), a stopped Aide can only be replaced by a new one, and a verifier with several holds or only a pending request shows less than the hub knows.

## Contents

- **§3.5 Stopped sessions: resume, archive, cleanup**, whole:
  - **Resume.** `r` on a stopped row and the palette action "Resume session" relaunch the same harness session through the harness's own resume, keeping the cland name, role and claim; for this the hub records the harness session id at launch. When the harness cannot resume, the action says so and offers a fresh launch with the same brief.
  - **Archive.** `d` on a session row archives it; `A` keeps showing or hiding the archive section. An archived session leaves every group and the default `session.list`; the journal keeps it.
  - **Cleanup.** A stopped crew session (Implementer, Reviewer, QA) is archived automatically one hour after its item merged or closed, otherwise 24 hours after it stopped. The human's Aides never archive automatically. The background "more" fold shows the latest 20 stopped sessions and a count of the archived. `cland session prune --older-than <duration>` deletes the hub's records of archived sessions, never the journal.
- **§3.4 The verifier's item in the sessions panel**: when a verifier holds several items, the column shows the latest hold and `+N`; before a hold exists, the item named by the latest review or QA request delivered to the session shows dimmed, until the hold replaces it (the held item itself was built as T-168).
- **§3.6 The verification queue as the human sees it**: no general queue API; the `verify:` line in the sessions panel header becomes a one-line summary of the queue (who runs and for how long, how many wait) and opens the queue view (the holder, the waiters in order with their wait, the admission ETA from the median run); the human's own `npm test` goes through the same queue, and the local runner does not start while the hub's queue is busy unless `--force` is given.

Not in this epic: the accounts block at the top of the panel ("Accounts and limits"); the executors whose remote runs the summary line counts once they exist ("Remote executors").

Choices where the spec is silent:

- Resume builds on `cland session resume --relaunch`: for a stopped session it relaunches through the harness's own resume (Claude Code `--resume <id>`, a Codex thread resume, an OpenCode session) in the session's recorded working directory, under the same name and role. The claim it held at its stop comes back when no other session took the item meanwhile; otherwise the resume goes ahead without it and says so.
- The fresh launch offered in place of a resume uses the brief recorded at the session's launch (the `--brief` text or artifact), under the same name and role.
- A session archived by hand or by rule can be resumed from the archive section, and resuming takes it out of the archive.
- A stopped Lead or Coordinator session follows the 24-hour rule, since it holds no item that merges; a pool Reviewer's item is the latest it held.
- The pending item comes from the first line of the latest message delivered to the session that reads `review request <id>` or `qa request <id>`, the form the crew already uses; a hold, a verdict or the session's stop clears it.
- The summary line reads like `verify: impl-3 4m · 2 waiting · next ~6m`, and adds the remote runs (`remote 2/4`) once remote executors exist. Enter on it and the palette action open the queue view in the centre, which shows what `cland verify queue --json` returns.
- `npm test` asks the hub's queue for a slot as the human and waits, printing its place and ETA; with no hub running it runs as today; `npm test -- --force` starts at once beside the queue, and the hub journals that it did.

## Tracer-bullet order

1. **The verifier's item.** The column shows the latest hold with `+N`, and a pending review or QA request dimmed until the hold. Demo: a Reviewer holding two items reads `T-b +1`, and a QA sent `qa request T-c` shows `T-c` dimmed until it takes the hold.
2. **Resume.** `r` and "Resume session" relaunch a stopped session through its harness's resume with its name, role and claim, and offer a fresh launch with the same brief when the harness cannot resume. Demo: a stopped fake Claude Implementer resumes on the same harness session with its claim, and a fake harness without resume gets the offer.
3. **Archive by hand.** `d` archives a session row, `A` shows the archive, and archived sessions leave every group and the default `session.list`, which lists them with `--archived`. Demo: `d` on a stopped Aide moves it to the archive, and `cland session list --json` no longer lists it.
4. **Archive by rule, and prune.** The automatic archival rules, the "more" fold of the latest 20 with the archived count, and `cland session prune --older-than`. Demo: with the windows shortened by the test configuration, a stopped Implementer archives an hour after its item merged while an Aide never does, and `cland session prune --older-than 7d` removes old records while `cland hub journal` still lists their launches.
5. **The verify line.** The header's one-line summary of the queue, and the queue view it opens. Demo: with one suite running and two waiting, the header reads the holder, its run time and the two waiting, and Enter shows the waiters in order with the admission ETA.
6. **The human's `npm test` through the queue.** The local runner asks the queue and waits while it is busy, unless `--force` is given. Demo: while a crew suite runs, `npm test` prints its place and waits, and `npm test -- --force` starts at once with a journal record.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with the fake harnesses, QA launches an Implementer, a Reviewer pool of two and an Aide. A Reviewer takes holds on two items and its row reads `+1`; a QA sent a `qa request` shows the item dimmed until its hold. QA stops the Implementer and resumes it with `r`: the same harness session, name, role and claim. QA archives the stopped Aide with `d` and finds it with `A`; with the archival windows shortened by the test configuration, a stopped Reviewer whose item merged archives after its window, the Aide does not, and `cland session prune --older-than 1d` removes archived records while the journal keeps them. QA queues three `cland verify` runs and reads the header's summary and the queue view's order and ETA; `npm test` waits in the queue, and `npm test -- --force` starts at once.

- [ ] C1. A verifier with several holds shows the latest and `+N`; a pending review or QA request shows dimmed until the hold.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.286Z · commit e27e08ff6f441687f75713893f34f5618607bc3d
- [ ] C2. `r` and "Resume session" relaunch a stopped session through the harness's own resume with its name, role and claim, from the harness session id recorded at launch, and offer a fresh launch with the same brief when resume is impossible.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.286Z · commit e27e08ff6f441687f75713893f34f5618607bc3d
- [ ] C3. `d` archives a session; `A` shows the archive; archived sessions leave every group and the default `session.list`; the journal keeps them.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.286Z · commit e27e08ff6f441687f75713893f34f5618607bc3d
- [ ] C4. Stopped crew sessions archive one hour after their item merged or closed, otherwise after 24 hours; Aides never archive automatically; the "more" fold shows the latest 20 and the archived count.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.286Z · commit e27e08ff6f441687f75713893f34f5618607bc3d
- [ ] C5. `cland session prune --older-than <duration>` deletes the hub's records of archived sessions and never the journal.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.286Z · commit e27e08ff6f441687f75713893f34f5618607bc3d
- [ ] C6. The verify line summarises the queue and opens the queue view with the holder, the waiters in order with their waits and the admission ETA.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.287Z · commit e27e08ff6f441687f75713893f34f5618607bc3d
- [ ] C7. The human's `npm test` waits in the hub's queue while it is busy, and starts at once only with `--force`.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.287Z · commit e27e08ff6f441687f75713893f34f5618607bc3d
- [ ] C8. `hub/README.md`, `nvim/README.md` and the role clauses describe resume, archive, prune and the queue line.
  - verified: qa-27 [qa] · run qa-2026-10-13-27-3 · 2026-10-13T06:08:28.287Z · commit e27e08ff6f441687f75713893f34f5618607bc3d

## Dogfooding

The human uses the panel to steer the rest of the build: stopped crew sessions clear themselves an hour after their merges, the human's Aides resume with their context the next morning, and the verify line shows at a glance whether a suite slot is free before the human runs `npm test` themselves.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side (`nvim/test` on the stub hub, QA cases in `qa/cases/`); no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **ADRs.** 0001 (Roles are hub-held state delivered as events): a resumed session receives its role's clause again. 0005 (Neovim is the host).
- **Risks.** Resume differs per harness, and a resumed session must not hold a claim another session took meanwhile. Automatic archival must not hide a session the human still needs, which is why Aides are exempt.
- **References.** `SessionsPanel.dc.html` (v0.1) for the groups and the stopped fold; no board shows the queue view, so §3.6's words and `cland verify queue` are the reference.
- **Order.** Second in the Neovim lane, after "Inbox and the events view"; "The explorer and the card" waits for it.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.4, §3.5, §3.6; `docs/spec/v0.1.md` §3.11 (the sessions panel).
- Tickets: T-257, T-239 and T-246 (decided, closed into this epic); T-168 (the held item, built in v0.1); T-232 (`cland verify`).
- GLOSSARY: Session, Aide, Claim, Pool.
- ADRs: `docs/adr/0001-roles-are-hub-held-state.md`, `docs/adr/0005-neovim-is-the-host.md`.
- Mockups: `docs/design/main-screen/SessionsPanel.dc.html`; `screens/v01-sessions-panel.png`.

## Plan

```yaml
stages:
  - name: the verifier's item and resume
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-303
      - - T-304
  - name: archive by hand and the verify line
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-305
      - - T-307
  - name: archive by rule and prune
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-306
  - name: the human's npm test through the queue
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-308
  - name: gaps before QA
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-319
```

## Comments

### coord · 2026-10-12T21:35:18.471Z

Tickets cut on 2026-10-12 (Coordinator): T-303 the verifier's item (latest hold +N, a pending request dimmed); T-304 resume; T-305 archive by hand (after T-304); T-306 archive by rule and prune (after T-305); T-307 the verify line and the queue view; T-308 the human's npm test through the queue. Decisions on the drafts' open points: (1) `d` on a live session is refused; only a stopped row archives. (2) Resume restores the item claim only, never a verifier hold (a verifier takes its hold again). (3) `prune --older-than` counts from the session's stop time. (4) The human's npm test waiter queues behind integrated dev runs and ahead of ranked items. (5) Only full or phase runs of `npm test` queue; explicit single-file targets stay free, as docs/agents/tests.md already says. (6) `--force` skips both the queue and the legacy lease, and the hub journals that it did. (7) No journal backfill of stop times: a stopped row without one takes the time of the first sweep that sees it, so it archives 24 hours later; this keeps startup free of journal reads (T-293's lesson). (8) The column reads `T-b review +1`: the latest hold with its role, then +N. Hot files: panels.lua and the stub hub (T-303 to T-307), sessions.ts and processes.ts (T-304 to T-306), default-roles.ts (T-304, T-305, T-306, T-308; it adds Coordinator tools, so the Coordinator relaunches after those merge), run-suite.ts (T-308, which collides with T-281 and T-282 and therefore goes last). Every hub-event-driven recompute is coalesced once per tick (T-293); keep T-284's C7 workload test green.

### qa-27 · 2026-10-13T06:08:28.287Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-13-27-3
commit: e27e08ff6f441687f75713893f34f5618607bc3d

| Case | Result | What was checked |
|---|---|---|
| M0 | PASS | HEAD/dev e27e08f; only live tracker dirty; seven merge SHAs ancestors; all seven children closed/done with Coordinator merge receipts; five stages closed |
| M1 | PASS | Node24 and npm from nvm; machine lock read-only baseline; no holder/waiters and T-312/T-314 protected slots released |
| M2 | PASS | Node24 clean identity, serial files: node --test hub/test/session-holds.test.ts |
| M3 | PASS | Node24 clean identity, serial files: node --test hub/test/inbox-workload.test.ts |
| M4 | PASS | Node24 clean identity, serial files: node --test hub/test/session-resume.test.ts |
| M5 | PASS | Node24 clean identity, serial files: node --test hub/test/session-archive.test.ts |
| M6 | PASS | Node24 clean identity, serial files: node --test --test-name-pattern=human package runner --test-name-pattern=human waiter --test-name-pattern=human slot --test-name-pattern=plain human runs hub/test/suite.test.ts |
| M7 | PASS | Node24 clean identity, serial files: node --test hub/test/surface.test.ts |
| M8 | PASS | Node24 clean identity, serial files: node --test --test-name-pattern=verifier rows show the latest hold nvim/test/shell.test.ts |
| M9 | PASS | Node24 clean identity, serial files: node --test nvim/test/session-resume.test.ts |
| M10 | PASS | Node24 clean identity, serial files: node --test nvim/test/session-archive.test.ts |
| M11 | PASS | Node24 clean identity, serial files: node --test nvim/test/verification-view.test.ts; node --test nvim/test/verification-queue.test.ts |
| M12 | PASS | PANELS-009 and PANELS-016 through qa-record.sh; both PASS |
| M13 | PASS | Local-only origin, guarded scratch config/locks and fixture, fake versions, capped budget, four spokes, reviewer pool2, six idle launched sessions with harness IDs and T1 claim; nvim connected |
| M14 | PASS | Latest review hold T3+1 over T2; QA pending T4 attribute112 versus claim116; after hold pending null and both attributes116 |
| M15 | PASS | r resumes stopped Implementer with same session/conversation/name/role/claim and new PID; fake resume=true; two clauses delivered; session-resumed notes empty |
| M16 | PASS | Refused Codex resume returns found=false/reason/recorded brief and exit1; n keeps stopped; palette Resume then f launches new conversation with same session identity and brief |
| M17 | PASS | Baseline N0=0; item archive30.002s after close, stop archive150.003s after stop; holds released, correct fold order/counts, Aide remains unarchived after210s |
| M18 | PASS | d archives Aide by hand; total8→7 and names/palette remove it; three archive rows newest-first; A toggles; d on running impl refused; journal retained; keys documented |
| M19 | PASS | BaselineN0=0; more counts2/0→1/1→0/2→0/3→0/0; newest stopped first, no older line with fewer than20 |
| M20 | PASS | 1d dry-run empty; 1m dry-run and actual prune exactly rev1/rev2/aide1; archive0, three running sessions untouched; one prune event, journal preserved; 5x refused exit1 |
| M21 | PASS | With authorized missing-delivery amendment: warm-up exit0 median62328ms; queue positions1/1/2, waiters vq2/vq3 and ordered ETAs; summary ages0→15s without action |
| M22 | PASS | Enter on verify line and palette open queue; holder/session/mode/PID/worktree, ordered waits/ETAs and metrics shown; q restores previous centre and panel |
| M23 | PASS | Coordinator order amendment: plain human npm waits at1of3 ahead of vq2/vq3; target not started, one queued record, no fallback; header/view agree (later ETAs unknown until hub-only history) |
| M24 | PASS | npm test -- --force exit0 in1s, one target pass, locks held[] while vq1 scratch lease exists; human1/1 crew2/1, plain still queued; one forced and still one queued record |
| M25 | PASS | Amended token order vq1 -> human -> vq2 -> vq3; human label with 2 waiters; one queued/admitted/left, waitMs112331; four exit0 reports; empty queue and verify: idle |
| M26 | PASS | Read full matched hub/nvim README paragraphs and source/root/scratch clauses: resume/fresh, archive/prune, queue line/order/human path; all six role clauses carry queue guidance, Coordinator tools include archive/prune |
| M27 | PASS | Scratch nvim exited normally; drivers and tails stopped; three fake sessions and hub stopped; known PIDs gone; scratch paths removed; no machine-lock string; machine listing/queue unchanged from M1 |
| PANELS-009 | PASS | cland --headless --qa qa/cases/PANELS-009.lua |
| PANELS-016 | PASS | cland --headless --qa qa/cases/PANELS-016.lua |

Findings: none (high, medium or low). The two brief errors were resolved by explicit Coordinator amendments; the original refusal and order mismatch remain in the evidence.

Verdict: clear. Item T-275; run `qa-2026-10-13-27-3`; tested dev commit `e27e08ff6f441687f75713893f34f5618607bc3d`. All M0–M27 checks and both catalogue cases passed. The 11 serial single-file test commands passed 51 tests with no failures or skips; the two catalogue cases ran through qa-record.sh and the project headless QA harness. Manual checks used the CLI and one headless Neovim process, with nvim_input and screenstring captures. No full root suite ran. The scratch verify jobs exercised queue orchestration against the brief’s tiny fixture package, so their reports show exit 0 and unavailable suite counts by design.

Criterion marks: C1=M2,M3,M8,M14; C2=M4,M9,M15,M16; C3=M5,M10,M12,M18; C4=M3,M5,M10,M12,M17,M19; C5=M5,M20; C6=M11,M21,M22; C7=M6,M23,M24,M25; C8=M7,M26. All eight verified in this run. Gates M0,M1,M13,M27 passed.

The scratch hub used its own lock path throughout. All scratch processes stopped and directories were removed. The machine lock listing and empty queue matched the starting snapshot. Evidence includes case captures, scripts, fixture package, flushed scratch journal/log, and the unmodified per-case runs.jsonl lines.

Coordinator amendment, message 5445690b-aff1-4c3a-a9b7-26fd66ab936e, Agents, 2026-10-13T05:58:21.786Z:

"The brief missed the delivery that lets the verify drivers publish in TV. Your refusal is correct evidence and not a T-275 defect."

Before M21 the scratch coord sends kind report in TV to vq-1, vq-2 and vq-3: "Verify runs for the T-275 demo: report your suite results in this topic." Each driver reads it. TV stays unbound. The Coordinator explicitly authorized restarting M21 from its first command and instructed QA to stop M21–M25 BLOCKED if artifact.create is still refused.

The original refusal remains in M21-refusal.txt and the original initial queue/UI reads in M21-initial.txt. All three drivers read the delivered message (M21-delivery-correction.txt). The subsequent warm-up submission succeeded.

Coordinator amendment, message f517b413-7d66-4103-bc40-696ae375f080, Agents, 2026-10-13T06:01:15.165Z:

"This is a brief error, not a finding. The merged order, T-319 per decision 4 and hub/README.md, is: integrated dev, then human, then ranked items, then other runs. The vq runs are unranked 'other runs', so the human waiter goes ahead of them. My earlier note about place 3 was wrong."

M23 expects human at place 1 of 3, ahead of vq-2 and vq-3 while vq-1 holds. M24 otherwise stays unchanged. M25 releases vq-1, observes human holding with two waiters, finishes the human, then releases vq-2 and vq-3 in turn. Exact-count assertions remain: one queued, one admitted with positive waitMs, one left, four suite results and an empty queue at the end. The original place-3 polling timeout remains in M23.txt; M23-order-observed.txt preserves the actual queue before the amendment.

Evidence: A-1820, published by the Coordinator: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1820-t-275-qa-evidence-run-qa-2026-10-13-27-3-at-e27e08f-published-by-the-coordinator/README.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### coord · 2026-10-13T06:08:50.133Z

Closed on QA's clear demo (qa-2026-10-13-27-3 at e27e08f, evidence A-1820): C1–C8 verified, no findings. Two brief amendments made during the run by the Coordinator: the delivery before M21 and the human's queue place in M23–M25.
