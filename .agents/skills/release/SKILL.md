---
name: release
description: Release a human-chosen version, publish marketing commits outside a release, or recover pending publication.
---

The Coordinator performs this skill from its own shell. **Never delegate a release to a sub-agent:** a sub-agent in the Coordinator's shell inherits its authority. The human may also run `cland release` from their own shell.

Use `cland release --help` (or `-h`) for usage without a hub or Git/network
work; sync, publish, push and merge accept the same help flags. Release, sync
and publish share the release usage block.

A release-version item updates the root package version and both lockfile version fields together, and proves `--version` in a sealed disposable copy under rule 15 (A-8634 R15; T-967).

For `cland verify all --occasion release`, receipt reuse requires full matching
coverage on the effective executor and OS, even with a configured default. A
local macOS stage receipt cannot satisfy a droplet release request. Read the
cache notice's original occasion/executor; `--fresh` forces execution. See
`hub/README.md`, Verification commands, for the shared identity contract.


For committed `[release] web_bundle = true` (cland product only), the release
machine needs installed, already-authenticated gh and network access for locked
build dependencies. Dry-run checks gh before approval, builds/caches the pinned
commit and names repo, tag, archive/checksum filenames, byte sizes and SHA-256.
Include all those facts in step 3’s single approval. Generated/older configs default
to false. Publication creates a draft as needed, uploads and reads back both
assets, then publishes it. On `web-bundle` follow-up failure, preserve
`release.tmp` and `.cland/release-web/`, repair the obstruction, and retry the
same item/version. Never clobber conflicting remote assets or start a new login.
See [Web release assets](../../../hub/README.md#prebuilt-web-release-assets).

For a configured `[release.homebrew] tap`, include the preview's tap repository,
`main`, `Formula/cland.rb`, version and exact tag archive URL in step 3's approval.
The preview states SHA-256 follows download after the product push. That one
approval covers the formula for the approved tag URL; no second approval follows
hashing. An empty tap reports skipped. The human creates the tap first. See
[Homebrew publication](../../../hub/README.md#homebrew-formula-publication) for
receipt/retry semantics; final output and item comment include SHA and tap commit.

For approval before readiness work finishes, use [Conditional release approval](#conditional-release-approval) before step 2's final dry run. Complete all preflight steps before publication.

1. Work in the project root on `dev`. Read the current release item with `cland task view T-n --json` and use or open its bound topic. The current release is the open top-level item with the lowest semver version. Commit outstanding tracker and docs changes on `dev`, keeping unrelated staged work out of that commit, and publish them to the territory with `cland push` from your own shell. Resolve any fast-forward refusal before releasing. The default branch is `main` unless the territory records another in `cland.defaultBranch`. Release includes all committed work between the default branch and `dev`; a project version bump is an ordinary item reviewed and merged before release.
2. Read the item's version and the human's recorded version decision. When a recorded decision exists, ensure the item's version matches it before previewing. If the version is missing, ask the human to choose it, then record it with `cland task edit T-n --version X.Y.Z`. Before the dry run, ensure the root `package.json` version equals the release's through an ordinary commit reviewed and merged onto `dev`. Release reads the committed `dev` version and refuses a mismatch with `release-version`; it never writes the bump. Projects without that file or its `version` key release as before. Before the dry run, when releasing cland itself (the repository containing `hub/bin/check-opencode.ts`), run the [informational OpenCode check](OPENCODE-CHECK.md) and include any differences in the release report. Differences do not stop the release. Run `cland release --item T-n --dry-run`. Resolve every refusal before continuing: close or move open descendants; when GitHub has commits dev lacks, run `cland sync` from a clean root, then preview again. Share the resulting notes, version, commit and refs in the release topic through `artifact.create`.
3. For daytime approval while readiness is pending, use [Conditional release approval](#conditional-release-approval). Otherwise ask through the Coordinator's `ask` in that topic: show the preview's notes and version and request approval to release that build, allowing a free answer (`free: true`). Wait for approval. The version comes from the human. An Aide or a stand-in named by the human may relay approval and the version only when the human has recorded that version decision; cite the record (for this project's v0.1, D18 in docs/spec/v0.1.md records v0.1.0). A stand-in never invents a version; an unrecorded version needs the human's decision. Follow the project's recorded acceptance policy: D19 uses QA's clear T-117 walkthrough instead of a separate human acceptance pass, and the notes retain T-109 C1 and T-111 M7 as verified in v0.1.1.

4. If the approved version differs, record it on the item, run `cland release --item T-n --dry-run` again and show the resulting notes and version in a fresh approval ask. For ordinary exact-build approval, if dev or the notes changed, preview and obtain approval for that build again. Conditional approval follows its recorded future-change scope below. Once the preview is approved and every recorded condition is satisfied, run `cland release --item T-n` yourself. It prepares an annotated tag with the item Notes, epic deliverables and commit notes, pushes the default branch and the tag atomically, advances the default branch locally and in the territory, then comments the tag and full commit on the item and closes it. The next open release becomes current. Web assets use gh’s GitHub Release API only when opted in; the Git refs transaction makes no API calls.
5. Report the returned version and full commit in the release topic. If it says `released; follow-up failed`, GitHub already accepted the release: preserve `.cland/release.tmp`, repair the named local, territory, Web assets, Homebrew tap or item obstruction, and retry **the same item and version** with `cland release --item T-n`. The receipt pins the published item, tag, commit and notes, so a restart or later dev commit cannot publish a different release on that retry. A failed push can also have lost its reply; retry the same item and version to let cland check the receipt against GitHub. With a pending sync, preserve `.cland/sync.tmp` and finish `cland sync` before releasing.

For a project without a release item, `cland release <chosen-version> [--dry-run]` retains the version-based flow: run the same applicable preflight check, preview the notes, ask for approval with a human-chosen version, then publish from your own shell. It does not comment on or close tracker items.

`cland sync` fetches GitHub and prepares a replay of dev's unreleased commits. Finish any pending `cland merge` follow-up first: sync refuses to rewrite a merge whose checkout, item, claim or topic completion is still pending. A dirty root refuses; a conflict names the files and leaves the default branch, dev and the root untouched. Reconcile the conflicting work on dev, then retry. Sync publishes only to the local territory, never to GitHub. If it says `synced locally; follow-up failed`, preserve its receipt, repair the named obstruction, and retry sync; it finishes the same prepared replay.

## Conditional release approval

In daytime, the Coordinator may use `ask` in the release topic (`free: true`)
to request the human's approval of a named version, notes and explicit conditions
before readiness is complete. The ask must name the scope of future changes it
authorizes, such as reviewed fixes for named release items and their committed
tracker and evidence updates. For example: “Approve release vX.Y.Z with these
notes, including reviewed fixes for the listed release items and their tracker
and evidence updates, once the release epic is clear and the covers are green?”
Attach the notes artifact and identify the release item, current candidate commit, named future
work and required covers (platforms, executor and occasions). Name any other conditions in the ask; the
human decides both the version and conditions. A declined ask is not approval.

Record the ask id, human answer, approved version, notes artifact and exact
conditions and authorized future-change scope in a release item comment.
A conditional approval authorizes release only when all those conditions hold. While a dry run still refuses pending
readiness, keep the recorded notes as a proposal; complete step 2's successful
preview before publication. Compare every intervening commit with the recorded
scope. The final successful preview must identify the final head, and required
cover receipts must match that head under the existing coverage rules. Existing
release gates and acceptance policy apply.

The Coordinator checks each condition and records its evidence in the release
item before running `cland release`: cite the clear epic verdict and matching green
cover receipts, including their heads, platforms, executor and occasions, plus
evidence for every other named condition. A missing, failed or pending condition
means wait; report which evidence is outstanding. When all conditions hold and
every intervening commit is within the human-approved scope, release without another ask.
Any change outside that scope requires a fresh approval ask. Any change to the
version or the notes, conditions or other approved publication facts (including
asset and Homebrew facts above) also requires a fresh approval ask. Approval
never waives a release refusal.

## Publish marketing without a release

`cland publish` is the only out-of-release GitHub push. The Coordinator uses its own shell; the human may also run it. Use it **before merging** the marketing branch into dev. Keep the project root clean on `dev` and finish pending merge/release/sync follow-ups first.

1. Run `cland publish <branch> --item T-n --dry-run`. It selects branch-only commits (`dev..<branch>`), excluding inherited unreleased dev commits. Every path in every commit must match `[publish] allow_paths` in `.cland/config.toml` (exact paths or `directory/**` prefixes). The default permits site, brand docs, README, LICENSE and the Pages workflow. Mixed commits and merge commits refuse the whole operation; prepare a linear marketing branch instead. Never broaden the allow-list just to pass unrelated product work.
2. Share the preview's source, commits, paths and resulting GitHub/dev tips through `artifact.create` in the item's topic. Ask the human through `ask`, with `free: true`, to approve this exact publication. Wait for approval, as for a release. If the source, dev, GitHub tips or configuration changes, preview and ask again.
3. Run `cland publish <branch> --item T-n`. It cherry-picks onto GitHub's default branch, atomically fast-forwards that branch and `site` to one tip, merges both the source branch and public tip into dev, and syncs local refs and the territory. This sync preserves existing dev ancestry (D59); it does not replay open lanes. The hub records a durable publication landing, comments the public and dev tips on the item and leaves it open. Close the completed task separately; its publication landing then counts toward plan progress, with the stage’s QA and platform covers still required. Commit that tracker change on root dev and use `cland push` to publish it to the territory.
4. If publication reports a failed follow-up or loses its push reply, preserve `.cland/publish.tmp`, repair the named obstruction and retry the same branch and item. The receipt pins the original tips; an unpublished retry must still satisfy the current allow-list. Once GitHub already has both tips, local-only recovery can finish after a policy change. Recovery never adds a second public history or duplicate tracker comment. Pending publication blocks release, ordinary sync, push, merge and offline tracker migration until recovered. A pre-push conflict leaves public and local refs untouched.

Publish creates no version or tag and makes no GitHub API calls. Ordinary `cland sync` retains its replay behavior; use publish's integrated sync for this marketing flow.

## Coordinator publication procedure

Clause procedure (defaults coordinator):

- Use `release`: `cland release --item T-n --dry-run`; `ask` notes/version approval, then `cland release --item T-n`. Human chooses version; Aides/stand-ins cite recorded choice. Marketing-only publication outside a release: `cland publish <branch> --item T-n --dry-run`; `ask` human approval, then `cland publish <branch> --item T-n`. Follow the release skill and recorded acceptance policy; never delegate release. `cland sync` imports from a clean root.

Clause procedure (project coordinator):

- Use `release`: `cland release --item T-n --dry-run`, then `ask` for notes/version approval; once approved, `cland release --item T-n`. The human chooses the version; Aides/stand-ins cite a recorded choice. Follow recorded acceptance policy; never delegate release. `cland sync` imports from a clean root.
