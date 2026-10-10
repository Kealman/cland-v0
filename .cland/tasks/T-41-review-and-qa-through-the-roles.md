---
id: T-41
kind: task
title: Review and QA through the roles
state: closed
status: done
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-26
  - T-30
  - T-35
topic: null
branch: null
created: 2026-10-08T11:55:49Z
updated: 2026-10-10T00:58:17.488Z
github:
  repo: Kealman/cland-v0
  number: 41
  url: https://github.com/Kealman/cland-v0/issues/41
---

## Parent

Part of #19. Spec sections 4.10 and 6 (g); decisions https://github.com/Kealman/cland-v0/issues/10 (addendum), https://github.com/Kealman/cland-v0/issues/6 and https://github.com/Kealman/cland-v0/issues/16; research `docs/research/qa-astra.md` on branch `research/qa-astra`.

## What to build

The Coordinator requests a review or a QA pass through the hub: a message to the session holding the Reviewer role (Codex with gpt-6.1-sol by default) or the QA role (Codex with gpt-6-astra) naming the item and what to check; the role's clause tells it how to work and to record its verdict as a structured comment on the item (`verdict: review | qa`, `result: clear | not clear`, `by`, `run`), which the item view and the board show. QA in slice 1 checks what it can without the QA lane: shell-level checks, the `cland task` CLI, and a headless Neovim driven by `nvim_input` with `screenstring()`. `/codex:rescue` remains the documented fallback for both. The role clauses for Reviewer and QA are written and shipped in `roles.toml` defaults.

## Acceptance criteria

- [ ] A review request from the Coordinator reaches a real Codex session holding Reviewer; its verdict comment lands on the item with the structured header; the item view shows "review clear" or "not clear"
- [ ] The same for QA with astra, including one headless Neovim check in its run
- [ ] A verdict written by a session not holding the role is refused by the hub
- [ ] The fallback path through `/codex:rescue` is documented in the Reviewer and QA clauses and tried once
- [ ] The run is recorded in a comment on this ticket with the item used

## Comments

### Kealman · 2026-10-08T15:36:56Z

<!-- github-comment: 6063465993 -->

## Real run: review and QA through the roles (2026-10-08)

Branch `worktree-agent-af75ae59273c8a863` (not pushed), on top of #30's tip `6c6e3fb`. Commits: `b6782ee` tests and the fake Codex's scripted review/QA mode, `1f806d1` the Reviewer, QA and Coordinator clauses, `9a5f013` `docs/review-and-qa.md`, `8c96490` the forged-verdict fix the fallback review found.

### Setup

- A temp project `…/scratchpad/rqa` (no `cland init` on this base, so `cland hub start`, which wrote `roles.toml` with the new clauses), `cland` on the PATH through a shim to the branch.
- Item **T-1** "Review and QA smoke: the cland task CLI": check `cland task list --state open` and `cland task view T-1`; a headless Neovim running the workbench shows General; review commits `6c6e3fb..9a5f013` of this branch against #41.
- The Coordinator: a scripted spoke `coord` holding Coordinator (not a Claude Code session), sending one request each.
- `cland session launch rev --role reviewer` → Codex 0.160.0, `gpt-6.1-sol`, effort high (from roles.toml; clause as the first turn, idle after ~30 s).
- `cland session launch qa-1 --role qa` → Codex, `gpt-6-astra`, effort high.

### Review (criterion 1)

- 15:22:53 `send {to: ["reviewer"]}`: `review request T-1` + the brief. Reviewer used `task.view`, read the diff read-only, wrote the verdict, reported back.
- 15:25:01 report in Agents, **128 s**:
  > review clear T-1
  > No high or medium findings; verdict rev-2026-10-08-1 is on T-1. One low docs issue: branch examples at docs/review-and-qa.md:23/:28 conflict with ADR 0004's t/<id>-<slug> convention. …
- On T-1: `rev · 15:24:59  [verdict review: clear, by rev [reviewer], run rev-2026-10-08-1]`, with findings ranked by severity and file:line. The low finding is fixed in `8c96490`.
- Tokens (`thread/tokenUsage`, clause turn + review): 917,739 total (844,800 cached input), 3,601 output. Account weekly limit 11% used after.

### QA (criterion 2)

- 15:25:26 `send {to: ["qa"]}`: `qa request T-1` + the brief.
- astra ran `cland task list --state open; cland task view T-1` in its sandbox: **EPERM** on the hub's Unix socket (as #16 predicted). It then asked for an escalation to run them outside the sandbox (`waiting for approval`, seen by the hub). **Declined**: I attached (`codex resume --remote …`; the TUI first offered a 0.161.0 update, skipped, then asked for **folder trust, accepted**, which saved a trust entry for the temp folder in `~/.codex/config.toml`), chose "No", which interrupted the turn, and typed one message telling it to continue in the sandbox with the task tools and a one-process headless Neovim. No approval was granted.
- 15:30:28 report, **300 s** from the request (including the decline):
  > qa clear T-1
  > Recorded qa-2026-10-08-1 on T-1. CLI list/view hit sandbox socket EPERM; the authorized task.list/task.view fallback confirmed T-1 open and its details. One in-sandbox Neovim 0.12.5 process (no --listen) fed nvim_input and read screenstring(): General and its composer appeared, exit 0. Limitation: the workbench also showed hub EPERM, so this verifies disconnected rendering, not live history/session data. No fixes made.
- The headless Neovim check it ran: `NVIM_APPNAME=cland …/nvim --clean -i NONE -u <branch>/nvim/init.lua --headless -c 'lua <probe>'`; the probe set 160×45, `nvim_input("<Esc><Space>g")`, read every cell with `screenstring()`, and would `cquit 1` if General were absent. The grid had "cland rqa | General", "No messages in General yet.", "Message General… Enter sends · Shift+Enter newline", and "cannot reach the hub: EPERM".
- Tokens: 612,316 total (520,960 cached input), 3,229 output. Weekly limit 12% used after.

### The fallback (criterion 4)

- `node …/codex-companion.mjs task --fresh --model gpt-6.1-sol "<the same review brief>"`, from the branch worktree: job `task-muzos71y-0htphy`, thread `01a11c1c-fb1b-72d3-b341-9f2a320b02c4`, **2 min 31 s**.
- Result **not clear**:
  - high: hub/test/review-qa.test.ts:158 refusal coverage misses plain-text verdict headers: an Implementer commenting on its own item can forge an indexed verdict, bypassing the role check.
  - medium: hub/test/review-qa.test.ts:104 the QA text in the test is fixture text; no Neovim check runs there.
- The Coordinator recorded it: `cland task comment T-1 "<findings>" --verdict review --result "not clear" --run task-muzos71y-0htphy --as coord --role coordinator` → `coord · 15:29:14  [verdict review: not clear, by coord [coordinator], run task-muzos71y-0htphy]`.
- The high finding was real, and is fixed in `8c96490`: a `task.comment` whose text reads back as a verdict header now needs `task.comment:verdict`. The test reproduced it first, with an Implementer on its own item and a forged `by: rev [reviewer]`. The medium is by design: the fake test proves the plumbing, and this real run is the Neovim evidence.

### Wrong role (criterion 3)

Covered by `hub/test/review-qa.test.ts` against a real hub. An Implementer Codex (fake) is sent review and QA requests. Its `task.comment` verdicts get `forbidden: task.comment:verdict (Implementer may not write verdicts)`, with the notice in Agents. A plain-text forged header on its own item is refused the same way. Not run live.

### Final state of T-1

```
--verdict review=clear       no items          (the latest review verdict is the fallback's "not clear")
--verdict review=not clear   T-1
--verdict qa=clear           T-1
```

### Not met / deviations

- "the item view shows review clear / not clear": the Neovim item view and board are #36. Today the display is `cland task view` and `task list --verdict`, shown above.
- No `cland init` on this base; `cland hub start` wrote roles.toml.
- The Coordinator was a scripted spoke, not a Claude Code session.
- `by` reads `<name> [<role id>]` (`rev [reviewer]`), as the hub writes it, not `[Reviewer]`.
- `task.comment:verdict` does not distinguish kinds: a Reviewer may write a `qa` verdict. Left as is (permissions.ts belongs to #30).

### Kealman · 2026-10-08T16:19:42Z

<!-- github-comment: 6064242371 -->

Done on main (b6782ee..8c96490, merged at 6487a36): Reviewer, QA and Coordinator clauses with the request/verdict/report/fallback protocol, docs/review-and-qa.md, tests with a scripted fake Codex, a forged plain-text verdict refused; real runs recorded in the issue: review on gpt-6.1-sol (clear, 128 s), QA on gpt-6-astra with a headless Neovim check (clear, 300 s), the /codex:rescue fallback (not clear: it found the forged-verdict hole, fixed). Open: the item view display of verdicts is #36 (now merged); verdict kinds are not checked against the role (a Reviewer may write a qa verdict).
