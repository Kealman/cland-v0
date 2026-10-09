---
id: T-65
kind: task
title: "Codex Implementer and QA sessions run with full access by default: any work a role needs, on any harness"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: impl-65
parent: T-19
blocked_by: []
topic: topic-15
branch: t/T-65-codex-full-access-defaults
created: 2026-10-09T08:55:35.290Z
updated: 2026-10-09T10:09:37.297Z
---

## Parent

Part of T-19; follows T-48. Decision of the human, 2026-10-09 (the second one on the Codex sandbox): every session of every harness must be able to do any work its role needs; "this needs Claude Code because the Codex sandbox cannot" is no longer a reason to pick a harness.

## What to build

- The launch defaults for the Implementer and QA roles become `approval = "never"` and `sandbox = "danger-full-access"` (the equivalent of Claude Code's auto mode), in `default-roles.ts` (what `cland init` writes) and in this repository's `.cland/roles.toml`. The Reviewer stays `read-only` with no network. The per-role profile of T-48 (`workspace-write`, writable roots, local sockets) stays available as a roles.toml value for projects that want it.
- `hub/README.md` and docs/review-and-qa.md state the new defaults and why, and keep the profile's description for those who choose it; the QA clause and the Implementer clause no longer warn about socket refusals.
- Verification on a real Codex Implementer launched under the new defaults, recorded on this item: `/bin/ps` works (the five pid-identity tests run instead of skipping); file watching works (the watcher and the seven FSEvents tests run for real, no polling fallback); nested `sandbox-exec` works (the edges test runs); the real harnesses can be spawned from inside the session (`claude --bg`, `codex app-server`, `opencode serve`, as a scratch hub launching one session of each); `npm test` passes with no skips but the ones that need an absent tool. Record on the item what still cannot be done, if anything.

## Acceptance criteria

- [ ] A test against the fake app-server asserts the Implementer's and QA's launch carries `approvalPolicy` never and the full-access sandbox, and the Reviewer's stays read-only; a roles.toml that sets the T-48 profile still gets the profile
- [ ] The real-Codex verification above is recorded on the item, with the list of what still cannot be done
- [ ] `hub/README.md`, docs/review-and-qa.md and the clauses say the new defaults and why
- [ ] `npm run typecheck && npm test` pass

## Notes

Two phases: the defaults, docs and the fake-seam test first, on the branch; the verification after the branch merges and the hub restarts, by the same Implementer relaunched under the new defaults. Size S. Implementer: Codex gpt-6.1-sol.

## Comments

### impl-65 · 2026-10-09T08:56:50.786Z

Claimed phase 1 on t/T-65-codex-full-access-defaults. Using the assigned fake app-server seam to verify full-access Implementer/QA defaults, read-only Reviewer and an explicitly configured T-48 profile. Real-session checks remain phase 2 after merge, hub restart and relaunch.

### impl-65 · 2026-10-09T08:59:52.944Z

The fake app-server test went red as intended: Implementer still sent permissions=cland instead of :danger-full-access. Changed built-in and repository defaults to never/full-access, kept Reviewer unchanged, and retained configured local-profile assertions across launch and relaunch. Updated both docs and clauses. Targeted tests and typecheck are running under the current restricted profile.

### impl-65 · 2026-10-09T09:01:54.720Z

Phase 1 implementation checks: typecheck exit 0; fake Codex launch/profile test passes; parser checks pass. Initial targeted two-file run: 11 passed, 1 stale CLI-output assertion failed, 1 ps-dependent skipped. Updated the role-list Implementer/QA expectations; isolated rerun passes (1/0/0). Full npm test now running.

## Standards
Internal skill review found no documented violations or baseline smell findings; terminology and existing seam conventions preserved. No tracker files changed.

## Spec
Internal skill review found no Phase 1 missing requirements, scope creep or incorrect implementation. Phase 2 real checks deliberately remain pending until merge/relaunch.

Totals: Standards 0 findings; Spec 0 findings. Evidence logs: /tmp/T65-red.log, /tmp/T65-targeted.log, /tmp/T65-role-list.log, /tmp/T65-typecheck.log, /tmp/T65-suite.log.

### impl-65 · 2026-10-09T09:10:14.584Z

Phase 1 committed as a75df1f on t/T-65-codex-full-access-defaults (6 files; worktree clean). Built-in and repository Implementer/QA defaults are never/danger-full-access; Reviewer remains read-only/no-network. Clauses and hub/README.md + docs/review-and-qa.md explain the decision and retain optional T-48 configuration. Fake app-server covers full-access defaults plus explicit local profiles on launch and relaunch; parser/CLI expectations updated. No .cland/tasks files committed.

Verification: npm run typecheck exit 0. Full npm test invocation ran hub: 269 tests, 261 passed, 1 failed, 7 skipped; its only failure was the existing Claude replacement clause-turn timeout (claude-code-sessions.test.ts:186, 15 s deadline) under heavy machine load. Rerun alone passed 1/0/0 without source changes. npm test stopped before Neovim; npm run test:nvim separately passed all 62, 0 failed, 0 skipped. New fake launch/profile test passed in the targeted and full hub runs. The 7 current restricted-profile skips are six ps-identity scenarios (T-49 added cli-identity.test.ts beyond the five listed on this item) and sandbox-exec. Documentation now names the additional skip. Logs: /tmp/T65-suite.log, /tmp/T65-isolated.log, /tmp/T65-nvim.log, /tmp/T65-typecheck.log, /tmp/T65-targeted.log, /tmp/T65-role-list.log.

Phase 2 remains pending merge + hub restart + this Implementer's relaunch under full access; no real-Codex capability claim made yet.

### rev-7 · 2026-10-09T09:12:24.352Z

verdict: review
result: clear
by: rev-7 [reviewer]
run: rev-2026-10-09-T65-1

Reviewed 8cbc33ce4bec643f0d505eeea5f8c8546bf70ce7...a75df1f3ef883caef0228c58bda4bc7ab0baebdc (phase 1 only), read-only in the main thread as requested.

## Standards
No documented violations or actionable baseline smells. Read AGENTS.md, GLOSSARY.md, relevant role/hub ADRs and the role/adapter documentation. The explicit T-65 human decision supersedes the earlier T-48 restricted defaults described in ADR 0003; the restricted profile remains documented as an option.

## Spec
No findings: high none; medium none; low none. Built-in and repository Implementer/QA defaults are never/danger-full-access; Reviewer remains never/read-only with no network. Existing key-by-key parser inheritance yields the new defaults, and the unchanged adapter maps them to :danger-full-access or :read-only. Explicit workspace-write/local/writable-root configuration retains the named profile, git-directory grants and socket exclusions. The fake app-server test checks per-role default launches, configured QA launch and relaunch, and configured Implementer relaunch with both git directories. Parser and role-list assertions match the new values. Clauses remove socket-refusal caveats; both requested docs explain the defaults, rationale and optional profile, including explicit local-network configuration. Exactly six changed files; none under .cland/tasks. git diff --check is clean.

Evidence: read the Implementer's logs. Full hub run: 261 passed, 1 clause-turn timeout, 7 skips; the failing scenario passed alone. New fake launch/profile test, parser test and updated role-list test passed in that full run. Neovim separately: 62 passed, 0 failed, 0 skipped. Typecheck log contains no errors; exit 0 is reported on the item. This review did not run tests or edit files. The original combined npm test invocation was not wholly green; its isolated rerun and separate Neovim results are recorded accurately. Real-Codex capability verification remains phase 2 after merge, hub restart and relaunch; this verdict makes no claim on it.

Totals: Standards 0 findings; Spec 0 findings. Nothing high or medium remains for phase 1.

### qa-9 · 2026-10-09T09:29:19.923Z

verdict: qa
result: clear
by: qa-9 [qa]
run: qa-2026-10-09-T65-1

Phase 1 only, independently exercised at a75df1f3ef883caef0228c58bda4bc7ab0baebdc on t/T-65-codex-full-access-defaults. main advanced during the brief, so the inspected change is fixed at 8cbc33c...a75df1f: six files, no tracker files. Worktree remains clean; no fixes made.

Ran and observed:
- `npm run typecheck && npm test`: exit 0. Typecheck passed. Hub: 269 tests, 262 passed, 0 failed, 7 skipped (340.9 s). Neovim: 62 passed, 0 failed, 0 skipped (67.3 s). The project's headless Neovim harness uses nvim_input and screenstring(). No timing failure required an isolated rerun.
- `node --test hub/test/codex-adapter.test.ts hub/test/roles.test.ts`: exit 0, 13 tests, 12 passed, 0 failed, 1 ps-dependent skip (102.1 s). Read the assertions: codex-adapter.test.ts:331 checks never/:danger-full-access for Implementer and QA, never/:read-only for Reviewer, configured QA workspace/local profile on launch and relaunch, and configured Implementer relaunch with writable main/worktree git directories. roles.test.ts:148 and :211 cover role-list wording and parsed defaults/profile values.
- `node hub/bin/cland.ts role list`: exit 0 against the project hub. Live Implementer/QA still show never/workspace-write/local, Reviewer never/read-only/network none, as expected before phase 2. The branch's isolated CLI test shows its new danger-full-access wording.
- `node hub/bin/cland.ts task list --state open --json` and `node hub/bin/cland.ts task view T-65 --json`: exit 0; list includes T-65, view returns its expected branch and item contents.
- Read hub/README.md:150 onward, docs/review-and-qa.md:63 onward, and both clauses/defaults in .cland/roles.toml and hub/src/roles/default-roles.ts. They explain the full-access defaults and human decision, retain the explicit optional T-48 profile and its limits, retain Reviewer read-only/no-network, and remove the clauses' socket-refusal caveats. `git diff --check 8cbc33c...HEAD` passed.

Findings by severity: high none; medium none; low none for phase 1.

Limits: the seven hub skips are six ps-identity scenarios (including T-49's cli-identity scenario) and the sandbox-exec edges scenario. This existing restricted QA session does not verify real full-access capabilities. Phase 2 remains required after merge, hub restart and Implementer relaunch: real ps/pid identity, FSEvents without polling fallback, nested sandbox-exec, real child harness launches, and the full suite under that policy. A clear phase-1 verdict does not complete that acceptance criterion.

Evidence: /tmp/qa9-T65-suite.log, /tmp/qa9-T65-targeted.log, /tmp/qa9-T65-items.json, /tmp/qa9-T65-item.json. Typecheck success is established by the combined command reaching npm test and exiting 0.

### impl-65 · 2026-10-09T10:09:37.297Z

Phase 2 started after Coordinator's 10:08:55Z handoff: main 55780b2, hub restarted at 10:08Z. `node hub/bin/cland.ts role list --json` against the live hub confirms Implementer + QA approval never, sandbox danger-full-access, writableRoots [], network full; Reviewer approval never, read-only, writableRoots [], network none. My existing session still refuses /bin/ps; the updated clause alone does not change a running thread's policy. Fresh QA/Reviewer proof requires Coordinator launch. Implementer cannot launch/stop sessions; a read attempt `session list --json` was refused under session.launch, so I asked the Coordinator to provide fresh sessions and handle their stop. No code changes.
