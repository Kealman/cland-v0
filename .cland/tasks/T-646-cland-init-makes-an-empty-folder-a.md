---
id: T-646
kind: task
title: cland init makes an empty folder a repository whose first commit is cland's files, then the territory, ending on a clean dev
state: open
status: review
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-639
  - T-609
  - T-637
topic: topic-539
branch: t/T-646-cland-init-makes-an-empty-folder-a
created: 2026-10-16T16:23:59.380Z
updated: 2026-10-19T00:02:01.338Z
---

## Summary

Today an empty folder stops with "main has no commit yet: create main, then run cland init". Init now runs `git init -b main` in a folder outside any repository, provisions as before, makes a first commit holding only cland's files, then creates the territory from that commit (ADR 0004), so the root ends on a clean `dev` (spec v0.1.4 §3.2, "The first commit"; prototype/setup 5028220a). This ticket is the empty folder; the next two extend it to folders with files, repositories without commits and a machine without a Git identity.

## What to build

- **A new module** `hub/src/init/repository.ts`, taking from the prototype what fits:
  - `createRepository(report, root)`: `git init -q -b main` when `root` is in no repository and holds nothing beside cland's own paths and `.DS_Store`; T-609's root check has already refused a folder inside another repository, so a nested repository cannot arise.
  - `commitClandFiles(report, root)`: the first commit on the new branch holding only the paths cland provisioned (`AGENTS.md`, `.cland/` as its `.gitignore` leaves it, `.agents/`, `.claude/`, `docs/agents/`), with the message `Initial commit: cland init` and the list of paths in its body. It runs Git with `-c core.hooksPath= -c commit.gpgsign=false`, as the release's own commits do (`hub/src/territory-release.ts`).
  - `foldReport(report, again)`: one line per path when the territory runs twice.
- **The order in `provision`** (`hub/src/init/provision.ts`): create the repository, the territory's first pass (as today, before generated files appear), the managed files, then, for a repository init has just made, the first commit and a second territory pass that seeds `main` and `dev` in the territory, sets `origin/HEAD` and switches the clean root to `dev`.
- **The report** shows `created .git` (git init -b main) and `created … main` (first commit <sha>: <paths> (<n> files)); the territory's "main has no commit yet" line no longer appears for this folder.
- **`cland update`** never creates a repository or a commit.
- **Tests** in a new `hub/test/init-first-commit.test.ts` (with its line in `hub/test/shards.json`) on the scratch machine of ticket T-639, with an identity configured.
- **Docs.** The hub README's init section describes the empty folder's path.

## Acceptance criteria

- [x] C1. `cland init` in an empty folder leaves exactly one commit (`git log --oneline --all`), whose tree holds only `AGENTS.md`, `.cland/`, `.agents/`, `.claude/` and `docs/agents/` paths (init-first-commit.test.ts).
  - done: impl-646 · 2026-10-19T00:01:48.771Z
- [x] C2. Afterwards `git status --porcelain` is empty, `git branch --show-current` prints `dev`, and `main` and `dev` point at that commit.
  - done: impl-646 · 2026-10-19T00:01:49.230Z
- [x] C3. The territory exists with `main` and `dev` at that commit, its HEAD is `dev`, and `origin/HEAD` in the root is `origin/dev`.
  - done: impl-646 · 2026-10-18T23:56:51.991Z
- [x] C4. A second `cland init` makes no commit and reports nothing to change.
  - done: impl-646 · 2026-10-18T23:56:52.427Z
- [x] C5. The first commit carries none of `.cland/`'s volatile files (`hub.db`, `secret`, `territory.git/`, `log/`).
  - done: impl-646 · 2026-10-18T23:56:52.769Z
- [x] C6. A Git commit hook installed through the scratch machine's global `core.hooksPath` does not run during init's commit.
  - done: impl-646 · 2026-10-18T23:56:53.213Z
- [x] C7. Demo: in a scratch HOME, `mkdir x && cd x && cland init`, then `git log`, `git status` and `git branch` show the one commit on a clean `dev`.
  - done: impl-646 · 2026-10-18T23:56:53.655Z

## Comments

### impl-646 · 2026-10-18T23:56:20.279Z

Implemented the empty-folder Git bootstrap and second territory pass with folded reporting; update explicitly disables repository creation. Added T2 CLI/Git criteria coverage using the scratch machine, isolated provider/account variables in that fixture, and documented init. Initial test was red ('not a git repository'), then green. Scratch HOME demo: one Initial commit: cland init (82 managed files), clean dev, main/dev at same head. Evidence posted in item topic; host lint and typecheck passed. Preparing source review before one mode-free droplet verify.

### rev-31 · 2026-10-18T23:58:48.118Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-646-source-1
commit: bbddf4c474f330ae11dbe0604384031ab5f06ddf
scope: full
findings: [{"severity":"medium","text":"Allowed .DS_Store remains untracked; the second territory clean check leaves main instead of the promised clean dev.","file":"hub/src/init/repository.ts","line":15},{"severity":"medium","text":"Recursive staging of allowed directories adopts pre-existing custom skills/private docs that cland never provisioned.","file":"hub/src/init/repository.ts","line":25},{"severity":"medium","text":"New CLI/Git proofs use unregistered execFile writers without cancellation or bounded stop/close/result joins before scratch-root removal.","file":"hub/test/init-machine.ts","line":41}]
finding_counts: {"high":0,"medium":3,"low":0}

# T-646 source review: not clear

Head: bbddf4c474f330ae11dbe0604384031ab5f06ddf
Fixed base: 4b196c6208da89a4852be654cd05acd9978de83f
Branch: t/T-646-cland-init-makes-an-empty-folder-a
Scope: full. Read-only review against item C1–C7, v0.1.4 §3.2, ADR 0004 and docs/agents/tests.md. No verification at this head.

## Standards

M3 (medium), hub/test/init-machine.ts:41, exercised by new hub/test/init-first-commit.test.ts:14: execFile children have a command timeout but no test cancellation signal, immediate process registration or owned stop/close/result join before scratch-root removal. scratchMachine registers ownDirectory only; its set of child identities remains empty for these invocations. Parent cancellation can therefore delete the root while a CLI/Git writer remains active. Rule 12 requires observed writer completion before deletion. Add explicit ownership and bounded cleanup with a held-writer cancellation proof. Implementer confirmed no outer owner in 7b2bfb4b.

The intended T2 seam is otherwise appropriate: CLI behavior is the subject, with native Git observations and scratch HOME/Git config, no hub/harness starts and no sleeps. Tier manifest replaces the old shards manifest as documented. Existing init-next assertions are retained while text and JSON cases split to fit per-test budgets. Provider/account variables are newly filtered. Hook and signing overrides are command-local. No separate heuristic smell finding.

## Spec

M1 (medium), hub/src/init/repository.ts:15: admission explicitly permits .DS_Store but commitClandFiles leaves it untracked. With the scratch Git configuration and no global ignore, the second territory pass sees a dirty root and leaves main checked out (territory.ts:165,237–241). This violates C2 for an explicitly supported input. Preserve the file while ensuring the allowed metadata does not obstruct the promised clean dev.

M2 (medium), hub/src/init/repository.ts:25: git add recursively stages every file beneath the directory allowlist, while admission checks only top-level names and docs' immediate entries. Pre-existing .agents/skills/custom/SKILL.md or docs/agents/private.md can be committed despite never being provisioned by cland. This violates the task's managed-only first-commit boundary/C1. Derive staging from actual managed outputs, and preserve user-owned files rather than adopting them through a directory name. Implementer confirmed M1/M2 in 5a926e6c and is adding red controls before correction.

The ordinary empty-directory path otherwise follows the requested order: create main, first territory pass, provision, managed commit, second territory pass/folded report. Update explicitly passes repository=false, and existing repositories are not committed by the new path. Tests check one commit/tree boundaries, root/territory refs and HEADs, idempotence, exclusions, global hooks/signing, and update refusing to create history. A-5649 records the scratch-HOME demo and reported local file timings; those positive receipts do not establish the uncovered inputs or cancellation path.

Result: not clear. Fail C1 (unmanaged recursive staging and unsafe writer cleanup in its proof) and C2 (.DS_Store prevents clean dev). C3–C7 remain unverified at this source pass. No full/task verification until a corrected committed head receives clear source review; no dev merge requested. No per-item QA.

Findings: Standards 1 medium; Spec 2 medium.

Evidence: A-5654.

Criteria: C1 failed (Directory-wide staging can commit non-provisioned user files; the CLI proof also lacks owned child cancellation/drain before root cleanup.), C2 failed (Explicitly allowed .DS_Store stays untracked and prevents the second territory pass from switching to clean dev.).
