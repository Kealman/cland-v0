---
id: E-424
kind: epic
title: OpenCode v2 hygiene
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.1.3
  - ready-for-agent
assignee: null
parent: R-577
blocked_by: []
follows:
  - E-423
topic: topic-404
branch: null
created: 2026-10-14T16:43:08.893Z
updated: 2026-10-20T03:51:10.129Z
closed: 2026-10-20T03:51:10.129Z
---

## Summary

cland's OpenCode sessions move onto a database of their own, so that OpenCode's background service can never resume one behind cland's back, and the adapter follows OpenCode 2.x with a check at every cland release instead of trusting a range nobody ran. The roles.toml launch policy reaches OpenCode sessions, injects become idempotent, child sessions feed the instrumentation, and two measured experiments decide what else changes.

## Goal

OpenCode v2 is driven without its hazards. Today cland's per-session servers share the user's default OpenCode database with OpenCode's background service, which resumes any session it finds mid-turn: two processes then drive one cland session, the second with the user's global config and no cland spoke (upstream #51213, reproduced twice by the research). The doctor's tested range admits three releases nobody ran, its install hint leads to v1, which cland cannot drive, launch hangs on a log line, and a rejected approval looks like a server shutdown. The adapter drops roles.toml's launch policy and effort for OpenCode and mangles `provider/model#variant`, although OpenCode is the Implementer's harness in cland's shipped defaults.

## Contents

- **§3.1 Own database (T-296).** cland's per-session OpenCode servers use a database of their own, per user at once and per account where the accounts registry (v0.1.2 §3.13, T-361) names one, so that OpenCode's background service can never resume a cland session (upstream #51213). The doctor names the database and the login it needs. Until the fix lands, the clauses forbid running the `opencode` CLI inside a session.
- **§3.1 Versions: follow with a check.** The adapter follows OpenCode 2.x. The doctor's tested range is re-verified at each cland release with the research's API diff tool; the doctor points 1.x users to `opencode upgrade --major`, and its install hint leads to the v2 installer. The two fragile points are fixed: launch waits for the server's own readiness, not for a log line, and a rejected approval is reported as a rejection, never as a server shutdown.
- **§3.1 Launch policy.** The roles.toml policy (approval, sandbox, permissions, the item rule, effort) maps onto OpenCode's per-session rules at session creation; the `provider/model#variant` syntax is handled; the `codemode: false` experiment for cland's MCP server is measured before the default changes.
- **§3.1 Capabilities.** Taken: caller-chosen idempotent prompt ids (OpenCode-only behind the shared contract) and child-session tracking into the instrumentation of v0.1.2 §3.12. The role clause as durable session instructions only as a measured experiment. The approval reply and the mid-session model switch wait for the v0.2 approvals relay (spec v0.2 §3.8, E-414).
- **§3.1 Risks.** The doctor warns that the free default model may train on the code it sees and that OpenCode has no OS sandbox; the clause forbids moving a session out of its item's worktree.

Not in this epic: the approval relay and a model switch from outside (E-414 in v0.2); the research's other deferrals (artifacts as attachments, `resume: false` and synthetic input for hub events, a cland plugin inside OpenCode, one server per project routed by `_meta`, the durable session log); this project's own Implementer harness, which stays Codex (§4).

Choices where the spec is silent:

- **Where the database lives.** With no account, every cland OpenCode server runs with `OPENCODE_DB` at `cland/opencode/opencode.db` under the user's data directory (`$XDG_DATA_HOME`, else `~/.local/share`): one database per user, shared by the user's cland projects. An account from `~/.config/cland/accounts.toml` keeps the data home or the database T-361 gives it. The adapter drops any inherited `OPENCODE_DB` and `XDG_DATA_HOME` before it sets its own, so a server never falls back to the user's default database, and the doctor warns when an account points at that default database. The session's launch record names its database, and resume and relaunch reuse it.
- **The login.** The doctor names the database and prints the login line for it, which sets the database and runs standalone, so the login itself never starts the background service. The first slice tests whether the free default model answers from a fresh database with no login (the research's open question), and the doctor says whether a login is needed for it.
- **The proof.** The research's P3 reproduction (`probe-restart-sweep.mjs`) becomes a hub test with a fake OpenAI-compatible provider: a cland server mid-turn, then OpenCode's service started on the user's default data directory, and no request from the service for the cland session. It needs the real `opencode` binary, so it is a platform skip where the binary is absent, as the other real-binary cases are.
- **The interim rule.** Until the database slice merges, the prohibition stands as a rule in the rulebook for all roles, recorded by the Coordinator when this epic starts if the seed did not record it, and that slice's merge retires it; no clause text is edited by hand for it.
- **The check at each release.** The check is a script kept in the repository, built from the research's `openapi-digest.mjs`, its event-name grep and its P1 probe. It fetches the newest 2.x OpenAPI document, compares the adapter's ten operations on the wire and its event names with the tested document, and runs a smoke against the fake provider. The `release` skill runs it before the dry run. A pass moves the range's upper bound in `hub/src/doctor/ranges.ts` just above the newest version that passed; a failure keeps the range and files a Bug. It reaches the network, so it is never part of `npm test`.
- **What the doctor says per version.** A 2.x inside the range passes. A 2.x newer than the range is reported as newer than tested, not as a failure, since the adapter follows 2.x. A 1.x gets `opencode upgrade --major`, a missing binary the v2 installer (`https://opencode.ai/v2/install`), and a 3.x a refusal naming the tested range.
- **Readiness.** The adapter picks a free loopback port itself, passes it with `--port`, and polls an authenticated `GET /api/session/active`, a route it already uses, until it answers within the launch deadline. A port taken in between restarts the attempt on a new port, and the log is read only to explain a failure.
- **Rejections.** The adapter keeps each session's last `permission.replied` with `reject`. An `interrupted` with the reason `shutdown` that follows it in the same execution (upstream #54180) is reported as the rejection, with its command, and the session stays alive; a shutdown with no rejection before it is still the server's death.
- **The policy table.** It lives in the adapter and in `hub/README.md`'s OpenCode section:
  - `approval`: `never` allows what the sandbox permits and denies the rest, so nothing waits; `on-request` asks for the rest; `untrusted` asks for every shell command.
  - `sandbox`: `read-only` denies every edit and write tool; `workspace-write` allows edits inside the cwd and `writable_roots` and denies them elsewhere through `external_directory` rules; `danger-full-access` allows everything; `""` leaves OpenCode's own rules.
  - `network` has no counterpart, and the launch record says so. `permissions = "skip"` allows everything.
  - `item` (D8) denies edits outside the item's worktree.
  - `effort` selects the model's variant of that name from `GET /api/model`, or none with a warning in the launch record; an explicit `#variant` wins over `effort`.
  - The launch record lists the rules applied and each field without a counterpart, and the adapter's capability declaration says "rules, not a sandbox".
- **D8 and Code Mode.** Code Mode's `worktree_create` and `session_move` request no permission (the research's R6), so rules cannot stop them. The adapter watches `session.moved`: a move out of the item's worktree is a warn-level event to the session's lead, and the clause forbids the move.
- **The codemode experiment.** It runs in a scratch project that holds none of this repository's code, since the free model may train on what it sees. Ten scripted turns per setting, on the default free model, each ask for one `send`; the measure is the share of turns that deliver the `send` with the right fields, and the turn time. The result is an artifact on this epic. The default changes to `codemode: false` only if it is at least as reliable; otherwise it stays, with the measurement recorded.
- **Idempotent ids.** Each inject carries `msg_` plus a hash of the cland message id and the session, so a retried inject returns the first admission and a broadcast gets one id per recipient. This stays inside the adapter, with no contract change.
- **Child sessions.** `session.created` with a `parentID` becomes the existing sub-agent signal (`SubagentLaunch`) with the child's model; a child's steps add to the parent's usage, and a child waiting for approval shows its parent as waiting.
- **The instructions experiment.** An adapter option, off by default, carries the role clause as an instruction entry instead of a message. It is measured once on a real model across a forced compaction, against the message path, with the result as an artifact on this epic; adopting it is the human's later decision, filed in Follow-ups.
- **The warnings.** The doctor warns when a role launches OpenCode on a free model, which may use the code it sees for training, and that OpenCode has no OS sandbox. Both are warnings, never launch refusals.
- **The clauses.** The role clauses that `cland init` writes for roles that may run on OpenCode forbid moving the session out of its item's worktree, so every project gets the rule, not only this one.

## Tracer-bullet order

1. **The database of cland's own (T-296).** The per-user database, the per-account one through the registry, the environment the adapter passes, the launch record, the doctor's database and login line, and the P3 test; the interim rule retired on merge. Demo: the P3 test passes with the real binary, `cland doctor` names the database and its login line, and the interim rule shows as retired in `cland rule list --all`.
2. **Readiness and rejections.** Launch on a port cland chose, polling the server, and a rejected approval reported as a rejection. Demo: a fake server that never prints the listening line launches, and a rejected approval appears in the events view as a rejection while the session stays alive.
3. **Following 2.x with a check.** The doctor's messages per version, the v2 installer, the release-time check script, its step in the `release` skill, and the range re-verified. Demo: with fake binaries reporting 1.19.0, a 2.x newer than the range and 3.0.0, and with none, `cland doctor` prints the four messages, and the check against the newest 2.x document passes and moves the range.
4. **The launch policy.** The policy table, `#variant`, `effort`, and the `session.moved` watch. Demo: a launch for each row of the table creates a session whose rules, read back from the fake server, match the table; `openai/gpt-5.2#high` reaches the server as the model `gpt-5.2` with the variant `high`; a planted `session.moved` out of the worktree raises a warn-level event to the lead.
5. **Idempotent injects and child sessions.** The `msg_` ids and the children in the instrumentation. Demo: a timed-out inject retried at the next idle reaches the fake server once, and a child session's model and usage appear in the parent's launch and usage records.
6. **The experiments and the warnings.** The codemode measurement, the instructions measurement, the doctor's two warnings and the clause line. Demo: two artifacts on this epic with the measurements and the decision each supports, and `cland doctor` shows both warnings for a role on a free OpenCode model.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The cases that need the real `opencode` binary run locally where it is installed, and the rest on a droplet through the demo lease (spec §3.4). The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with the fake OpenCode binary, QA launches an Implementer on OpenCode with no account and reads its database in the launch record; `cland doctor` names that database and its login line, and warns about the free model's training and the missing sandbox. With the real binary and a fake provider, QA starts a cland session mid-turn and then OpenCode's service on the user's default data directory, and the provider sees no second request for the session. With fake binaries reporting 1.19.0, a 2.x newer than the range and 3.0.0, and with none, the doctor prints the upgrade with `--major`, the newer-than-tested note, the refusal and the v2 installer. A fake server that prints no listening line still launches. A rejected approval shows in the headless workbench's events view as a rejection, and the session stays alive. QA launches with each row of the policy table and reads the rules the fake server received and the fields without a counterpart in the launch record; `provider/model#high` arrives as the model and the variant `high`. A retried inject is admitted once, and a child session's model and usage show in the parent's records. A session moved out of its worktree raises a warn-level event to its lead, which the headless workbench's events view shows. QA reads the two experiment artifacts on this epic and runs the `release` skill's check against the newest 2.x.

- [ ] C1. cland's OpenCode servers use a database of their own, per account where the registry names one and per user otherwise, and the launch record names it; OpenCode's service started on the user's default database never resumes a cland session (the P3 test); the doctor names the database and its login.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C2. Launch waits for the server's readiness on a port cland chose and does not depend on the log line; a rejected approval is reported as a rejection, never as a shutdown.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C3. The doctor points 1.x to `opencode upgrade --major` and a missing binary to the v2 installer, reports a newer 2.x as newer than tested, and refuses 3.x; the check re-verifies the range at each cland release through the `release` skill.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C4. roles.toml's approval, sandbox, permissions, item rule and effort map onto OpenCode's session rules at creation as the table in `hub/README.md` says, `provider/model#variant` is parsed, and the launch record lists the rules applied and the fields without a counterpart.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C5. Injects carry caller-chosen idempotent ids, so a retried inject is admitted once; child sessions report their model, usage and pending approvals into the instrumentation of v0.1.2 §3.12.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C6. The `codemode: false` and the clause-as-instructions experiments are measured, with their results as artifacts on this epic, and a default changes only where its measurement supports it.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C7. The doctor warns about the free default model's training and OpenCode's missing sandbox; the clauses forbid moving a session out of its item's worktree, and a move raises a warn-level event to its lead.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c
- [ ] C8. `hub/README.md` (OpenCode), the role clauses `cland init` writes and the `release` skill describe the database, the login, the version check, the policy table and the warnings; T-296 is closed.
  - verified: qa-3 [qa] · run qa-20261020-3c · 2026-10-20T03:50:58.951Z · commit 824105c5a2a56b3495e9215cc88d60c4c129df6c

## Dogfooding

This project's crew stays on Codex and Claude Code (§4), so the epic is used through its demo and the release: "Release v0.1.3 from the item" runs the check for v0.1.3 itself through the `release` skill. The interim rule in the rulebook guards the build until the database slice retires it. The experiments run on a free model in a scratch project.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). The hub's frame protocol is the first test seam (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`), the fake harnesses in `hub/test/fakes/` the second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. Items are written through `cland task` and the task tools, never as hand-written item files. The `opencode` CLI never runs inside a session until T-296 lands. The DigitalOcean token is never stored.
- **Tests.** The adapter is tested against the fake OpenCode binary in `hub/test/fakes/opencode/` and a fake OpenAI-compatible provider like the research's. Cases that need the real binary are platform skips where it is absent, and `npm test` makes no model call.
- **Data.** The experiments run in a scratch project with none of this repository's code. Server passwords stay in their mode-600 files, and no provider key is written anywhere.
- **Precedence.** The spec's words; then the research `docs/research/opencode-v2.md` and its probes; then T-296's body and the questions Q-297, Q-298 and Q-299.
- **Risks.** The whole API is labeled experimental, and the early 2.x releases renamed 129 operations (the research's R2). OpenCode ships about one release a day (R3). Free models in a fresh database are untested, and the login in cland's database is one more step for the user. The background service stays a process cland does not own.
- **Size.** About six sessions on the v0 scale.
- **Order.** Second in the rules lane. Its `blocked_by` edge on "Rules and rhythm" stands for lane order, not a code dependency, until the `follows` relation exists (spec §4); that epic then turns it into a follow. "Release v0.1.3 from the item" waits for this epic.

## Links

- Spec: `docs/spec/v0.1.3.md` on `dev`, §3.1 and §4; `docs/spec/v0.1.2.md` §3.12 (instrumentation) and §3.13 (accounts); `docs/spec/v0.2.md` §3.8 (the approvals relay, E-414).
- Tickets: T-296, a child of this epic; Q-297, Q-298 and Q-299, decided and closed into this epic; Q-295, the research question, closed with them; T-361 (the accounts registry).
- Research: `research/opencode-v2` (`docs/research/opencode-v2.md`; the probes `probe-restart-sweep.mjs`, `probe-features.mjs`, `probe-server.sh` and `openapi-digest.mjs` in `docs/research/opencode-v2/`).
- Upstream: anomalyco/opencode #51213 (the restart sweep resumes sessions it does not own) and #54180 (a declined approval reported as a shutdown).
- Code: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/` (`client.ts`, `server.ts`, `state.ts`), `hub/src/adapters/contract.ts`, `hub/src/accounts/registry.ts`, `hub/src/doctor/toolchain.ts`, `hub/src/doctor/ranges.ts`.
- Skills: `release`.
- GLOSSARY: Harness, Account, Adapter, Role clause.

## Plan

```yaml
stages:
  - name: OpenCode v2 hygiene
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-296
        - T-532
        - T-535
        - T-534
      - - T-533
        - T-536
```

## Comments

### human · 2026-10-16T15:39:02.799Z

Amendment from the v0.1.4 design (Q-599, the human, 2026-10-16): harness versions are neither pinned nor judged. Criterion C3's release-time OpenCode range check and the newer-than-tested and 3.x notes become informational (no refusal, no warning row); the plan of E-613 carries the doctor side. See docs/spec/v0.1.4.md §3.3 and §3.8.

### hub · 2026-10-20T02:36:20.351Z

demo 3781f5d9-3790-45f6-89f3-719541e09f5b created: droplet cland-v0-3781f5d9, commit 32ae5bdce84f2a74cbcdd8ce0dc14dd14e301d79, deadline 2026-10-20T03:50:17.276Z.

### hub · 2026-10-20T03:03:05.106Z

demo 3781f5d9-3790-45f6-89f3-719541e09f5b destroyed: lifetime 1286727 ms; cost $0.0894.

### hub · 2026-10-20T03:13:56.557Z

demo 99e76c76-aa09-4af5-9493-90bd583056f0 destroyed: lifetime 0 ms; cost $0.0000.

### hub · 2026-10-20T03:17:01.004Z

demo 0144bd56-e455-4f66-b479-01a9be7c612a created: droplet cland-v0-0144bd56, commit 824105c5a2a56b3495e9215cc88d60c4c129df6c, deadline 2026-10-20T04:31:00.924Z.

### qa-3 · 2026-10-20T03:50:58.951Z

verdict: qa
result: clear
by: qa-3 [qa]
run: qa-20261020-3c
commit: 824105c5a2a56b3495e9215cc88d60c4c129df6c
findings: [{"severity":"low","text":"D5 brief correction: invalid explicit binary override correctly asks to fix/unset it; separate unset-override missing-binary probe confirms installer. Product passes.","file":"qa/briefs/E-424.md","line":174},{"severity":"low","text":"D15 brief correction: sed fixture produced duplicate TOML keys. Coordinator-approved scratch atomic writer yielded all five expected policies; original failure evidence retained in A-7011. Product passes.","file":"qa/briefs/E-424.md","line":185},{"severity":"low","text":"R1 brief correction accepted by Coordinator: rule retirement may be committed with tracker title. Rule 13 retired and T-296 closed; actual evidence passes.","file":"qa/briefs/E-424.md","line":230}]
finding_counts: {"high":0,"medium":0,"low":3}

| Case | Result | Method / evidence |
|---|---|---|
| G0 | PASS | [local read-only] build identity, child closure, amendment and QA hold gates; G0.txt |
| G1 | PASS | [local read-only] build identity, child closure, amendment and QA hold gates; G1.txt |
| G2 | PASS | [local read-only] build identity, child closure, amendment and QA hold gates; G2.txt |
| D0 | PASS | [droplet Linux] brief D0; fresh execution at candidate; full command/output retained; D0-start.json |
| D1 | PASS | [droplet Linux] brief D1; fresh execution at candidate; full command/output retained; D1-build.txt |
| S0 | PASS | [droplet Linux] brief S0; fresh execution at candidate; full command/output retained; S0-scratch.txt |
| D2 | PASS | [droplet Linux] brief D2; fresh execution at candidate; full command/output retained; D2-launch.txt |
| D3 | PASS | [droplet Linux] brief D3; fresh execution at candidate; full command/output retained; D3-server-env.txt |
| D4 | PASS | [droplet Linux] brief D4; fresh execution at candidate; full command/output retained; D4-resume.txt |
| D5 | PASS | [droplet Linux] doctor versions informational per human amendment; missing binary tested with override unset as well as invalid override; v2 installer present; D5-versions.txt, D5-missing-unset.txt |
| D6 | PASS | [droplet Linux] brief D6; fresh execution at candidate; full command/output retained; D6-doctor.txt |
| D7 | PASS | [droplet Linux] brief D7; fresh execution at candidate; full command/output retained; D7-accounts.txt |
| D8 | PASS | [droplet Linux] brief D8; fresh execution at candidate; full command/output retained; D8-quiet.txt |
| D8b | PASS | [droplet Linux] brief D8b; fresh execution at candidate; full command/output retained; D8b-reject.txt |
| D9 | PASS | [droplet Linux] D9 fresh test or informational release check; full log exit 0; no failed scoped tests; D9-adapter.log |
| D10 | PASS | [droplet Linux] D10 fresh test or informational release check; full log exit 0; no failed scoped tests; D10-policy.log |
| D11 | PASS | [droplet Linux] D11 fresh test or informational release check; full log exit 0; no failed scoped tests; D11-native.log |
| D12a | PASS | [droplet Linux] D12a fresh test or informational release check; full log exit 0; no failed scoped tests; D12a-policy.log |
| D12b | PASS | [droplet Linux platform skip resolved by local macOS L1] P3 skipped remotely because binary absent; same-SHA real binary test passed 1/1; PASS with L1 basis per brief; D12b-database.log, L1-p3.log |
| D13a | PASS | [droplet Linux] D13a fresh test or informational release check; full log exit 0; no failed scoped tests; D13a-check-test.log |
| D13 | PASS | [droplet Linux] D13 fresh test or informational release check; full log exit 0; no failed scoped tests; D13-check.txt |
| D14 | PASS | [droplet Linux] generated clauses: 6 worktree-rule matches; doctor 18/18 and roles 4/4 pass; D14-clauses.txt, D14a-doctor.log, D14b-roles.log |
| D15 | PASS | [droplet Linux] five launch policy rows match README; Coordinator-approved atomic fixture writer avoids known brief duplicate-TOML defect; D15-policy.txt, D15-corrected.sh, set-policy.mjs |
| D16 | PASS | [droplet Linux] openai/gpt-5.2#high reaches fake as providerID=openai,id=gpt-5.2,variant=high; D16-variant.txt |
| D17 | PASS | [droplet plus local git read] freshness current=true; no dev changes; D17-status.json, D17-dev.txt |
| D18 | PASS | Scratch sessions/hub stopped, scratch process scan empty, scratch removed; demo stop accepted. Coordinator reports stand-in confirmed DigitalOcean destruction at 03:50Z (a9bc4801); known T-932 leaves hub releasing. Last estimated lifetime 1988550 ms/cost $0.13809375; accepted decision basis.; D18-cleanup-confirmed.json, D18-stop.json, D18-final-status.json, D18-release-confirmation.txt |
| L1 | PASS | [local macOS] node --test hub/test/opencode-database.test.ts; real OpenCode 2.0.24; 1 pass/0 fail/0 skip; cleanup count 0; L1-p3.log, L1-p3.exit, L1-queue.json, L1-cleanup-count.txt |
| R1 | PASS | [records] rule 13 retired, no active OpenCode CLI restriction; Coordinator d8f3774b accepts retirement in tracker-titled commit as brief correction; R1-rules.json, R1-rule-proof.txt, R1-history-diff.txt |
| R2 | PASS | [records] A-3486/A-3474/A-3489/A-3492 read; historical P3 proof present; T-296 closed with C1-C5 current verified marks; R2-proof.txt, R2-T296.json |
| R3 | PASS | [records] A-4113 default 8/10 vs false 7/10; A-4114 inconclusive adoption comparison; defaults unchanged; T-619 open; no experiment rerun; R3-experiments.txt, R3-T619.json |
| R4 | PASS | [records at tested SHA] document-topic matrix complete after explicit exemptions; 12 policy rows; worktree clauses in defaults/project; release informational step precedes dry run; R4-matrix.md, R2-T296.json |
| R5 | PASS | [records at tested SHA] README durable msg_ admission/retry, child model and warn-level moved event; T-534/T-535 closed; R5-docs.md, R5-T534.json, R5-T535.json |

Findings, ranked by severity: no high or medium findings; no product failures. Three low brief defects were corrected only in scratch/check interpretation, with original evidence retained:

- D5 — qa/briefs/E-424.md:174: setting CLAND_OPENCODE_BIN=/nonexistent/opencode requests an explicit override. Doctor correctly says to fix/unset the override, rather than offering the default installer. A separate scratch doctor command with the override unset and opencode absent from PATH returned the v2 installer. Both outputs are retained.
- D15 — qa/briefs/E-424.md:185: the scratch sed writer accumulated duplicate TOML keys, so the hub retained its previous valid policy. The original failure/diagnosis is preserved in A-7011, run qa-20261020-3a. Coordinator authorized correcting only the scratch fixture writer (b98c1796-1fdb-4796-98a0-b60f56e0c259). This current run used the atomic fixture writer; all five newly launched policies match the README. No product source was changed.
- R1 — qa/briefs/E-424.md:230: git history contains tracker commit 89c040bd, not exclusively rule-titled commits. Actual rule 13 is retired, no active rule prohibits the CLI, and T-296 is closed. Coordinator explicitly accepted this evidence and corrected the commit-title expectation (d8f3774b-6fd5-4434-8562-64a0e042dfdb).

D4 used the brief's documented JSONL extraction alternative and directly confirmed the same native session/database after relaunch. D8b directly observed rejection and running/idle, supplemented by D11. D12b skipped remotely because no real binary is installed; its PASS basis is the same-commit L1 real OpenCode 2.0.24 P3 test: 1 passed, 0 failed, 0 skipped. D5 and D13 use the human's 2026-10-16 informational-version amendment, not the obsolete original C3 version refusals. R3 reads the measured artifacts A-4113/A-4114 without rerunning paid/free model experiments; measured defaults remain unchanged. R4 uses the document-specific exemptions explicitly written in the brief.

Criterion verification in this run:

| Criterion | Passing evidence |
|---|---|
| C1 | D2–D4, D6–D7, D12b/L1, R1–R2; private database, login, persistence and real P3 isolation |
| C2 | D8, D8b, D9, D11; readiness without log text, rejection without shutdown |
| C3 (amended) | D5, D13a, D13, R4; versions informational, absent-binary installer, live release check |
| C4 | D10, D12a, D15, D16, R4; policy rows, item/effort rules, explicit variant |
| C5 | D11, R5; idempotent admission, children model/usage/approval instrumentation |
| C6 | R3; measured CodeMode and role-instruction artifacts/default decisions |
| C7 | D6–D7, D11, D14, R4–R5; warnings, generated clauses and lead move event |
| C8 | R2, R4–R5; README, generated roles, release check, closed T-296 |

Run qa-20261020-3c; QA qa-3; tested full commit 824105c5a2a56b3495e9215cc88d60c4c129df6c. All 32 checks PASS. Marks requested: C1,C2,C3,C4,C5,C6,C7,C8. Targeted tests: 64 passing on Linux plus 1 real-binary P3 passing on macOS; remote P3 skip resolved by L1. No full suite was submitted by QA, per brief. Coordinator's same-commit integrated receipts A-7022 (Linux, two shards) and A-7026 (macOS) were read: both finished exit 0 with no nonzero fail summary. integrated-receipts.txt contains their exact paths, per-shard machine/duration/cost and overall wall. Report-only budget warnings remain report-only and are not E-424 findings.

D cases ran in the hub-owned Linux x86_64 demo with Node 24.21.0, isolated scratch HOME/DB and fake OpenCode. L1 ran after the quiet queue gate on macOS with real OpenCode 2.0.24 and a local fake provider; it used test-owned HOME/XDG paths. G/R checks are local read-only. No real provider prompt/account/database was used. All scratch sessions/hub stopped; process scan empty; scratch directory removed; L1 cleanup count 0. Local-done was delivered to qa-676 and qa-2.

Demo lease 0144bd56-e455-4f66-b479-01a9be7c612a; hub state releasing (known T-932); created 2026-10-20T03:16:02.515Z; lifetime 1988550 ms; last estimated cost $0.13809375; freshness current=true. Elapsed wall through report: 2076.9 s (includes cover-quiet wait and cleanup wait; not final billing lifetime).

D18 decision basis: Coordinator a9bc4801-54a2-443b-b3db-6e3de65af2cd reports that the stand-in confirmed DigitalOcean destruction at 03:50Z. QA did not independently query DigitalOcean. The hub row awaits release due to known T-932 (empty-tags identity recheck). Cost/lifetime above are the last observed estimates, not a final receipt.

Historical runs are not substitutes for this candidate: qa-20261020-3a at 32ae5bdc was superseded (A-7011; old lease final 1286727 ms/$0.08935604); qa-20261020-3b was a no-lease capacity wait. Coordinator authorized exactly one retry when a slot freed; that is this 3c lease.


Published evidence: A-7028, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7028-e-424-qa-evidence-at-824105c5-qa-20261020-3c (entry README.md); QA note A-7029, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-7029-e-424-qa-clear-32-checks-c1-c8-at-824105c5.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.

### hub · 2026-10-20T03:51:05.995Z

demo 0144bd56-e455-4f66-b479-01a9be7c612a destroyed: lifetime 1662476 ms; cost $0.1154.
