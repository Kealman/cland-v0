---
id: T-45
kind: task
title: "spoke session.launch: accept cwd, so the Coordinator can launch a session in a worktree"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: impl-45
parent: T-19
blocked_by: []
topic: topic-4
branch: t/T-45-session-launch-cwd
created: 2026-10-08T19:01:49.042Z
updated: 2026-10-10T00:58:17.519Z
---

## Parent

Part of T-19. Found while preparing T-42 (dogfooding): the Implementer for T-43 must run in `.cland/worktrees/T-43`, but the Coordinator's `session.launch` spoke tool (`hub/src/spoke/spoke.ts:93`) takes `name`, `role`, `model`, `harness` and `effort` only. The hub frame (`hub/src/adapters/requests.ts:21`) and the CLI (`cland session launch … --cwd dir`) already take `cwd`, so the Coordinator has to fall back to the CLI, which the audit records as `human`.

## What to build

- `session.launch` on the spoke takes `cwd` (optional: an absolute path, or one relative to the project root) and passes it in the frame. A directory that does not exist is refused with the hub's typed error.
- `hub/README.md` documents the parameter where the spoke tools and the launch defaults are described.

## Acceptance criteria

- [ ] A Coordinator spoke calling `session.launch {name, role, cwd}` gets a process whose `cwd` is that directory (against the fake harness, as the existing launch tests do)
- [ ] A relative `cwd` resolves against the project root; a missing directory is refused with a typed error
- [ ] `hub/README.md` documents the parameter
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:14:43.512Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/44 (filed during the T-42 run; the numbers differ, the item is the source of truth).

### impl-45 · 2026-10-09T06:21:25.293Z

Implementing with implement/tdd. Test seam: Coordinator spoke session.launch through the hub to the fake harness; observe the child process cwd and hub typed refusal for missing directories. This is the seam specified by the acceptance criteria.

### impl-45 · 2026-10-09T06:23:30.692Z

The absolute-cwd spoke/fake-harness test failed with the child launched at the project root, then passed after schema/frame forwarding. The relative-cwd test exposed an unresolved relative path in the hub process row; resolution now lives in Sessions.launch. Typecheck passed. Adding typed directory refusal next.

### impl-45 · 2026-10-09T06:25:06.268Z

All three focused integration tests pass (absolute, relative-from-nested-spoke, typed missing/file refusal plus name reuse and default cwd); typecheck passes. Applying code-review with independent Standards and Spec sub-agents against initial commit 33b598e451ccc5faaa014b8196038c9ad0f4afd2 and the working-tree diff before the single final commit.

### impl-45 · 2026-10-09T06:26:55.441Z

The final combined command stopped at typecheck because the added tool-schema assertion accessed a property on the SDK's generic object type. Corrected the assertion with an in-check narrowing; the full test suite had not started. Rerunning final validation. Standards review found no violations or actionable smells.

### impl-45 · 2026-10-09T06:27:27.068Z

Code-review results against base 33b598e451ccc5faaa014b8196038c9ad0f4afd2 (working-tree diff): Standards — no documented violations or actionable smells; tests use the public MCP/fake-harness seam and domain vocabulary. Spec — no missing requirements, scope creep, or incorrect implementation found; CLI/spoke share cwd resolution and typed refusal. Total findings: Standards 0, Spec 0. Final full test output is being captured in /tmp/cland-T-45-tests.log; no tracker files will be committed.

### impl-45 · 2026-10-09T06:29:29.208Z

Implemented and committed as 573959f (feat(spoke): launch sessions in a requested working directory) on t/T-45-session-launch-cwd. Spoke schema/frame accept cwd; Sessions.launch resolves against the project root and refuses missing/file paths before reservation/spawn; requests/protocol expose invalid-cwd. README covers spoke parameter and role-launch default. hub/test/session-launch.test.ts verifies child cwd, relative resolution from a nested Coordinator cwd, typed refusals, name reuse, and omitted cwd. Final npm run typecheck && npm test passed: 246 hub tests + 60 Neovim tests, 0 failures. Standards and Spec reviews: 0 findings each. Seven code/doc/test files committed; no .cland/tasks files. No work remains within T-45 scope; ready for Coordinator review/QA.

### coord · 2026-10-09T06:30:19.641Z

Implementer report (impl-45, Codex gpt-6.1-sol, 06:29:29Z): one commit 573959f on `t/T-45-session-launch-cwd` (merge-base 33b598e): the spoke's `session.launch` takes `cwd`; the shared launch boundary resolves a relative path against the project root and refuses a missing or non-directory path with `invalid-cwd` before reserving a role or spawning; fake-harness tests (hub/test/session-launch.test.ts) and README. `npm run typecheck && npm test`: 246 hub + 60 Neovim, 0 failures. Verified from the root checkout: 7 files, nothing under .cland/tasks, `git merge-tree` against main clean. Launched 06:20:54Z, claimed 06:21Z, report 06:29Z: about 9 minutes. Review requested from rev-1 (Codex gpt-6.1-sol) at 06:30Z in topic-4.

### rev-1 · 2026-10-09T06:31:50.407Z

verdict: review
result: clear
by: rev-1 [reviewer]
run: rev-2026-10-09-T45-1

Reviewed 33b598e451ccc5faaa014b8196038c9ad0f4afd2...573959f0af8569b8c9d38f6f515d1612c8c7ce84 read-only.

Standards: no findings. Shared hub launch validation, spoke forwarding, typed protocol refusal and documented vocabulary conform to the project's ownership boundaries and docs.

Spec: no findings. Optional cwd is forwarded; relative paths resolve against the project root; missing and non-directory paths yield invalid-cwd before role reservation or spawning. Fake-harness tests cover absolute, relative, missing/file and omitted cwd; README documents both requested locations. No .cland/tasks files or T-44/T-48 changes in the diff.

Validation evidence: inspected /tmp/cland-T-45-tests.log: the three new integration tests pass; 246 hub tests and 60 Neovim tests pass, zero failures. Implementer reports typecheck passed. This review ran no tests and changed no files.

Totals: Standards 0 findings; Spec 0 findings. Nothing high or medium remains.

### qa-1 · 2026-10-09T06:39:15.633Z

verdict: qa
result: clear
by: qa-1 [qa]
run: qa-2026-10-09-T45-1

Checked branch t/T-45-session-launch-cwd at 573959f0af8569b8c9d38f6f515d1612c8c7ce84. No product changes; worktree remains clean.

What I ran and saw:
- task.view T-45; CLI task view T-45 --json from the main project directory; CLI task list --json in the temporary project. All succeeded.
- npm run typecheck && npm test: unrestricted run exited 0, with 246/246 hub tests and 60/60 Neovim tests passing, no skips. The Neovim harness drives nvim_input and reads screenstring(). Initial sandbox run failed at listen EPERM; rerunning with socket access resolved it. Log: /tmp/qa-T45-full-unrestricted.log (initial restricted log: /tmp/qa-T45-full.log).
- node --test hub/test/session-launch.test.ts: 3/3 passed independently. Read coverage for optional schema, absolute child cwd, relative cwd from a nested Coordinator directory, missing/file typed refusals, zero spawned children after refusal, name reuse, and omitted cwd default. hub/src/adapters/sessions.ts:221 validates before the role reservation.
- Temporary git project, branch CLI init and hub start, then session launch x1 --role implementer --harness claude-code --cwd sub, session list --json, missing-cwd x2 launch, and x2 launch without cwd. Used the existing fake Claude seam against the real branch hub as Coordinator requested after real Claude refused the untrusted temporary workspace. Asserted both session-list rows and child-observed cwd: x1 = /private/var/folders/np/77bqv0b975563h22_twt3tsw0000gn/T/qa-T45-cli-fake-VsNyjl/sub; x2 without cwd = that project root. Missing path returned exit 1 and no process; direct socket response had ok:false and code:invalid-cwd. Reused x2 successfully. Stopped both sessions and hub successfully. Script /tmp/qa-T45-cli-fake.mjs; evidence /tmp/qa-T45-cli-fake.log. Real-harness attempt and cleanup: /tmp/qa-T45-cli.mjs and /tmp/qa-T45-cli.log; no workspace trust changed.
- hub/README.md:73 and :166 document optional cwd, absolute/project-relative resolution and project-root default, consistent with observed behavior.

Findings by severity:
- High: none.
- Medium: none.
- Low, pre-existing observation (not a blocker): hub/src/cli/socket-client.ts:44 discards the structured refusal code and renders only frame.error, including with CLI --json. The real hub returned invalid-cwd and spoke tests assert it; the CLI printed the expected inaccessible-directory message. Coordinator explicitly confirmed this is outside T-45.

Acceptance criteria satisfied.

### coord · 2026-10-09T06:43:23.473Z

Merged into main as e404863 (`git merge --no-ff`, by the Coordinator per the run's arrangement) at 06:40Z; on main after the merge: typecheck clean, 246 hub + 60 Neovim tests pass. Verdicts: review clear rev-2026-10-09-T45-1 (rev-1, 06:31:50Z), qa clear qa-2026-10-09-T45-1 (qa-1, 06:39:15Z; full suite unrestricted, focused tests, the branch's real hub with the fake Claude harness: relative cwd resolved in the process rows and the child's cwd, `invalid-cwd` with no spawn, name reuse, omitted cwd unchanged; one low observation, pre-existing: the CLI prints a refusal's message and drops its typed code). Timeline: launched 06:20:54Z, claimed 06:21Z, implemented 06:29Z (9 min), review 06:30Z to 06:31Z, QA 06:32Z to 06:39Z (7 min, including the sandboxed first run), merged 06:40Z: about 19 minutes from launch to merge. Not pushed.
