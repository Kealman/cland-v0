---
name: plan-epic
description: Draft or revise a cland epic's ordered stages, parallel lanes and QA policy before launching its work.
---

Lane order uses `follows` between epics, separate from `blocked_by`. A follow is met when its predecessor closes, or has task children all closed with its last ticket merged. When every ticket of the predecessor’s last stage is in review, cut the following epic’s tickets with `to-tickets` and write its `plan-epic`; launch the first stage on the last merge once blockers are closed and follows met. The predecessor’s QA demo runs in parallel. Until either demo verdict is recorded or the predecessor closes, the merge gate holds follower tickets whose diff overlaps files changed by that predecessor’s merges on dev; tickets with no overlap can merge.

Run as the Coordinator or the epic's claimed Lead. The plan belongs to the configured second container level (`tracker.levels[1]`, normally epic).

Read `cland task view T-<epic> --json`, `cland task list --under T-<epic> --json` and `cland crew show --json`. View every task to read its criteria and blocking edges. Read `.cland/config.toml` for `[plan] approval` and `qa_default`. Existing plans, merged work and stage QA verdicts constrain a revision.

When cutting tasks, assign a size (XS, S, M or L) with `--size`, write a `## Summary` of one to three sentences and set `--regression-of T-n` for rework of landed tasks.

Split each L task into 2–3 M tasks before planning it. If the Coordinator keeps an L task, record its reason with `--allow-large <id>=<reason>` when setting the plan, repeated for every L task. XL tasks must be split before filing.

Draft ordered stages of parallel lanes. Include every remaining task exactly once. Within a lane, order dependencies before their dependants; dependencies between lanes belong to earlier stages. External blockers stay visible as prerequisites, never become lane members. Detect cycles and report them to the supervising Lead before setting a plan. Match the available crew: `per-group` means one Implementer session takes the whole ordered lane; `per-item` means a fresh session per item; pool and singleton policies retain their caps. Every epic gets a plan, including a single stage when that fits.

For a first draft, run `node <this-skill>/draft.mjs T-<epic> --scope affected --when after-stage > plan.yaml`. It reads the tracker and crew, orders dependencies and emits YAML without writing an item. Set the stage names, lane grouping and QA policies to suit the epic's observable demos. Use `none` only for work covered by review; `affected` for the touched user surfaces; `full` for the whole epic demo. Choose `per-item` when QA must gate each merge; `after-stage` when integrated QA on dev can close the stage after its Linux cover and any named targeted macOS receipt. Read each task's criteria and add stable ids needing QA to `items.<id>.qa_criteria`; per-item `qa` overrides are available too.

The accepted schema is:

```yaml
stages:
  - name: schema and CLI
    qa: { scope: affected, when: after-stage }
    lanes:
      - [T-55, T-57]
      - [T-58]
  - name: panels
    qa: { scope: full, when: per-item }
    lanes:
      - [T-63]
items:
  T-63:
    qa_criteria: [C1]
```

Set with `cland task plan set T-<epic> --file plan.yaml --json`, then show it with `cland task plan show T-<epic> --json`. Completion means the hub accepted the plan and every remaining task, dependency, QA criterion and crew constraint is accounted for. Share the accepted plan and rationale through `artifact.create` in the epic's topic. A revision explains the reason and preserves merged items and closed stages.

With `approval = "human"`, hold the epic's Implementer launches until `show` reports `approval.state = "approved"`. The human approves with `a` in the plan view (`gp`) or `cland task plan approve T-<epic>`; an Aide may approve on the human's behalf. The Coordinator and Lead draft plans but cannot approve them. A changed plan needs renewed approval. With `approval = "none"`, approval is not required; notify the human through the usual watch report.

Once approval permits work, the hub sets the first current stage's open backlog tasks to `planned` and advances the next stage after landing and any required stage QA. Each task moves once per stage entry; keep hand statuses as they are. Launch only the current stage. For `per-group`, give each lane session its ordered ids, keep it alive through that lane's merges, and send its next item with the new task worktree path after the previous merge. Close the current stage's merges and any after-stage QA before starting the next stage. Stage order is carried by role clauses, rather than a hub scheduler.

Stage completion also counts evidence-only tasks: closed `done`, no branch, no landing receipt and no `Item:` trailer on dev. Tasks with a branch still need a dev landing receipt, even if their branch has no commits. Evidence-only completion keeps the stage's QA and platform-cover requirements.

<!-- cland-workflow-change: T-1892 move full macOS cover to epic DoD -->
Every `after-stage` stage, including `qa.scope: none`, needs a green Linux droplet stage full cover. Add optional `macos: [<repository test paths>]` for targeted macOS checks; plan set refuses unknown or duplicate paths. Such a stage also needs an exact-path targeted macOS receipt at the Linux tree. A non-none QA scope adds clear stage QA there. The Coordinator runs Linux `cland verify all --occasion stage`, then local `cland verify all --occasion stage --executor local --stage <epic>` when paths are named. Repeat `--stage` to union several epics' current open stages at one tree; MCP uses `stages`. Omit it for a full local run. Keep advancement held until `task plan show` reports closed. Epic DoD separately requires a macOS full cover at its DoD tree. Per-item gates are unchanged. See [close runs](../../../docs/hub/running.md#close-runs).

## Coordinator epic sequencing

- `follows` orders epics apart from `blocked_by`. Start after blockers close and follows are met: predecessor closed, or its task children all closed and last ticket merged. Until its demo verdict or closure, hold follower merges overlapping its merged files on dev. When every last-stage ticket is in review, cut the next epic with `to-tickets` and `plan-epic`; launch its first stage on the last merge while the demo runs.

## Coordinator stage procedure

- Before an epic, run `plan-epic` and `task.plan show`; await configured human/Aide approval before launches. Finish stage merges and after-stage QA before advancing. Per-group lanes keep one session and ordered ids across task worktrees until lane end; stop_after merge applies then.
- Before an epic, run `plan-epic` and `task.plan show`; await configured human/Aide approval before launches. Finish stage merges and after-stage QA before advancing. Per-group lanes keep one session and ordered ids across task worktrees until lane end; stop_after merge applies then. Follow other `crew.toml` policies.
