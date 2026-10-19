---
id: T-646
kind: task
title: cland init makes an empty folder a repository whose first commit is cland's files, then the territory, ending on a clean dev
state: open
status: ready
size: M
criterion_seq: 7
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-639
  - T-609
  - T-637
topic: topic-539
branch: t/T-646-cland-init-makes-an-empty-folder-a
created: 2026-10-16T16:23:59.380Z
updated: 2026-10-19T01:32:13.487Z
---

## Summary

Today an empty folder stops with "main has no commit yet: create main, then run cland init". Init now runs `git init -b main` in a folder outside any repository, provisions as before, makes a first commit holding only cland's files, then creates the territory from that commit (ADR 0004), so the root ends on a clean `dev` (spec v0.1.4 §3.2, "The first commit"; prototype/setup 5028220a). This ticket is the empty folder; the next two extend it to folders with files, repositories without commits and a machine without a Git identity.

## What to build

- **A new module** `hub/src/init/repository.ts`, taking from the prototype what fits:
  - `createRepository(report, root)`: `git init -q -b main` when `root` is in no repository and holds nothing beside cland's own paths and `.DS_Store`; T-609's root check has already refused a folder inside another repository, so a nested repository cannot arise.
  - `commitClandFiles(report, root)`: the first commit on the new branch holding only the paths cland provisioned (`AGENTS.md`, `.cland/` as its `.gitignore` leaves it, `.agents/`, `.claude/`, `docs/agents/`), with the message `Initial commit: cland init` and the list of paths in its body. It runs Git with `-c core.hooksPath= -c commit.gpgsign=false`, as the release's own commits do (`hub/src/territory-release.ts`).
  - `foldReport(report, again)`: one line per path when the territory runs twice.
- **The order in `provision`** (`hub/src/init/provision.ts`): create the repository, the territory's first pass (as today, before generated files appear), the managed files, then, for a repository init has just made, the first commit and a second territory pass that seeds `main` and `dev` in the territory, sets `origin/HEAD` and switches the clean root to `dev`.
- **The report** shows `created .git` (git init -b main) and `created … main` (first commit <sha>: <paths> (<n> files)); the territory's "main has no commit yet" line no longer appears for this folder.
- **`cland update`** never creates a repository or a commit.
- **Tests** in a new `hub/test/init-first-commit.test.ts` (with its line in `hub/test/shards.json`) on the scratch machine of ticket T-639, with an identity configured.
- **Docs.** The hub README's init section describes the empty folder's path.

## Acceptance criteria

- [x] C1. `cland init` in an empty folder leaves exactly one commit (`git log --oneline --all`), whose tree holds only `AGENTS.md`, `.cland/`, `.agents/`, `.claude/` and `docs/agents/` paths (init-first-commit.test.ts).
  - done: impl-646 · 2026-10-19T01:05:10.820Z
  - verified: rev-31 [reviewer] · run rev-20261019-646-final · 2026-10-19T01:32:11.055Z · commit 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
- [x] C2. Afterwards `git status --porcelain` is empty, `git branch --show-current` prints `dev`, and `main` and `dev` point at that commit.
  - done: impl-646 · 2026-10-19T00:06:15.987Z
  - verified: rev-31 [reviewer] · run rev-20261019-646-final · 2026-10-19T01:32:11.055Z · commit 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
- [x] C3. The territory exists with `main` and `dev` at that commit, its HEAD is `dev`, and `origin/HEAD` in the root is `origin/dev`.
  - done: impl-646 · 2026-10-18T23:56:51.991Z
  - verified: rev-31 [reviewer] · run rev-20261019-646-final · 2026-10-19T01:32:11.055Z · commit 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
- [x] C4. A second `cland init` makes no commit and reports nothing to change.
  - done: impl-646 · 2026-10-18T23:56:52.427Z
  - verified: rev-31 [reviewer] · run rev-20261019-646-final · 2026-10-19T01:32:11.055Z · commit 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
- [x] C5. The first commit carries none of `.cland/`'s volatile files (`hub.db`, `secret`, `territory.git/`, `log/`).
  - done: impl-646 · 2026-10-18T23:56:52.769Z
  - verified: rev-31 [reviewer] · run rev-20261019-646-final · 2026-10-19T01:32:11.055Z · commit 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
- [x] C6. A Git commit hook installed through the scratch machine's global `core.hooksPath` does not run during init's commit.
  - done: impl-646 · 2026-10-18T23:56:53.213Z
  - verified: rev-31 [reviewer] · run rev-20261019-646-final · 2026-10-19T01:32:11.055Z · commit 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
- [x] C7. Demo: in a scratch HOME, `mkdir x && cd x && cland init`, then `git log`, `git status` and `git branch` show the one commit on a clean `dev`.
  - done: impl-646 · 2026-10-18T23:56:53.655Z
  - verified: rev-31 [reviewer] · run rev-20261019-646-final · 2026-10-19T01:32:11.055Z · commit 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a

## Comments

### impl-646 · 2026-10-18T23:56:20.279Z

Implemented the empty-folder Git bootstrap and second territory pass with folded reporting; update explicitly disables repository creation. Added T2 CLI/Git criteria coverage using the scratch machine, isolated provider/account variables in that fixture, and documented init. Initial test was red ('not a git repository'), then green. Scratch HOME demo: one Initial commit: cland init (82 managed files), clean dev, main/dev at same head. Evidence posted in item topic; host lint and typecheck passed. Preparing source review before one mode-free droplet verify.

### rev-31 · 2026-10-18T23:58:48.118Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-646-source-1
commit: bbddf4c474f330ae11dbe0604384031ab5f06ddf
scope: full
findings: [{"severity":"medium","text":"Allowed .DS_Store remains untracked; the second territory clean check leaves main instead of the promised clean dev.","file":"hub/src/init/repository.ts","line":15},{"severity":"medium","text":"Recursive staging of allowed directories adopts pre-existing custom skills/private docs that cland never provisioned.","file":"hub/src/init/repository.ts","line":25},{"severity":"medium","text":"New CLI/Git proofs use unregistered execFile writers without cancellation or bounded stop/close/result joins before scratch-root removal.","file":"hub/test/init-machine.ts","line":41}]
finding_counts: {"high":0,"medium":3,"low":0}

# T-646 source review: not clear

Head: bbddf4c474f330ae11dbe0604384031ab5f06ddf
Fixed base: 4b196c6208da89a4852be654cd05acd9978de83f
Branch: t/T-646-cland-init-makes-an-empty-folder-a
Scope: full. Read-only review against item C1–C7, v0.1.4 §3.2, ADR 0004 and docs/agents/tests.md. No verification at this head.

## Standards

M3 (medium), hub/test/init-machine.ts:41, exercised by new hub/test/init-first-commit.test.ts:14: execFile children have a command timeout but no test cancellation signal, immediate process registration or owned stop/close/result join before scratch-root removal. scratchMachine registers ownDirectory only; its set of child identities remains empty for these invocations. Parent cancellation can therefore delete the root while a CLI/Git writer remains active. Rule 12 requires observed writer completion before deletion. Add explicit ownership and bounded cleanup with a held-writer cancellation proof. Implementer confirmed no outer owner in 7b2bfb4b.

The intended T2 seam is otherwise appropriate: CLI behavior is the subject, with native Git observations and scratch HOME/Git config, no hub/harness starts and no sleeps. Tier manifest replaces the old shards manifest as documented. Existing init-next assertions are retained while text and JSON cases split to fit per-test budgets. Provider/account variables are newly filtered. Hook and signing overrides are command-local. No separate heuristic smell finding.

## Spec

M1 (medium), hub/src/init/repository.ts:15: admission explicitly permits .DS_Store but commitClandFiles leaves it untracked. With the scratch Git configuration and no global ignore, the second territory pass sees a dirty root and leaves main checked out (territory.ts:165,237–241). This violates C2 for an explicitly supported input. Preserve the file while ensuring the allowed metadata does not obstruct the promised clean dev.

M2 (medium), hub/src/init/repository.ts:25: git add recursively stages every file beneath the directory allowlist, while admission checks only top-level names and docs' immediate entries. Pre-existing .agents/skills/custom/SKILL.md or docs/agents/private.md can be committed despite never being provisioned by cland. This violates the task's managed-only first-commit boundary/C1. Derive staging from actual managed outputs, and preserve user-owned files rather than adopting them through a directory name. Implementer confirmed M1/M2 in 5a926e6c and is adding red controls before correction.

The ordinary empty-directory path otherwise follows the requested order: create main, first territory pass, provision, managed commit, second territory pass/folded report. Update explicitly passes repository=false, and existing repositories are not committed by the new path. Tests check one commit/tree boundaries, root/territory refs and HEADs, idempotence, exclusions, global hooks/signing, and update refusing to create history. A-5649 records the scratch-HOME demo and reported local file timings; those positive receipts do not establish the uncovered inputs or cancellation path.

Result: not clear. Fail C1 (unmanaged recursive staging and unsafe writer cleanup in its proof) and C2 (.DS_Store prevents clean dev). C3–C7 remain unverified at this source pass. No full/task verification until a corrected committed head receives clear source review; no dev merge requested. No per-item QA.

Findings: Standards 1 medium; Spec 2 medium.

Evidence: A-5654.

Criteria: C1 failed (Directory-wide staging can commit non-provisioned user files; the CLI proof also lacks owned child cancellation/drain before root cleanup.), C2 failed (Explicitly allowed .DS_Store stays untracked and prevents the second territory pass from switching to clean dev.).

### rev-31 · 2026-10-19T00:02:57.789Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-646-source-2
commit: 87dedc052f7602eb6baee14fe727e38f93ac572b
scope: full
findings: [{"severity":"medium","text":"Created/updated report paths can be whole refreshed skill directories; recursive ls-files still stages an unlisted private leaf in a legacy-managed skill.","file":"hub/src/init/repository.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-646 corrected source review: not clear

Head: 87dedc052f7602eb6baee14fe727e38f93ac572b
Base: 4b196c6208da89a4852be654cd05acd9978de83f
Correction comparison: bbddf4c4 → 87dedc05. Scope: full; no dev merge.

## Standards

The previous cleanup finding is addressed in source: scratch commands carry t.signal, immediately register PID ownership and register pre-directory stop plus bounded close/result drainage. The new T3 lifecycle control waits for the held writer's socket receipt, cancels the inner test, observes PID-gone and settled command result while its root exists, then checks removal. The lifecycle header/tier names the real-process reason. Reported host lint/typecheck and touched-file timings are retained in A-5656; post-source task execution remains pending.

The .DS_Store finding is also addressed: the symlink-aware writer appends a root-local exclude, with a regression retaining metadata while asserting it is absent from HEAD and clean dev is selected.

## Spec

M1 (medium), hub/src/init/repository.ts:30: filtering report entries by created/updated still accepts directory entries. provisionSkills reports the whole skill directory at skills.ts:251. A valid legacy manifest owning a shipped skill's SKILL.md, with an unlisted private.md in that same directory, follows the legacy refresh path and retains private.md; the directory is reported updated. Recursive ls-files under that directory then stages the private file despite no cland leaf ownership. This is the prior C1 managed-only boundary finding, narrowed to an updated directory. The new sibling custom-skill/private-doc cases do not cover it. Use an explicit validated owned/written leaf set and retain a control for an extra file inside a refreshed managed skill.

Implementer confirmed no further leaf filter exists in 17a0908f and will add that control before a new review request. No verification at this head.

C1 failed for the remaining managed-only commit gap. C2–C7 remain unverified pending corrected source and exact-head execution. Original first-commit/tree/territory/hook/update assertions are retained; no per-item QA.

Findings: Standards 0 remaining; Spec 1 medium.

Evidence: A-5658.

Criteria: C1 failed (A refreshed skill's directory report still permits an unlisted private file into the first commit; filter exact owned/written leaves.).

### rev-31 · 2026-10-19T00:05:51.896Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-646-source-3
commit: 08eb210728f49997824e1cbb22649dccc41cc597
scope: full
findings: [{"severity":"medium","text":"Selector omits unchanged managed leaves, leaving admitted pre-provisioned roots dirty on main; an empty path list instead lets ls-files select all untracked files.","file":"hub/src/init/repository.ts","line":31}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-646 source review: incomplete managed set

Head: 08eb210728f49997824e1cbb22649dccc41cc597
Fixed base: 4b196c6208da89a4852be654cd05acd9978de83f
Correction comparison: 87dedc05 → 08eb2107. Scope: full; no dev merge.

Standards: no additional finding. The exact skill-manifest leaf expansion, kept-path exclusions, file/symlink check and literal Git pathspecs address the refreshed-directory private-file finding. The new legacy tdd control checks the owned SKILL.md is committed while unlisted private.md is preserved and absent from HEAD. The earlier .DS_Store and cancellation ownership fixes remain intact.

Spec M1 (medium), hub/src/init/repository.ts:31: the managed selector includes only created/updated report entries, omitting unchanged managed files already present in an admitted non-Git folder. When some files are newly generated, those unchanged managed files stay untracked and the final clean check leaves main instead of dev (C2). With an entirely empty selector, ls-files with no path operands instead selects every untracked file, potentially adopting private files (C1). An empty selected candidate list must likewise not fall through to a broad Git operation. Select the complete owned leaf set, including unchanged owned outputs, and explicitly guard empty selectors/candidates.

Implementer confirmed the missing guarantees in 30c79c75 and will add a previously-provisioned/no-Git control plus an empty-report negative control. A-5659 establishes the refreshed-skill correction, but does not cover these remaining branches.

Result: not clear; fail C1/C2. C3–C7 remain unverified pending corrected source and exact-head verification. No verify at this head, no dev merge requested, no per-item QA.

Findings: Standards 0; Spec 1 medium.

Evidence: A-5660.

Criteria: C1 failed (An empty managed selector expands ls-files to all untracked files; explicit empty guards are missing.), C2 failed (Unchanged managed outputs are omitted from the first commit and stay untracked, preventing clean dev.).

### rev-31 · 2026-10-19T00:07:48.357Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-646-source-4
commit: 5beb685186194aecd5d4e53edff3a8a7b415f772
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-646 source review: clear

Head: 5beb685186194aecd5d4e53edff3a8a7b415f772
Fixed base: 4b196c6208da89a4852be654cd05acd9978de83f
Correction comparisons: bbddf4c4 → 87dedc05 → 08eb2107 → reviewed head.
Scope: full. No dev merge after the first review. Branch tip independently matches this head.

## Standards

Clear; no remaining findings. The new repository module uses the territory Git runner, command-local hook/signing suppression, literal pathspecs and Git's ignore rules. Managed selection admits created/updated/unchanged owned outputs, excludes kept paths, expands skill directories only through validated manifest leaves, and retains only files/symlinks. Both empty leaf and empty candidate lists return before broad Git listing/staging. The .DS_Store exclusion uses the existing symlink-aware atomic writer in local Git configuration.

Scratch CLI/Git invocations now receive the test AbortSignal and immediate PID ownership. Pre-directory cleanup stops/reaps the process and joins close plus result within a named five-second drain bound. The separate T3 lifecycle test proves a held writer's PID is gone and its result settled while the root exists, then checks removal. Its native-process lifecycle header and tier justify the seam. CLI contract cases remain T2, and the empty-selector negative control is T1: it performs no Git work in a non-Git scratch folder. Empty process cleanup returns before process inspection.

Original contract assertions and the prior corrections are retained. No new sleep, native harness or hub startup is introduced. Changes to existing init-next text/JSON tests preserve their assertion meanings while splitting per-test cost. Scratch HOME/XDG/Git identity and provider/account isolation stay inside the fixture.

## Spec

Clear; no remaining findings. For the admitted empty-folder path, provisioning creates main, runs the initial territory step, provisions the managed files, makes one Initial commit: cland init with a managed-path body, then repeats/folds territory setup. Existing repositories retain history/index. Update explicitly disables repository creation/commit. The second territory step seeds root/territory main and dev, sets both default refs and switches a clean main root to dev. Folded reporting removes stale unborn-main observations.

Coverage maps to C1–C7:
- The original CLI case observes one commit, the allowed tree prefixes and exact nonvolatile .cland leaf set, clean root dev, both root/territory refs and HEADs.
- Idempotence preserves the head/count and reports nothing to change.
- A global failing pre-commit hook plus signing configuration proves command-local bypass.
- Update controls cover non-Git and unborn repositories.
- Corrections cover preserved/excluded .DS_Store, custom skill/private-doc siblings, an unlisted private leaf inside a refreshed legacy skill, and previously provisioned/no-Git clean dev.
- The empty-report T1 control prevents no-path selection from adopting private content.
- A-5649 records the scratch-HOME demonstration with one Initial commit on clean dev; A-5656/A-5659/A-5661 document the correction controls.

Reported final local validation: eight CLI cases, 9.09 s file, each below 2 s; empty-selector file 0.11 s/test 0.005 s; unchanged lifecycle 0.34 s, machine 3.97 s, next-step file 3.12 s. Host lint/typecheck pass is recorded in the review request and A-5661. These are source-readiness receipts, not an exact-head post-source task run.

Result: clear source. C1–C7 remain unverified until the same-head execution receipt is audited with the existing demo evidence. One mode-free droplet verification may follow at this unchanged head; no full-run request and no per-item QA. A head change requires fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5664.

### rev-31 · 2026-10-19T00:32:19.442Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-646-runtime-1
commit: 5beb685186194aecd5d4e53edff3a8a7b415f772
scope: evidence
findings: [{"severity":"medium","text":"Five existing Aide/init/territory/worktree fixtures reach the new initial commit without an isolated Git identity and fail on Linux before their behavior assertions.","file":"hub/test/init-fixture.ts","line":39},{"severity":"medium","text":"Old non-Git expectation still uses an empty folder now deliberately bootstrapped by init; retain that assertion family using a nonempty project fixture.","file":"hub/test/territory-cli.test.ts","line":210}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-646 runtime evidence: not clear

Head: 5beb685186194aecd5d4e53edff3a8a7b415f772, matching source-4 / A-5664.
Run a1218901-01fc-4766-a1ba-ac3fddad7f87 / A-5686, raw exit 1, hub-only.
Scope: evidence.

## Standards

M1 (medium), hub/test/init-fixture.ts:39 and affected existing init callers: the new initial commit adds a configured Git identity prerequisite, but five task-adjacent fixtures rely on the host identity. On the Linux droplet every failure is Author identity unknown, before the behavior assertions execute:
- aide.test.ts:70 (A-5686:54915);
- init.test.ts:478 via init-fixture.ts:39 (54946);
- init.test.ts:558 via init-fixture.ts:39 (54976);
- territory-cli.test.ts:211 (55006);
- worktree-cli.test.ts:63 (55038).

Supply explicit isolated fixture author/committer identity through the relevant subprocess and in-process seams, retaining the Aide, symlink safety and independent-root assertions. This is not evidence that symlink or root behavior itself failed. The product identity fallback belongs to the later scope and is not requested here. Implementer confirms task-owned fixture correction and no unchanged-head retry in f43aac17.

## Spec

M2 (medium), hub/test/territory-cli.test.ts:210: the existing non-Git fixture is an empty folder yet still expects no territory and the old push rule. Empty-folder bootstrap deliberately changes that input's behavior. Preserve the original non-Git/no-remote assertion family with a genuinely nonempty project folder; the new first-commit cases already prove empty-folder behavior. This stale expectation is visible in source behind the identity failure and must remain covered rather than removed.

Positive execution evidence: all eight ordinary init-first-commit cases pass (7.847354335 total test-seconds), plus the lifecycle control (0.703578257), T1 empty-selector control (0.015863657), both next-step cases, and init-machine's isolated self-test. All eight CLI identities, lifecycle, selector and both next-step identities have exact 5/5 load gates. These positives establish no task-owned timing failure but do not clear the five failed compatibility cases.

Ordinary hub totals: 2341 tests, 2331 pass, 5 fail, 0 cancelled, 5 skipped. The larger completed-before-interruption count includes repetition receipts and is not the ordinary test total. Hub free 104.44 s, hub machine 1177.92 s; run stops before Neovim smoke. Linux x64 c-8 lon1, Node 24.21.0, Neovim 0.12.5, workers 2, peak load 7.01; lifetime 1365 s, cost $0.0948.

Result: not clear; C1 fails task integration readiness at this pass. C2–C7 remain unverified pending corrected source and a replacement exact-head receipt. No unchanged-head retry. Preserve the current source freeze except task-owned corrections, request fresh source review, then submit verification. No per-item QA.

Findings: Standards 1 medium; Spec 1 medium.

Evidence: A-5687.

Criteria: C1 failed (Same-head verification fails five task-adjacent init compatibility fixtures; isolated identities and the non-Git fixture expectation need correction.).

### rev-31 · 2026-10-19T00:37:13.436Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-646-source-5
commit: e87ff41dde7cb5ab058f8bf6f6400a27a65d7aeb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-646 fixture correction source review: clear

Head: e87ff41dde7cb5ab058f8bf6f6400a27a65d7aeb
Fixed base: 4b196c6208da89a4852be654cd05acd9978de83f
Correction comparison: source-cleared 5beb6851 → reviewed head.
Scope: full. No dev merge; branch tip independently matches.

## Standards

Clear; no findings. This correction changes only five test files. git-identity-fixture.ts supplies explicit author/committer name/email. Subprocess init receives that environment; in-process init uses a try/finally scope restoring each previous environment value (including deletion when originally absent). The affected file-level tests await their init calls sequentially; no new overlapping identity scope or fixture lifetime is introduced.

The shared init-fixture module/CLI seams, Aide init, territory init and independent worktree-child init are covered. No production fallback identity, product-source change, new subprocess or wall-clock wait is added. The original empty-folder implementation, exact managed leaf selection, kept exclusions, empty guards, Finder metadata handling and owned scratch-command drain from source-4 remain unchanged.

## Spec

Clear; no findings. The territory non-Git control now contains a human README, retaining its original no-territory and push-rule assertions while empty-folder behavior remains proved by init-first-commit. Independently compared assertion lines in aide.test.ts, territory-cli.test.ts and worktree-cli.test.ts: all retained exactly. The shared init-fixture change likewise does not remove the symlink assertions.

A-5688 was inspected as raw file output: all 16 listed files exit 0, with zero failures, cancellation or skips in each, under the declared scratch HOME/XDG/no-inherited-identity/useConfigOnly environment. It includes the five previously failing cases, complete first-commit controls, lifecycle/selector controls and related root/settings/worktree consumers. Timings range from 0.090 s for settings to 20.577 s for territory CLI. A-5689 records the Linux failure and local reproduction/correction. This supports correction readiness; it is not a replacement post-source task run.

Previous source-4 / A-5664's C1–C7 mapping remains applicable; all seven are claimant-done and remain unverified until exact-head task execution plus the existing scratch-HOME demo evidence are audited.

Result: clear source. Submit one replacement mode-free droplet verification at this unchanged head. No per-item QA. Any subsequent head change requires fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5690.

### rev-31 · 2026-10-19T01:04:12.140Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-646-runtime-2
commit: e87ff41dde7cb5ab058f8bf6f6400a27a65d7aeb
scope: evidence
findings: [{"severity":"medium","text":"Ten owned T2 identities emit 20 runtime execFile/execFileSync resource mismatches through direct scratch command launch and PID inspection; no approved boundary disposition exists.","file":"hub/test/init-machine.ts","line":45},{"severity":"medium","text":"New lifecycle adds 0.745113315 s to T3 ratchet without the required allowance or explicit Coordinator disposition; report-only green is not that disposition.","file":"hub/test/init-machine-lifecycle.test.ts","line":8}]
finding_counts: {"high":0,"medium":2,"low":0}

# T-646 runtime resource review: not clear

Head: e87ff41dde7cb5ab058f8bf6f6400a27a65d7aeb, unchanged from source-5 / A-5690.
Run: b30cdea8-ea9e-4a79-b37c-cab90d9e914e / A-5697, hub-only, raw exit 0.
Scope: evidence. Branch and task receipt independently match.

## Standards

M1 (medium), hub/test/init-machine.ts:45,50: the eight new init-first-commit T2 identities and two renamed init-next identities each emit child_process.execFile and child_process.execFileSync runtime mismatches: 20 task-owned rows. First stacks point to commandIn's direct execFile and ownProcess → captureProcess's process inspection. The documented T2 CLI launch exemption is narrow; the current helper does not use it, and native Git/cleanup calls must also have the correct resource boundary/tier. Report-only mode does not establish an approved seam. Retain the native assertions and immediate ownership; resolve the boundary/tier through the lead without broad suppression. These are additional to three known unrelated suite-close-component rows.

M2 (medium), hub/test/init-machine-lifecycle.test.ts:8: the new held-writer lifecycle contributes 0.745113315 s of observed T3 growth. The log reports 2652.246 s versus base 2651.501 s, would refuse growth, with incomplete base timings separately disclosed. docs/agents/tests.md:700–714 requires a T3 allowance; the justified lifecycle seam does not itself supply one. Obtain the explicit Coordinator disposition/required allowance through lead T-646. Implementer d05736c8 confirms no existing disposition, escalation in progress and no unchanged-head retry.

## Spec

All behavioral checks audited pass. Eight init-first-commit cases total 8.297046289 test-seconds, all below the T2 per-test limit, with exact 5/5 gates each. The lifecycle control passes in 0.745113315 s, selector control in 0.019454306 s, and both have 5/5 gates. Both next-step identities pass and have 5/5 gates.

The five previous identity failures now positively pass:
Aide defaults/launch (4.878901677 s); static symlink safety (1.401138822 s); swapped-parent symlink safety (0.428255117 s); nonempty non-Git territory behavior (0.301624272 s); independent child project/root routing (1.530938193 s).
All affected complete files pass. No task-owned per-test/file duration overage appears. These positives support C1–C6 behavior and the existing A-5649 scratch-HOME demo, but do not clear the owned resource/growth findings.

Whole ordinary run: 2347 tests, 2342 pass, 0 fail, 0 cancelled, 5 skips, 0 TODO. All three shard failure arrays are empty; Neovim smoke completes. Skips are existing platform/binary cases; one idle-sleep skip has the generic raw reason. Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 1449 s, cost $0.1006, peak load 8.94. No global zero-debt or enforce-mode pass is claimed.

Result: not clear for task readiness; fail C1 on the owned tier/growth requirements, leave C2–C7 unverified pending disposition/corrected source and accepted execution evidence. The raw assertion run remains green and must not be described as exit 1. No further run at this head; any correction needs fresh source review. No per-item QA.

Findings: Standards 2 medium; Spec 0 behavioral findings.

Evidence: A-5698.

Criteria: C1 failed (Behavioral run is green, but owned T2 resource mismatches and unallowed new T3 growth prevent final readiness.).

### impl-646 · 2026-10-19T01:04:26.723Z

Coordinator-accepted T3 growth for the held-writer cancellation proof: hub/test/init-machine-lifecycle.test.ts adds +0.745 s in A-5697 (2652.246 s vs base 2651.501 s). Coordinator disposition 3bd66275-7f5d-40b7-93b0-600545f4b6f5 accepts this real-process rule-12 proof while the ratchet is report-only. Following the same decision, init-first-commit.test.ts and init-next.test.ts move from T2 to T3 because they require scratch CLI/native Git and ps PID ownership; assertions and cleanup are preserved. No broad resource suppression or product change.

### impl-646 · 2026-10-19T01:05:10.804Z

Coordinator-accepted T3 growth for the held-writer cancellation proof: hub/test/init-machine-lifecycle.test.ts adds +0.745 s (A-5697, 2652.246 s vs base 2651.501 s), accepted by decision 3bd66275-7f5d-40b7-93b0-600545f4b6f5. The same disposition and confirmation a93b1307-9905-46f8-9c19-3a89d8d8cc8a cover reclassifying existing native process work: hub/test/init-first-commit.test.ts measured 8.297 s and hub/test/init-next.test.ts 2.867 s in A-5697 (11.164 s combined; the earlier estimate was about 10.65 s). These two files move T2 → T3 because scratch CLI/native Git plus ps PID capture and owned close drainage require real processes; no tests, process starts or assertions were added or removed by the reclassification. test:tiers, typecheck and lint passed without demanding an allowance, so no E-612 allowance entry was added. Focused files still pass (first-commit 9.32 s; next 3.21 s on host).

### rev-31 · 2026-10-19T01:06:03.710Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-646-source-6
commit: 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-646 classification source review: clear

Head: 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
Base: 4b196c6208da89a4852be654cd05acd9978de83f
Correction comparison: e87ff41d → reviewed head. Scope: full; no dev merge.

Standards: clear, no findings. The correction changes only the two file headers and their tiers.json entries. init-first-commit and init-next now declare T3 and identify the scratch CLI/native Git, PID/ps ownership and close-drain boundary. Test bodies, assertions, process starts, cleanup ownership and product source are unchanged. No resource suppression is added.

Coordinator decisions 3bd66275 and a93b1307 were independently read in topic-539. They explicitly accept the held-writer proof's +0.745 s T3 growth and the honest reclassification of existing native work, require no allowance unless tiers/lint demand one, and require fresh source review plus one replacement droplet run. The item comment records the exact A-5697 measured file totals (8.297 s + 2.867 s = 11.164 s), correcting the earlier approximate 10.65 s. Reported tiers/lint/typecheck pass without an allowance; none was added, as directed.

Spec: clear, no findings. The managed-only commit, clean-dev, territory refs, idempotence, volatile exclusions, hooks and scratch-HOME demonstration remain covered by the unchanged source/tests reviewed in source-4/source-5. A-5697's behavioral positives remain useful historical evidence but do not replace the instructed execution at the reclassified head.

Result: source clear. C1–C7 remain unverified pending replacement exact-head task evidence and the existing demo. Submit one mode-free droplet verification at this head. No per-item QA.

Findings: Standards 0; Spec 0.

Evidence: A-5699.

### rev-31 · 2026-10-19T01:32:11.055Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-646-final
commit: 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-646 final execution review: clear

Head: 403c3d0feb0614e11b5ed6f3ceb9a4659b91e24a, unchanged from source-6 / A-5699.
Run: 567e742c-0e64-47b5-be38-64fbce9ac923 / A-5700, hub-only, raw exit 0.
Scope: evidence. Task receipt and branch tip independently agree; all seven criteria are claimant-done.

## Standards

Clear; no remaining findings. All 20 owned T2 runtime mismatch rows are absent after the honest T3 classification. The only three runtime mismatch rows are the known external suite-close-component identities, previously tracked as T-803. No task-owned per-test/file budget overage or quarantine outcome appears.

The report-only T3 total is 2663.597 s versus 2651.501 s; the 12.096 s increase corresponds to the reclassified first-commit/next-step work and held-writer lifecycle. Current observed file totals are 8.252383929 s, 3.155812814 s and 0.688420329 s. Coordinator 3bd66275 and a93b1307, independently read during source-6, accept the required lifecycle proof and reclassification, direct no allowance unless lint/tiers demand one, and require this replacement run. This verdict applies that explicit disposition; it does not claim the raw ratchet is flat or an enforce-mode run was performed.

Source-4/source-5/source-6 established exact owned leaf staging, unchanged managed outputs, kept exclusions, empty guards, .DS_Store preservation, hook/signing bypass, test-only identity isolation and bounded owned child cleanup. No source changed after that review.

## Spec

Clear. The eight exact first-commit cases positively pass, totaling 8.252383929 test-seconds, each with a 5/5 load gate. They establish:
C1 one managed-only first commit;
C2 clean dev with main/dev at that commit;
C3 root/territory refs, both HEADs and origin/HEAD;
C4 repeat-init idempotence;
C5 exact nonvolatile .cland tree;
C6 global failing-hook and signing bypass.
Additional cases retain .DS_Store and private files, omit unlisted leaves inside refreshed skills, include unchanged managed files and keep update from creating history.

The held-writer cancellation proof and T1 empty-selector proof pass ordinarily and 5/5; both renamed next-step cases likewise pass 5/5. These 12 owned identities supply 60/60 repetition passes. All five previously failed Aide/symlink/territory/independent-root compatibility cases now positively pass; their complete affected files pass.

C7 is supported by the scratch-HOME command demonstration A-5649 (one Initial commit on clean dev, main/dev matching), together with this exact-head scratch-machine CLI/Git case executing and asserting the same init/log/status/branch/ref observations. A-5688 additionally retains all 16 sequential host file passes under an identityless scratch environment. Neither this review nor that evidence claims a new human QA session.

Overall ordinary result: 2347 tests, 2342 pass, zero fail/cancelled/TODO, five existing platform/binary skips (idle-sleep retains its generic raw skip reason). Three shard failure arrays are empty, and Neovim smoke completes. Hub free 110.93 s, hub machine 1264.79 s, Neovim smoke 10.36 s; suite 1386.09 s. Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 1475 s, cost $0.1024, peak load 8.74.

Result: final clear; verify C1–C7. No further verification or per-item QA required.

Findings: Standards 0; Spec 0.

Evidence: A-5701.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
