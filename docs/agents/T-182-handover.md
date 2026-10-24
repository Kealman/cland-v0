# T-182: launches follow the crew

<!-- cland-allow-closed-wording: pending launches and reservation describe runtime state; T-211 identifies the handoff owner -->
Launch admission enforces crew caps alongside role exclusivity, counting running sessions, live spokes, pending launches and supervised failed-launch cleanup. A retained Reviewer/QA pool runs from the project root and returns an idle member's actual name and stable native identity for the next item. Reuse checks current holds, deliveries and lifecycle work, delivers text or artifact briefs, and records the handoff in the journal and Agents topic. A handoff without a brief is reserved until ordinary addressed work reaches that member. Other roles reuse only matching working directories; Implementer pools return an explanatory launch note and remain capped. T-211 owns worktree handoff.

Successful merge follow-up stops the item's launched per-item sessions when their current `stop_after` is `merge`, before pruning. A failure preserves the landed commit and reports the stop as a follow-up to retry. Pool, per-group and `never` sessions remain running. Crew reload appends updated sub-agent instructions to live role clauses, with `leads` staffing instructions for the Coordinator. Native first-turn clauses use the same source.

`cland update` preserves an existing `.cland/roles.toml`. This task changes exactly line 46 in this project's `[coordinator]` clause (the stanza and old text identify it if concurrent work shifts line numbers). Replace:

```text
- Only you launch Leads: use `session.launch` with role `lead` and `item` naming an open configured container. One Lead holds each node, and a Lead runs at the project root.
```

with:

```text
- Follow the staffing instructions appended from `crew.toml`: launch Leads for its `leads` levels with `session.launch`, role `lead` and the open container as `item`. Use the returned session name when a launch reuses a pool member. One Lead holds each node and runs at the project root.
```

The same sentence is shipped in `hub/src/roles/default-roles.ts`. No other `.cland/roles.toml` lines change. The hub appends current crew values at delivery; projects do not copy policy values into their role file.

Protocol/fake-harness coverage is in `hub/test/crew-launch.test.ts`: two retained Reviewers, a third-launch refusal, idle reuse with unchanged native identity, unbriefed handoff reservation, concurrent singleton/per-item caps, failed-slot recovery, live clause updates, Codex native first-turn instructions, and merge stop/never behavior. The existing subscription recovery fixture declares Reviewer size two because it runs one direct spoke and one native watcher concurrently. No Neovim UI changes are needed.

Review correction: initial launch validation and pool selection enter the request resumer within Sessions itself, including when TaskWorktrees starts the launch after awaited preparation. New-launch admission resumes measurement after checking pool reuse; merge-stop process scans and each sequential stop initiation also enter the request resumer. Selection and post-await revalidation share one reuse eligibility helper. `hub/test/launch-admission.test.ts` checks these measured continuations through actual Tracker/TaskWorktrees item preparation, invalid-cwd admission and two awaited stops. The item-bound regression failed before the initial launch correction and passes afterward.

Full-suite fixture correction: Sessions stand-ins declare that they are not retained pools. The Codex profile comparison uses a two-member QA pool, and the Lead permission fixture declares two Reviewer slots for its direct verdict writer and launched verifier. Coordinator launch assertions check the crew singleton refusal and holder; role-assignment assertions still check exclusivity. Three deferred-cleanup fixtures set `implementer.stop_after = "never"` so their sessions survive merge until the explicit stop, retaining the branch-switch and moved-tip preservation checks. The crew-launch tests independently cover automatic stop after merge.
