# The tour

The staged tour of cland, offered once the Coordinator runs. Teach one stage per round, in the human's language and your own words, tied to what is on their screen now: this project's release, sessions and rules. Every stage ends with its "look now", then one question: the next stage, or stop here? Keys are for looking; anything that changes the project is said to a session, which acts.

## 1. The workbench

cland's window in the terminal, built on Neovim. The top bar names the project and the view in the centre, then the Coordinator chip (its session and state, or a red "no coordinator"), the "needs you" count and the number of sessions. On the left, the items panel (space then i). In the centre, one view at a time: a conversation, a session's terminal, an item, the explorer. On the right, your inbox (space then n), the sessions (space then s) or the topics (space then t). The status line at the bottom shows the hub's connection and short hints. Space then ? lists every key; space then space returns to the previous centre view; Ctrl with h, j, k or l moves between the panels.

Look now: the Coordinator chip in the top bar, and the sessions panel with the Coordinator and me.

## 2. Items, the explorer and the card

Items are the project's to-do list, versioned with the code in `.cland/tasks/`. A release is a version you ship and holds epics and tasks; an epic is a larger feature split into tasks; a task is one change one session can make; a category (Bugs, Tech debt, Follow-ups, Ideas) holds work outside any release; a map with its questions charts a goal before its tasks exist. A task moves through backlog, planned, in progress, review, qa, ready and done, and the hub moves it as the work goes. The explorer (space then e) shows the tree in the centre and, beside it, the card of the item under the cursor: its summary, status, progress, latest verdict and who works on it. You never edit items by hand: tell the Coordinator or me what to change.

Look now: release R-<n> in the explorer, and the card of its first task.

## 3. Conversations: topics, General, the inbox and asks

Topics are conversations. General (space then g) is the standing one with the Coordinator: write there what you want, and it answers there. Each task gets a topic of its own where its sessions report; the topics panel (space then t) lists them, the ones waiting for you first. Your inbox (space then n) holds only what needs you: asks and approvals, plan approvals, requests for your own review, and messages to you. An ask is a decision with numbered options that the Coordinator puts to you: press the option's number on its card, or i to answer in your own words; the work that waits on it carries on after. The "needs you" count in the top bar counts these.

Look now: General with the Coordinator's first report, and the "needs you" count.

## 4. Sessions, roles and the crew

A session is one AI agent at work, with its own terminal and conversation; its role is its job in the crew. The sessions panel (space then s) lists each one: name, role, agent and model, state (busy, idle, waiting for you) and the task it holds. Enter on a row opens its terminal in the centre, where you can watch it or talk to it; Ctrl and \ leaves it. The line above the list sums up the crew, for example "impl per item · rev pool 1 · qa 1 · leads: none": how many sessions of each role may run. The crew lives in `.cland/crew.toml`, and the agent and model of each role in `.cland/roles.toml`; the Coordinator or I change them when you decide.

Look now: the Coordinator's row and its state, and the crew line above the list.

## 5. The life of a task

The Coordinator takes the next planned task and launches an Implementer for it. The Implementer works on a branch of its own (`t/T-<n>-…`) in a folder of its own (a worktree, under `.cland/worktrees/`), so tasks never step on each other. When the change is ready, it marks the acceptance criteria done and asks a Reviewer; the verdict, clear or not clear with the reasons, lands in the task's topic. After a clear review, cland verify runs the project's own checks, the check and test commands recorded with the stack, and posts the result there. Then the Coordinator merges the task into `dev` as one commit, and the task closes. Nothing reaches GitHub before a release, and releases are yours to decide.

Look now: the first task's card, its status and the session that holds it, then its topic once it has one.

## 6. Artifacts

Artifacts are files a session shows you: a plan, a report, a test result, a diagram, this onboarding's welcome note. Each appears as a chip in a conversation, and Enter on a chip opens it. Space then a lists them all; in a conversation, g then a opens the artifacts browser. Yours and mine stay until deleted; an agent's stays with its topic unless it is kept.

Look now: the welcome note's chip in General.

## 7. The rulebook

The project's own rules for how its work is done, numbered: who decides what, how to build, what never to do. Every session receives the rules of its role at launch, and a changed rule as it changes. Space then R opens the rulebook, and Enter on a rule shows its reason and where it came from. You never edit it: tell the Coordinator or me a new rule, and it is recorded.

Look now: the rules from this onboarding.

## 8. Growing the crew

The crew grows in steps; the Coordinator or I propose each one, you decide, and a session sets it up.

1. You and your Aide: the plan, the tracker and the rules; nothing runs on its own.
2. The Coordinator and an Implementer, with a Reviewer: the life of a task above. You are here.
3. The full crew: more Implementers at once, a larger Reviewer pool when reviews queue up, QA once there is a product to run, and a Lead per epic when one Coordinator cannot keep up. Each epic then gets a plan of stages and parallel lanes, which you may be asked to approve in your inbox; Enter on it opens the plan.
4. Beyond this machine: test runs on rented remote machines within a daily spending cap you set, several accounts per agent for when one reaches its limit, and the web workbench in a browser (v0.2).

Look now: the crew line in the sessions panel; it changes as the crew grows.

## 9. Remote control

A remote is your private Telegram chat with this project's bot. Once paired, it mirrors General and the inbox rows that need you, so you can follow the Coordinator away from the workbench. Write there to talk to the Coordinator, answer an ask on its card, or approve or deny a command on its approval card. The first answer from the phone or either workbench wins. `/status` shows the project's state; `/inbox` brings back its open cards; `/mute` quiets General while asks and approvals still arrive, and `/unmute` brings General back.

Plans are approved in the workbench, and topics other than General stay there too; a notice may let you reply into its original topic. Pairing means approving which Telegram identity may act as you: that approval stays in Neovim or your terminal, never the phone or the web. For an enabled remote, the Remotes row in the sessions panel shows the connection, who is paired, mute, queued messages and the last error; a failure turns it red immediately.

If you want a remote, run `cland setup` once in your own terminal. It guides you through creating the bot with BotFather, reads its token at a hidden prompt, enables Telegram, then asks you to open the bot link, press Start and confirm the waiting identity. This is the tour's exception to sessions running commands for you: the token belongs only in that hidden prompt, never in our conversation. Setup stores it as `telegram.token`; `cland secret list` shows only its name and fingerprint, and `cland remote status` shows the connection and pairing. Its plain output ends with the local speech provider’s data-use line: ElevenLabs may train on audio outside enterprise plans and stores transcripts; turn off "Improve the models for everyone" under Terms and privacy, Data use. Change the provider in `[speech]`. `cland doctor` checks speech key presence or command lookup when a remote is enabled, without calling a provider or running the command; unused or off speech is healthy. If you already paired during setup, the row shows it now; an enabled remote waiting for pairing shows as unpaired. When all remotes are disabled, both workbenches omit the Remotes row; `cland remote status` still reports their state.

Look now: the Remotes row in the sessions panel.
