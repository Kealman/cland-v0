# Review and QA through the roles

How a change gets reviewed and checked in slice 1 (spec 4.10 and 6 (g), ticket #41). The roles, their clauses and their permissions are in `.cland/roles.toml` (`hub/src/roles/default-roles.ts` writes the defaults); the tracker's verdict comments are in `hub/README.md`, "The tracker".

## The flow

1. The Coordinator has an item, say `T-12`, whose work is ready: a branch, commits or a diff.
2. It sends a request through the hub to the session holding the role: `send` with `to: ["reviewer"]` (or `["qa"]`, or the holder's name). When no holder is live, it launches one first with `session.launch` and the role; `roles.toml` gives the harness and the model (Reviewer: Codex with `gpt-6.1-sol`; QA: Codex with `gpt-6-astra`), and the first turn is the role's clause.
3. The holder works as its clause says:
   - Reviewer: reads the item with `task.view`, then the changes the request names, read-only, against the spec and the acceptance criteria. It edits nothing.
   - QA: reads the item, then runs shell-level checks, the `cland task` CLI, and where UI is involved a headless Neovim fed with `nvim_input` and read with `screenstring()`. It fixes nothing.
4. The holder writes its verdict on the item with one `task.comment` (`verdict`, `result`, `run`); the hub adds `by` and writes the header.
5. The holder reports back with `send` to the Coordinator, in the request's topic.

Only Reviewer and QA (`task.comment:verdict`) and the Coordinator (`task.comment`) may write a verdict. Anyone else gets the typed error `forbidden: task.comment:verdict (<Role> may not write verdicts)`, and the refusal shows in Agents.

## The messages

The request's first line is conventional, so the UI can style it later; the rest is free text:

```
review request T-12
Branch impl/t-12, commits a1b2c3..d4e5f6. Check the acceptance criteria of T-12 and spec 4.7; tests are in hub/test/tracker.test.ts.
```

```
qa request T-12
On branch impl/t-12: `cland task list --state open` lists T-12, and the items panel in a headless Neovim shows it.
```

The report's first line is the verdict and the item, then the points that matter:

```
review not clear T-12
High: hub/src/tracker/tracker.ts:212 a closed item keeps its claim.
```

## The verdict

A comment on the item whose first lines are the header, then the findings ranked by severity (high, medium, low), each with file:line, or for QA the command and what it showed:

```
### rev-1 · 2026-10-08T12:38:26.729Z

verdict: review
result: not clear
by: rev-1 [reviewer]
run: rev-2026-10-08-1

- high: hub/src/tracker/tracker.ts:212 a closed item keeps its claim.
- low: hub/README.md:440 the example lacks `--run`.
```

`verdict` is `review` or `qa`, `result` is `clear` or `not clear`, `by` is the session with its role (the hub writes it), `run` is the writer's id for that pass. A later verdict of the same kind supersedes the earlier one.

## Where the verdict shows

- `cland task view T-12` (and `task.view`) lists each comment, verdicts as `[verdict review: not clear, by rev-1 [reviewer], run rev-2026-10-08-1]`, and returns `verdicts` in `--json`.
- `cland task list --verdict review=clear` (or `qa="not clear"`, and `task.list` with `verdict`) lists the items whose latest verdict of that kind matches.
- The item view in the Neovim UI (ticket #36) shows the verdicts in its own section, and the board shows the latest verdict of each kind on the card ("review clear", "qa not clear", red for not clear). Until #36 lands, the CLI is the display.

## The fallback

When the role session is unavailable (none can be launched, it died, or it does not answer), the Coordinator runs the same brief through `/codex:rescue`:

- review: `/codex:rescue --wait --fresh --model gpt-6.1-sol <brief>`, read-only;
- QA: `/codex:rescue --wait --fresh --model gpt-6-astra <brief>`; long runs go `--background`, then `/codex:status` and `/codex:result`.

Outside Claude Code the same run is `node <codex plugin>/scripts/codex-companion.mjs task --model gpt-6.1-sol "<brief>"`. The Coordinator then records the verdict itself, in the same shape: `task.comment` with `verdict`, `result` and `run` set to the rescue job id, and the text saying it came through `/codex:rescue`. A rescue run declines every approval, so QA through it keeps to what needs none: shell checks and the one-process headless Neovim (no `--listen`; the sandbox refuses sockets).
