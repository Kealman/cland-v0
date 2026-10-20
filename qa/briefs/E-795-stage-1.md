# Stage QA brief: E-795 stage 1 — rendered artifacts

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-795, Rendered Markdown artifacts in the Neovim workbench (under R-377).
- Exact stage name: rendered artifacts.
- Items: T-796, T-1003, T-1004, T-1005 (one lane, in this order). Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: full/after-stage.
- Scope: full, which for this epic means its whole Definition of done (`cland task view E-795`) run as a QA stage. C1: a Markdown artifact opened in the workbench renders like a thread message, with a key that toggles the raw source. C2: long artifacts open and scroll without a visible delay; rendering is cached per artifact version and never blocks the UI. C3: headless-grid cases cover a rendered artifact and the raw toggle. The human's decision (Coordinator comment on E-795, 2026-10-20 16:54Z, ask 310190bf option 1): a Markdown artifact opens as a read-only rendered view built from the thread's projection (tables laid out, link tails compacted), with a toggle to the raw editable buffer; rendered is the default on every open and the mode is not remembered. Neovim only; Mermaid, HTML and the other browser artifacts, and prompt drafts, open as before; following links in a rendered artifact is out of scope.
- Verdict marks: a stage verdict carries no epic criterion marks. The epic's Definition-of-done ids are C1, C2 and C3; they are marked by the epic's own Definition-of-done run, and this stage run is the evidence for it. The table in the Verdict section maps each check to C1, C2 or C3.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. All four items must have merged onto dev (`git log --first-parent --grep "Item: T-796" dev`, likewise T-1003, T-1004 and T-1005). T-796 delivers `qa/cases/ARTIFACT-001.lua` and T-1005 delivers `qa/cases/ARTIFACT-002.lua`: if either file is missing at the build, its item is not merged and the run is `BLOCKED`. A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree, with `npm install` done there (worktrees share the root's `node_modules`; symlink it if absent). Neovim comes from `node nvim/bin/nvim-path.ts` and must match `nvim/NVIM_VERSION`. No GUI, no real browser (none of these checks needs one), no harness process.

## Setup (once, before the cases)

Every command runs with a scratch HOME, XDG and Git config and with the credential and provider variables removed (rule 15), never the human's HOME or the live project. Keep `PATH`, `SHELL` and `TERM`, leave `TMPDIR` at the system default (on macOS `/var/folders/...`), never use `env -i` and never put `TMPDIR` under `/tmp`: Neovim frame fixtures break there (T-1030). The headless cases build their own fixture projects; the scratch environment keeps `ui.json`, restart snapshots and Git state away from the real ones. Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-$(date +%F)-1                        # unique run id; bump the suffix on a rerun
Q=$(mktemp -d "${TMPDIR:-/tmp}/qa-e795-XXXXXX")   # scratch root under the system TMPDIR
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data"
cat > "$Q/env.sh" <<ENV
export HOME="$Q/home" XDG_CONFIG_HOME="$Q/xdg/config" XDG_STATE_HOME="$Q/xdg/state" XDG_DATA_HOME="$Q/xdg/data"
export GIT_CONFIG_GLOBAL="$Q/gitconfig" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=qa GIT_AUTHOR_EMAIL=qa@example.invalid GIT_COMMITTER_NAME=qa GIT_COMMITTER_EMAIL=qa@example.invalid
for v in \$(env | cut -d= -f1 | grep -E '(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|COOKIE)|^(ANTHROPIC|OPENAI|CODEX|CLAUDE|GEMINI|GOOGLE|GH|GITHUB|AWS|DIGITALOCEAN|DO|NPM|SSH|CLAND)_'); do unset "\$v"; done
unset SSH_AUTH_SOCK
ENV
. "$Q/env.sh"; : > "$Q/gitconfig"; cd "$W"
echo "TMPDIR=$TMPDIR"; echo "$Q"                # the scratch root must sit under the system TMPDIR, not /tmp, on macOS
```

Every check below starts with `. "$Q/env.sh"; cd "$W"`. Cleanup at the end, after the evidence is recorded: print `$Q`, check it begins with the system TMPDIR and `qa-e795-`, and remove it by its literal path with a non-force `rm -r`.

## Cases

Run each headless case from `$W` with the recorder; exit 0 is PASS, 1 FAIL, 2 INCONCLUSIVE or BLOCKED. Command for every row: `CLAND="$PWD/hub/bin/cland.ts" sh .agents/skills/qa/qa-record.sh run E-795 "$RUN" <CASE>`. Platform: local (Linux or macOS alike; the cases need only Neovim and the stub hub). Expected result of every row: PASS.

| case | surface | command and expected outcome |
| --- | --- | --- |
| ARTIFACT-001 | headless-grid | C1, C3. A Markdown artifact with a heading, emphasis, inline code, a fenced block, a list, a quote, a link and a table opens rendered by default (thread projection, wrapped rows, no raw markers), is read-only, `␣v` shows the exact editable source and toggles back. PASS. Proven in the suite by `nvim/test/artifact-render.test.ts` "ARTIFACT-001: rendered Markdown is read-only and raw toggles back to the exact editable source" and by `nvim/test/qa-shipped.test.ts` |
| ARTIFACT-002 | headless-grid | C1, C3. A folder child and a palette `CTRL-v` split open rendered and are read from the grid; the split toggles independently of the centre. PASS. Proven in the suite by `nvim/test/qa-shipped.test.ts` "ARTIFACT-002 passes through the headless QA runner" |

Re-check the case ids with `ls qa/cases | grep ARTIFACT` at the tested build; renames happen. A case that cannot find Neovim exits 2: record BLOCKED.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-795 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, saving the output under `.cland/qa/E-795/$RUN/<id>.txt` first. Test files run one at a time from `$W`, under cover-quiet admission (no cover is running; targeted runs take no suite lease). A skipped test (no Neovim) is BLOCKED, never PASS: read the `# pass`, `# fail` and `# skipped` counts and confirm that `# pass` equals the number of tests the check names. A `--test-name-pattern` that matches nothing exits 0 with `# tests 0`: that is a failure.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test --test-name-pattern='ARTIFACT-001: rendered Markdown' --test-name-pattern='a raw toggle keeps its source position' --test-name-pattern='artifact tables follow the thread layout' nvim/test/artifact-render.test.ts` | exit 0, `# pass 3`, none skipped. C1: rendered by default and read-only, `␣v` toggles to the exact editable source and back ("ARTIFACT-001: rendered Markdown is read-only and raw toggles back to the exact editable source"); the raw toggle returns to the same source line or the nearest rendered one, also when deferred tables change the final row count ("a raw toggle keeps its source position when deferred tables change the final row count"); tables lay out as the thread does at 120 and 80 columns and toggle at their source line ("artifact tables follow the thread layout at 120 and 80 columns and toggle at their source line") |
| M2 | hub-api | `node --test --test-name-pattern='a 2,000-line artifact bounds parsing' --test-name-pattern='the artifact projection cache distinguishes' --test-name-pattern='first artifact open projects an existing modified editor buffer' nvim/test/artifact-render.test.ts` | exit 0, `# pass 3`, none skipped. C2, the 2,000-line first paint is bounded: "a 2,000-line artifact bounds parsing before first paint and reuses spans for its file version" (the first screen is parsed before the rest, a reopen reuses the cached spans); "the artifact projection cache distinguishes path, mtime and size independently" (the version key); "first artifact open projects an existing modified editor buffer without losing its unsaved source" |
| M3 | hub-api | `node --test --test-name-pattern='a 20,000-line artifact yields to keys' --test-name-pattern='sliced artifacts retain whole-document Markdown context' nvim/test/artifact-render.test.ts` | exit 0, `# pass 2`, none skipped. C2, the 20,000-line slices are bounded by deterministic caps: "a 20,000-line artifact yields to keys, bounds render work and caches the settled projection" (first screen before the rest, a key typed right after the open handled first, per-slice work caps counted by instrumentation, a reopen parses nothing) and "sliced artifacts retain whole-document Markdown context and discard superseded work" (fence and block context across slices, superseded slices dropped). The wall-clock guard in these tests is gross only; the median-largest-slice figure of T-1003 C2 is local evidence the item recorded and is not re-measured here |
| M4 | hub-api | `node --test --test-name-pattern='artifact events refresh an open projection' --test-name-pattern='restart snapshot restores an artifact rendered' --test-name-pattern='moving an open Markdown artifact rebinds' nvim/test/artifact-render.test.ts` | exit 0, `# pass 3`, none skipped. C1, C2, version refresh and the window following: "artifact events refresh an open projection and raw saves replace its cached version" (the new file text is shown, never the previous cached render); "restart snapshot restores an artifact rendered even when it was raw" (the mode is not remembered); "moving an open Markdown artifact rebinds its rendered view and editable raw source" (the view and the toggle keep working on the new path). Window width re-layout is proved by the third test of M1 |
| M5 | hub-api | `node --test --test-name-pattern='palette CTRL-v opens Markdown through the artifact opener' --test-name-pattern='folder entry and md and markdown children open rendered' nvim/test/artifact-render.test.ts` | exit 0, `# pass 2`, none skipped. C1, every opener renders: "palette CTRL-v opens Markdown through the artifact opener with independent centre and split modes and widths" and "folder entry and md and markdown children open rendered from the artifacts browser and toggle to exact raw source" (the folder entry file and `.md`/`.markdown` children, and the palette split, each render and toggle on their own) |
| M6 | hub-api | `node --test --test-name-pattern='recorded prompt drafts stay raw' nvim/test/artifact-render.test.ts` | exit 0, `# pass 1`, none skipped. C1, prompt drafts stay raw: "recorded prompt drafts stay raw and ps and pa send exact saved Markdown bytes with their attachment flag" |
| M7 | hub-api | `node --test nvim/test/artifacts.test.ts` | exit 0, `# pass 9`, none skipped (the 9 tests of the file at writing; the count must equal the file's test count at the build). C1, Mermaid and HTML open as before and the older artifact behaviour is unchanged: includes "recorded frames: artifact chip opens editable Mermaid source and the browser renderer, topic list and picker open artifacts", "recorded frames: prompt drafts are editable full buffers, survive hub events, reopen, and send saved text" and "recorded frames: folder chips open their entry and old moved-file chips open inside the folder" |
| M8 | hub-api | `node --test nvim/test/thread.test.ts` | exit 0, none skipped. C1, the thread's own rendering, which the artifact view reuses, is unchanged (this file is the oracle for `thread_md.lua`) |
| M9 | hub-api | `node --test nvim/test/qa-shipped.test.ts` | exit 0, none skipped (T4). C3: every shipped case, including ARTIFACT-001 and ARTIFACT-002, passes through the headless QA runner; the cases run by hand above are the same cases through the recorder |
| M10 | hub-api | `grep -n '␣v' nvim/README.md` | at least one match in the "Shared artifacts" section: Markdown notes, pages, `.md` and `.markdown` files, including folder entries and children, open in a separate read-only rendered view, `␣v` toggles the exact raw source in its editable file buffer where `:w` saves, and `␣v` toggles only the focused window. C1 (T-796 C4) |
| M11 | hub-api | `npm run typecheck` | exit 0, no diagnostics |

Re-check helper, file and test names with grep at the tested build, renames happen (`grep -n "^test(" nvim/test/artifact-render.test.ts`).

## Probes that mislead

- Process probes exclude their own shell: use `pgrep`'s bracket trick or exclude the probe's process tree.
- Timing is never a criterion here: the 2,000-line and 20,000-line checks rest on the tests' deterministic per-slice caps and parser-call counts, not on stopwatch figures; a slow machine alone is not a FAIL.
- A rendered row with raw markers (`#`, `**`, a backtick, a fence) is a FAIL only once rendering has settled; the grid is read after the tests' own settle wait.
- Targeted test runs obey cover-quiet admission: if the Coordinator holds a cover slot, wait; do not run two test files at once.
- "No skip": all the named files run on Linux and macOS alike; a skipped test (no Neovim) is BLOCKED, never PASS.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

The web workbench's own artifact rendering (E-418), following links in a rendered artifact, a remembered mode across opens, prompt-draft rendering, the real-hardware median of the largest render slice (T-1003 C2 is the item's own local evidence), Linux/macOS stage covers (the Coordinator's business, not judged here), and duration budget lines (report-only).

## Grants

none.

## Verdict

Fix nothing. Clear only when every case and check in scope passes (S0, ARTIFACT-001, ARTIFACT-002, M1-M11). Otherwise not clear, with the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "rendered artifacts"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. The Definition-of-done mapping for the epic's own run:

| epic criterion | evidence in this run |
| --- | --- |
| C1 | ARTIFACT-001, ARTIFACT-002, M1, M4, M5, M6, M7, M8, M10 |
| C2 | M2, M3, M4 |
| C3 | ARTIFACT-001, ARTIFACT-002, M9 |

Report `qa clear E-795 stage rendered artifacts` or `qa not clear E-795 stage rendered artifacts` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
