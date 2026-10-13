---
id: T-49
kind: task
title: "cland CLI with a session identity: the hub refuses the human-only commands"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: impl-48
parent: E-19
blocked_by: []
topic: topic-7
branch: t/T-49-cli-session-identity
created: 2026-10-09T06:33:20.718Z
updated: 2026-10-10T00:58:17.545Z
---

## Parent

Part of T-19. Found by impl-48 while building T-48 (2026-10-09): once a sandboxed Codex session may reach the hub socket, its shell can run every `cland` command, including the ones only the human should run (`cland topic answer` answers a real ask as the human; `cland role set` moves a role), and the audit records them as `human` with client `cli`. Any process holding the socket can do the same today; the launched Claude Code sessions, unsandboxed in auto mode, always could.

## What to build

- T-48 passes `CLAND_SESSION_ID` and `CLAND_SESSION_NAME` to the Codex session's shell, as the Claude Code adapter does, so `cland task` acts as the session. Build on it: when the CLI carries a session identity, the hub treats the call as that session, with the session's role permissions: `topic answer`, `role set` / `role revoke`, `inbox dismiss` and the other human-only frames are refused with a typed error naming the session, and the audit records the session, not `human`.
- A CLI call with no session identity stays the human's, as today.
- `hub/README.md` says which commands are the human's and what a session's CLI call may do.

## Acceptance criteria

- [ ] A test in `hub/test/` runs `cland topic answer` with `CLAND_SESSION_ID`/`CLAND_SESSION_NAME` of a launched session against a real hub: refused with the typed error, the ask stays open, the audit names the session
- [ ] `cland task view` and `cland task comment` with the same identity work as the session (the comment's author is the session)
- [ ] Without the variables, every command behaves as before
- [ ] `hub/README.md` documents it
- [ ] `npm run typecheck && npm test` pass

## Comments

### impl-48 · 2026-10-09T07:12:11.476Z

Done on `t/T-49-cli-session-identity` (worktree `.cland/worktrees/T-49`), commit dac8c4f, on top of T-48's head 0b217d8. Not pushed.

What changed:
- `hub/src/cli/socket-client.ts`, `actor.ts`: every frame the CLI sends from a shell with `$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` carries the session as `as` (before, only `cland task` did). `cland hook`'s `session.signal` and `session.bridge` carry none.
- `hub/src/hub/dispatch.ts`: a client frame whose `as` is a session is audited as that session and decided: `session.launch` / `session.list` by the permission table; `hub.status`, `inbox.list`, `role.list` and `hub.stop` allowed; every other frame refused with the typed `forbidden` error (`permission` is the frame's type) and a notice in Agents.
- `hub/test/cli-identity.test.ts`: `cland topic answer` as a launched Implementer, as the asking Coordinator and as an unknown session id is refused, the ask stays open, the audit names the session; `role set`, `role clear`, `session stop`, `hub unmute` refused; `inbox` and `role list` allowed and audited as the session; `task view` and `task comment` work as the session, the comment's author is the session, another item's comment is refused; without the variables the same commands succeed as the human.
- Docs: `hub/README.md`, "The CLI in a session's shell"; `docs/review-and-qa.md` updated where it said those commands act as the human.

Tests: typecheck clean; hub 256 passed, Neovim 61 passed, 0 failed, 0 skipped.

Decisions to check:
- `cland hub stop` stays allowed from a session's shell, so the Coordinator can restart the hub after a merge; a session can signal the hub's process anyway.
- `cland session attach`, `stop`, `resume` and `retry` are refused for every session, the Coordinator included: the table knows only `session.launch`.
- The item names "`inbox dismiss`" and "`role revoke`": the CLI has neither. The frames `inbox.dismiss` and `role.clear` are refused.
- I did not run the two-reviewer `/code-review` pass on this change; the Reviewer's pass is its first independent read.

### rev-1 · 2026-10-09T07:37:56.029Z

verdict: review
result: not clear
by: rev-1 [reviewer]
run: rev-2026-10-09-T49-1

Reviewed da6cd3dde7107a12909d435d7be90f683148fe62...a8e36988c2e7f278f5fc06f33fdf1141b5c6fd69 against the item and Coordinator's topic decisions, with parallel Standards and Spec reviews.

Spec — not clear (two medium findings):
- Medium — hub/src/hub/dispatch.ts:209: With only CLAND_SESSION_NAME=ghost, sessionOf sends a name-only actor, but #asSession returns null for an unknown name; topic.answer executes and audits as human. The requirement covers either identity variable. Preserve session origin for unknown name-only identities while retaining human --as behavior; add this CLI regression case.
- Medium — hub/src/cli/hub.ts:169: Only a received forbidden response prevents the stop fallback. A non-Coordinator shell whose hub.stop request times out or loses its response reaches SIGTERM at line 187 when the live hub owns its lock, without the Coordinator grant. Session shells must not signal after an unconfirmed request; retain human fallback and fallback after confirmed authorization.

Standards — clear (two low findings):
- Low — hub/src/cli/actor.ts:30: sessionOf repeats actorOf's environment normalization and actor construction; share that extraction while preserving actorOf's warning and flag behavior (duplication judgment).
- Low — docs/review-and-qa.md:82: The docs list session stop among commands refused to a launched session, although Coordinator now has session.stop; qualify the example by role.

No high findings. Reviewed source and tests read-only; no edits or tests executed. The reported clean typecheck and 257 hub / 62 Neovim tests were not independently reproduced. No task item files are in the reviewed diff.

### rev-1 · 2026-10-09T07:46:31.505Z

verdict: review
result: clear
by: rev-1 [reviewer]
run: rev-2026-10-09-T49-2

Reviewed main (4490cf7)...5399b2879b82966ecd7aa858f9f215357fea5982 and fix commit 5399b28 against the item and Coordinator's second-round request, with parallel Standards and Spec reviews.

Standards — clear: no findings. actorOf shares sessionOf's extraction, and docs/review-and-qa.md correctly describes the Coordinator's stop capability; both previous low notes are closed.

Spec — clear: no findings. Both previous medium findings are closed. The shell:true actor marker keeps unknown name-only identities roleless for task and non-task frames, while a human's --as remains unchanged. A session shell's failed/unconfirmed hub.stop exits before the signal fallback; confirmed requests and human calls retain fallback. The regression tests check ghost-only topic.answer refusal/audit, task.create refusal and the still-open ask, plus an unresponsive SIGSTOPped hub for Implementer, Coordinator and unknown-name shells, followed by a successful status after SIGCONT.

No high, medium or low findings remain. Source and tests reviewed read-only; no edits or tests executed. The reported clean typecheck and 258 hub / 62 Neovim passes were not independently reproduced. No task item files appear in the diff.

### qa-3 · 2026-10-09T07:51:29.730Z

verdict: qa
result: clear
by: qa-3 [qa]
run: qa-2026-10-09-T49-1

Checked branch t/T-49-cli-session-identity at 5399b2879b82966ecd7aa858f9f215357fea5982. Read the item, Coordinator's 07:12Z decisions and subsequent acceptance, hub/test/cli-identity.test.ts, and the relevant docs. No source edits; worktree clean.

Part A (T-48 launch proof):
- `node --version`: exit 0, v24.21.0.
- `npm run typecheck && npm test`: exit 0. Typecheck clean; hub 258 total, 251 passed, 7 skipped, 0 failed; Neovim 62 passed, 0 skipped/failed. Six hub scenarios skip because this sandbox refuses `ps` for PID identity (the existing five plus Coordinator session/hub management in cli-identity.test.ts); one skips because nested sandbox-exec is unavailable. Neovim uses the project's headless harness, nvim_input and screenstring(), with the cached runtime.
- `node /Users/evgeniyivanov/Projects/cland/v0/hub/bin/cland.ts inbox`, from this worktree: exit 0, inbox notifications and `needs you: 0`.
- `git commit --allow-empty -m "probe"`: exit 128, cannot create main .git/worktrees/T-49/index.lock: Operation not permitted. Not retried; no commit made.
- No command entered waiting for approval.

Part B:
- Branch CLI `task list --state open --json` and `task view T-49 --json` against the project hub: both exit 0; eight open items including T-49, correct T-49 body/verdicts returned.
- `node --test hub/test/cli-identity.test.ts`: exit 0, 4 passed, 1 skipped, 0 failed. The skip is the Coordinator's launch/list/stop/resume/hub-stop scenario, requiring ps for PID identity before signalling. Executed cases confirm human-only refusals, an open ask and correct audit identity, task view/comment attribution and scope, unknown name-only identity rejection, and no signal fallback for unanswered stops (Implementer, Coordinator and ghost).
- Scratch git project: /private/var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/qa-T49-uTcS8u. Every scratch CLI command unset CLAND_HUB_FILE; init and hub start retained this QA shell's session identity. Both exit 0.
- With CLAND_SESSION_NAME=ghost and CLAND_SESSION_ID removed: task create probe exits 1 (`forbidden: task.create (a session with no role has no tools)`); role set ghost implementer exits 1 and explicitly names ghost; hub stop exits 1 (`forbidden: hub.stop (a session with no role has no tools)`). Subsequent hub status exits 0, same PID 58638 still answering.
- With both session variables removed: task create probe exits 0, creates T-1. Audit records human for that successful create and ghost, role null, client cli, forbidden for the refused commands.
- Human hub stop exits 0; subsequent status says no hub running. No kill fallback needed. No lifecycle or role mutations were sent to the project's own hub.

Part C: hub/README.md:289-308 documents session identity, the command permission table, human-only frames, unknown roleless sessions, stop fallback, and the missing session.stop/session.resume/hub.stop grants in older roles.toml. docs/review-and-qa.md:82 agrees on Coordinator stop capabilities.

Findings:
- High: none.
- Medium: none.
- Low: the scratch ghost `task create probe` and `hub stop` errors omit `ghost`, contrary to the brief's naming expectation; they emit the generic roleless reason from hub/src/roles/permissions.ts:137. `role set` names ghost, and all three audit records correctly identify ghost. Refusal and identity enforcement work; this is diagnostic wording, not an authorization bypass.

Evidence logs: /tmp/qa-20261009-T49-suite.log and /tmp/qa-20261009-T49-identity.log; project CLI snapshots /tmp/qa-20261009-T49-list.json and /tmp/qa-20261009-T49-view.json; scratch audit .cland/log/hub.log in the temporary project above. Fix/instrumentation phases were not performed: QA's brief explicitly forbids fixes, and the direct CLI observations establish the diagnostic finding.

### coord · 2026-10-09T07:57:23.467Z

Merged into main as d063ff8 (`git merge --no-ff`, by the Coordinator) at 07:52Z; on main after the merge: typecheck clean, hub 258 pass (a first run had one failure that did not reproduce on the rerun: 258/258), Neovim run separately. Verdicts: review not clear rev-2026-10-09-T49-1 (07:38:02Z, two medium: an unknown name-only identity promoted to the human; an unanswered hub stop still signalling the hub), fix 5399b28 (an identity from the shell's environment is the shell's own, an unknown one a roleless session; a session's hub stop signals only after the hub accepted it), review clear rev-2026-10-09-T49-2 (rev-1, 07:46:38Z); qa clear qa-2026-10-09-T49-1 (qa-3, 07:51:29Z, the first QA session under the new per-role policy: the identity tests, the scratch-hub refusals of a ghost identity for task create, role set and hub stop with the hub staying alive, the human's create and stop; one low: the task create and hub stop refusals omit the session's name in their text, while the audit names it). Decisions on the way: `session.stop`, `session.resume` and `hub.stop` granted to the Coordinator in the permission table, refused to every other session; `attach`, `retry`, `role set`, `role clear` refused to all sessions; listing stays under the `session.launch` grant; older roles.toml files lack the grants (README). Timeline: briefed 07:05Z, first commit 07:12Z, grants 07:16Z, review loop 07:33Z to 07:46Z (one fix round), QA 07:48Z to 07:51Z, merged 07:52Z. Not pushed.
