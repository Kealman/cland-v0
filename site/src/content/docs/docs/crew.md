---
title: Crew configuration
description: Configure roles, harnesses, models, accounts, permissions and staffing in roles.toml and crew.toml, with example crews for different plans.
sidebar:
  order: 8
---

Everything about the crew is configurable: which harness and model each role runs on, which account it uses, how many sessions of each role run, how long they keep their context, who approves plans and how QA works. Two committed files hold it:

| File | Holds |
| --- | --- |
| `.cland/roles.toml` | What each role is: its clause (instructions), skills, launch settings and permissions. |
| `.cland/crew.toml` | How the crew is staffed: one session per item, a pool or a singleton; when sessions stop; which levels get Leads. |

`cland init` writes both from templates built for the harnesses you have. The onboarding Aide sets them with you. After that they are yours: `cland update` never rewrites them.

The hub re-reads both files on change. A file that does not parse is refused with a notice, and the last good version stays in force. New values apply to the next launch; running sessions keep what they launched with.

## Launch settings: `roles.toml`

Each role has a `[<role>.launch]` table. The roles are `coordinator`, `lead`, `implementer`, `reviewer`, `qa` and `aide`.

```toml
[implementer.launch]
harness = "codex"
model = ""            # "" = the harness's default model
effort = "high"
account = "codex-b"   # a name from ~/.config/cland/accounts.toml; "" = the default login
approval = "never"
sandbox = "workspace-write"
```

| Key | Values | Applies to |
| --- | --- | --- |
| `harness` | `claude-code`, `codex`, `opencode` | All |
| `model` | A model id the harness accepts. `""` for its default. | All |
| `effort` | The harness's effort level, for example `high` or `max`. `""` for its default. | Claude Code, Codex |
| `account` | One account name from the registry. `""` or absent for the default login. | All |
| `permissions` | `auto`, `skip`, or `""` | Claude Code |
| `approval` | `never`, `on-request`, `untrusted` | Codex |
| `sandbox` | `read-only`, `workspace-write`, `danger-full-access`, or `""` | Codex |
| `writable_roots` | Extra writable directories, relative to the project root. Needs `workspace-write`. | Codex |
| `network` | `none`, `local`, `full`. Needs a sandbox. | Codex |

Model ids by harness:

- **Claude Code**: `opus`, `sonnet`, `haiku`, or a full model id.
- **Codex**: a GPT model id that `cland models codex` lists.
- **OpenCode**: a `provider/model` string, for example `openrouter/qwen3-coder`. Add `#variant` for a model variant. With `model = ""` OpenCode picks a free model; the free default is `opencode/big-pickle`.

### Set it with commands

You never need to edit the file by hand:

```sh
# The models a harness offers, under a given account
cland models claude-code
cland models codex --account codex-b
cland models opencode --refresh

# Write a role's launch settings
cland role launch implementer --harness opencode --model openrouter/qwen3-coder
cland role launch reviewer --harness claude-code --model sonnet --effort high
cland role launch coordinator --permissions auto

# See every role with its launch settings and holders
cland role list
```

`cland models` caches each list for 24 hours per harness and account; `--refresh` probes again. For Claude Code it returns the aliases `default`, `sonnet`, `opus` and `haiku`.

### Per launch

Any launch can override the role's settings for one session:

```sh
cland session launch impl-43 --role implementer --item T-43 --harness claude-code --model sonnet
```

The workbench launcher (`l` in the sessions panel) has the same fields; `C-n` and `C-p` on the model field cycle the harness's model list.

## Permissions

How much a session may do without stopping to ask you is part of the role.

**Claude Code** roles take `permissions`:

| Value | Behaviour |
| --- | --- |
| `auto` | The default. Launches with `--permission-mode auto`: Claude Code's auto mode decides which tool calls need your approval. |
| `skip` | Launches with `--dangerously-skip-permissions`: no permission prompts at all. |
| `""` | Your own Claude Code permission settings for the project. |

Permissions are never off by default. `skip` is a conscious choice: make it for a machine and a project where an agent with no prompts is safe. The onboarding Aide asks you, explains the trade-off and records your answer.

**Codex** roles never stop for approval (`approval = "never"`). The sandbox is the guard, per role:

| Role | Default sandbox |
| --- | --- |
| Reviewer | `read-only`: it reads, it never edits. |
| Implementer | `workspace-write`: its own worktree and the temp directory. |
| QA | `danger-full-access`: it runs the product. |
| Aide | `workspace-write` |

With `network = "local"`, a sandboxed session reaches the hub, local sockets and loopback, and nothing else.

**OpenCode** keeps its own permission settings.

Approvals a harness asks for stay in that harness. A session waiting on one shows in your inbox with the command; attach to the session to answer. Codex and OpenCode approvals can also be answered from the [web workbench](/docs/web-and-phone/).

## Staffing: `crew.toml`

```toml
leads = []          # container levels that get their own Lead, e.g. ["epic"]
idle_from = []      # categories the Coordinator takes work from when the release is idle

[crew.coordinator]
policy = "singleton"
heartbeat = "1h"
subagents = true

[crew.implementer]
policy = "per-item"
stop_after = "merge"

[crew.reviewer]
policy = "pool"
size = 1
keep_context = true

[crew.qa]
policy = "singleton"

[crew.aide]
subagents = true
```

| Key | Values | Meaning |
| --- | --- | --- |
| `policy` | `per-item` | A fresh session for each item. |
| | `per-group` | One session per lane of the epic plan, taking the lane's tasks in turn. |
| | `pool` | Up to `size` reusable sessions. A launch takes an idle member first. |
| | `singleton` | Exactly one. |
| `size` | Positive integer | The cap for a pool, or for `per-item` and `per-group`. |
| `keep_context` | `true`, `false` | Reuse a session's conversation across items, or start fresh each time. |
| `stop_after` | `merge`, `never` | Stop the session when its item merges, or keep it. |
| `subagents` | `true`, `false` | Whether the role may delegate to sub-agents inside its harness. Their cost counts to the session. |
| `heartbeat` | A duration such as `30m`, `1h`, or `off` | How often the hub sends the session a digest of what is in flight and stale. |
| `leads` | A list of container kinds | Levels of the item tree that get a dedicated Lead session. Empty is a flat crew. |
| `idle_from` | A list of category ids | Categories whose tasks the Coordinator takes, in order, when the release has nothing unblocked. Empty means never. |

The hub enforces the policy at launch: a launch beyond `size`, or a second singleton, is refused.

Change it with commands:

```sh
cland crew show
cland crew set reviewer.size 2
cland crew set implementer.keep_context true
cland crew set coordinator.heartbeat 30m
cland crew set leads '["epic"]'
cland crew set idle_from C-2
```

### Growing the crew

A project starts flat: the Coordinator leads everything. When it saturates, add a level of Leads:

```sh
cland crew set leads '["epic"]'
```

The Coordinator then launches one Lead per open epic. Each Lead plans its epic, launches its Implementers, requests review and QA, and merges its own tasks. Questions travel up one level at a time; only the Coordinator asks you.

## Plan approval

By default the Coordinator or the epic's Lead writes each epic's plan and starts work; you are notified. To approve every plan yourself:

```sh
cland config set plan.approval human
```

Then no Implementer starts on an epic until you approve its plan: open it with `gp` on the epic and press `a`, or approve it from the inbox's plan section. Set it back with `cland config set plan.approval none`.

QA for tasks outside any plan comes from the same table:

```toml
[plan]
approval = "none"
qa_default = { scope = "none", when = "per-item" }
```

`cland config set` validates the value, saves it into `.cland/config.toml` and says whether it applies now or at the next hub start.

## Example crews

### Mixed plans

A Claude plan and a ChatGPT plan. The strong model leads; review runs on another harness than the implementation, so one model's blind spots get a second look.

```toml
# roles.toml
[coordinator.launch]
harness = "claude-code"
model = "opus"
effort = "max"
permissions = "auto"

[implementer.launch]
harness = "codex"
model = ""            # the Codex default GPT model
effort = "high"
sandbox = "workspace-write"

[reviewer.launch]
harness = "claude-code"
model = "sonnet"
effort = "high"
permissions = "auto"

[qa.launch]
harness = "codex"
model = ""
effort = "high"
sandbox = "danger-full-access"

[aide.launch]
harness = "claude-code"
model = "opus"
```

```toml
# crew.toml
[crew.implementer]
policy = "per-item"
size = 4
stop_after = "merge"

[crew.reviewer]
policy = "pool"
size = 2
keep_context = true
```

### One Claude subscription

One plan, two models: `opus` leads and plans, `sonnet` does the work.

```toml
# roles.toml
[coordinator.launch]
harness = "claude-code"
model = "opus"
effort = "max"

[implementer.launch]
harness = "claude-code"
model = "sonnet"
effort = "high"

[reviewer.launch]
harness = "claude-code"
model = "sonnet"
effort = "high"

[qa.launch]
harness = "claude-code"
model = "sonnet"

[aide.launch]
harness = "claude-code"
model = "opus"
```

```toml
# crew.toml
[crew.implementer]
policy = "per-item"
size = 2
stop_after = "merge"

[crew.reviewer]
policy = "pool"
size = 1
keep_context = true
```

Keep `size` low on a single subscription: every session draws on the same 5-hour and weekly windows. Watch the Accounts meters for a few days and raise it if there is room.

### Budget: open models for the legwork

A paid model for the Coordinator and review, open models through OpenCode for implementation.

```toml
# roles.toml
[coordinator.launch]
harness = "claude-code"
model = "sonnet"
effort = "high"

[implementer.launch]
harness = "opencode"
model = "openrouter/qwen3-coder"   # needs OpenRouter credentials in cland's OpenCode database

[reviewer.launch]
harness = "codex"
model = ""
sandbox = "read-only"

[qa.launch]
harness = "opencode"
model = "openrouter/qwen3-coder"
```

Sign OpenCode in to your provider through cland's database: `cland doctor` prints the exact `opencode auth login --standalone` line. With `model = ""` OpenCode uses a free model and needs no login at all.

:::caution
Free OpenCode models may train on the code they see. `cland doctor` names every role this affects.
:::

### Minimal

One harness, no QA role, the smallest crew that still reviews every change.

```toml
# roles.toml
[coordinator.launch]
harness = "claude-code"

[implementer.launch]
harness = "claude-code"

[reviewer.launch]
harness = "claude-code"
```

```toml
# crew.toml
[crew.implementer]
policy = "per-item"
size = 1
stop_after = "merge"

[crew.reviewer]
policy = "pool"
size = 1
keep_context = true
```

Keep `[plan] qa_default` at its default, `{ scope = "none", when = "per-item" }`, and ask the Coordinator for plans without QA stages: tasks then merge on a clear review alone. Review stays mandatory for every merge. Add a QA session when there is something to run.

## Shaping a role

The six roles are fixed: the hub knows what each may do. What you change is how each one works:

- **`clause`**: the role's instructions, delivered to every holder at assignment and on every reconnect. Add your own lines, for example a Reviewer that checks every change against your security checklist.
- **`skills`**: the skills the holder is pointed at, from `.agents/skills/`. Add a skill of your own to the folder and list it here.
- **`[<role>.permissions] tools`**: the hub tools the role may call. Leave it out to get the built-in list.

```toml
[reviewer]
skills = ["code-review", "security-review"]
clause = """
You are a Reviewer: you review changes when the item's lead or the Coordinator asks and return a verdict. You read; you never edit.
- Check every change against docs/security.md before a clear verdict.
"""
```

Rules that apply to several roles belong in the [rulebook](/docs/concepts/#rulebook) instead: the hub adds a role's rules to its clause.

For a second flavour of the same role, launch named sessions with per-launch overrides: a `rev-deep` Reviewer on `opus` beside a pool of `sonnet` Reviewers, for example.

```sh
cland session launch rev-deep --role reviewer --harness claude-code --model opus
```

## Assigning roles by hand

The Coordinator and the Aide launch sessions for you. You can also do it directly:

```sh
cland session launch impl-42 --role implementer --item T-42 --brief "Implement T-42 and report to the Coordinator."
cland role set my-session reviewer      # give an existing session a role
cland role clear my-session             # take it away
cland role set session-2 coordinator --note-file handover.md   # move the Coordinator with a handover note
```
