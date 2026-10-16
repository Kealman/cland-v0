// Shared help text: keep this module free of command implementation imports.
export const IMPORT_USAGE = `  task import-github [--repo owner/name] [--all]
                  GitHub Issues → items, through \`gh\`; open issues (--all: closed too); re-runs update in place
`;

export const ACCOUNT_USAGE = `  account list [--refresh] [--json]   list the user-level account names, harnesses, paths and limit windows\n  account clear <name>              lift an account's limited mark by hand\n`;

export const OPEN_USAGE = `  open [dir]      start the project's hub if none runs, then the workbench in Neovim
                  (what \`cland\` with no command does on a terminal)
`;

export const SUITE_USAGE = `  verify [all|hub|nvim] [--all] [--fresh] [--executor local|droplet] [--workers N] [--size <slug>] [--occasion stage|epic|release] --report <topic|session> [--to <session>] [--json]
                  occasion: integrated dev closes only (Coordinator; QA epic); batch runs stay on one slot
  suite           alias for verify\n                  run typecheck and the package suite detached; post one artifact-backed result
  verify cancel [<suite id>] [--json]
                  cancel your active suite (human: any explicit id); post its cancelled result
  verify queue [--json]
                  show local holder, remote runs, executor waiters, waits, admission ETA and recent timing metrics
  verify classify <run> load-flake --note <text> [--json]
                  Coordinator or human: reclassify a red cover, retaining its derived cause and tests
`;

export const EXECUTOR_USAGE = `  executor status [--json]  token presence, live droplet leases and today's cost
  executor prepare [--report <topic>] [--json]  submit snapshot preparation
  executor reap [--json]    delete orphaned and expired cland droplets
`;

export const QA_USAGE = `  --headless --qa <case.lua> [--out <dir>] [--hub stdio|stub] [--timeout <seconds>]
                  run one QA case in a headless workbench on a fixture project; prints one JSON line
                  (case, result, duration_ms, build, hub, evidence) and exits 0 (PASS), 1 (FAIL) or
                  2 (INCONCLUSIVE, BLOCKED). --out: the screen and state dumps go there as files,
                  else they are printed inline. --hub: the hub the case runs against, whatever it names
`;

export const INIT_USAGE = `  init [dir]      prepare the project (dir, else the one around the current directory) for cland: .cland/,
                  skills, docs/agents/, AGENTS.md's block, hooks and local git territory; idempotent (--json)
                  --undo restores the territory's remotes/root branch; --force discards territory-only refs
  update [dir]    rewrite what cland manages in an initialised project to this version; nothing else
`;

export const DOCTOR_USAGE = `  doctor [dir]    check the harnesses, gh, Neovim, the hub and what cland init provisioned; one line per
                  check with the fix for each problem; exits 1 on a failure (--json for JSON; --fix ends owned orphan servers and deleted-project hubs)
`;

export const HUB_USAGE = `  hub start       start the project's hub in the background (idempotent)
                  --autostart: honor the deliberate-stop grace period; --client cli|nvim|other identifies the starter
  hub subscriptions list every session's event subscriptions (--json for JSON)
  hub reload      validate and reload config.toml and roles.toml (also SIGHUP)
  hub status      show the running hub and its connected sessions (--json for JSON)
  hub stop        stop the project's hub
  hub serve       run the hub in the foreground (what start runs)
                  --stdio: also speak the UI's frames on stdin/stdout, and stop when stdin ends;
                    when the listeners cannot bind (a sandbox), it goes on over stdio alone
                  --stdio --no-listen: stdio alone, binding nothing
  hub audit       every tool call the hub answered, allowed or refused (.cland/log/hub.log)
                  --session <name> (human: the UI and the CLI), --since <ISO time | 30m, 2h, 1d>, --json
  hub unmute <a> <b>
                  lift the loop breaker's mute of two sessions before its cool-down ends
  hub journal     the journal (.cland/journal.jsonl), oldest first
                  --since <ISO date | 30s | 10m | 2h | 1d>, --kind <event>[,<event>…], --json (the lines as they are)
`;

export const TASK_USAGE = `  task create <title> [--kind k] [--size XS|S|M|L] [--regression-of <id>] [--found-by review|cover|droplet|qa|human] [--version semver] [--body t | --body-file f] [--label l]… [--assignee a]
                  [--parent <id>] [--blocked-by <id>]… [--follows <id>]… [--topic t] [--branch b]
  task view <id> (any kind prefix in either case, or a bare number)
  task migrate [--dry-run] [--sizes <JSON-file>] [--json] (offline prefixes, references, titles, categories and retired labels)
  task plan migrate (retire qa-required labels, report policy fallbacks)
  task plan <set|show|approve> <epic-id> [--file plan.yaml] [--reason text] [--allow-large <id>=<reason>]…
  task list [--under <id>] [--state open|closed] [--label l]… [--kind k] [--assignee a] [--verdict review=clear]
  task comment <id> <text> [--verdict review|qa --result clear|"not clear" --run <id> [--commit <sha>] [--scope full|delta|evidence] [--stage <name>] [--finding high|medium|low:text[@file:line]]… [--verified C1,C3|all | --failed "C1=note"]…]
  task edit <id> [--found-by review|cover|droplet|qa|human|none] [--version semver|none] [--title t] [--body t | --body-file f] [--kind k] [--size XS|S|M|L] [--state s] [--status s] [--label l]…
                  [--add-label l]… [--remove-label l]… [--assignee a|none]
  task close <id> [--comment t] [--override reason (human shell only)]
  task link <id> [--regression-of <id>|none] [--parent <id>|none] [--blocked-by <id>]… [--follows <id>]… [--unblock <id>]… [--unfollow <id>]… [--topic t|none] [--branch b|none]
  task hold <id> [--release] (Reviewer or QA verification beside the claim)
  task criterion <id> <done|verify|fail|edit|remove> <C-n> [--run r] [--note t] [--text t]
  task criterion <id> add <text>
  task rank <id> <--top | --before <id> | --after <id>>
  task claim <id> [--release] [--force]
                  claiming an open task in a project with a territory makes (or reuses) its branch
                  t/T-<n>-<slug> and its worktree .cland/worktrees/T-<n>
${IMPORT_USAGE}                  every task command takes --json, and --as <name> [--role r] (default: "human"). In a
                  launched session's shell ($CLAND_SESSION_ID / $CLAND_SESSION_NAME) the call is always
                  that session's, checked against its role as its own tools are; --as cannot change it.
                  The human acting --as a session the hub knows is checked against that session's role
`;

export const SESSION_USAGE = `  session launch <name> [--role r] [--model m] [--harness claude-code|opencode|codex] [--account name] [--effort e] [--cwd dir | --item T-<n>] [--brief text|A-<n>]
                  launch a harness session through the hub; a role's launch defaults
                  (.cland/roles.toml) fill the harness, model, effort and account not given; --item starts an
                  Implementer in its task worktree, or a Lead on an open epic/release at the root, with its claim;
                  --brief delivers text or an artifact's content once after the role clause
  session list [--archived]    launched sessions and the archived count (--json for JSON); --archived shows only the archive
  session archive <name>  archive a stopped or exited session
  session prune --older-than <duration> [--dry-run]  remove old archived session records; keep the journal
  session attach <name>   print the command that attaches a terminal to the session
  session stop <name>     stop the session through its harness
  session resume <name> [--relaunch | --fresh]   re-find the session's process; --relaunch starts a new one on the same
                  conversation, stopping the old one first when it still runs (keeps its role and valid item claim); --fresh starts a new
                  conversation with the recorded brief when native resume cannot
  session retry <name> <message id>    send again a message whose inject got no answer
                  (its delivery is uncertain: the turn may have started; never retried on its own)
`;

export const WORKTREE_USAGE = `  worktree list   the task worktrees (.cland/worktrees/T-<n>): item, branch, the item's state, the commits
                  its base lacks and the sessions standing inside (--json for JSON)
  worktree prune [--yes]   the human's: each closed item's worktree with its unmerged commits, removed with
                  its branch after a y (--yes: all); refused from a session's shell
`;

export const MERGE_USAGE = `  merge <T-id> [--json]   land one task as a squash commit on its task base (dev); Coordinator or human
    --override <reason>   the human's shell only: skip verdicts and criteria for tracker/docs only; record why and unmet criteria
                          allowed: .cland/tasks/**, .cland/RULES.md, docs/**, GLOSSARY.md, README.md files, qa/briefs/**
                          other paths require review; conflicts still refuse
`;

export const PUSH_USAGE = '  push [--json]         fast-forward territory dev to root dev; Coordinator’s shell or human\n';

export const RELEASE_USAGE = `  release <vX.Y.Z> [--dry-run] [--json]   publish dev as GitHub main and an annotated tag atomically; Coordinator's shell or human
  release --item T-n [<vX.Y.Z>] [--dry-run] [--json]   publish the release item's version and notes, then close it
  sync [--json]          fetch GitHub main and replay unreleased dev commits; never pushes to GitHub
`;

export const ROLE_USAGE = `  role set <session> <role>   assign a role (coordinator, lead, implementer, reviewer, qa, aide) to a session,
                  live or not yet connected; the session gets the role's clause
                  --note-file <file>  with a handover note (Markdown: Goals now, Work in flight, Open decisions,
                                      Waiting on); the Coordinator moves from its holder, who is told to stop
                  --move              move the Coordinator from its holder without a note
                  --item T-n         move this Lead node to the receiver (with --move or --note-file)
  role clear <session>        revoke the session's role
  role list       the roles, their launch defaults and holders (--json for JSON)
`;

export const CREW_USAGE = `  crew show       effective staffing policy and summary (--json)
  crew set <role>.<key> <value>  validate and save staffing; leads takes a TOML list
  crew set idle_from <id|list>  open categories in order; [] means never
`;

export const INBOX_USAGE = `  inbox [--json] [--archive] four sections: asks and approvals, plan approvals, requests to you, messages to you
                          newest first, all rows with ids, subjects, senders and waiting ages;
                          last 'needs you: <n>'
                          (--json for the hub's Inbox frame)
                          --archive prints departures from the last seven days, newest first, with when and why
`;

export const TOPIC_USAGE = `  topic answer <ask id> <option number> [--as <stand-in name>]
                          answer an ask with its option n (1-based): prints
                          'answered <ask id> in <topic title>: <the answer>'
    topic answer <ask id> --text "<free answer>" [--as <stand-in name>]
                          answer an ask with a free answer; the hub's refusals (an ask not open, an option
                          out of range, a free answer to an options-only ask) print 'cland: <error>', exit 1
`;

export const HOOK_USAGE = `  hook <event>    from inside a launched session (its hooks, the cland mod): post a signal to the hub
                  --session <name> --launch <id> --hub-file <path>; the harness's JSON payload on stdin
                  (worktree-create --worktree <path>: refuses the harness's own worktree, exit 2)
`;

export const ARTIFACT_USAGE = `  artifact new --kind prompt|note|page|diagram|file --title <title> --topic <topic>
                  --path <file|directory> | --content <text> | --content-file <file|-> (stdin with -)
                  [--folder] [--entry <relative-file>] (create is an alias for new)
  artifact promote <A-id> <project-relative-path> [--json]
  artifact open <A-id> [--json] (VISUAL, EDITOR, else nvim; --json resolves without an editor)
  artifact keep <A-id> [--release] [--json]
  artifact move <A-id> <folder-A-id> [--name <filename>] [--json]
  artifact archive <A-id> [--json]
  artifact list [--topic <topic>] [--json]
                  persistent files shown in topics; all commands accept --json
`;

export const SUBSCRIPTIONS_USAGE = `  subscribe <session|item|topic|role|subtree> <subject> --event <session.state|task|topic|usage|artifact> [--event e]… [--digest turn|now] [--cost USD|--tokens N]
  unsubscribe <subscription id>
  subscriptions  list the caller's subscriptions
                  --as <session> from the human CLI; launched shells use their own identity; --json
`;

export const RULE_USAGE = `  rule add <text> --scope <roles>|all --reason <text> [--title t] [--origin memory:<path>]
  rule edit <n> [--title t] [--text t] [--scope s] [--reason r]
  rule retire <n> --reason <text>
  rule list [--all] [--role r]
  rule show <n>   read one rule; every rule command takes --json
                  writes belong to the human shell or an Aide; other sessions propose to the Coordinator
`;

export const DEMO_USAGE = `  demo start <epic> [--commit <sha>] [--json]  lease a demo droplet
  demo exec <epic> -- <command…>              run in the delivered tree
  demo stop <epic> [--json]                  release the demo droplet
  demo status <epic> [--json]                show commit, lifetime and cost
`;

export const CONFIG_USAGE = `  config set <section.key> <value> [--json]  validate and save one managed config.toml value\n`;
