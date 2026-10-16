---
id: R-294
kind: release
version: 0.1.3
title: v0.1.3
state: open
labels: []
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-12T15:31:51.406Z
updated: 2026-10-16T11:36:14.746Z
---

## Goal

v0.1.3, "Rhythm and rules": the project's rules live with the project and reach every session, the Coordinator's heartbeat watches what is in flight, epics follow each other without the crew idling, the suite is structurally faster and sharded on droplets, the hub keeps itself clean, and the run is recorded as data.

## Notes

Scope by the grilling round of 2026-10-14 (`docs/spec/v0.1.3.md` §3 and §4), plus "Run records" (E-468), filed on 2026-10-15 from the v0.1.2 retrospective A-2783. Version 0.1.3 is the human's recorded version (D30, D40; R-294's comment of 2026-10-15 20:49Z). The build started on 2026-10-15 at about 07:20Z under lane flow, before v0.1.2's own release at 08:18Z. coord led it, and the stand-in cland-impl answered for the human under D24. Implementers and the Reviewer pool ran on Codex gpt-6.1-sol, QA on gpt-6-astra, the Coordinator on claude-opus-5-5 and the other Claude Code roles on claude-sonnet-5-5. The Reviewer pool grew from 2 to 4. On 2026-10-16 the human trimmed the scope (D47, ask 396ec11a). "OpenCode v2 hygiene" (E-424) and the flake sweep (E-482) moved whole to v0.1.4 (R-577). T-575 and T-520 moved into E-578, "Test speed: structural, part 2", and T-379 and T-475 into E-579, "Hub hygiene, part 2". T-248 stays in Tech debt.

The goal: the project's rules live with the project and reach every session, the Coordinator wakes on its own when a chain of events breaks, the crew no longer idles between epics, the suite is structurally faster, and the run is recorded as data rather than prose.

What the human can now do, by epic:

- **E-387 Test speed: structural.** Tests run against a hub served inside the test process, over its real socket and WebSocket. A spawned hub is kept only for lifecycle tests. The top 20 files and 28 more moved, and daemon starts per full run fell from about 944 to 743 (census A-3775). Each integrated `dev` run publishes a function-level coverage map. A task run then selects its changed tests, the tests covering the changed functions and the smoke baselines (`hub-selected`, naming the deciding functions). It falls back to full, with the reason, on shared or unknown paths and on a map older than two days. `cland verify all --occasion stage|epic|release` shards a close run across droplets. It posts one merged report with each shard's machine, time and cost, and a short cap gives one slot with a warning. A two-shard c-8 close run costs about $0.11 and takes 786–908 s of wall time. A stage closes only on a Linux and a Mac cover. A test new to `hub/test/durations.json` must pass 5 of 5 under load before it merges, at under 5 minutes of extra wall for 8 new 20 s tests (T-557). `cland verify queue` and `hub status` show the queue wait's p50 and p90 against a target of p90 under 20 minutes. A test red on two branches raises one shared-defect notice to the Coordinator. Worker counts are config (`[verification] workers`, `[verification.droplet] workers`, default 4), and `--workers` and `--size` override them per run. QA clear: qa-2026-10-16-27-23 (A-3892). It was a partial rerun after run 21, which had found the Implementer clause gap (fixed by T-588) and a live hub that predated T-470.
- **E-423 Rules and rhythm.** `.cland/RULES.md` is the project's rulebook. It holds numbered rules ("rule 12"), each with a scope, a date, a reason, a status and an origin. `cland rule add|edit|retire|list|show` read and write it, and so do the `rule.*` tools for the Coordinator (from a human message only) and the Aide. Every clause and launch brief carries the active rules in its scope. A change reaches running sessions at their next turn as a `rule` event, never a needs-you. `␣R` opens the rulebook view, which unfolds a rule's reason and origin, follows a thread origin with `gt`, and adds, edits and retires rules. The rulebook was seeded with the eight rules from the planning and stand-in memories (T-457). `heartbeat` per role in `crew.toml` (the Coordinator's is `1h`; `cland crew set coordinator.heartbeat 1m`) wakes an idle session with a digest the hub computes of what is in flight and what looks stale. On a busy session it folds into the next turn, and it is never a needs-you. `cland task link E-2 --follows E-1` lets an epic start on its predecessor's last merge, and the merge gate holds tickets on the predecessor's files until its QA verdict. `cland demo start|exec|stop` leases a droplet for an epic's demo at a named `dev` commit, and the verdict stands while `dev` moves on other files. XL tasks are refused at filing, and plan-epic splits L tasks unless the Coordinator records a reason. The merge override covers only tracker and docs changes. QA clear: qa-2026-10-16-27-20 (A-3876, 65 checks). Three earlier runs (27-15, 27-17, 27-18) were not clear, on the demo lease's release and on rule origins (T-550, T-551, T-553, T-572, T-583, all fixed).
- **E-425 Hub hygiene.** A `cland hook bridge` whose hub is gone exits within 60 seconds. The cause was an unbounded 500 ms retry in `hub/src/cli/hook.ts` (T-311). The runner's leftovers check fails a phase that leaves a bridge behind. `cland doctor` lists orphan bridges, and `cland doctor --fix` ends only those whose hub file is gone. `npm run typecheck` runs on TypeScript 7.0.2, with a median of 0.90 s against 5.83 s on 5.9 (T-427). `cland hub reload` and SIGHUP re-read `config.toml` and `roles.toml` without a restart, and a bad file keeps the old config (T-488). `hub-started` records who started the hub, and a deliberate stop holds off the workbench's autostart (T-513). A smoke test proves a built tree starts, serves a request and stops within a bound (T-476). Under a full crew, tracker calls stay inside their budgets: `task.view` uses an index instead of scanning the journal (T-548), and inbox rebuilds are coalesced (T-559). The verify queue works under load:
  - finished remote runs free their slots, including at start-up (T-562, T-567);
  - an explicit `--executor droplet` waits for a droplet and never takes a Mac result from the cache (T-512, T-518);
  - a lock deadline retries before falling back to local (T-491);
  - a droplet bundle ignores the hub's own uncommitted tracker writes (T-496).

  QA clear: qa-2026-10-16-27-22 (A-3887, 28 checks), with its droplet start retried once after T-589.
- **E-468 Run records.** Verdicts carry findings with their severity, lows included, and `task view` shows their counts. A regression records `--found-by review|cover|droplet|qa|human`. An ask answer records `answered_as` (human or stand-in) and `answered_by`. An integrated cover records its status and cause, shown in `hub status`, and `cland verify classify <run> load-flake` lets the Coordinator reclassify one. A sub-agent start records its model, or `unreported`. QA clear: qa-2026-10-16-27-19 (A-3855, 32 checks).
- **E-426 Release v0.1.3 from the item.** The docs (`hub/README.md`, `nvim/README.md`, `docs/agents/tests.md` and the `cland init` templates) describe the rulebook, the heartbeat, `follows`, demos on a droplet and the typecheck as built. A slow tracker operation under load no longer kills the hub: the fail-fast exit has its own deadline beyond the 5 s stall warning (T-483, hotfix). Two shared test fixes carried from v0.1.2 merged (T-447, T-461). OpenCode check, 2026-10-16 at 9f00cd0c (T-590, A-3883): PASS. The newest stable 2.x is 2.0.30, inside the tested range `>=2.0.24 <2.0.31`, so the range is unchanged. C2's rulebook-commit leg moved to v0.1.4 with T-379 (ask 6085e249).
- **Also on `dev`, from items now under v0.1.4.** OpenCode servers get their own database (T-296), and OpenCode follows 2.x with doctor messages per version and a release-time range check (T-533). 42 of E-482's load flakes are fixed.

Decisions of the run (`docs/spec/v0.1.3.md`, Decisions of the build; D24, D25, D27, D28 and D29 of v0.1 carry over):

- **D30 (human, 2026-10-15 ~05:25Z).** v0.1.3 starts right after v0.1.2, with no separate go-ahead. Its first epic may start on v0.1.2's last merge, and the retrospective does not block the kickoff. With D40, it records 0.1.3 as the human's version.
- **D31 (human, ask 35ca68c2).** `remote_budget` rises from 2 to 4, and the cap stays at $3 (d1be03a9).
- **D32 (human).** No model rotation yet: one model per role builds the baseline. The retrospective's conclusions became E-468 and T-469 to T-476.
- **D33, D37 and D41: the droplet daily cap.** It rose to $6 (human, ask 88782a0f, c693ac21), then $10 (human, ask 35663eef, 2d627243), then $14 (stand-in under D39, ask 4896a52a, 968b7eb8).
- **D34 (human).** Routine config changes are hot-reloaded instead of restarting the hub. The task is T-488, `cland hub reload`.
- **D35 (human, ask aa197b46).** The DigitalOcean token is not rotated after a session's process listing exposed it. T-492 goes through the normal queue, and process checks are by PID only until it lands.
- **D36 (human, ask 45c1eb99).** The rulebook-seed Aide runs on Codex, because a Claude Code Aide launch stops on the workspace-trust prompt.
- **D38 (human, ask 394f2f13).** The Coordinator may quarantine a verify lock held by a dead pid when the hub refuses recovery, journaled on T-204 (bug T-511).
- **D39 (human).** While the human sleeps, the stand-in may raise the droplet cap, each raise through an ask.
- **D40 (human).** Go straight on to v0.2 if v0.1.3 finishes overnight. Superseded by D48.
- **D42 (stand-in under D24, ask e3530558).** No session runs the `opencode` CLI until T-296 merges. It became rule 13 and was retired on 2026-10-16, once T-296 merged.
- **D43 (stand-in under D24 and D39, ask dce6f33b).** `remote_budget` rises from 4 to 6 (1b9687a7). The project now runs on `remote_budget = 6` and `daily_spend_usd = 14`.
- **D44, D45 and D46 (stand-in, 2026-10-16).**
  - D44 (on the Coordinator's recommendation) and D46 (ask a527f3db): two hub restarts without a cover, to clear a saturated hub and the T-562 slot deadlock.
  - D45 (ask e2bd8307): one Neovim phase run outside the queue, as a one-time exception to rule 3.
- **D47 (human, ask 396ec11a).** The scope trim above.
- **D48 (human).** The releases go v0.1.3, then v0.1.4 (R-577), then v0.2 (R-377).
- **Recorded without a number:**
  - the reviewer pool rises from 2 to 4 (human, ask 0727b3c8);
  - E-387's (a) in-process hub by default and (b) sharding only close runs (human, 2026-10-14 12:20Z);
  - coverage selection's bar of zero misses on the last 40 merges' own tests, with the batch run as backstop (human, ask 82732199);
  - the flaky gate of two Linux receipts on different known flakes while E-482 is open (human, ask 9183a54c);
  - E-387 closes on its delivered infrastructure, with its targets moved to E-578 (human, ask 6a7185b6, answer 3ab87e56);
  - E-426's C2 loses its rulebook-commit leg to E-579, and a failed OpenCode check does not block v0.1.3 (human, ask 6085e249).

Rules recorded during the build (`.cland/RULES.md`):

- **Seeded from the memories (T-457), 2026-10-15.**
  - Rule 1: briefs address the role.
  - Rule 2: no long foreground commands as Coordinator.
  - Rule 3: one full suite at a time.
  - Rule 4: verdicts go to the lead.
  - Rule 5: no routing around refusals.
  - Rule 6: the batch-merge rule.
  - Rule 7: verify the head before merging.
  - Rule 8: check the verify queue before committing on `dev`.
- **The test-writing rules, recorded by the aide-rules session on 2026-10-15.**
  - Rule 9: wait for the exact thing the test asserts.
  - Rule 10: observe completion before timing the report.
  - Rule 11: keep a reviewed head stable.
  - Rule 12: stop fixture writers before deleting their directories.
- **Rule 13, retired.** Rule 13 (no `opencode` CLI inside a session until T-296) was recorded under D42 and retired on 2026-10-16.

Deferred checks, in v0.1.4 (R-577):

- **E-578 (Test speed: structural, part 2), carried from E-387.**
  - D1 and T-575: daemon starts per full run under 600.
  - D2 and T-520: the two-shard close run's wall against T-395's 600 s target.
  - D3: hub test-time down at least 15% against A-2714.
  - D4: a coverage-selected task verify under 5 minutes, with the 40-merge replay (T-394 C5–C7).
  - D5: worker defaults set from the measurement (T-396).
  - D6: T-393's 20 migrated files at least 20% faster (T-393 C5).
- **E-579 (Hub hygiene, part 2), carried from E-425.** E-425's C1 and C2: a run's identity follows its tree, so tracker and docs commits never cancel an integrated run (T-379). Cover-quiet is enforced by the harness (T-475). E-426 C2's first leg joins them as E-579 D3: a rulebook commit during an integrated run keeps the run. All three were mitigated in this build by covers from detached worktrees and the posted cover-quiet rule.
- **E-424 (OpenCode v2 hygiene).**
  - T-532: launch on a port cland chose, and a rejected approval reported as a rejection.
  - T-534: the launch-policy mapping.
  - T-535: idempotent inject ids and child sessions.
  - T-536: the warnings and the codemode experiment.
- **E-482 (the flake sweep).** The nine backlog flakes: T-494, T-501, T-509, T-524, T-526, T-528, T-555, T-558 and T-560.

Known issues filed during the build:

- Bugs (C-325):
  - T-589 A failed `demo start` leaves its lease releasing for minutes after the droplet is gone; a demo stop's release is confirmed only by the 10-minute sweep (no droplet leaks)
  - T-587 A queued role-addressed QA request isn't delivered when the verifier goes idle
  - T-504 Session MCP verify fails with 'unknown request type suite.start' while CLI verify works
  - T-537 `cland verify` can time out at the CLI's 15 s reply limit while the hub admits the run
  - T-576 `artifact.create` on a large folder times out at 10 s while the hub completes it
  - T-521 Concurrent `artifact.create` can fail with 'artifact reservation moved'
  - T-541 An item turns ready on a clear source verdict with no verify at all on record
  - T-542 A merge that adds a package leaves the root checkout without it, and the next root typecheck fails
  - T-561 A verify that fell back to local keeps waiting for the local slot after remote slots free up
  - T-492 The executor credential is inherited by launched sessions and test processes (D35)
  - T-554 The project socket fallback under tmpdir isn't length-checked, so a deep TMPDIR makes `hub start` time out
  - Also filed: T-464, T-511 and T-543.
  - Load flakes on droplets: T-565, T-569, T-573, T-580, T-581, T-585 and T-586.
- Tech debt (C-216):
  - T-462 A droplet release logs 'droplet identity differs from its lease' and recovers a minute later
  - T-563 A broken spend ledger can suppress a sharded close run's parent receipt
  - T-564 Restored finished runs inflate `runMs` and queue ETAs
  - Also filed: T-538, T-539, T-552 and T-571.
- Follow-ups (C-326):
  - T-582 Five pre-T-562 finished runs stay "ended without a posted result" in the heartbeat
  - T-516 The Neovim smoke set omits explorer-card, so hub-only selections miss its regressions
  - T-522 Remote ETA ignores durable-only leases
  - Also filed: T-515 and T-570.
- Wording: E-387's DoD C2 and the docs still say "$3/day cap", while the live cap is $14 (D41). This was a low finding in QA run qa-2026-10-16-27-21.
- Still open from v0.1.2's list: T-443, T-444, T-448, T-450 and T-460.

The retrospective artifact of the run follows the release and will be linked from R-294.

## Epics

| Key | Id | Title | State |
|---|---|---|---|
| E01 | E-387 | Test speed: structural | closed on QA run qa-2026-10-16-27-23 |
| E02 | E-423 | Rules and rhythm | closed on QA run qa-2026-10-16-27-20 |
| E04 | E-425 | Hub hygiene | closed on QA run qa-2026-10-16-27-22 |
| E06 | E-468 | Run records: findings, escapes, answers, covers and sub-agent models as data | closed on QA run qa-2026-10-16-27-19 |
| E05 | E-426 | Release v0.1.3 from the item | the release epic |

E03 E-424 "OpenCode v2 hygiene" moved to v0.1.4 (R-577) by the human on 2026-10-16 (D47), together with E-482 "Flake sweep".

## Comments

### human · 2026-10-14T16:52:46.282Z

Handover to the implementation session (cland-impl), 2026-10-14: v0.1.3 "Rhythm and rules" is planned; you lead the build as for v0.1.2, starting right after v0.1.2 ships; questions only the human can answer go to the inbox as asks and wait. Nobody has run cland push since v0.1.1: push first.

Spec: docs/spec/v0.1.3.md (complete: §3.1 OpenCode v2 hygiene, §3.2 the rulebook, §3.3 the heartbeat, §3.4 lane flow, §3.5 hub hygiene, §4 the release); GLOSSARY: Rulebook, Rule, Heartbeat, Follows. Epics under this item, labelled epic, v0.1.3, ready-for-agent: E-387 Test speed: structural (yours; T-393 to T-396; no blockers) → E-425 Hub hygiene (T-379 a run's identity follows the tree, T-311 orphan hook bridges, T-427 TypeScript 7); E-423 Rules and rhythm (the rulebook .cland/RULES.md with cland rule add and the rule.add tool, rules in clauses and briefs, changes delivered to running sessions, the seed from the planning memories by one Aide task; the heartbeat per role in crew.toml with a hub digest, a turn only when idle, never a needs-you; lane flow: the next epic starts on the previous one's last merge, the follows relation beside blocked_by, demos on a droplet; T-335 under it) → E-424 OpenCode v2 hygiene (T-296 own database per user and per account; follow with a check and the two fragile points; the launch policy mapping and the codemode experiment; idempotent prompt ids and child sessions; doctor warnings); E-426 Release v0.1.3 from the item (after E-424 and E-425; the release refuses while a child is open, so the release, the post-release check and the retrospective follow its close; Q-384 must be closed by then). The lane edges E-387 → E-425 and E-423 → E-424 are blocked_by until follows exists; unlink them as lane order when §3.4 says the next epic may start. Rules carry a plain number ("rule 12"), never the R- prefix. Crew as v0.1.2 (Implementers on Codex gpt-6.1-sol, Claude Code roles on claude-sonnet-5-5, Reviewer pool 2), [plan] approval = "none". Research: docs/research/opencode-v2.md (research/opencode-v2), docs/research/test-speed.md (research/test-speed).

Rules that stay: every artifact in English; sub-agents never use the hub; commits end with "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"; only cland release pushes to GitHub; the hub frame protocol is the first test seam, fake harnesses the second; no routing around refusals; cland verify for suites; dogfood each epic as it lands (the heartbeat and the lane flow by the build that makes them; the rulebook read by every clause from then on). Definition of done: every epic's demo run by QA on dev with a clear verdict, the release from this item, a retrospective artifact, no human acceptance pass. After v0.1.3 ships, v0.2 follows: see the handover on R-377. The planning session (cland-design) stays available for design questions.

### coord · 2026-10-15T05:26:23.426Z

Decision (human, relayed verbatim by the stand-in on 2026-10-15 about 05:2xZ: «как закончите с 0.1.2, берите 0.1.3»): once v0.1.2 is released, the Coordinator goes straight into v0.1.3 'Rhythm and rules' (E-387 and E-423 to E-426) without a separate go-ahead.
- **Lane flow.** The first v0.1.3 epic may start on the last v0.1.2 merge rather than on the release demo.
- **Retrospective.** The v0.1.2 retrospective still happens, but does not block the kickoff.
- **Carried over.** The stand-in answers asks and plan approvals under D24. The restart protocol and D25, D27, D28 and D29 carry over.

### coord · 2026-10-15T08:35:07.889Z

Decision (human, ask 35ca68c2, 2026-10-15 08:34Z): remote_budget rises from 2 (D27) to 4; the daily spend cap stays at $3. Committed in .cland/config.toml; it applies at the next hub restart.

### coord · 2026-10-15T09:12:01.758Z

Decision (human, relayed by the stand-in on 2026-10-15 after reading the v0.1.2 retrospective A-2783): no model rotation yet. «мы пока набираем baseline на тех моделях в которых я уверен, сравнивать уже потом отдельно будем». The crew keeps one model per role (Implementer and Reviewer on Codex gpt-6.1-sol, QA on gpt-6-astra, Coordinator on claude-opus-5-5). Model comparison is a separate later exercise. The retrospective's Start/Stop/Continue conclusions are filed as v0.1.3 tickets (see the Coordinator's follow-up comment).

### coord · 2026-10-15T09:13:39.195Z

The v0.1.2 retrospective's conclusions are filed for v0.1.3 (Coordinator, 2026-10-15 09:12Z).
- **START:**
  - 1 is T-473: XL refused, L split at plan time.
  - 2 is the new epic E-468 'Run records': T-477 severity with lows, T-478 found_by and answered_as, T-479 cover status and cause, T-480 sub-agent model.
  - 3 is T-469: a Linux proof on every stage-close cover.
  - 4 is T-470: queue-wait p50/p90 against a 20-minute target.
  - 5 is T-471: a load gate for new tests.
- **STOP:**
  - 1 is T-475: cover-quiet enforced by the harness.
  - 2 is T-379, which already exists; the retrospective's case is added as a comment.
  - 3 is T-474: override for tracker and docs only.
  - 4 is T-472: shared-defect detection.
  - 5 is T-477: lows recorded.
  - 6 is T-476: a hub start-up smoke test.
- **CONTINUE:** D24, D25, D27, D29, lane flow, droplets under the budget and cap, restarts only on a green cover with an empty queue, T-204, and retro.py. These are standing practice and enter the rulebook through E-423's seed (T-457).
- **Plans:** T-469..T-472 and T-466 are E-387's stage 3. T-473 and T-474 are E-423's stage 3. T-475 and T-476 join E-425 (Hub hygiene). E-468 gets its plan when E-423's first stage closes.
- **Model rotation:** deferred by the human's decision above.

### coord · 2026-10-15T09:31:01.294Z

Decision (human, ask 0727b3c8, 2026-10-15 09:30Z): the reviewer pool goes from 2 to 4, with the same model (Codex gpt-6.1-sol, no rotation). It is in crew.toml (443bd0aa), read live; rev-30 and rev-31 were launched at once.

### human · 2026-10-15T20:49:34.737Z

Decision record (recorded by the stand-in cland-impl from the human's own words): the release that follows v0.1.2 is v0.1.3 and the one after it is v0.2. Sources: 2026-10-15 ~08:20Z, human: «как закончите с 0.1.2, берите 0.1.3» (D30); 2026-10-15 ~20:35Z, human, before sleep: «если вдруг за ночь закончите 0.1.3 то переходите к 0.2» (D40). The version number 0.1.3 is therefore the human's explicit choice for this release; the release ask may be answered by the stand-in per D24 once the DoD is met. Scope stays as in docs/spec/v0.1.3.md.

### human · 2026-10-16T06:36:23.677Z

Decision record (human, 2026-10-16 ~06:40Z, recorded verbatim by the stand-in cland-impl): «Ок, тогда дальше 0.1.4 и потом уже 0.2». The release sequence is therefore v0.1.3 → v0.1.4 → v0.2; this supersedes the 2026-10-15 20:35Z instruction to go straight to v0.2 after v0.1.3. v0.1.4 holds the items carried over by the human's answer to ask 396ec11a (option 1): E-482's nine backlog flakes, E-387's T-575 and T-520, E-425's T-475 and T-379, E-424's T-532, T-534, T-535, T-536. v0.2 (R-377) follows v0.1.4.
