---
id: T-44
kind: task
title: "cland CLI: find the hub from a worktree of the project"
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: impl-44
parent: E-19
blocked_by: []
topic: topic-3
branch: t/T-44-cli-hub-from-worktree
created: 2026-10-08T19:01:49.025Z
updated: 2026-10-10T00:58:17.510Z
closed: 2026-10-09T06:54:35.340Z
---

## Parent

Part of T-19. Found while preparing T-42 (dogfooding): the Implementer for T-43 works in `.cland/worktrees/T-43`, and every `cland` command run there answers `no hub running for …/.cland/worktrees/T-43` while the project's hub is up.

## Problem

`projectRoot(cwd)` (`hub/src/project.ts:96`) stops at the first ancestor holding `.git` or `.cland/`. A git worktree of the project has both (its `.git` file and the committed `.cland/tasks`, `roles.toml`, `config.toml`), so the CLI looks for `.cland/hub.json` inside the worktree, where the ignored hub files never are. The spoke and `cland hook` honour `CLAND_HUB_FILE`; the other CLI commands (`task`, `session`, `hub status`, `hub stop`) do not: they read `readDiscovery(layout(projectRoot(cwd)).discovery)`.

## What to build

- `cland` resolves the project from a worktree: when `.git` is a file (`gitdir: …/.git/worktrees/<name>`), the project root is the main worktree's root (`git rev-parse --git-common-dir`, or the gitdir path's grandparent), and `.cland/hub.json` is read there. A `.cland/` without `hub.json` inside a worktree is not the project.
- Every CLI command honours `CLAND_HUB_FILE` the way the spoke does, so a launched session's environment can name the hub outright.
- Tracker writes still land in the main worktree's `.cland/tasks` (the hub's root), never in the worktree's copy: say so in `docs/agents/issue-tracker.md` and `hub/README.md`.

## Acceptance criteria

- [ ] `cland hub status`, `cland task view T-1` and `cland session list` run from `.cland/worktrees/<x>` of a project with a running hub answer as from the root
- [ ] `CLAND_HUB_FILE=<file>` makes any `cland` command use that hub, from any directory
- [ ] A test in `hub/test/` adds a worktree to a temporary project with a running hub and runs the CLI there as a child process
- [ ] `hub/README.md` and `docs/agents/issue-tracker.md` say where the CLI finds the hub from a worktree and where item files are written
- [ ] `npm run typecheck && npm test` pass

## Comments

### human · 2026-10-08T19:14:43.398Z

GitHub mirror: https://github.com/Kealman/cland-v0/issues/43 (filed during the T-42 run; the numbers differ, the item is the source of truth).

### impl-44 · 2026-10-09T06:23:04.825Z

Starting implementation. Test seam agreed by the spec: CLI child processes from a real Git worktree against a temporary project's running hub. Will first reproduce hub status/task/session discovery failure, then cover CLAND_HUB_FILE override and tracker writes landing only in the main worktree.

### impl-44 · 2026-10-09T06:28:18.835Z

Regression reproduced: new hub/test/worktree-cli.test.ts initially reported running:false with the linked worktree as root. After following the Git worktree commondir and sharing CLI discovery, the real-worktree test passes for inside/outside worktrees and nested copied .cland directories; tracker writes remain only in the main worktree. npm run typecheck passes. Adding explicit hub-file override coverage and docs before final validation.

### impl-44 · 2026-10-09T06:32:23.495Z

Implementation and validation complete. Files: hub/src/project.ts; hub/src/cli/{hub,task,task-import,session,role,inbox,hook}.ts; hub/test/worktree-cli.test.ts; hub/README.md; docs/agents/issue-tracker.md. Worktrees resolve through Git's commondir; all existing-hub CLI commands share CLAND_HUB_FILE discovery; start/serve keep cwd project semantics. CLI integration covers inside/outside worktrees, nested copied .cland, main-only tracker writes, another running project, copied/relative discovery files, missing/invalid overrides, import, topic answer, and stop.

Standards review: no documented violations; one nonblocking duplicated-probe smell was removed (override status/unmute now use their existing connection; only stop probes for lock/cleanup root).
Spec review: no missing requirements, incorrect behavior or scope creep.

Validation: npm run typecheck && npm test passes (245 hub tests, 60 Neovim tests, zero failures); focused worktree-cli tests pass (2/2); git diff --check passes. No changes to session.launch schema or Codex adapter. Preparing the single final commit; no .cland/tasks files included.

### coord · 2026-10-09T06:34:07.763Z

Implementer report (impl-44, Codex gpt-6.1-sol, 06:32:35Z): one commit 16883af on `t/T-44-cli-hub-from-worktree` (merge-base 33b598e): `projectRoot` resolves linked worktrees through the git common dir; the CLI commands share one `CLAND_HUB_FILE` discovery while start/serve keep the cwd semantics; hub/test/worktree-cli.test.ts; hub/README.md and docs/agents/issue-tracker.md on main-worktree tracker writes. `npm run typecheck && npm test`: 245 hub + 60 Neovim pass. Launched 06:20:54Z, claimed 06:23Z, report 06:32Z: about 12 minutes. Review requested from rev-1 at 06:34Z in topic-3.

### rev-1 · 2026-10-09T06:36:56.554Z

verdict: review
result: not clear
by: rev-1 [reviewer]
run: rev-2026-10-09-T44-1

Reviewed 33b598e451ccc5faaa014b8196038c9ad0f4afd2...16883afc50206c557e09384a73ad1d6283bc63ed read-only.

Standards: no documented violations or actionable baseline smells.

Spec findings, ranked by severity:
- medium: hub/src/project.ts:115 — Outside a linked worktree, a separately initialized non-Git child project with .cland/ but no hub.json is bypassed for an ancestor's running hub. With /parent/.cland/hub.json and /parent/child/.cland/, projectRoot(child) now returns parent rather than child; hub start cannot start the child's hub, and task commands can target the parent's tracker. The request limits skipping copied .cland to worktrees and asks unchanged main behavior; README still promises otherwise the nearest .git/.cland. Preserve the nearest .cland fallback when no linked worktree is found.
- medium: hub/src/cli/hub.ts:320 — For CLAND_HUB_FILE pointing at a copied discovery file outside the project, a failed probe keeps dirname(dirname(discovery)) as the lock/cleanup root. If the copied file names a dead old hub and a replacement takes the actual project lock/binds its socket after that probe, stop checks an unrelated hub.lock and unlinks the replacement socket at line 194. The existing protection against deleting a newer hub's socket is lost. Establish the actual root before socket cleanup, or skip that cleanup when the root is unknown.

Core worktree resolution and override command wiring, main-only tracker routing, required documentation and integration coverage otherwise appear complete. No .cland/tasks files or unrelated T-45/T-48 changes in the diff.

Validation evidence: inspected /tmp/cland-T-44-tests.log: both new CLI integration tests pass, 245 hub tests and 60 Neovim tests pass, zero failures. Implementer reports typecheck passed. This review ran no tests and edited no files.

Totals: Standards 0 findings; Spec 2 medium findings. Both need resolution before clear.

### impl-44 · 2026-10-09T06:38:01.354Z

Addressing review rev-2026-10-09-T44-1. Will preserve the nearest initialized non-worktree project when an ancestor hub runs. For override stop, discovery will record its project root; new files use that root even if probing fails, and legacy copied files with no provable root will skip lock-based signaling/socket cleanup. Adding CLI regressions for nested projects and stale copied discovery with a replacement hub using a new secret.

### impl-44 · 2026-10-09T06:44:25.312Z

Fixed both findings from rev-2026-10-09-T44-1. The nested initialized non-worktree child test went red by selecting the parent's running hub; projectRoot now retains the nearest .cland when it reaches that ancestor. The stale copied-discovery test went red by unlinking the replacement's socket; new discovery files now record optional absolute root, and override stop uses that root for its lock and canonical-discovery checks. Legacy files remain readable: a reachable hub supplies its root through probing, otherwise process signaling and socket cleanup are skipped. Copied discovery also cannot clean a socket after the canonical file has disappeared or names another hub. Added both CLI regressions (including long-root socket relocation, secret rotation, another running project, and legacy copies); updated discovery shape validation, daemon shape test, test harness type and README.

Validation: both new regression triggers reproduced before correction; focused worktree-cli tests 4/4 pass. npm run typecheck && npm test passes once on final code: 247 hub tests + 60 Neovim tests, zero failures. git diff --check passes. Log: /tmp/cland-T-44-review-fix-tests.log. Preparing one fix commit on the existing task branch; no tracker files included.

### rev-1 · 2026-10-09T06:46:19.761Z

verdict: review
result: clear
by: rev-1 [reviewer]
run: rev-2026-10-09-T44-2

Second review of T-44: full change 33b598e451ccc5faaa014b8196038c9ad0f4afd2...44894b63736f7f832b1dfa9483bdbd2ed392d529, with fix 44894b6 inspected separately. Both prior medium findings are closed.

Standards:
- low (judgment, possible Duplicated Code): hub/test/harness.ts:236 — The harness repeats the production Discovery type, so the new optional root field is maintained twice. Consider importing/re-exporting the production type; the harness already imports project.ts. Nonblocking; no documented standard violation.

Spec: no findings. The nearest separately initialized non-Git child project is preserved. Linked worktree resolution and CLI override coverage remain intact. New discovery files record an absolute root; legacy files remain readable, a live legacy copy obtains its root through probing, and an unknown root disables signaling and socket cleanup. Copied-file cleanup checks canonical discovery ownership and the actual project lock. README documents the field and compatibility. Both regression tests exercise the prior failures, including a replacement hub with a rotated secret and rootless legacy discovery.

No .cland/tasks files or unrelated T-45/T-48 changes in the diff. Inspected /tmp/cland-T-44-review-fix-tests.log: both new regression tests pass, 247 hub tests and 60 Neovim tests pass, zero failures. Implementer reports typecheck passed. This review ran no tests and edited no files.

Totals: Standards 1 low finding; Spec 0 findings. Nothing high or medium remains.

### human · 2026-10-09T06:47:27.193Z

QA T-44: a CLI write from inside the worktree

### qa-1 · 2026-10-09T06:51:09.970Z

verdict: qa
result: clear
by: qa-1 [qa]
run: qa-2026-10-09-T44-1

Checked t/T-44-cli-hub-from-worktree at 44894b63736f7f832b1dfa9483bdbd2ed392d529 against the item and Coordinator's 06:24Z scope note. No product changes; worktree remains clean.

What I ran and saw:
- task.view T-44, CLI task view T-44 --json, and CLI task list --json succeeded.
- In the T-44 worktree, exported PATH with /Users/evgeniyivanov/.nvm/versions/node/v24.21.0/bin first, then ran npm run typecheck && npm test. Exit 0: 247/247 hub tests and 60/60 Neovim tests pass, zero skips. The project Neovim harness drives nvim_input and reads screenstring(). Log /tmp/qa-T44-node24-full.log.
- Afterwards, node --test hub/test/worktree-cli.test.ts under Node 24: 4/4 pass. Read the coverage: internal/external linked worktrees; nested copied .cland; separately initialized child isolation; stale copied discovery preserving a replacement hub and another project (including rootless legacy files); main-only tracker writes; missing/invalid overrides; explicit hub override across hub/task/session/role/inbox/topic/import commands. Log /tmp/qa-T44-focused.log.
- Against the real project hub (PID 8676), compared branch CLI from T-44 with main CLI from the repository root: hub status matched after normalizing elapsed uptime; task view T-44 --json, session list and inbox matched exactly. CLAND_HUB_FILE was removed for these discovery checks while retaining the session's identity.
- From an unrelated TMPDIR directory, CLAND_HUB_FILE=/Users/evgeniyivanov/Projects/cland/v0/.cland/hub.json with the T-44 CLI returned the project's hub, PID 8676.
- Made exactly one requested CLI write: task comment T-44 "QA T-44: a CLI write from inside the worktree". Asserted main's .cland/tasks/T-44-cland-cli-find-the-hub-from-a-worktree.md gained exactly one occurrence (line 118), while the worktree copy stayed byte-identical. git status --short is empty. No hub start/stop, topic answer or role set was run against the real project hub. Live script/evidence: /tmp/qa-T44-live.mjs and /tmp/qa-T44-live.log; task-list evidence /tmp/qa-T44-task-list.json.
- hub/README.md:380 and :382 and docs/agents/issue-tracker.md:5 accurately describe worktree discovery, existing-hub overrides, main tracker writes and the hub-start exception.

Findings by severity:
- High: none.
- Medium: none.
- Low, environment observation, not T-44: the launched shell initially selected /opt/homebrew/bin/node v25.6.1, outside the declared >=24.13 <25 range. The initial full run had 244 passes and 3 failures from SQLite ExperimentalWarning text in exact stderr assertions (asks-cli and tracker); Neovim was not reached. Independent asks-cli reproduction showed that extra warning text, then passed 4/4 on Node 24.21.0; the entire supported-runtime suite passed as above. Logs /tmp/qa-T44-full.log, /tmp/qa-T44-asks-diagnostic.log and /tmp/qa-T44-node24-asks.log. The live discovery checks also passed under the initial Node 25 shell.

Acceptance criteria satisfied.

### coord · 2026-10-09T06:54:35.338Z

Merged into main as 66f1353 (`git merge --no-ff`, by the Coordinator per the run's arrangement) at 06:52Z; on main after the merge: typecheck clean, 250 hub + 60 Neovim tests pass. Verdicts: review not clear rev-2026-10-09-T44-1 (06:36:56Z, two medium: the "no hub.json, not the project" rule leaked outside worktrees; `hub stop` through a copied override could clean another hub's socket and lock), fix 44894b6 (the discovery file records its hub's root, optional, legacy files readable; stop checks its own lock), review clear rev-2026-10-09-T44-2 (06:46:19Z); qa clear qa-2026-10-09-T44-1 (qa-1, 06:51:09Z: full suite on Node 24, focused tests, the branch's CLI from inside the worktree against the project's live hub matching the root's answers, the override from an unrelated directory, one CLI comment landing only in the main worktree's tracker file). Observation from QA, not T-44's: a hub-launched Codex session's shell resolves Homebrew's Node 25 (outside the engines range) instead of the hub's nvm Node 24, which adds SQLite ExperimentalWarning lines to stderr and fails three exact-stderr assertions; passed to T-48 (the launched session's PATH). Timeline: launched 06:20:54Z, claimed 06:23Z, implemented 06:32Z (12 min), review loop 06:34Z to 06:46Z (one fix round, 12 min), QA 06:46Z to 06:51Z, merged 06:52Z: about 31 minutes from launch to merge. Not pushed.
