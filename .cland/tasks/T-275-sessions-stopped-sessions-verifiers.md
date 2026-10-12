---
id: T-275
kind: epic
title: "Sessions: stopped sessions, verifiers' items, the queue line"
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: T-228
blocked_by:
  - T-274
topic: null
branch: null
created: 2026-10-12T11:35:14.436Z
updated: 2026-10-12T11:35:19.885Z
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

- [ ] A verifier with several holds shows the latest and `+N`; a pending review or QA request shows dimmed until the hold.
- [ ] `r` and "Resume session" relaunch a stopped session through the harness's own resume with its name, role and claim, from the harness session id recorded at launch, and offer a fresh launch with the same brief when resume is impossible.
- [ ] `d` archives a session; `A` shows the archive; archived sessions leave every group and the default `session.list`; the journal keeps them.
- [ ] Stopped crew sessions archive one hour after their item merged or closed, otherwise after 24 hours; Aides never archive automatically; the "more" fold shows the latest 20 and the archived count.
- [ ] `cland session prune --older-than <duration>` deletes the hub's records of archived sessions and never the journal.
- [ ] The verify line summarises the queue and opens the queue view with the holder, the waiters in order with their waits and the admission ETA.
- [ ] The human's `npm test` waits in the hub's queue while it is busy, and starts at once only with `--force`.
- [ ] `hub/README.md`, `nvim/README.md` and the role clauses describe resume, archive, prune and the queue line.

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
