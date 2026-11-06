---
id: T-1709
kind: task
title: The `[verification] provision` hook, and Neovim and Chromium leave the recipe
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by: []
topic: topic-1402
branch: t/T-1709-the-verification-provision-hook-and
created: 2026-11-06T10:47:58.346Z
updated: 2026-11-06T11:06:43.320Z
---

## Summary

`[verification] provision` names a script the executor's image builder runs once as root, after the recipe and before `prepare` runs as `runner`. The snapshot key drops its Neovim pin and gains the hook's content digest. This project's own hook installs its Chromium runtime libraries and its pinned Neovim, which leave `provision.sh` in the same change, so the executor's droplet snapshot keeps passing this project's suites.

Hot files: `hub/src/executor/droplet/provision.sh`, `hub/src/executor/droplet/prepare.ts` (`PrepareKey`, `prepareKey`, `sameKey`, `staleParts`), `hub/src/init/config.ts` (`[verification]`), `hub/bin/verify-prepare.ts`, this project's hook script (new), `.cland/config.toml`, `hub/test/executor-prepare.test.ts`

## What to build

- the config key, with its template comment;
- the builder step that copies the hook and runs it as root, its output logged with `executor-prepare-install`;
- the key change and its staleness report;
- `verify-prepare.ts` reading a key without `nvim`;
- this project's hook with the Neovim tag and digest embedded, so that a pin change changes the hook's content.

Notes: `provision.sh` is read from the running hub's code, so the new recipe and key take effect at the hub restart after landing, which triggers one snapshot rebuild. The Coordinator restarts and watches the first droplet run before any batch relies on it (epic constraint "The executor stays green").

## Acceptance criteria

- [x] C1. On the scripted machine, the builder runs the hook as root before `prepare` runs as `runner`, and a failing hook fails the prepare with its output (test).
  - done: impl-1709 · 2026-11-06T11:02:48.400Z
- [x] C2. The snapshot key carries the hook's content digest and no Neovim field, and editing one byte of the hook marks the snapshot stale with `provision` named in its stale parts (test).
  - done: impl-1709 · 2026-11-06T11:02:49.063Z
- [x] C3. `provision.sh` installs no `nvim` and none of the Chromium runtime packages (test).
  - done: impl-1709 · 2026-11-06T11:02:49.768Z
- [x] C4. This project's hook installs those Chromium packages and the Neovim tag and digest of `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`, which a test keeps equal (test).
  - done: impl-1709 · 2026-11-06T11:02:50.486Z
- [x] C5. `cland config` documents `[verification] provision`, and a project without it prepares exactly as before apart from the key (test).
  - done: impl-1709 · 2026-11-06T11:02:51.264Z

## Comments

### impl-1709 · 2026-11-06T10:51:05.659Z

Rule 20 sweep before edits: searched hub/src, hub/bin, hub/test (all tiers), nvim, web, docs, qa/briefs and .agents/skills for PrepareKey/prepareKey/sameKey/staleParts, key.nvim, NVIM_VERSION/SHA256 and verification prepare. Migrate prepare.ts, droplet.ts status/options, config.ts, verify-prepare.ts; key assertions in prepare-key, executor-prepare (T3), verify-prepare, suite-task-selection; scripted fixtures may retain previous wire keys for compatibility. Other executor consumers (dependencies, recovery, run, admission, retry, prepared-project, droplet-fixture) pass keys opaquely; nvim pin readers and run platform receipts remain project-specific and unaffected. QA briefs do not construct the key; historical specs remain records. Update current running/tests guidance. No Host/frame/API method change.

### impl-1709 · 2026-11-06T10:56:12.339Z

Consumer sweep addendum: Machine.result gains an optional final user parameter (default runner); all production callers and fakes retain their old arguments. Scripted transport result fake signature updated only to observe C1 user ordering; scripted-machine key parameter accepts the previous Neovim wire shape for compatibility. Coordinator expanded scope to generic recipe SHA-256 plus recipe stale reason: target-project base cannot identify running-hub code for other projects. Old snapshot JSON remains readable, with missing recipe stale rather than invalid. Test edits so far: executor-prepare-component adds C1 and legacy persisted key cases; prepare-key moves recipe package assertions to project hook and adds digest/template cases; executor-prepare removes superseded Neovim-key assertions and adds committed hook-byte case; verify-prepare supplies a key without nvim. executor-droplet, executor-safety, executor-run and suite-selection assertions are unchanged.

### impl-1709 · 2026-11-06T10:58:24.863Z

Package move from starting HEAD provision.sh lines 11–13: libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 libcairo2 libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2. Neovim substitutions at lines 17–18 and installation at 25–31 move to hub/bin/verify-provision.sh lines 8–18, pins v0.12.5 / bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875. Hook lines 19–22 are new cache seeding: previously verify-prepare invoked nvim-path.ts on the cold builder and downloaded another copy into .cache/nvim/<tag>. The resolver ignores /usr/local/bin/nvim; the hook now links its verified /opt installation into that same ignored runner-owned cache. Without this, suites still use the correct pin but cold prepare redundantly downloads it and depends on a second network fetch. Seed call remains for cold/changed project pins; warm receipt behavior is unchanged.

### impl-1709 · 2026-11-06T11:06:43.320Z

Native executor-run red at 8d2f72f16: warm-delivery assertion expected dependencies match snapshot / Neovim pin matches snapshot, actual dependencies match snapshot / Neovim pin changed: seed. remote-fixture.ts line 94 copied the executor key into the project installation marker, so removing key.nvim dropped the installed pin. Consumer sweep missed this read-then-serialize alias; correcting the fixture receipt, preserving executor-run assertions. Coordinator additionally requires hook to persist installed tag+digest and differing-hook-pin delivery regression. Hook writes .cache/nvim/.cland-installed.json (outside npm ci deletion); verify-prepare reads it independently of key. Hook source test observed red then green. Native new hook receipt test is written and awaiting the next authorized preservation slot for its red run before implementation. Source reviewer has been told to hold final verdict pending new head.
