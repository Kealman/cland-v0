---
id: Q-599
kind: question
title: "Init and setup: the decided flow"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-591
blocked_by:
  - Q-592
  - Q-593
  - Q-594
  - Q-597
topic: null
branch: null
created: 2026-10-16T11:26:11.880Z
updated: 2026-10-16T15:11:54.243Z
closed: 2026-10-16T15:11:29.848Z
---

## Question

Init and setup as the decided flow, on the harness research, the prior-art research and the setup prototype: `cland init` on an empty folder and on a project whose default branch is not main; the setup steps in order, the accounts registration, doctor's strictness; the Aide in the terminal and the answer to the trust prompts (T-603); what `cland` prints in a folder without `.cland/`; the package version at release. The install command on a fresh machine is deferred (the human, 2026-10-16): 0.1.4 assumes cland installed from the checkout on the human's machine; Q-592's findings stand for later.

## Comments

### human · 2026-10-16T13:02:58.124Z

Open questions raised by the setup prototype (Q-597, prototype/setup at 187123a1), to be decided here with the human after the live try:

1. A repository with no commit keeps init's old path (no first commit) because the existing init tests define it: should it get the first commit too, like an empty folder?
2. A non-empty folder without Git gets no repository: does init create one and commit the human's files, or refuse with a line?
3. Trust goes to the favourite harness only, so a Codex favourite leaves a Claude Code Coordinator untrusted: grant trust for every installed harness?
4. Setup grants trust without asking, as decided: keep, or ask once as the harness's own dialog does?
5. A declined install is offered again on every run: remember the refusal (in config.toml?) or keep re-offering?
6. The accounts question writes the machine-wide registry (`~/.config/cland/accounts.toml`, read by every project's hub): default to No?
7. In Claude Code's attach, Ctrl+Z suspends setup together with the attach: acceptable?
8. Init's first commit uses Git's identity; a machine without user.name/email (a droplet) fails: init commits with a fallback identity (`cland <cland@local>`) when none is set?
9. Codex 0.163.0 is outside doctor's tested range and setup only repeats the warning: offer the pinned install (`--release 0.160.0`) as a step?
Also from the build: a path-less Claude Code account selects no CLAUDE_CONFIG_DIR unless the hub has one (fixed in the prototype beside T-603); real installers, logins, attach and hub start were not exercised (fakes and a stand-in hub); Codex's config/batchWrite and account/read answered only by the fake.

### human · 2026-10-16T13:07:26.912Z

10. `worktree.bgIsolation` is a managed key in .claude/settings.json (prototype 9e94a411 → amended): `cland update` rewrites a human's deliberate "worktree" back to "none". Keep it managed (cland's rule: sessions edit directly) or let a project override it?

### human · 2026-10-16T13:47:01.663Z

11. Decision update (the human, 2026-10-16 ~15:30Z, after trying the onboarding by hand in the workbench): the onboarding runs inside the cland workbench, not as an Aide attached in a plain terminal. setup ends by opening the workbench with the Aide in the centre (as the launcher does after ␣A), so the human sees the items appear, the Coordinator start, and can try things during the tutorial; the attach-in-terminal path stays only as a fallback (--attach) for a machine without the pinned Neovim. Supersedes decision 6 of the map's settled list.

### human · 2026-10-16T15:11:29.756Z

## Resolution

Decided with the human on 2026-10-16 ("все да"), after the setup run and the HOME incident:

1. Roots and the first commit: `cland init` serves the current folder or `--dir` only; when the discovered root differs it refuses, naming both paths; HOME is never a root; the hub's machine-wide state directory moves from `~/.cland/executor` to `~/.local/state/cland` so it is no project marker. A repository without commits and a non-empty folder without Git get what an empty folder gets: `git init -b main` and a first commit holding only cland's files (the human's files stay as they were). Without a Git identity init commits as `cland <cland@local>`.
2. Trust, logins, declined installs: trust is granted to every installed harness, not only the favourite, without a question, reported in one line ("trusted for …"); a login is offered for every harness a template role uses; a declined install is remembered in config.toml and not offered again until `setup --install`.
3. Accounts: the question about `~/.config/cland/accounts.toml` defaults to No (a machine-wide file); setup says when Yes is worth it (several accounts per harness, limits).
4. Harness versions: with Codex outside doctor's range, setup offers the pin (`--release <tested>`) as a step; the range itself is updated in the 0.1.4 hygiene; doctor stops counting OpenCode environment keys as credentials.
5. The managed `worktree.bgIsolation` key stays managed (`update` restores "none"); a human who wants isolation back sets it in `.claude/settings.local.json`, which takes precedence and cland never touches.
6. `cland` in a folder without `.cland/` prints "not a cland project: run cland init" and starts no hub; `cland open` in a project initialised but not set up prints "next: cland setup" in one line and opens the workbench as usual.
7. The package version: the root package.json version is the only source and equals the tag; `cland release` refuses a mismatch; the bump is an ordinary commit before the dry run (the install itself stays deferred).
8. Ctrl+Z in `--attach` suspends setup with the attach: accepted as is, the workbench is the main path.
Decision 11 (recorded earlier here): the onboarding runs inside the workbench; setup ends by opening it with the Aide in the centre; `--attach` is the fallback.

### human · 2026-10-16T15:11:54.243Z

Amendment to decision 4 (the human, 2026-10-16, right after the round): harness versions are not pinned and not judged at all for now: harnesses update themselves, pins would be a chore. setup offers no pin step; doctor prints each harness's version for information but gives no range verdict (the tested ranges in doctor become informational or go); the OpenCode environment-keys fix stays.
