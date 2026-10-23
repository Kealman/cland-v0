---
id: E-414
kind: epic
title: The approvals relay
state: open
labels:
  - epic
  - v0.2
  - ready-for-agent
assignee: null
parent: R-377
blocked_by:
  - E-413
topic: topic-862
branch: null
created: 2026-10-14T15:59:14.627Z
updated: 2026-10-23T02:19:35.053Z
---

## Summary

Command approvals get one record in the hub, and the hub answers them for the human where the harness's protocol allows it: the Codex app-server and OpenCode's permission API. Claude Code's approvals stay in its TUI and their records are marked "answer in Neovim"; the first answer from any client wins, and every client, Neovim included, sees the outcome.

## Goal

The human approves a command where they are, in the inbox of either client, and never has to attach a Codex or OpenCode session to do it. Today all three adapters declare `approvalRelay: 'none'`: the hub shows `waiting for approval` with the command, and the inbox's approval row only carries the session's attach command. The harnesses allow more. A Codex app-server sends each approval request to every client it serves, the first answer wins, and `serverRequest/resolved` reports it. OpenCode's server takes a reply on its permission endpoint (`once`, `always` or `reject`, with a message), and any attached TUI clears its dialog.

## Contents

- **§3.8 Approving a command from the browser.**
  - **The Codex relay.** The Codex adapter, already a client of each session's app-server, answers its approval requests (`item/commandExecution/requestApproval` and `item/fileChange/requestApproval`) with the human's decision, and closes the record when `serverRequest/resolved` says another client answered.
  - **The OpenCode relay.** The OpenCode adapter answers `permission.asked` through `POST /api/session/{id}/permission/{requestID}/reply` with `once`, `always` or `reject` and the note, and closes the record on `permission.replied`.
  - **Claude Code.** Its approvals stay in the TUI until its supervisor exposes them: the record says so, and the web marks such rows "answer in Neovim".
  - **The capability.** `approvalRelay` becomes reliable for the Codex and OpenCode adapters and stays `none` for Claude Code.
- **§3.4 One gate for answers.** An approval has one record in the hub: the session, the harness, the command or the file change in full, the choices the harness offers, since when, and its state. The first answer from any client wins, and every client sees the outcome. An answer given in the harness's own TUI closes the record with that outcome too.
- **The clients.** The records ride in the snapshot and the deltas of E-412. The Neovim inbox shows the same records: a relayed approval's row offers its choices on keys and folds with its outcome, and a Claude Code row keeps Enter to attach. The web's approval cards in the inbox, the thread and the session's drawer are E-417's and E-418's, built on these records.

Not in this epic: the web's cards (E-417, E-418) and the phone's rows (E-419); a terminal in the browser for the approvals that stay in Claude Code's TUI (0.2.x); plan approval, which keeps its own path (v0.1 §3.10).

Choices where the spec is silent:

- **The choices.** Approve once; Always for this command, the harness's own wider grant (Codex's grant for the session, OpenCode's `always`); Deny with a note. The note goes to the harness where its protocol carries one (OpenCode's message) and into the session's topic as the human's message otherwise.
- **No answer by default.** The hub never answers on a timer or by default: a record waits until a client or the harness's TUI answers it, or until the harness withdraws the request.
- **Losing the race.** A second answer is refused with who answered and when, and the client folds its card to that outcome.
- **Restarts.** Records are rebuilt from the harnesses when the adapters reconnect: a Codex app-server replays pending requests to a client that attaches, and OpenCode's snapshot lists pending permissions. No approval is lost to a hub restart.
- **The fakes.** Both already raise approvals: the fake Codex app-server sends `item/commandExecution/requestApproval`, `item/fileChange/requestApproval` and `serverRequest/resolved`, and the fake OpenCode server sends `permission.asked` and takes the reply on its endpoint. The tests drive the relays through them, extending a fake only where an answer path is missing.
- **The CLI.** `cland inbox` prints the approvals with their state, choices and outcome; answering stays with the clients.
- **This project's crew** runs its Codex roles with `approval = "never"`, so the demos launch their Codex sessions with approvals on (`approval = "on-request"`).

## Tracer-bullet order

1. **One approval record.** The hub's record built from the adapters' state, in the snapshot and the deltas, with Claude Code's marked as staying in the TUI, and `cland inbox` printing it. Demo: a fake Claude Code session waiting for approval appears once to a frame client, marked to answer in Neovim, and Neovim's inbox row still attaches it.
2. **The Codex relay.** The adapter answers the app-server's approval requests through the gate and closes the record on `serverRequest/resolved`. Demo: a frame client approves a fake Codex session's command once, the fake runs it, and every client reads the record folded with "approved once by the human".
3. **The OpenCode relay.** The adapter answers `permission.asked` through the reply endpoint and closes the record on `permission.replied`. Demo: a frame client denies a fake OpenCode permission with a note, and the fake receives `reject` with that note.
4. **The first answer wins.** Concurrent answers, answers given in the harness's TUI, and records rebuilt after a hub restart. Demo: two frame clients approve and deny the same request in one tick; exactly one outcome is recorded, and both clients read it.
5. **Neovim's inbox.** The relayed approval's choices on Neovim's inbox keys, the folded outcome, the capability table and the docs. Demo: in the headless workbench the approval row of a fake Codex session approves on its key, and a frame client reads the outcome.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, frame clients holding the web's cookie and a headless Neovim workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (spec §4: no separate human acceptance pass). The web's cards are checked in the demos of E-417 and E-418 and in the integrated pass of E-420.

In a scratch project with the fake harnesses, QA launches a fake Codex session with approvals on, a fake OpenCode session and a fake Claude Code session, each made to ask for approval of a command. A frame client reads three records in the snapshot: the Codex and OpenCode ones with their choices, the Claude Code one marked to answer in Neovim. QA approves the Codex command once and reads that the fake ran it; it denies the OpenCode permission with a note and reads the note in the fake's reply. Two frame clients answer a fourth request at once: one wins, the other is refused naming the winner, and both read the same outcome. QA answers a fifth request through the fake's own TUI path and reads the record closed with that outcome. QA restarts the hub with a request pending and reads its record rebuilt. In the headless Neovim workbench the inbox shows the same records and approves a sixth request on its key. `cland inbox` prints the approvals with their outcomes.

- [ ] C1. An approval has one record in the hub with the session, the harness, the command or change in full, the choices and its state, carried in the snapshot and the deltas.
- [ ] C2. Codex app-server approvals and OpenCode permission requests are answered through the hub with Approve once, Always for this command or Deny with a note, and an answer in the harness's own TUI closes the record.
- [ ] C3. Claude Code's approvals stay in its TUI, and their records say so, so that the web marks them "answer in Neovim".
- [ ] C4. The first answer from any client wins, a later one is refused naming who answered and when, and every client sees the outcome.
- [ ] C5. Nothing answers an approval on a timer or by default, and pending records survive a hub restart.
- [ ] C6. Neovim's inbox shows the same records and answers a relayed approval on its keys.
- [ ] C7. `hub/README.md`, `nvim/README.md` and the adapters' capability table describe the relay and the gate.

## Dogfooding

In this project the crew's Codex roles run with approvals off and the Claude Code roles keep theirs in the TUI, so the relay meets few live approvals. The Coordinator launches one Codex or OpenCode session with approvals on for a real task, and the human answers its approvals from Neovim's inbox, and from the browser once E-417 lands.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, real clients, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, and Playwright the third (headless Chromium through `playwright-core` under `node:test`, only for what needs a page); no new seams inside the hub. The web never sees the hub's secret. No hex colour outside the tokens in `web/src/tokens.css`. No iframe has `allow-scripts` together with `allow-same-origin`. Keys match by physical key (`KeyboardEvent.code`).
- **Precedence.** The spec's words; then the harnesses' protocols as the research read them (`docs/research/web-terminal.md` §1.2 to §1.5; `docs/research/opencode-v2.md`, the permission reply); then the boards' approval card (P23).
- **Tests.** The relays are proved against the fake app-server and the fake OpenCode server at the frame seam; the real harnesses are the Implementer's and QA's manual checks, never part of `npm test`.
- **Risks.** The Codex app-server and OpenCode's HTTP API are both labelled experimental: the adapters check the request shapes they rely on and fall back to `approvalRelay: 'none'` with a warn-level event when a shape changes. A denial must never reach the harness as consent.
- **Size.** About three sessions on the v0 scale.
- **Order.** Third in the hub lane: it waits for E-413, and E-420 waits for it. The approval cards of E-417 and E-418 answer through it without an edge; the hub lane is expected to land it before the web lane reaches them, and otherwise the Coordinator orders those slices after it.

## Links

- Spec: `docs/spec/v0.2.md` on `dev`, §3.4, §3.6 (approvals bound to a TUI on the phone) and §3.8.
- Map M-399 and the tickets this epic absorbs: Q-400 (W12), Q-403 (the harnesses' approval paths), Q-406 (approvals marked on the phone), Q-407 (the relay), Q-408 (one gate).
- Research: `research/web-terminal` (`docs/research/web-terminal.md` §1 and §5); `research/opencode-v2` (`docs/research/opencode-v2.md`, the permission API); `research/web-prior-art` (`docs/research/web-prior-art.md` §7.2: one gate, no timers, a denial that is a denial).
- Mockups: `docs/design/web/Sessions.dc.html` (P23, the approval card), `PhoneHome.dc.html` (a Claude Code approval marked "answer in Neovim").
- Code: `hub/src/adapters/contract.ts` (`approvalRelay`), `hub/src/adapters/codex.ts` (the server requests), `hub/src/adapters/opencode.ts` (`permission.asked`).
- GLOSSARY: Adapter, Harness, Ask.

## Plan

```yaml
stages:
  - name: record and gate
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1109
        - T-1110
  - name: relays and Neovim
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1111
      - - T-1112
      - - T-1114
  - name: races and restarts
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1113
      - - T-1159
```

## Comments

### coord · 2026-10-22T15:17:41.387Z

Decision on ask 9a81a158 (stand-in under D24, 15:17Z). The approval record carries the command, its cwd and the reason, plus the file paths and the change as the harness reports them, capped at 64 KB, and no other tool input (T-127). Only the human answers approvals; agent sessions, Aides included, are refused. The deny note is optional.

### qa-676 · 2026-10-22T23:07:33.020Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s1-2026-10-23-1
commit: 4411dcc99173b864850ac0988a11334d87262614
stage: record and gate
stage_hash: ca5e352aadd77a88822283392fcbd926b47ac32234168d69fc914212e135e81d
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-414 stage QA — clear

Run `qa-s1-2026-10-23-1`; commit `4411dcc99173b864850ac0988a11334d87262614`. Every scoped case passed.

| Case | Result | Command and observation |
| --- | --- | --- |
| E414S1-00 | PASS | Fresh clean detached4411dcc9 equalsdev; stage2/2 merges verified; shared environment dropped37names/prefix0; helpersparse; p1init/start0 local executor/lock correct, systemTMPDIR. |
| E414S1-01 | PASS | macOSlocal named approval-records18/18 pass no skips/failures; every required case name present including two one-tick answers, human-only gate, failed-delivery retry, native/fallback denialnotes and24hfakeclock. |
| E414S1-02 | PASS | macOSlocal web-authority and unit44/44 nofailure/cancel/skip; exact cookieapproval and hello/as/policy cases present; extra runtimecases reflect currentS. |
| E414S1-03 | PASS | Neovim inboxactions5/5 and recorded liveframe drift1/1 pass with pinnedNeovim no skips; T1109 commit lists refreshed protocolframes and attachmenttest. |
| E414S1-04 | PASS | 37/37 changedclock/fakeadapter/inbox/needsYou tests pass macOSlocal nofail/cancel/skip, required blockedinterval clockcase present. |
| E414S1-05 | PASS | wire import lint exit0 and full npmtypecheck exit0 no compilerdiagnostics. |
| E414S1-06 | PASS | Scratch productionClaude adapter/fakeclaude: one pendingid scopedtosession, command/subject touchapproved only, TUIroute nochoices nooutcome, nonemptyattach, needsYou1. |
| E414S1-07 | PASS | CLI oneapprovalrow/id needsYou1 matchesJSON; streamingS1alive oneid stablependingrecord/inboxmax1; privateinput0. |
| E414S1-08 | PASS | TUIonce/deny refusals exact, unknownnopending, malformedvalidationrefusal; recordunchanged pending. |
| E414S1-09 | PASS | Pendinginterval waitedS193 sameAsBefore true outcome null; both waitingepisodes PID/harness matchlive; SIGUSR1 yields exactlyone tooluse/reply, fresharchive andstream same harnessoutcome, idle; secondnewid, lateexactwinnerrefusal, archiveCLI1; S1neverreplaced. |
| E414S1-10 | PASS | qa-ccstop0 oldhub87270exit new4087start0; twoapprovalarchive rows byte-identical acrossrestart. |
| E414S1-11 | PASS | Rigproject underQ serving; all3fake launches accepted; nativeidle1 pending subjectechoidle choicesonce/deny viahub nooutcome; needsYou0→1 and rigraiseok. |
| E414S1-12 | PASS | R1alive pending→closed oneinboxrow no duplicates; exactallowlistedsubject, human/harness denyoutcome matches timestamp/archive, listedfalse. |
| E414S1-13 | PASS | Repeated nativeidempotent; base2→two3→three4→after3 needsYou equalsstatus; filechangeone, identicalnativeids separatepersession, closure removesonlymatchingrecord. |
| E414S1-14 | PASS | Subject65536UTF8bytes exactcap, originalprefix truncatedwithoutlonehighsurrogate, topcommand matches; allowlistedpatch exact; privateInSnapshotfalse. |
| E414S1-15 | PASS | CLI idle/filechange/archive eachone; archiveddeny attributedwithnote; needsYou5 matchesJSON. |
| E414S1-16 | PASS | Native answer closes once with human/neovim attribution; stream and adapter agree. |
| E414S1-17 | PASS | Concurrent answers have one winner, one exact refusal, one archive row and one adapter delivery. |
| E414S1-18 | PASS | Unoffered choice and already-closed answer refused; requests unchanged and adapter counts correct. |
| E414S1-19 | PASS | All eight session roles refused human-only approval.answer; implementer and Aide tool drivers ready and refused; pending unchanged, zero adapter delivery. |
| E414S1-20 | PASS | Cookie human answer attributed via web; impersonation refused cli-neovim-only; local late reply names winner; adapter receives one answer. |
| E414S1-21 | PASS | Scripted delivery failure restores pending and journals warning; brief-prescribed deny retry closes once with matching stream and adapter receipts. |
| E414S1-22 | PASS | 8196-byte note refused before delivery; corrected fallback note posts once to human/session General; native note is not duplicated. |
| E414S1-23 | PASS | After 601 seconds idle approval remained byte-identical pending with no outcome; adapter answers 0, live R1 only pending; private marker sweep 0. |
| E414S1-24 | PASS | All 16 documentation markers present; surrounding README/capability/CLI sections agree with observed cases 06–23. |
| E414S1-25 | PASS | Rig exit 0 tests 1/pass 1/fail 0; p1 hub stopped; census of 48 fixture-owned PIDs found none alive. |
| Stage cover gate | PASS | Linux A-9478/A-9479/A-9480 and macOS A-9485 green at S; plan cover complete. |

## Findings

No product or probe findings.

## Shared stage cover receipts

Both Coordinator-owned full stage runs tested commit `4411dcc99173b864850ac0988a11334d87262614`, verification tree `95303fe6e1ec65315487e5c6c1231ae0f4fa8cd6`.

- Linux droplet run `4786647f-b5e0-4c6e-921c-d716fb816ce3`: exit 0; 3823 passed, 8 skipped, zero failures. Merged log A-9478; shard logs A-9479/A-9480. T1–T4 plus Web ran, Web 17 files/47 top-level tests. Two c-8 lon1 machines: cland-v0-c72db40c, admission-to-remote-finish 1100.90 s, collection 35.06 s, lifetime 1086 s, $0.0754; cland-v0-a263d360, 982.90 s, collection 20.44 s, lifetime 966 s, $0.0671. Actual overall admission-through-collection wall 1136.23 s, total $0.1425. T-1155 T4 100-frame verifier case passed with 201/200/100 pending reads (A-9480); its earlier targeted receipt A-9469 is supporting evidence only.
- macOS local run `c6c2ee05-f2b4-444e-b6a4-9e8bfefb6d27`, A-9485: exit 0; 3831/3831 passed, zero failures or skips. Darwin arm64 27.0.0, Node v24.21.0, Neovim v0.12.5, two workers. T1–T4 plus Web ran (17 Web files/47 top-level tests, 93 including nested cases). Actual runner phase walls T1 30.71 s, T2 178.75 s, T3 915.61 s, T4 46.45 s, Web 33.68 s. Job queued 22:44:42.036Z, finished 23:05:12.908Z: 1230.872 s queued-to-finish, including admission/host-gate overhead, not pure test wall. Local monetary cost not reported; no droplet lifetime applies.

T4 base phase ran on both; T4 repetitions were explicitly skipped. Duration budgets and ratchet diagnostics are report-only, not enforced budget passes; projections are not measured walls. No QA full suite was submitted. Fresh plan reads show the applicable stage cover complete on both platforms. No epic criterion marks.

All fixture cleanup and earlier detailed observations remain in report-before-covers.md and original captures. Final HEAD/dev still equal S; detached tree clean apart from the allowed node_modules symlink. Stage verdict only; no criterion marks.

Evidence A-9487: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9487-e-414-stage-qa-clear-at-4411dcc9-final-cases-and-both-stage-covers/report.md

### coord · 2026-10-22T23:29:51.149Z

Coordinator decision (2026-10-22 23:30Z, from rev-32's review of T-1112; it refines ask 9a81a158's 64 KB cap): an approval whose complete authorization subject (command, or file paths and change) does not fit the public payload cap is a record answered in the TUI. It is not answerable in the hub, and it directs the human to the harness; truncated text is informational only. This applies to the Codex (T-1111) and OpenCode (T-1112) relays alike. Error paths use the same public-field allowlist as success paths.

### qa-676 · 2026-10-23T02:19:35.053Z

verdict: qa
result: clear
by: qa-676 [qa]
run: qa-s2-2026-10-23-1
commit: d32c6a8ff74d2052596f68c77d38dccaad879163
stage: relays and Neovim
stage_hash: 95d923e27ee229eb553322594f2b877e04839026eda925869911a14951656358
findings: [{"severity":"low","text":"E414S2-19 documentation sweep also at line 857 still describes re-keying and unlanded relays. Prescribed counts pass; Coordinator disposition 3273cf45 accepts low finding. Fix T-1159 in stage 3.","file":"hub/README.md","line":847},{"severity":"low","text":"QA capture limitation: wrapper and tee collided. Original kept unchanged; separate launch logs, sessions.json, S1 JSONL/pid and read-only liveness establish PASS under Coordinator b3d672f1. No relaunch.","file":"E414S2-10.txt"}]
finding_counts: {"high":0,"medium":0,"low":2}

| Case | Surface | Result | Evidence |
| --- | --- | --- | --- |
| E414S2-00 | hub-api | PASS | E414S2-00-init.txt, E414S2-00-p1-start.txt, E414S2-00-plan.json, E414S2-00-stage.txt, E414S2-00.txt |
| E414S2-01 | hub-api | PASS | E414S2-01.log, E414S2-01.txt |
| E414S2-02 | hub-api | PASS | E414S2-02.log, E414S2-02.txt |
| E414S2-03 | hub-api | PASS | E414S2-03.log, E414S2-03.txt |
| E414S2-04 | hub-api | PASS | E414S2-04.log, E414S2-04.txt |
| E414S2-05 | hub-api | PASS | E414S2-05.txt, E414S2-05a.log, E414S2-05b.log |
| E414S2-06 | hub-api | PASS | E414S2-06.log, E414S2-06.txt |
| E414S2-07 | hub-api | PASS | E414S2-07.txt, E414S2-07a.log, E414S2-07b.log, E414S2-07c.log |
| E414S2-08 | hub-api | PASS | E414S2-08.log, E414S2-08.txt |
| E414S2-09 | hub-api | PASS | E414S2-09.log, E414S2-09.txt |
| E414S2-10 | hub-api | PASS | E414S2-10-capture-limitation.txt, E414S2-10-cx.txt, E414S2-10-oc.txt, E414S2-10-readback.txt, E414S2-10-sessions.json, E414S2-10.txt |
| E414S2-11 | hub-api | PASS | E414S2-11-inbox.txt, E414S2-11-list.jsonl, E414S2-11-output.txt, E414S2-11-send.jsonl, E414S2-11.txt |
| E414S2-12 | hub-api | PASS | E414S2-12-answer.jsonl, E414S2-12-archive.jsonl, E414S2-12-archive.txt, E414S2-12-fake.log, E414S2-12-history.jsonl, E414S2-12-output.txt, E414S2-12.txt |
| E414S2-13 | hub-api | PASS | E414S2-13-history.jsonl, E414S2-13-output.txt, E414S2-13a-answer.jsonl, E414S2-13a-fake.log, E414S2-13a-list.jsonl, E414S2-13a-send.jsonl, E414S2-13b-answer.jsonl, E414S2-13b-fake.log, E414S2-13b-list.jsonl, E414S2-13b-send.jsonl |
| E414S2-14 | hub-api | PASS | E414S2-14-answer.jsonl, E414S2-14-fake.log, E414S2-14-inbox.txt, E414S2-14-list.jsonl, E414S2-14-output.txt, E414S2-14-send.jsonl, E414S2-14.txt |
| E414S2-15 | hub-api | PASS | E414S2-15-archive.jsonl, E414S2-15-archive.txt, E414S2-15-closed.jsonl, E414S2-15-fake.log, E414S2-15-late.jsonl, E414S2-15-list.jsonl, E414S2-15-output.txt, E414S2-15-send.jsonl, E414S2-15.txt |
| E414S2-16 | hub-api | PASS | E414S2-16-always-answer.jsonl, E414S2-16-always-inbox.txt, E414S2-16-always-list.jsonl, E414S2-16-always-send.jsonl, E414S2-16-deny-answer.jsonl, E414S2-16-deny-inbox.txt, E414S2-16-deny-list.jsonl, E414S2-16-deny-send.jsonl, E414S2-16-fake.log, E414S2-16-history.jsonl, E414S2-16-once-answer.jsonl, E414S2-16-once-inbox.txt, E414S2-16-once-list.jsonl, E414S2-16-once-send.jsonl, E414S2-16-output.txt, E414S2-16.txt |
| E414S2-17 | hub-api | PASS | E414S2-17-archive.jsonl, E414S2-17-archive.txt, E414S2-17-closed.jsonl, E414S2-17-fake.log, E414S2-17-late.jsonl, E414S2-17-list.jsonl, E414S2-17-output.txt, E414S2-17-send.jsonl, E414S2-17-tui.txt, E414S2-17.txt |
| E414S2-18 | hub-api | PASS | E414S2-18-inbox.jsonl, E414S2-18-output.txt |
| E414S2-19 | hub-api | PASS | E414S2-19-docs-context.txt, E414S2-19-output.txt |
| E414S2-20 | hub-api | PASS | E414S2-20-plan-final.json, E414S2-20-cover-receipt.txt |
| E414S2-21 | hub-api | PASS | E414S2-21-output.txt, E414S2-21-stop-cx.txt, E414S2-21-stop-oc.txt |

Build: d32c6a8ff74d2052596f68c77d38dccaad879163, clean detached macOS arm64, Node24.21.0, pinned Neovim0.12.5. Run qa-s2-2026-10-23-1; 127 targeted tests passed, zero skip/fail/cancelled; typecheck and wire lint passed. Behavioral live checks used a sealed scratch HOME/XDG/Git and fake Codex/OpenCode only. No local full suite was run. All scratch processes stopped, 40-PID fixture census empty; scratch root removed. All scoped cases PASS.

Low findings:
- E414S2-19, hub/README.md:847 and :857: surrounding documentation still says reconnects may re-key a request and the relay implementations have yet to land. All prescribed counts passed; Coordinator disposition 3273cf45 accepts this as low finding, with fix T-1159 in stage 3. Retained docs context and disposition.
- E414S2-10 QA capture limitation: the stdout wrapper and helper tee targeted the same file, overwriting early launch-exit lines. Original retained unaltered. Separate launch logs, sessions.json and S1 capture plus read-only PID liveness prove both sessions running in p1 with reliable relays and subscribed S1. Coordinator b3d672f1 authorized judging those receipts; no launch repeated. Later wrapper output uses separate -output.txt.

Criterion marks: none; after-stage QA.

Stage covers at d32c6a8ff74d2052596f68c77d38dccaad879163, verification tree f3ac7b4d73c8e68f127bceb4ced633ac27e3e6f0: final plan missing=[]; all stage members merged. Detached HEAD and dev both equal S, clean detached status.
- Linux droplet 83a773e8-7ec5-43fb-b117-d4d2e0f60b2a: green, 3923 pass, 0 fail, 8 skip. Merged A-9755; shard logs A-9756 and A-9757. linux x64, 2 workers, T1–T4 and Web. Shard 1 cland-v0-75f6311a (c-8 lon1): 1095.56 s admission through remote finish, lifetime 1086 s, $0.0754; collection 25.39 s. Shard 2 cland-v0-afc1850f (c-8 lon1): 954.56 s, lifetime 938 s, $0.0652; collection 19.07 s. Overall wall 1121.20 s; total $0.1406.
- macOS local bd2aafa5-9fec-4161-8d87-3a4de930cac3: green, 3931 pass, 0 fail, 0 skip; A-9764. darwin arm64, 2 workers, T1–T4 and Web. Overall macOS wall/cost not stated in the receipt; no projection substituted.
- Both covers ran T4 base files only; T4 repetitions skipped. Timing budgets and lint report-only; projected tier walls are not observed overall walls.
- Original failed Linux 10fcb1d8 retained as A-9739, shard logs A-9740/A-9741. Exact failure: `AssertionError [ERR_ASSERTION]: first hub.status took 10424.6 ms; T-1081 budget 10000 ms` (startup-replies-scale.test.ts:81). Coordinator classified known flake T-1094 and authorized same-head retry. Original incomplete run is not counted as passing coverage: overall wall 996.20 s, total $0.1273. Original and retry Linux billed total $0.2679; summed observed run walls 2117.40 s, not an end-to-end elapsed-time claim.

Durable evidence A-9766: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-9766-e-414-stage-relays-and-neovim-22-pass-at-d32c6a8f-both-covers-green/report.md
