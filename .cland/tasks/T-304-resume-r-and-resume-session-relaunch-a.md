---
id: T-304
kind: task
title: 'Resume: r and "Resume session" relaunch a stopped session on its harness conversation, with a fresh launch on the same brief when it cannot'
state: open
status: backlog
labels:
  - v0.1.2
  - ready-for-agent
  - hub
  - nvim
assignee: null
parent: T-275
blocked_by: []
topic: null
branch: null
created: 2026-10-12T21:34:30.803Z
updated: 2026-10-12T21:35:02.196Z
---

## Summary

`r` on a stopped session row, and the palette action "Resume session", relaunch the same harness conversation under the same cland name, role and claim. When the harness cannot resume, the action says why and offers a fresh launch with the brief recorded at launch.

## Parent

T-275: Sessions: stopped sessions, verifiers' items, the queue line. Spec: `docs/spec/v0.1.2.md` §3.5, Resume (decided in T-257). ADR 0001: a resumed session receives its role's clause again.

## What to build

**What exists.** `cland session resume <name> --relaunch` (frame `session.resume` with `relaunch: true`) already starts a new harness process on a recorded conversation. Claude Code relaunches with `--resume <harnessSessionId>`, Codex with `thread/resume`, and OpenCode on the recorded session. `harnessSessionId` is already recorded at launch in the process table. The adapters' paths are in `hub/src/adapters/`. The resume orchestration is `Sessions.resume` in `hub/src/adapters/sessions.ts`. Build on these. Do not add a second resume path.

**Record what a fresh launch needs.** At launch, the hub records on the session's process-table row (`hub/src/adapters/processes.ts`, `hub.db`) everything an equivalent fresh launch needs:

- the brief as given: the `--brief` text, or the artifact id, stored as the id and not as its content;
- the harness, the model, the effort, the cwd and the launch item.

The recorded harness conversation id stays where it is. Rows written before this change have no brief and fall back to "no brief recorded".

**Resume a stopped session.** For a row whose status is `stopped` or `exited`, `session.resume` with `relaunch` resumes through the adapter in the session's recorded cwd, under the same name.

- **Role.** The row's role comes back, and the role clause is delivered again on the resumed session's hello (ADR 0001). When the role is exclusive and another session holds it now, for example a Coordinator handed over meanwhile, the resume goes ahead without it and the answer says so.
- **Claim.** An Implementer's or Lead's claim is not released at stop: the tracker keeps it, keyed by the session's identity. The resumed session keeps it while it is still that session's. When another session took the item meanwhile, or the item closed, the resume goes ahead without the claim and the answer says so. A resumed session must never end up holding a claim another session holds.
- **Verifier holds.** Holds are released at stop by design. The resume does not restore them, and the answer says that the verifier must retake its hold.
- **The answer.** It carries what came back and what did not: `{ found, process, role, claim, notes[] }`, or a shape of that kind documented beside the frame.
- **The journal.** It records `session-resumed` with `relaunched: true`, as today, plus what was not restored.

**When the harness cannot resume.** Resume is impossible in these cases:

- the row has no conversation id;
- the adapter refuses: the conversation is gone, `thread/resume` is refused, or the OpenCode session is not found;
- the adapter reports that it has no resume.

Then the answer is `found: false` with the reason and an offer: `fresh: { brief: <text summary or A-id> | null }`.

- A new request, `session.resume` with `fresh: true`, makes an ordinary `session.launch` under the same name and role with the recorded harness, model, effort, cwd or item, and brief. Its claim follows the same rule as a resume: kept when it is still the session's, otherwise launched without it and said so.
- The CLI is `cland session resume <name> --fresh`. When a plain `cland session resume <name> --relaunch` cannot resume, it prints the reason and the `--fresh` hint, and exits 1.

**The fakes.** The demo needs one fake harness that cannot resume. Add a switch to the fake's home, in the style of the fake Codex's `fail-thread-resume`, that makes that fake refuse resume. Keep it to the fake's own files in `hub/test/fakes/`. T-281 is editing `fake-claude.ts` (the hook stdin), so prefer the Codex or OpenCode fake, or rebase onto T-281 first.

**The panel and the palette.**

- `r` on a stopped row of the sessions panel resumes that session. On a live row, it says the session is running and does nothing.
- The panel shows `resuming <name>…`, then the outcome on its note line, including what did not come back.
- When the hub offers a fresh launch, the panel shows a confirmation line in the style of stop's: `cannot resume <name>: <reason> · f launches it fresh with its brief · n keeps it stopped`. `f` sends `fresh: true`, and `n` or `Esc` dismisses it.
- The palette action "Resume session" works on the selected or named session. Both keys, the confirmation keys and the action are registered in the action registry (`nvim/lua/cland/actions.lua`), so `␣?` and the palette list them.
- The panel footer gains `r resume`.

**Demo** (the epic's words). A stopped fake Claude Implementer resumes on the same harness session with its claim, and a fake harness without resume gets the offer.

**Out of scope.** The archive and resuming from it (the next ticket), automatic archival, and pool hand-offs, which keep their own restart path (`#restartPool`).

**Constraints.**

- Tests go through the frame protocol first, with a real hub, real spokes and the CLI on a temporary project. The fake harnesses come second. The Neovim UI is tested headless on the stub hub.
- No new seams inside the hub. The fakes' switch lives in the fakes.
- Helpers stay out of `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` waits on the `hub.status` `flushLogs` barrier.
- Recomputes are coalesced once per tick (T-293).
- Every key goes through the action registry.
- Suites run through `cland verify`, and only when the queue shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. Resuming a stopped fake Claude Code Implementer relaunches the same harness conversation, with the same `harnessSessionId`, under the same name, role and claim. The role clause is delivered again.
- [ ] C2. When another session holds the item's claim, or the exclusive role, the resume goes ahead without it and the answer and journal say so. A hub test covers the claim case and the exclusive-role case.
- [ ] C3. A harness that cannot resume answers `found: false` with its reason and a fresh-launch offer. `--fresh` (`fresh: true`) launches under the same name and role with the brief recorded at launch, text or artifact id, and a hub test checks that the first input carries that brief.
- [ ] C4. A Neovim headless test on the stub hub shows four things: `r` on a stopped row, the outcome note, the fresh-launch confirmation line with `f` and `n`, and "Resume session" in the palette and `␣?`.
- [ ] C5. `hub/README.md`'s session frames and CLI table describe `--relaunch` on a stopped session, `--fresh` and the answer's fields. `nvim/README.md` describes `r` and the offer. The Coordinator's default clause names `cland session resume <name> --relaunch` and `--fresh`.
