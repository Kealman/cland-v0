# Stage QA brief: E-1212 stage 1 — mermaid rendering

Everything the run needs is in this file or in the files it names: whoever runs it cannot ask. Commands are for bash (zsh reads `$S:q` as a modifier).

## Stage

- Epic: E-1212, Rendered Mermaid diagrams in the web workbench (under R-1191).
- Exact stage name: mermaid rendering.
- Items: T-1158 (one lane). Findings fixes added to this stage by `task.plan set` after writing are listed in the request; none at writing.
- Policy: affected/after-stage.
- Scope: affected, the combined change of T-1158. A Mermaid `.mmd` artifact opens rendered in the web Artifacts area inside the existing sandboxed viewer, from a capability URL, with its source one physical key away. Mermaid (`mermaid` 12.2.0, pinned in the web workspace only, chosen by the human 2026-10-24 09:34Z) loads lazily on the first `.mmd` open, so the shell's initial bundle grows by at most 1 KB. Rendering uses Mermaid's strict security level in an opaque-origin sandbox, and a diagram that fails to parse shows Mermaid's error with the exact source. HTML and SVG diagrams and every other artifact open as before.
- Verdict marks: a stage verdict carries no epic criterion marks. E-1212's Definition of done has C1; it is marked by the epic's own Definition-of-done run, which includes a check in the human's real browser while the human is present. This stage run is the isolated-browser evidence for it.

## Build

Use a clean detached worktree at the full dev SHA named in the request. HEAD must equal that SHA and refs/heads/dev before and after running. T-1158 must have merged onto dev (`git log --first-parent --grep "T-1158" dev` shows its landing commit). A dirty build, missing merge or moved dev blocks this run; retain any collected evidence and report to the requester. The brief names no commit or run id on purpose: committing a brief changes the tested tree.

Run from that worktree. Symlink the project's installed dependencies before anything else: `ln -s /Users/evgeniyivanov/Projects/cland/v0/node_modules node_modules` (the root install already holds mermaid 12.2.0). Never run npm install or npm ci. Build the web client in the worktree with `npm run build --workspace web` before M3 and M4.

Browser use follows rule 18: only the isolated testing browser the Web tests launch themselves (Chrome Headless Shell with its own user-data-dir). No GUI process, no real browser, no computer use in this run.

## Setup (once, before the checks)

Every command runs with a scratch HOME, XDG and Git config and with the credential and provider variables removed (rule 15), never the human's HOME or the live project. Keep `PATH`, `SHELL` and `TERM`, leave `TMPDIR` at the system default, never use `env -i`. Record the setup as the first note (check id `S0`).

```sh
W="$PWD"                                   # the clean worktree at the tested SHA
RUN=qa-$(date +%F)-1                        # unique run id; bump the suffix on a rerun
Q=$(mktemp -d "${TMPDIR:-/tmp}/qa-e1212-XXXXXX")
mkdir -p "$Q/home" "$Q/xdg/config" "$Q/xdg/state" "$Q/xdg/data"
cat > "$Q/env.sh" <<ENV
export HOME="$Q/home" XDG_CONFIG_HOME="$Q/xdg/config" XDG_STATE_HOME="$Q/xdg/state" XDG_DATA_HOME="$Q/xdg/data"
export GIT_CONFIG_GLOBAL="$Q/gitconfig" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=qa GIT_AUTHOR_EMAIL=qa@example.invalid GIT_COMMITTER_NAME=qa GIT_COMMITTER_EMAIL=qa@example.invalid
for v in \$(env | cut -d= -f1 | grep -E '(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|COOKIE)|^(ANTHROPIC|OPENAI|CODEX|CLAUDE|GEMINI|GOOGLE|GH|GITHUB|AWS|DIGITALOCEAN|DO|NPM|SSH|CLAND)_'); do unset "\$v"; done
unset SSH_AUTH_SOCK
ENV
. "$Q/env.sh"; : > "$Q/gitconfig"; cd "$W"
echo "TMPDIR=$TMPDIR"; echo "$Q"
```

Every check below starts with `. "$Q/env.sh"; cd "$W"`. Cleanup at the end, after the evidence is recorded: print `$Q`, check it begins with the system TMPDIR and `qa-e1212-`, and remove it by its literal path with a non-force `rm -r`.

## Cases

none. The stage has no headless-grid case; every check is a manual check below.

### Web cases (when in scope)

none in this run: no real-browser case. The human's-browser check belongs to E-1212's Definition-of-done run.

## Manual checks

Record each with `sh .agents/skills/qa/qa-record.sh note E-1212 "$RUN" <id> hub-api "<command>" <PASS|FAIL|INCONCLUSIVE|BLOCKED> <evidence-file…>`, saving the output under `.cland/qa/E-1212/$RUN/<id>.txt` first. Test files run one at a time from `$W`, under cover-quiet admission (if the Coordinator holds a cover slot, wait). A skipped test is BLOCKED, never PASS: read the `# pass`, `# fail` and `# skipped` counts and confirm that `# pass` equals the number of tests the check names. A `--test-name-pattern` that matches nothing exits 0 with `# tests 0`: that is a failure.

| id | surface | command | expected |
| --- | --- | --- | --- |
| M1 | hub-api | `node --test --test-name-pattern='diagram HTML, SVG and Mermaid use the sandboxed viewer' --test-name-pattern='Mermaid strict mode blocks source scripts' web/test/artifacts.test.ts` | exit 0, `# pass 2`, none skipped. C1: a `.mmd` artifact opens rendered (an SVG with diagram nodes) in the sandboxed viewer from a capability URL, HTML and SVG diagrams still open there, and the source is one physical key away and back ("diagram HTML, SVG and Mermaid use the sandboxed viewer with source one physical key away"); strict mode blocks scripts, event attributes and click callbacks in diagram text, leaving the frame and parent sentinels unchanged, and a parse failure shows Mermaid's message with the exact source ("Mermaid strict mode blocks source scripts and callbacks, and a parse failure retains its message and exact source") |
| M2 | hub-api | `node --test web/test/artifacts.test.ts` | exit 0, none skipped, `# pass` equal to the file's test count at the build (`grep -c "^test(" web/test/artifacts.test.ts`). The other artifact behaviour of the web workbench is unchanged |
| M3 | hub-api | `node --test hub/test/web-artifacts.test.ts` | exit 0, none skipped, `# pass` equal to the file's test count (`grep -c "^test(" hub/test/web-artifacts.test.ts`). Capability URLs, confinement, the script-only sandbox and expiry are unchanged with the rendered route added |
| M4 | hub-api | `npm run build --workspace web && node web/check-shell-size.ts 455323 1024` | both exit 0. The baseline 455,323 bytes is the initial shell script measured before T-1158 (T-1158's ready report A-10701); the check asserts one initial script, no modulepreload, and growth of at most 1,024 bytes. Record the printed byte count |
| M5 | hub-api | `grep -n '"mermaid"' web/package.json package.json hub/package.json nvim/package.json 2>/dev/null; node -e 'console.log(require("./node_modules/mermaid/package.json").version)'` | exactly one match, `"mermaid": "12.2.0"` in web/package.json, and the installed version prints 12.2.0 |
| M6 | hub-api | `npm audit --omit=dev --json > "$Q/audit.json"; echo exit $?; node -e 'const a=require(process.argv[1]);console.log(JSON.stringify(a.metadata.vulnerabilities))' "$Q/audit.json"` | the printed vulnerability counts are all 0 (the KaTeX advisory GHSA-238p-pmpm-9mq7 carried by mermaid 12.1.0 is gone). A network failure of npm audit is INCONCLUSIVE, never PASS. Save the JSON as evidence |
| M7 | hub-api | `grep -n "render=mermaid\|securityLevel" web/README.md` | at least one match for each: the README describes the `?render=mermaid` capability route and the strict security level |
| M8 | hub-api | `npm run typecheck` | exit 0, no diagnostics (the typecheck also checks web colours and contrast) |

Re-check test names with grep at the tested build; renames happen (`grep -n "^test(" web/test/artifacts.test.ts`).

## Probes that mislead

- A rendered-frame wait proves rendering only once the Mermaid SVG has diagram nodes; an empty SVG or the loading state is not a render.
- `npm audit` needs the network; its failure says nothing about the dependencies.
- The size check compares against the fixed pre-change baseline in M4, not against the current dist, and measures the built output: run the web build first.
- Targeted test runs obey cover-quiet admission: if the Coordinator holds a cover slot, wait; do not run two test files at once.
- "No skip": the Web tests need the isolated browser the harness provides; a missing browser makes a test skip or block, which is BLOCKED, never PASS.
- Re-check helper and function names with grep at the tested build; renames happen.

## Out of scope

The human's real browser and phone (E-1212's Definition-of-done run). Rendering performance on very large diagrams. Other artifact kinds in Neovim. Publishing to cland.app.

## Grants

None beyond the defaults: no network except `npm audit` in M6, no GUI, no harness process, no droplet.
