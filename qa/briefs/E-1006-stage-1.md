# Stage QA brief: E-1006 stage 1 — summaries, settling, quiet writes and the startup budget

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-1006, Fast Neovim workbench start (P1).
- Exact stage name: summaries, settling, quiet writes and the startup budget.
- Items: T-1007, T-1008, T-1009, T-452, T-1010 (lanes: T-1007; T-1008; T-1009 then T-452; T-1010). Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: the combined changed behaviour of the five items. T-1007: `task.list` has a summary projection (no body, comments, verdict history, plans or verification) with a state filter, and the explorer loads open items first and closed ones lazily. T-1008: after startup the workbench applies hub events and sends no periodic full re-reads; the header shows the Coordinator and sessions as soon as `session.list` answers. T-1009: uncontested tracker writes leave no `.conflict` capture. T-452: finalized captures are pruned after seven days (at tracker start and hourly) and `cland doctor` has a `tracker conflicts` row. T-1010: a Neovim startup budget smoke test on a generated 1,000-item tracker.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. All listed items must have merged onto dev (`git log --first-parent --grep "Item: T-1007" dev`, likewise the other four). A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree, with `npm install` already done there (worktrees share the root's `node_modules`; symlink it if the worktree has none). Neovim comes from `node nvim/bin/nvim-path.ts` and must match `nvim/NVIM_VERSION`.

## Setup (once, before M1)

Every check runs in a disposable scratch project with its own HOME, XDG and Git config (rule 15). Never the live project, never the human's HOME, no GUI, no real browser. Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-$(date +%F)-1                        # unique run id; bump the suffix on a rerun
EV="$W/.cland/qa/E-1006/$RUN"; mkdir -p "$EV"
Q=$(mktemp -d /tmp/qa-e1006-XXXXXX)         # scratch root: HOME, XDG, Git config, project
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

Cleanup at the end, after the evidence is recorded: `( . "$Q/env.sh"; cd "$Q/p" && cland hub stop )`, then print `$Q` and remove it by its literal path with a non-force `rm -r` after checking it begins with `/tmp/qa-e1006-`.

## Cases

none. Every check below is a named test file or a manual check in the scratch project.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-1006 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, putting the capture in `$EV/<id>.txt` first. Scratch-project checks begin with `. "$Q/env.sh"; cd "$Q/p"`. Test-file checks run from `$W` under cover-quiet admission: no cover is running and this session runs one test file at a time (targeted runs take no suite lease; wait if the Coordinator holds a cover slot).

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test nvim/test/startup-budget.test.ts` | exit 0; three tests pass and none is skipped (a skip means Neovim was not found: BLOCKED): "thousand-item workbench startup fits the time and first-payload budgets", "a slowed task.list trips the rendered startup time budget", "bodies added to the first task.list trip the payload byte budget". Budgets are 3,000 ms and 131,072 bytes (`docs/agents/tests.md`, "Neovim workbench startup budget (T-1010)"); the file is T3 in `hub/test/tiers.json` and belongs to the Neovim smoke set (`NVIM_SMOKE`) |
| M2 | hub-api | `node --test --test-name-pattern='summary projection bounds' hub/test/tracker-summary.test.ts` | exit 0 and the test "summary projection bounds the first open payload in a thousand-item tracker and preserves default lists" passes: on a 1,000-item fixture (100 open) the open-only first payload is under 60 KB, the projection carries no body, comments, verdict history, plans or verification, and an unprojected `task.list` answers as before. Copy the output lines that record the all-items projection bytes into the note |
| M3 | hub-api | `node --test hub/test/tracker-summary.test.ts hub/test/tracker-criterion-write.test.ts` | exit 0; includes "list summaries omit import metadata and bookkeeping frontmatter available in view", "watcher notifications and rescans ignore conflict captures without emitting an item change" (T-1009 C4) and "uncontested CLI and hub task writes leave no conflict captures" (T-1009 C2) |
| M4 | hub-api | `cland task create "qa quiet write" --size S; cland task edit T-1 --title "qa quiet write edited"; cland task comment T-1 "qa comment"; sleep 3; ls -a .cland/tasks \| tee "$EV/M4-ls.txt"; find .cland/tasks -name '*.conflict' \| wc -l` | the three commands exit 0 against the running scratch hub; the id printed by `task create` is the one edited (use it if it is not `T-1`); `find` prints `0`; the listing has the item file and no `.conflict`, `.tmp` or `.criterion-capture-*` file |
| M5 | hub-api | `cland doctor . \| tee "$EV/M5.txt"; grep -c 'tracker conflicts' "$EV/M5.txt"` | `grep` prints `1`; the row reads `tracker conflicts` with verdict `ok` and detail `0 live captures; 0 differ from current item files` (from M4). Proven for the warn path by `hub/test/doctor.test.ts` (the test that writes `same`, `changed` and `missing` captures and expects `3 live captures; 2 differ from current item files: …`); run `node --test --test-name-pattern='doctor counts live captures' hub/test/doctor.test.ts` and record its exit 0 |
| M6 | hub-api | `cland hub stop; printf 'x' > ".cland/tasks/T-1-qa.md.00000000-0000-4000-8000-000000000000.conflict"; cland hub start; sleep 5; ls .cland/tasks \| grep -c '\.conflict$'; cland doctor . \| grep 'tracker conflicts'` | a capture created seconds ago is retained across the hub start (`grep -c` prints `1`): retention counts from the latest of mtime, ctime and birthtime, so a fresh capture must survive; the doctor row is `warn` and names the capture as differing (item missing), and doctor did not delete it (also with `--fix` never). This is the real-process negative control; it does not prove the age rule |
| M7 | hub-api | `node --test hub/test/tracker-conflict-captures.test.ts` | exit 0; three tests pass: "retention deletes only expired finalized captures, preserving intents and item bytes", "an old mtime cannot expire a freshly captured inode and abort prevents deletion", and "tracker prunes at startup and hourly while task writes preserve their canonical file". The last one is the proof that a capture older than seven days is pruned at tracker start (fake clock) and again hourly, while exactly seven days is retained and the canonical item file is untouched. A real eight-day-old capture cannot be staged in a scratch project: ctime and birthtime cannot be set backwards, and retention takes the latest of the three. Record this limit in the note |
| M8 | hub-api | `node --test --test-name-pattern='a reconnect reads each startup list once then settles for ten fake minutes' nvim/test/shell-component.test.ts` | exit 0 and the named test passes, not skipped: after a reconnect each of `task.list`, `topic.history`, `events.list`, `session.list`, `artifact.list`, `rule.list` and `account.list` is read once, then no further full read is sent through ten fake minutes while `task` events update the explorer row (T-1008 C2, C3, C5) |
| M9 | hub-api | `node --test --test-name-pattern='the header shows sessions and Coordinator while the startup items list is delayed' nvim/test/shell-component.test.ts` | exit 0 and the named test passes, not skipped (T-1008 C4: the header shows the Coordinator and session count once `session.list` answers, with `task.list` delayed) |
| M10 | hub-api | `node --test nvim/test/explorer-component.test.ts nvim/test/explorer-card-component.test.ts` | exit 0, none skipped: on start the explorer requests open items only, closed items load when the group is expanded or searched, and opening a card reads the body with `task.view` (T-1007 C2, C3) |
| M11 | hub-api | `npm run typecheck` | exit 0, no diagnostics (the wire types and `hub/test/wire-conformance.ts` accept the summary projection) |

## Probes that mislead

- Process probes exclude their own shell: use `pgrep`'s bracket trick or exclude the probe's process tree.
- File-change probes use isolation; mtime alone is confounded by live sessions rewriting the same file. `ls` and `find` run only in the scratch project under `$Q`, never in the live `.cland/tasks`.
- A `skip` from the Neovim tests (no Neovim found) is BLOCKED, never PASS: check the `ℹ skipped` count, and that the named test appears in the output (a name pattern that matches nothing exits 0 with no test run).
- The `.conflict` count of M4 is meaningful only on a quiet scratch project: no other writer touches `$Q/p/.cland/tasks`.
- Speed criteria use measured wall times, never projections: the startup budget is a hard limit in the test, not load-scaled.
- "No skip": the startup budget and the Neovim component tests need Neovim on Linux and macOS; the hub tests are platform-independent. Where a platform skips a case, name it in the note.
- Re-check helper, test and file names with grep at the tested build; renames happen.

## Out of scope

The live measurement on the human's Mac against a copy of the live tracker is the epic's own C1 (the Definition of done), run separately with `node nvim/test/startup-budget-probe.ts <tracker dir>`; this stage brief does not run it and records no live-tracker figure. Also out of scope: Linux/macOS stage covers (the Coordinator's business, not judged here), duration budget lines (report-only), items outside the five listed, and any check that touches the live project.

## Grants

none.

## Verdict

Fix nothing. Clear only when every check M1-M11 and S0 passes. Otherwise not clear, naming the failing, blocked or inconclusive ids and findings. On the epic record one QA verdict with `--stage "summaries, settling, quiet writes and the startup budget"`, the full tested dev SHA, the unique run id and the case table. Stage QA carries no epic criterion marks. Report `qa clear E-1006 stage summaries, settling, quiet writes and the startup budget` or `qa not clear …` to the requester in the epic topic. Keep recorded evidence if publication fails; follow the qa skill's recovery procedure.
