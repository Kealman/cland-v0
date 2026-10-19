---
id: T-648
kind: task
title: Without a Git identity, init's first commit is made as cland <cland@local>
state: open
status: ready
size: XS
criterion_seq: 4
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-646
topic: topic-542
branch: t/T-648-without-a-git-identity-init-s-first
created: 2026-10-16T16:23:59.985Z
updated: 2026-10-19T02:29:09.994Z
---

## Summary

A machine without `user.name` and `user.email` (a fresh droplet, a new laptop) no longer stops init at the first commit: init commits as `cland <cland@local>` and says so in its report (Q-599 resolution 1, question 8). The machine's Git configuration is not changed.

## What to build

- In `commitClandFiles` (`hub/src/init/repository.ts`): when no identity is set explicitly (no `user.name` or `user.email` in any Git configuration Git reads for the folder, and no `GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`/`GIT_COMMITTER_*` or `EMAIL` in the environment), the commit runs with `-c user.name=cland -c user.email=cland@local`. A name guessed by Git from the login and host name does not count as an identity, so the result is the same on every machine (an open question in the README).
- No `git config` write, local or global.
- The report line of the first commit ends with `as cland <cland@local>: no Git identity is set` when the fallback was used.
- The hub README names the fallback.

## Acceptance criteria

- [x] C1. On ticket T-639's machine made with `identity: false`, `cland init` in an empty folder succeeds, and `git log -1 --format='%an <%ae>|%cn <%ce>'` prints `cland <cland@local>|cland <cland@local>` (init-first-commit.test.ts).
  - done: impl-648 · 2026-10-19T01:58:59.587Z
  - verified: rev-30 [reviewer] · run rev-20261019-648-final · 2026-10-19T02:29:08.589Z · commit f24a6d800204ee6f24bbeba0114a251bf99d9f6a
- [x] C2. The repository's and the scratch machine's Git configuration files are unchanged: neither gains a `user` section.
  - done: impl-648 · 2026-10-19T01:59:00.029Z
  - verified: rev-30 [reviewer] · run rev-20261019-648-final · 2026-10-19T02:29:08.589Z · commit f24a6d800204ee6f24bbeba0114a251bf99d9f6a
- [x] C3. With `identity: true` the commit carries the configured name and email, and the report does not name the fallback.
  - done: impl-648 · 2026-10-19T02:02:04.484Z
  - verified: rev-30 [reviewer] · run rev-20261019-648-final · 2026-10-19T02:29:08.589Z · commit f24a6d800204ee6f24bbeba0114a251bf99d9f6a
- [x] C4. The fallback's report line says that no Git identity is set.
  - done: impl-648 · 2026-10-19T02:02:04.855Z
  - verified: rev-30 [reviewer] · run rev-20261019-648-final · 2026-10-19T02:29:08.589Z · commit f24a6d800204ee6f24bbeba0114a251bf99d9f6a

## Comments

### impl-648 · 2026-10-19T01:57:26.545Z

The new scratch-HOME repository-boundary test reproduced the failure with user.useConfigOnly=true (Git: no email given / auto-detection disabled). Command-local user.name/user.email fallback now makes it green and preserves both global and local config byte-for-byte; configured identity stays intact. Adding environment/partial identity coverage before the host gate.

### rev-30 · 2026-10-19T02:00:41.800Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-648-source
commit: ebc5e47391899dacb96e1ba03613c823fda95fda
scope: full
findings: [{"severity":"medium","text":"M1: explicit author.name/email and committer.name/email Git config is omitted from identity detection. These keys override injected user defaults, so a configured commit can be reported as cland/no identity; partial role-specific identity is silently supplemented. Recognize explicit identity keys/preserve validation and add native full/partial config controls with unchanged snapshots and truthful report.","file":"hub/src/init/repository.ts","line":59}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at ebc5e473. M1: identity detector ignores explicit author/committer config keys, whose documented precedence over user defaults makes fallback report incorrect and partial settings supplemented. A-5711 records installed Git manual evidence, static counterexample, both axes and positive user/environment/no-config paths. No criteria verified; fresh source review before verification. No other findings from this pass.

Criteria: C3 failed (Author/committer-specific configured identity is not recognized; report falsely names fallback despite configured commit fields.), C4 failed (Fallback suffix can falsely say no Git identity is set when explicit author/committer config exists.).

### rev-30 · 2026-10-19T02:02:33.520Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-648-corrected-source
commit: f24a6d800204ee6f24bbeba0114a251bf99d9f6a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear at f24a6d80. M1 resolved: user/author/committer identity keys suppress fallback and preserve Git validation; raw red→green proves distinct full identities/report accuracy and partial role-key errors with unchanged config snapshots. Command-local fallback, actual init smoke and other controls retained. A-5715 records both axes and raw10/10 native host checks. C1–C4 await accepted exact-head runtime; no findings or per-item QA.

### rev-30 · 2026-10-19T02:29:08.589Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-648-final
commit: f24a6d800204ee6f24bbeba0114a251bf99d9f6a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear from corrected source A-5715 plus accepted exact-head gate 7e1bc212/A-5724; audit A-5725. Hub-only plus Neovim smoke: 2376 passed, 5 prerequisite skips, zero failures/cancellations. Native fallback/configured/distinct-role/partial/environment controls and actual empty-folder init pass; 10/10 ordinary first-commit cases and all 50 corresponding repetition bodies pass. Three known T-803 report-only tier trips and other budget/lint diagnostics remain disclosed. No findings; C1–C4 verified; QA scope none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
