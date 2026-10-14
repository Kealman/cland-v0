---
id: E-272
kind: epic
title: Accounts and limits
state: closed
criterion_seq: 7
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-253
branch: null
created: 2026-10-12T11:35:14.048Z
updated: 2026-10-14T19:35:27.316Z
closed: 2026-10-14T19:35:27.316Z
---

## Goal

The human sees each account's limits in the sessions panel and pins sessions to accounts by name, and cland never moves work between accounts on its own. Several accounts per harness work today through one environment variable each (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_DATA_HOME` or `OPENCODE_DB`), but cland launches every session on the harness's default and shows no limits. A limited account refuses new launches and the human picks another, because the providers' terms forbid rotating accounts to get past a limit.

## Contents

- **§3.13 Accounts and limits**, whole:
  - The registry at user level in `~/.config/cland/accounts.toml`: names and paths only, never a secret. `roles.toml` and launches refer to an account by name; the account is recorded on the session; every process the adapter starts or queries for a session, `agents --json` included, runs in the account's environment (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `XDG_DATA_HOME` or `OPENCODE_DB`).
  - Limits from running sessions first: Codex's `account/rateLimits/updated`, Claude Code's status-line `rate_limits` forwarded by the cland mod. Idle accounts polled at most every 15 minutes and only through the harness itself (`claude -p "/usage"`, a short-lived `codex app-server`); cland never calls a provider's endpoint with a token it reads; OpenCode exposes nothing and shows nothing.
  - The accounts block at the top of the sessions panel: per account, the windows the source sent (5-hour, weekly, per-model weekly) with the used share and the reset time; a limited account highlighted.
  - Routing without rotation: an account pinned to a role or to a launch by hand; on a limit-hit signal (Claude `rate_limit` and 429, Codex `usageLimitExceeded`, OpenCode `provider.quota`) the hub marks the account limited, refuses new launches on it, and the human is asked to pick another; no automatic failover or round-robin.
- **T-265**, the Claude adapter's polling near token expiry (claude-code#95822), which precedes multi-account use: at most one `claude agents --json` per 30 seconds per config directory, or a push source instead; a logged-out directory gives one event and one message to the human, with no retry storm.

Not in this epic: failover, round-robin or a fill-first list of accounts, which §3.13 rules out; a second paid account for overflow, which is the human's own call; signing in, which stays each harness's own flow, done once by the human.

Choices where the spec is silent:

- `roles.toml` takes `account = "<name>"` under `[<role>.launch]`, one name and never a list; `cland session launch --account <name>` overrides it; with no account the harness's default applies, as today.
- The registry's shape follows the research (section 5.1): per account its `harness` and its directory or database (`config_dir`, `home`, `data_home` or `db`). A name the registry does not know refuses the launch and lists the known names. The registry's path follows `XDG_CONFIG_HOME` when it is set, so tests and QA use a scratch registry and never touch the human's.
- The account name is on the launch record and the session, in `session.list` and in the expanded row's meta line ("Codex · gpt-6.1-sol · codex-b"), and on the usage records of "Status, fields and instrumentation" from then on.
- The Claude adapter polls `claude agents --json` once per config directory that has live cland sessions, never in an idle one; `claude auth status` and `claude doctor` never run on a timer.
- `cland account list` prints each account with its windows, their age and its limited mark (`--json` the same); `cland account clear <name>` lifts a limited mark by hand, which an OpenCode account needs, since its signal names no reset.
- A limited mark lasts until the reset the signal names (Claude's `resetsAt`, Codex's window reset). A refused launch names the account and its reset; the Coordinator's clause turns it into an ask listing the other accounts of that harness, and the human's answer pins the account for the launch or the role. The hub asks nothing itself: only the Coordinator asks the human.
- An idle account is polled at hub start, when the human opens the accounts block, after a limit-hit signal, and otherwise at most every 15 minutes, backing off on a 429 as the harness itself does.

## Tracer-bullet order

1. **Safer polling first (T-265).** The Claude adapter polls `claude agents --json` at most once per 30 seconds per config directory and reports a logged-out directory once. Demo: a fake-harness test shows the interval under two directories, and one event and one message for a logged-out one.
2. **The registry and the launch environment.** `accounts.toml`, `account` in `roles.toml` and on launch, the account on the session, and every adapter process run in its environment. Demo: `cland session launch rev-x --role reviewer --account codex-b` runs its `codex app-server` with codex-b's `CODEX_HOME`, and `cland session list --json` shows the account.
3. **Limits from running sessions.** Codex's rate-limit events and Claude's status-line `rate_limits`, forwarded by the cland mod, are kept per account with their age. Demo: a fake Codex session's `account/rateLimits/updated` shows in `cland account list --json` with its windows and resets.
4. **Idle accounts through the harness.** Idle accounts are polled through `claude -p "/usage"` and a short-lived `codex app-server` at most every 15 minutes, and OpenCode accounts show no data. Demo: an idle fake account is polled once through its fake harness, and the test proves no HTTP request left cland for a provider's endpoint.
5. **The accounts block.** The block at the top of the sessions panel shows per account the windows sent, with the used share and the reset, and highlights a limited account. Demo: the headless workbench shows a Codex account's weekly window with its share and reset, and a limited account highlighted.
6. **Limited accounts refuse launches.** A limit-hit signal from any of the three harnesses marks the account limited until its reset, a launch on it is refused naming the reset, and the Coordinator's clause asks the human for another. Demo: a fake Codex `usageLimitExceeded` marks codex-a limited, the next launch on it is refused, and `cland account clear codex-a` lifts the mark.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a headless workbench (one `nvim --headless` process, keys by `nvim_input`, the screen read with `screenstring()`), and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with the fake harnesses and a scratch registry (two Claude Code accounts, two Codex accounts, one OpenCode account, under an `XDG_CONFIG_HOME` of QA's own), QA pins the Reviewer role to codex-b, launches a Reviewer and a Claude session on claude-b, and reads in the fakes' recorded environments that every adapter process for each session ran in its account's directory. The fakes push limits; `cland account list` and the headless workbench's accounts block show the windows each source sent, and the OpenCode account shows no limit data. An idle account is polled once through its harness within 15 minutes. A fake `usageLimitExceeded` marks codex-a limited and highlighted; the next launch on it is refused naming its reset; `cland account clear` lifts the mark. No launch moves to another account by itself.

- [ ] C1. `~/.config/cland/accounts.toml` holds names and paths only; `roles.toml` and launches name accounts; the account is recorded on the session and shown on its row.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-11 · 2026-10-14T19:34:58.481Z · commit ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b
- [ ] C2. Every process the adapter starts or queries for a session, `agents --json` included, runs in the account's environment.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-11 · 2026-10-14T19:34:58.481Z · commit ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b
- [ ] C3. Limits come from running sessions first, and idle accounts are polled at most every 15 minutes through the harness only; no code path calls a provider's endpoint with a token cland reads.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-11 · 2026-10-14T19:34:58.481Z · commit ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b
- [ ] C4. The sessions panel opens with the accounts block: per account, the windows the source sent with the used share and the reset time; a limited account is highlighted; OpenCode shows no limit data.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-11 · 2026-10-14T19:34:58.481Z · commit ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b
- [ ] C5. A limit-hit signal from any of the three harnesses marks the account limited and refuses new launches on it; nothing fails over, rotates or picks another account by itself.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-11 · 2026-10-14T19:34:58.482Z · commit ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b
- [ ] C6. The Claude adapter polls `claude agents --json` at most once per 30 seconds per config directory, and a logged-out directory gives one event and one message to the human with no retry storm (T-265).
  - verified: qa-27 [qa] · run qa-2026-10-14-27-11 · 2026-10-14T19:34:58.482Z · commit ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b
- [ ] C7. `hub/README.md`, `nvim/README.md`, the Coordinator's clause and `cland init`'s defaults describe accounts, limits and the limited mark.
  - verified: qa-27 [qa] · run qa-2026-10-14-27-11 · 2026-10-14T19:34:58.482Z · commit ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b

## Dogfooding

The crew's own launches name their accounts from this epic on: the human writes the registry once with the accounts they use, the Coordinator pins the roles to them in `roles.toml` with the human, and the accounts block shows the build's own spend against the weekly windows.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **Terms.** The providers' terms forbid rotating accounts and using several accounts to get past a limit, and Anthropic's forbid a third party holding Claude.ai tokens (research section 5.6). cland reads no token, calls no usage endpoint itself, and never moves work to another account.
- **Risks.** claude-code#95822: short-lived `claude` commands near a token's expiry can log a config directory out, which is why T-265 lands first and idle directories are never polled with `agents --json`. Each account's directory keeps its own trust and MCP state, so a project's first launch under a new directory may meet the trust dialog.
- **Order.** Fifth in the hub lane, after "Remote executors"; "Release v0.1.2 from the item" waits for it.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.13 Accounts and limits.
- Tickets: T-240 (decided, closed into this epic); T-265, a child of this epic.
- Branch: `research/account-limits` (`docs/research/account-limits.md`, section 5; the probes in `docs/research/account-limits/`).
- GLOSSARY: Harness, Adapter, Session, Role.
- Upstream: anthropics/claude-code#95822.

## Plan

```yaml
stages:
  - name: safer polling and the registry
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-265
      - - T-361
  - name: Claude Code on an account and limits from running sessions
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-362
      - - T-363
  - name: idle accounts and the accounts block
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-364
      - - T-365
  - name: limited accounts, the clauses and the docs
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-366
        - T-367
```

## Comments

### coord · 2026-10-13T23:43:19.757Z

Decision (stand-in, D24, 2026-10-13 23:23Z, lane flow): unlinked from E-271. The edge ordered the hub lane. No E-272 ticket depends on E-271's code: executors run suites, accounts govern harness sessions. The shared files are additive (protocol.ts, dispatch.ts, JOURNALLED, README prose, default-roles.ts clauses). E-273 still waits for both epics.
Coordinator decisions on the drafts' open questions, adopted as recommended:
- b2: a registry entry with no path names the harness default, at most one per harness. Otherwise limits go under default:<harness>, and the row records the effective directory.
- b3: the resolved environment is recorded on the session row at launch, and relaunch, resume and handoff reuse it.
- b4: API-key variables are removed for named Claude accounts and their idle polls.
- b5: hub start and the timer keep the 15-min floor across restarts. Panel open and after-hit polls wait at least 5 min.
- b6: a limit hit is only StopFailure.error == rate_limit.
- b7: relaunches and pool handoffs onto a limited account are refused. A hub-restart re-find of a running session is allowed.
- b8: account list is open to all role shells, account clear only to the human and the Coordinator. Neither is an MCP tool.
- b9: signed-out is no limited mark in this epic.
- b10: a missing directory refuses the launch, naming the sign-in command.
- b11: the account-limits journal record is kept, written only on change.
T-265 was amended with a Summary, Parent, What to build and single-line criteria. The two-directory demo moves to T-362.

### qa-27 · 2026-10-14T19:34:58.482Z

verdict: qa
result: clear
by: qa-27 [qa]
run: qa-2026-10-14-27-11
commit: ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b

| Case | Result | Evidence and observation |
| --- | --- | --- |
| M0 | PASS | M0.txt and JSON: eight children closed/done, four stages closed, ten ancestors; T-383 merged; T-372 open and outside scope. |
| M1 | PASS | M1.txt: build/runtime, queue, locks and process/load baseline. |
| M2 | PASS | M2.log: accounts 14/14. |
| M3 | PASS | M3.log: Claude accounts 5/5. |
| M4 | PASS | M4.log: Claude adapter 9/9. |
| M5 | PASS | M5.log: limit readings 3/3. |
| M6 | PASS | M6.log: account poller 10/10. |
| M7 | PASS amended | M7.log: one outer isolation test, which asserts the generated inner test. |
| M8 | PASS | M8.log: hard limits 10/10. |
| M9 | PASS | M9-roles.log 2/2; M9-init.log 1/1. |
| M10 | PASS | M10.log: three matched Neovim tests, no skips. |
| M11 | PASS | M11.log: panel-open polling 1/1. |
| PANELS-009 | PASS | Catalogue screen and state captures; exit 0. |
| PANELS-016 | PASS | Catalogue screen and state captures; exit 0. |
| M12 | PASS | Both catalogue cases above. |
| M13 | PASS | M13-source/docs/role-lines: exactly two passive URL references; no account network-call matches; all doc counts exact. Matching sections read in full. |
| M14 | PASS | M14-*: scratch isolation gates; five registry accounts; exactly four sanitized initial polls; one cached refresh; recorder loaded in hub and poll PIDs. |
| M15 | PASS | M15-*: malformed, unknown, conflicting and missing-directory refusals; unpinned launch allowed; no refused rows or extra Codex processes. |
| M16 | PASS | M16-*: seven launches with correct role pin, override and default accounts, matching journal and session rows. |
| M17 | PASS amended | M17-*: every process environment and attach correct; five successful attaches and wrong-directory attach exit 1; two cached version probes. |
| M18 | PASS | M18-*: saved account survives role edit/relaunch; Claude stop/resume on claude-b with no inherited auth. T-372 did not occur. |
| M19 | PASS | M19-window/all: five calls per active directory in 150 seconds; minimum gaps 30,241/30,223 ms; no idle Claude directory, auth or doctor polling. |
| M20 | PASS amended | M20-*: one signed-out notice; zero calls in the paused window; latch held across restart until fake pushed success; first call 375 ms afterward. Original mismatch retained. |
| M21 | PASS amended | M21-*: sparse update adds one record/event; equal full read adds none; Claude unchanged measure silent; changed measure and manual hook visible; refresh polls only idle claude-a once. |
| M22 | PASS amended | M22-amended/block/narrow/meta/folded: six ordered rows, exact colours and reset clocks, live update with list count 0, reopen poll count 1, width/max-width 30, fold persisted. |
| M23 | PASS | M23-*: retryable errors mark none; three hard marks/notices/Coordinator events; duplicate adds none; typed refusals create no processes; one after-hit read each; correct red UI. |
| M24 | PASS amended | M24-*: three marks survive unchanged, all six running sessions re-found; limited relaunch refuses before a process; Claude calls 2/1 in 45 seconds, no short gaps. |
| M25 | PASS amended | M25-*: all three role clear refusals; two hand lifts; reset lift at 19:31:04.007Z, 7 ms after R5; names bold; original-account relaunch succeeds despite 100% reading; clause present; zero hub asks. |
| M26 | PASS | M26-*: 56 default and 53 claude-b agents calls; min 30,185/30,165 ms; eight polls with repeated gaps ≥433,597 ms; zero non-loopback records; all three hubs and seven poll PIDs instrumented; directories confined to scratch. |
| M27 | PASS | M27-*: sessions, hub, Neovim and drivers stopped; every recorded fake PID dead; no forced kill needed; zero shared-lock references; captures preserved and scratch removed. Other crew queue work remains untouched. |

All 59 targeted tests passed, with zero failures and zero skips.

## Findings

- Low — T-437, fake harness gap (M20). `hub stop` / `hubstart` caused the running fake Claude session to answer its reconnect delivery successfully while its `logged-out` input still existed. `fake-claude.ts:108` checks that input for `agents`/`--bg`, not the running session turn. The successful hook at 19:11:27.588Z correctly lifted the latch; the first `agents` call followed at 19:11:27.963Z. This is not a product latch defect. Evidence: M20-first.txt, M20-restart-diagnostic.txt and M20-amendment.txt.
- No high or medium findings. No product defect remains under the authorized brief amendments.

## Brief amendments and observation deviations

1. The request allows one targeted file beside the integrated cover, excludes only the named tracker/planning paths from the final code gate, and recognizes T-383's merged fix. T-434 is not an epic child; its handoff test passed here.
2. M7 expects one top-level test: `account-fixture-isolation.test.ts:14` runs the generated test at line 32 and asserts its success at lines 60–61. Coordinator decision `0c1108c1`.
3. M14's append-only network recorder creates its main file only for a non-loopback attempt. The absent file, with `.loaded` covering all relevant PIDs, means zero attempts. The original `wc` error is preserved. Similarly, M15's absent version-probe file is a zero baseline, unchanged afterward.
4. M17 expects one Codex version probe per distinct account environment, not per launch: `codex.ts:352–363` caches by `JSON.stringify(accountEnv)`. Two homes mean two probes. Coordinator decision `24135c0a`.
5. M20's original restart expectation mismatch is preserved. Under decision `7c7ec5d5` and confirmation `6b0a832e`, the latch survives until the first pushed success; calls after it are expected. M20(g)'s warning is N/A after that lift; its other recovery checks passed. T-437 records the fake gap.
6. M20 and M24 Codex `at` refreshes followed new successful reconnect turns; windows and sources did not change. README permits equal readings to refresh age silently. This is not evidence of lost persistence.
7. M21(d) sent an ISO string `at`, while `cli/hook.ts:103` preserves numeric event times. The brief's payload format was wrong; its fallback reading time was 555 ms later. Windows and hook exit passed. Coordinator decisions `ac8d724b` and `0a84fa87`; no product timestamp finding.
8. M22 startup is Explorer on this build, so the right window is absent. Original helper errors/screens are retained. Navigate to General, leave Insert mode, show sessions, and only then start the observation counter. The amended checks passed without changing their expectations. All later account dumps use explicit output files.
9. M24's “every row running again” means rows that were running before restart; the four deliberately stopped rows correctly remained stopped.
10. M25's helper again landed on Explorer. Two authorized clears occurred before their pre-clear visual was captured; that visual is missing. No marks were restored or extra clears made. Decision `84fc87a4` permits combined evidence: M24's exact three persisted marks plus M25-after-clears-live, which shows persisted claude-b still red after Neovim restart, and codex-a/oc-b cleared with bold names.

## Criterion coverage

| Id | Brief checks |
| --- | --- |
| C1 | M2, M14–M16, M22 |
| C2 | M2–M3, M7, M17–M18, M26 |
| C3 | M5–M7, M11, M13–M14, M21, M26 |
| C4 | M10–M12, M22–M23 |
| C5 | M8, M10, M23–M25 |
| C6 | M3–M4, M19–M20, M26 |
| C7 | M9, M13–M14, M25 |

Final result: clear. All criteria C1–C7 are covered by this run. The final build gate is empty; HEAD and dev remain `ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b`. Evidence includes the scripts actually executed under `driver/`, fake captures under `fakes/`, flushed scratch logs under `scratch/`, and the per-case ledger in `runs.jsonl`.


Build and verdict commit: `ed0ea1b2dbf050c3380daeca03c4b7d8ad09317b`; run `qa-2026-10-14-27-11`. Full evidence: A-2530, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2530-e-272-qa-full-evidence-qa-2026-10-14-27-11` (README.md entry). Marks: verify C1,C2,C3,C4,C5,C6,C7; none failed. All 31 case records are PASS, including amended checks; original mismatch outputs retained.

Required verdict note: A-2531, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2531-e-272-qa-clear-cases-amendments-finding-and-criteria.md`.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
