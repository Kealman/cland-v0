# Stage QA brief: E-1006 stage 2 — the read loop and the startup replies

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-1006, Fast Neovim workbench start (P1).
- Exact stage name: the read loop and the startup replies.
- Items: T-1037, T-1038 (lanes: T-1037; T-1038). Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the two items. T-1037: Neovim's hub read loop (`nvim/lua/cland/hub.lua`, `Client:_data`) keeps pending chunks and joins them only when a newline arrives, so a multi-megabyte frame decodes in linear time and memory. T-1038: the eight startup replies Neovim reads are bounded at their source. `hub.status` by default carries live suites and at most 20 completed summaries, with full history behind `history: true` / `cland hub status --history`. General `topic.history` pages are byte-capped at 256 kB of complete messages, with the before-id continuation. `artifact.list` pages 100 rows newest first, with a cursor. Neovim reads further pages only on demand. The startup smoke budget guards every startup reply's bytes. Nothing else: the hub's 39 s startup on a copied project is T-1039, outside this stage.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. Both items must have merged onto dev (`git log --first-parent --grep "Item: T-1037" dev`, likewise T-1038). A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree, with `npm install` already done there (worktrees share the root's `node_modules`; symlink it if the worktree has none). Neovim comes from `node nvim/bin/nvim-path.ts` and must match `nvim/NVIM_VERSION`.

## Setup (once, before M1)

Every check runs in a disposable scratch project with its own HOME, XDG and Git config (rule 15). Never the live project, never the human's HOME, no GUI, no real browser. Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-$(date +%F)-1                        # unique run id; bump the suffix on a rerun
EV="$W/.cland/qa/E-1006/$RUN"; mkdir -p "$EV"
Q=$(mktemp -d /tmp/qa-e1006s2-XXXXXX)         # scratch root: HOME, XDG, Git config, project
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data" "$Q/p"
cat > "$Q/env.sh" <<ENV
export HOME="$Q/home" XDG_CONFIG_HOME="$Q/xdg/config" XDG_STATE_HOME="$Q/xdg/state" XDG_DATA_HOME="$Q/xdg/data"
export GIT_CONFIG_GLOBAL="$Q/gitconfig" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=qa GIT_AUTHOR_EMAIL=qa@example.invalid GIT_COMMITTER_NAME=qa GIT_COMMITTER_EMAIL=qa@example.invalid
unset CLAND_HUB_URL CLAND_HUB_SECRET CLAND_HUB_FILE CLAND_SESSION_ID CLAND_SESSION_NAME CLAND_ROLE
cland() { node "$W/hub/bin/cland.ts" "\$@"; }
ENV
. "$Q/env.sh"; : > "$Q/gitconfig"
( cd "$Q/p" && git init -q -b dev && git commit -q --allow-empty -m init && cland init . && cland hub start )
```

Cleanup at the end, after the evidence is recorded: `( . "$Q/env.sh"; cd "$Q/p" && cland hub stop )`, then print `$Q` and remove it by its literal path with a non-force `rm -r` after checking it begins with `/tmp/qa-e1006s2-`.

## Cases

none. Every check below is a named test file or a manual check in the scratch project.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-1006 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, putting the capture in `$EV/<id>.txt` first. Scratch-project checks begin with `. "$Q/env.sh"; cd "$Q/p"`. Test-file checks run from `$W` under cover-quiet admission: no cover is running and this session runs one test file at a time (targeted runs take no suite lease; wait if the Coordinator holds a cover slot).

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test nvim/test/hub-read-component.test.ts` | exit 0; both tests pass and neither is skipped (a skip means Neovim was not found: BLOCKED): "a 20 MiB frame in 64 KiB chunks decodes once within 2 s and bounded allocation" and "split, coalesced and partial lines preserve frame order and drop malformed lines" (T-1037 C1, C2). Copy the decode time and allocation lines into the note |
| M2 | hub-api | `node --test hub/test/hub-status-component.test.ts` | exit 0; every test passes, including "default hub status bounds completed suite history and preserves explicit historical diagnostics", "topic history pages complete messages by bytes and reads the next before-id page", "artifact pages are newest first and an exclusive cursor reaches the next page", "eight startup replies and byte guards work on a small durable fixture" and "full status retains a large fragmented response" (T-1038 C2 guards, C4) |
| M3 | hub-api | `node --test hub/test/startup-replies-scale.test.ts` | exit 0; "eight startup replies fit per-frame and total budgets on a thousand-item durable fixture" passes (T-1038 C2 at scale). It is T3 with a dated 10 s duration allowance owned by C-325 for T-1039; its wall time is recorded, not judged here |
| M4 | hub-api | `node --test nvim/test/startup-budget.test.ts` | exit 0; four tests pass, none skipped: the three from stage 1 plus "an oversized non-item startup reply trips the per-reply byte budget" (T-1038 C3) |
| M5 | hub-api | `node --test --test-name-pattern='fetch the next page only on human demand|byte-capped pages shorter than the row limit|older-page rendered artifact survives' nvim/test/artifacts.test.ts` | exit 0; the three named tests pass, not skipped: the artifact browser and palette fetch the next page only on human demand; the archived General thread follows byte-capped pages; an older-page rendered artifact survives a reconnect (T-1038 C4) |
| M6 | hub-api | `cland hub status --json \| wc -c; cland hub status --history --json \| wc -c; cland hub status \| head -20` | both commands exit 0 against the scratch hub; the default output is a few kilobytes and carries the hub block, web line and sessions; `--history` is accepted and is at least as large as the default (the scratch hub has little history, so the sizes may be close) |
| M7 | hub-api | `node --test nvim/test/shell-component.test.ts` | exit 0, no skip: the stage-1 reconnect and header tests still pass with the paged replies (no regression of T-1008) |
| M8 | hub-api | `npm run typecheck` | exit 0, no diagnostics |

## Probes that mislead

- Process probes exclude their own shell: use `pgrep`'s bracket trick or exclude the probe's process tree.
- A `skip` from the Neovim tests (no Neovim found) is BLOCKED, never PASS: check the `ℹ skipped` count, and that each named test appears in the output (a name pattern that matches nothing exits 0 with no test run).
- Speed criteria use measured wall times, never projections: the 2 s decode and the startup budget are hard limits in the tests, not load-scaled.
- Never treat the live project's `hub status` as evidence; the scratch hub is the one under `$Q/p`. Confirm `pwd` before M6.
- "No skip": the Neovim tests need Neovim on Linux and macOS; the hub tests are platform-independent. Where a platform skips a case, name it in the note.
- Re-check helper, test and file names with grep at the tested build; renames happen.

## Out of scope

The live-tracker figures (A-8170: eight replies 438,745 bytes; hub.status 4,326 bytes) are the implementer's local evidence and are not repeated here. The human's own 3-second measurement (E-1006 C1) and the 10-minute idle check (C2) belong to the epic's Definition of done, not this stage. Hub startup time is T-1039. Also out of scope: Linux/macOS stage covers (the Coordinator's), duration budget lines (report-only), items outside the two listed, and any check that touches the live project.

## Grants

none.

## Verdict

Fix nothing. Clear only when every check M1-M8 and S0 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "the read loop and the startup replies"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-1006 stage the read loop and the startup replies` or `qa not clear …` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
