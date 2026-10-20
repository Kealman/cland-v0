---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
metadata:
  origin: "mattpocock/skills skills/engineering/implement at 6d6a5b90; MIT, Copyright (c) 2026 Matt Pocock"
  changes: "model-invocable (Init); hub review request (T-226); review before verify (D25, T-322); Codex invocation follows frontmatter (T-621); test levels (D53); shell item topic creation (T-951); claimant done marks (T-958); repository static membership gate (T-959); queued budget fallback reclaim (T-561); release receipt identity/provenance (T-950); send recipient shape (T-966); sealed child-launch guard (T-962)"
---

Implement the work described by the user in the spec or tickets.

If the user passes a ticket reference, fetch it from the issue tracker and state its title before starting. If the reference is ambiguous, ask.

Call the Skill tool with "tdd" where possible, at pre-agreed seams.

Before writing or changing a test, read "Test levels" in `docs/agents/tests.md` and put each test at the lowest tier that proves its behaviour: no new real process without a lifecycle reason, and no wall-clock waits.

For native child launches in `hub/test`, use the complete `fixtureEnvironment`
or `accountFixtureEnvironment` result after explicit owned extras. Fresh runner
children use `runnerFixtureEnvironment` to filter inherited paths while keeping
execution/admission controls. Read the T0
child-environment guard scope in `docs/agents/tests.md`; intentional seams need a
nearby `cland-allow-child-env` comment naming the sealing owner or native contract.
Run the guard's `--inventory` when reviewing exemptions. It prints no environment
values.

Run typechecking and targeted single test files while implementing. In a hub session, run the full suite only after a clear source review, as described below; outside the hub, run it once at the end.

When changing dictionary membership or prototype checks in this repository's
`hub/src`, read the T0 dictionary guard scope and exemption rules in
`docs/agents/tests.md`.

Once done, request the hub Reviewer as described below; outside a hub session, use the "code-review" skill.

Commit your work to the current branch.

In a hub session, use the claimed item's existing topic; if it has none, open it with `cland topic create "<title>" --item T-<n> --json` or the `topic.create` tool. An Implementer may open only its own item's topic.

In a hub session, mark every acceptance criterion done with `cland task criterion T-<n> done C<n>` before requesting the final review. Read `task view` for the criterion ids. Done marks are separate from Reviewer/QA verification; ready needs both. If only done marks are missing, the hub notices the claimant in the item topic, repeating only when that claimant’s missing set changes. A replacement claimant receives its own first notice.

The `send` tool accepts `to` as one recipient string or an array of strings (`string | string[]`); for review, use `to: "reviewer"` or `to: ["reviewer"]`. Other shapes are validation errors; omitted `to` or `[]` addresses the human.

In a hub session, set your claimed item to `review` and send `review request T-<n>` to `reviewer` in the item's topic with the committed branch/head and criteria. Inspect the send outcomes: `resolvedTo` names the selected Reviewer; a `queued` outcome waiting for the next free verifier means the hub will assign it automatically and send you an assignment or refusal notice. Wait for that notice instead of resending the same request. A refusal names the retry rule. When no verifier is live, report the staffing blocker to `lead T-<n>` so it can launch one; the queued request remains pending.

Before requesting review, fetch and merge `origin/dev`, then commit and push the head to review. After a clear source verdict, run `cland verify` at the exact reviewed head and wait for its hub result. A fix or later merge that changes the head needs a new review before a new run. An unchanged head may reuse an earlier green run through the tree-hash cache. The Reviewer settles the final verdict when the same-head result arrives; see `docs/agents/tests.md`.

A verify queued locally after a remote-budget fallback can reclaim a free remote slot in its original queue order, including after a hub restart; the hub reports the move in its topic. Wait for that request rather than resubmitting. Explicit `--executor local` stays local.

Cache evidence names the original occasion and executor. Release reuse requires
full matching coverage on the effective executor/OS, including configured defaults;
a local macOS stage receipt cannot satisfy a droplet release request. See
`docs/agents/tests.md` for receipt identity and provenance.
