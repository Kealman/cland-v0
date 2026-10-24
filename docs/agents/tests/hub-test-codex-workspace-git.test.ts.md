# hub/test/codex-workspace-git.test.ts

T4 is macOS-only: real scratch Git operations under a synthetic Seatbelt write
allowlist derived from the generated Implementer's resolved `threadPolicy`.
It proves task-worktree add/commit, task-branch push and fetch with the exact
Git objects/refs/logs/worktrees and artifact roots. Hook/config writes remain
denied in both repositories, and the shipped territory hook still refuses dev.
No whole temp-directory grant is allowed: it would expose the scratch repository
and invalidate the negative controls. All subprocesses use `fixtureEnvironment`;
scratch Git auto-GC is disabled to leave no background writer at teardown.

Run locally after cover-quiet releases. Linux skips this test; neither that skip
nor a green synthetic Seatbelt receipt proves native Codex enforcement or Linux
Landlock parity. T-1222's landing evidence under E-778 still requires a scratch
project's real Codex Implementer to commit and push on generated defaults.
