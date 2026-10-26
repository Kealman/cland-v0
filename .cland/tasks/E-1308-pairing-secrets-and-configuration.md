---
id: E-1308
kind: epic
title: Pairing, secrets and configuration
state: closed
criterion_seq: 8
labels:
  - epic
  - v0.3
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by:
  - E-1307
topic: topic-1092
branch: null
created: 2026-10-25T14:11:59.271Z
updated: 2026-10-26T19:58:04.699Z
closed: 2026-10-26T19:58:04.699Z
---

## Goal

A project can hold a messenger's token and a speech key safely, configure its remotes, and pair one human per messenger. This epic builds the git-ignored secrets file and `cland secret`, the environment overrides on the sessions' deny-list, one redactor, the `[remote]` and `[speech]` keys with their reload, the pairing codes with their approval only from Neovim and the terminal, and `cland remote`. Today the only secret precedent is `DIGITALOCEAN_TOKEN`, held in the environment; the prototypes read their tokens from a file by path, and the pairing direction was reversed to the one every messenger bridge uses (Q-1290, Q-1294).

## Contents

- **The secrets file** (spec §3.3). `.cland/secrets.toml` holds `[telegram] token`, `[discord] token` and `[speech] elevenlabs_key` and `xai_key`. It is git-ignored through the managed `.cland/.gitignore`, kept at mode 600, checked and tightened at hub start, and refused as a symlink. Demo: a file at 644 is tightened at start, a symlinked file is refused with a reason, and `git status` never lists it.
- **`cland secret`** (§3.3). `set <name>` reads the value from stdin or a hidden prompt, never from argv; `list` prints names and SHA-256 fingerprint prefixes only; `unset <name>` removes one. A name is the file's dotted key, as `cland config set` names keys (`telegram.token`). Demo: a value piped to `cland secret set telegram.token` lands in the file, `list` shows its fingerprint prefix, and the value appears in no output, log line or process listing.
- **Environment overrides and the deny-list** (§3.3). `CLAND_TELEGRAM_TOKEN`, `CLAND_DISCORD_TOKEN`, `ELEVENLABS_API_KEY` and `XAI_API_KEY` win over the file and join the sessions' environment deny-list beside `DIGITALOCEAN_TOKEN`, so no session and no speech command inherits them. Demo: with all four set in the hub's environment, a fake harness session's environment holds none of them.
- **Validation and the redactor** (§3.3, §3.12). A Telegram token must match `^[1-9]\d{0,16}:[A-Za-z0-9_-]{24,}$` within 80 characters before any URL is built; a Discord token is opaque. One redactor masks every token and key in the log lines, errors, journal records and artifacts the gateway and the speech seam write. Demo: a malformed token is refused without being echoed, and an error that carried a token prints it masked.
- **The keys** (§3.3). `[remote] mute_default`, `[remote.telegram] enabled` and `format`, `[remote.discord] enabled`, and `[speech] provider`, `model`, `language`, `max_seconds` and `command`, rendered with their defaults by `cland init` and added to existing projects by `cland update`. A messenger is active when enabled with a token present; every key reloads on `cland hub reload`, and enabling or disabling connects or disconnects that messenger. Demo: `cland update` adds the sections to an older project, and `cland config set remote.telegram.enabled true` with a reload starts a test messenger, while `false` stops it.
- **Pairing codes** (§3.2). A code has 8 characters drawn without 0, O, 1 and I and comes with the sender's numeric id and the approve command ready to copy. A Telegram code lives one hour and a Discord code 15 minutes, at most three wait at once, and a stranger gets at most two replies, then silence. Demo: through a test messenger a stranger gets a code, then one more reply, then nothing.
- **Approval and identity** (§3.2). A waiting code is a needs-you row in the inbox ("Pair Telegram user 12345 (Name)? code …"). Approving grants new access, as `web.link` does, so the hub accepts it only from Neovim's connection and from the CLI, and refuses it from the web edge and from remotes; pairing rows never reach a remote. Approval binds the messenger's numeric ids in `hub.db`, replaces any earlier pairing with a line to the old chat, and clears every other waiting code of that messenger. Usernames never identify. Demo: the approval is refused through the web edge and the gateway and accepted from Neovim's connection and `cland remote approve`, and a second approval replaces the first with a line to the old chat.
- **`cland remote`** (§3.10). `status` per messenger: the token's presence with its fingerprint, paired with whom, the connection state, the last inbound and outbound, the outbox depth, mute and the bot's link. `approve <messenger> <code>` prints the paired name and id; `unpair <messenger>` forgets a pairing; `test <messenger>` checks the token with the platform and sends one line to the paired chat. Demo: each subcommand against a test messenger.
- **Rotation** (§3.3). A new token through `cland secret set` and `cland hub reload` keeps the pairing, since it keys on ids. Demo: after a token change and a reload, the test messenger reconnects still paired.

Not in this epic: the Telegram and Discord clients, which supply the platform side of pairing and of `cland remote test` ("The Telegram remote", "The Discord remote"); Neovim's card for a pairing row and the web's row ("Setup, doctor, onboarding and the workbenches"); setup's remote step (same epic); the speech provider and the data-use line of `cland remote status` ("Media, the upload frame and speech").

## Order

1. **The secrets file and `cland secret`.** Demo: set, list and unset; the mode, the symlink refusal and the git-ignore; no value in any output.
2. **Overrides, the deny-list, validation and the redactor.** Demo: no session inherits the four names; a malformed token is refused unechoed; errors print tokens masked.
3. **The keys and their reload.** Demo: `cland init` renders the sections, `cland update` adds them, and a reload connects and disconnects a test messenger.
4. **Pairing.** Codes, limits, approval only from Neovim and the CLI, replacement and identity. Demo: the pairing walk described above.
5. **`cland remote` and rotation.** Demo: `status`, `approve`, `unpair` and `test` against a test messenger, and a rotated token that keeps the pairing.

## Definition of done

QA runs the demo below on `dev` through the CLI, the hub's frame protocol and a test messenger in the suite standing in for a messenger platform, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. QA uses made-up tokens and keys only.

In a scratch project, QA sets the three secrets with `cland secret set` from stdin, reads `cland secret list`, unsets one, and checks the file's mode, its absence from `git status` and the refusal of a symlinked file. With the four environment overrides set in the hub's environment, QA reads a fake harness session's environment and finds none of them, and feeds a malformed Telegram token and reads a refusal that does not echo it. QA runs `cland update` in an older project and reads the new sections, then enables and disables a test messenger with `cland config set` and `cland hub reload`. As a stranger on the test messenger QA gets a code and its limits, tries to approve it through the web edge and the gateway and is refused, approves it from Neovim's connection, pairs again with `cland remote approve` and reads the line to the old chat, then runs every `cland remote` subcommand and rotates the token.

- [ ] C1. `.cland/secrets.toml` holds the four names, is git-ignored by the managed `.cland/.gitignore`, is tightened to mode 600 at hub start and is refused as a symlink.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.337Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff
- [ ] C2. `cland secret set` reads only stdin or a hidden prompt, `list` shows names and fingerprint prefixes only, `unset` removes a name, and no value reaches any output, log line or process listing.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.338Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff
- [ ] C3. The four environment overrides win over the file and are on the sessions' deny-list beside `DIGITALOCEAN_TOKEN`, so no session and no speech command inherits them.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.338Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff
- [ ] C4. A Telegram token is validated before any URL is built, and one redactor masks tokens and keys in everything the gateway and the speech seam write.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.338Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff
- [ ] C5. `cland init` renders the `[remote]`, `[remote.telegram]`, `[remote.discord]` and `[speech]` keys with their defaults, `cland update` adds them, and `cland hub reload` applies every key, connecting or disconnecting a messenger.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.338Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff
- [ ] C6. Pairing codes have 8 characters without 0, O, 1 and I, live one hour on Telegram and 15 minutes on Discord, wait at most three at once, and a stranger gets at most two replies.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.338Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff
- [ ] C7. Approving a pairing is accepted only from Neovim and the CLI, binds the numeric ids in `hub.db`, replaces an earlier pairing with a line to the old chat, and clears the other waiting codes.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.338Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff
- [ ] C8. `cland remote status`, `approve`, `unpair` and `test` behave as spec §3.10 says, and a rotated token keeps the pairing after `cland hub reload`.
  - verified: qa-677 [qa] · run qa-dod-2026-10-26-677-1308 · 2026-10-26T19:57:44.338Z · commit 94b56ad73c091a8da1e30d4d401474645d5688ff

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify` (D25 and D29 of v0.1 §4). Items are written through `cland task` and the task tools, never as hand-written item files.
- **The hub's code.** TypeScript on Node 24 under the hub's tsconfig (`strict`, `erasableSyntaxOnly`, `verbatimModuleSyntax`), so no enums, namespaces or parameter properties. No new runtime dependency: TOML goes through the hub's existing parser.
- **Tests.** Test first (`tdd`). The hub's frame protocol is the first seam (`hub/test/harness.ts`), the fakes in `hub/test/fakes/` the second, with a test messenger behind the gateway. No test needs a real platform, token or key, so the suite runs on droplets as it is.
- **Secrets.** A token or key never appears in argv, a frame, a log line, an error, a journal record or an artifact; tests feed made-up values through stdin or the hub's environment, never argv, since every session sees argv. Real tokens never go to droplets. Only the human creates bots and places tokens; the sandbox secrets file `~/.config/cland/sandbox-remote.secrets.toml` is read by path only, never printed, copied or deleted (T-1291).
- **New access.** Approving a pairing is new access, like `web.link`: the web edge and the remotes never approve, whatever their cookie or pairing allows.
- **ADRs.** 0003 (the hub is a per-project daemon): the secrets and the pairings belong to this project's hub alone.
- **The prototype.** `prototype/telegram-remote` at 33bf2b2e is never merged. The build may read its code and take what fits, but follows the spec (Q-1297).
- **Plan.** The Coordinator drafts the plan with `plan-epic`, chooses the crew and the models by the project's rules, and approves the plan itself (spec §4).
- **Order.** Second in the hub lane: follows "The gateway edge and its authority". "The Telegram remote" follows it, and "Setup, doctor, onboarding and the workbenches" is blocked by it.

## References

- Spec: `docs/spec/v0.3.md` §3.2 (remotes, pairing and identity), §3.3 (configuration and the secrets file), §3.10 (`cland remote` and `cland secret`), §3.12 (hygiene) and §4.
- Items: R-1278; the map M-1286, round-1 decisions 6 to 8 and 16; Q-1294 §1 to §4, §8 and §9; Q-1296 §13 (approval only from Neovim and the CLI); Q-1292 (the reversed pairing, and approving clears every waiting code); Q-1293 (the Discord code's 15 minutes); Q-1290 (capped pairing as every bridge does it); T-1291 (the sandbox bots).
- Prototype, on `prototype/telegram-remote` at 33bf2b2e: `hub/src/cli/remote.ts`, `hub/bin/cland.ts`, `hub/src/project.ts` (the managed `.gitignore`), `hub/src/remote/remote-store.ts`, and the pairing in `hub/src/remote/telegram-gateway.ts`.
- Research: `docs/research/telegram-remote.md` on `research/telegram-remote` (2a81ecc9), the token's form; `docs/research/messenger-bridges.md` on `research/messenger-bridges` (ffee79d8), pairing and secrets in other bridges.
- Code: `shared/executor-credentials.ts` (the deny-list), `hub/src/init/config.ts` (the rendered configuration), `hub/src/cli/init.ts` (`cland init` and `cland update`), `hub/src/cli/config.ts`, `hub/src/cli/web.ts` and `hub/src/hub/web-authority.ts` (`web.link`), `hub/src/executor/droplet/api.ts` (the token-redaction precedent).
- GLOSSARY: Pairing and Remote (added for v0.3).

## Plan

```yaml
stages:
  - name: secrets, keys and pairing
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1328
        - T-1331
        - T-1332
        - T-1333
        - T-1334
      - - T-1329
      - - T-1330
      - - T-1339
```

## Comments

### qa-677 · 2026-10-26T19:57:44.338Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-dod-2026-10-26-677-1308
commit: 94b56ad73c091a8da1e30d4d401474645d5688ff
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Case | Surface | Result | Observation |
|---|---|---|---|
| M1 | hub-api | PASS | 5/5 + 3/3; mode 600, symlink refusal, all four names and native Git ignore with positive control |
| M2 | hub-api | PASS | 4/4 plus M1; stdin/hidden stream, list fingerprints, unset, malformed inputs, no value in native CLI output/argv |
| M3 | hub-api | PASS | 3/3 + 3/3; overrides win; fake harness and speech stand-in receive no remote credentials |
| M4 | hub-api | PASS | 3/3 + 13/13; validation precedes provider setup; frame/journal/artifact masking survives rotation |
| M5 | hub-api | PASS | 15/15 + 19/19; defaults/update/round-trip and all reload keys, messenger connection and shutdown |
| M6 | hub-api | PASS | 8/8 + 3/3; alphabet, both exact lifetimes, three waiting/two replies, restart persistence and expiry exclusion |
| M7 | hub-api | PASS | 10/10 + 44/44 plus M6; local authority, trusted stdio, numeric persistence, replacement notice, cleared codes and web refusal |
| M8 | hub-api | PASS | 18/18 + 18/18; status/approve/unpair/test for both messengers, failure isolation, old replies, rotation retains pairing/mute |
| M9 | hub-api | PASS | 8/8 children closed done; clear same-source-head review/green verify; landed; stage closed; T-1332 exception recorded; both covers green |

QA clear: C1,C2,C3,C4,C5,C6,C7,C8 verified at 94b56ad73c091a8da1e30d4d401474645d5688ff, run qa-dod-2026-10-26-677-1308. No findings.

Fifteen files ran serially once in a clean detached checkout on local macOS arm64 / Node v24.21.0: 169 native tests, 169 passes, 0 failures/skips/cancellations/todos. Actual generated case names were matched by hash to both cover receipts and native summaries checked separately from exit status. M2/M7 reuse earlier cases without adding counts. Shared sealed fixture environments and disposable projects; only fabricated values. Captures screened/redacted before saving (five conservative label masks, zero suppressed lines). Sandbox secrets file never read. No real messenger, browser, full-suite rerun, build or timing/load claim. Web-authority exercises frame transport; browser binary not applicable to this local run.

M9 independently matches all eight children’s clear hub review and green native same-source-head verify to equivalent squash landings in both green stage covers. Covers at 79d5885e019a1fccc378f2e24a4f1d66b046aed2 / tree 0652e7abe9ca161dd43c10628749560425e341fb: Linux 95b8e738/A-12476 (4970 pass, 9 skip), macOS 4caa8495/A-12480 (4978 pass, 1 skip), each 4979 tests and 0 failures; all 169 scoped names pass in each. T0, T1–T4 base and Web complete; 14 T4 files base-only, outer repetitions skipped. Budget/ratchet/lint report-only. Linux x64 6.8.0-142-generic, macOS arm64 27.0.0; Node24.21.0/Nvim0.12.5. Linux Headless Shell156.0.8078.4 / Playwright1248; exact historical macOS browser binary unrecorded. Linux c-8 lon1 shard lifetimes1304402/1347159ms, costs$0.09058347222222222/$0.09355270833333333, total$0.18413618055555556; lifetimes are not test wall times. Local executor has no droplet cost.

T-1332 original full 0421f9fe/A-12445 remains failed: "live hub protocol drifted; run npm run test:nvim-fixtures", actual inbox.pairings: [] absent from expected. Coordinator’s fixture-only rule-6 exception is recorded on the item. Independently checked the sole added fixture line at e10bf44f; its green task run covered T0/T1/T2/Web, and the owning generated test passes in BOTH later stage covers. T-1328 prior A-12357 also remains failed ("native process identity unavailable for pid 71345; fixture preserved"); its later same-head run and exact owning case in both stage covers pass. No causal flake claim.

Freshness current:true at the requested build; no demo lease. Full commands, case names/hashes, source/declaration checks, recorder M1–M9, child/cover evidence, exception and failure text, and publication scan: A-12483, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12483-e-1308-dod-qa-clear-at-94b56ad7/report.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified.
