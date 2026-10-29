# QA brief: E-1314 — the live run on the sandbox bots (C3)

## Item

E-1314 criterion C3: "The live run on the sandbox bots, with the human on the phone, is done on this Mac against a sandbox project, its findings filed, and no real token reached a droplet." QA drives the hub's side. The human uses the phone and says what they see. Record the human's words as they said them.

## Build and setup (done by the Coordinator)

- The pinned cland is the worktree `/Users/evgeniyivanov/Projects/cland/live03-cland`, detached at dev `189d5100`. It holds everything in 0.3 except fixes still in flight; T-1442's Telegram restart fix is the notable one.
- The sandbox project is `/Users/evgeniyivanov/Projects/cland/sandbox-live03`, a fresh repo with `cland init` run in it.
- **Run every sandbox command through `./sbx` from that directory.** `sbx` strips this crew's `CLAND_*` variables. A bare `cland` or `node …/cland.ts` from a crew shell talks to the v0 project hub instead, which happened once already today. Never run a sandbox command without `./sbx`.
- The tokens and the ElevenLabs key were loaded from the human's sandbox secrets file over stdin. Check them only with `./sbx secret list`, which prints fingerprints. Never read, print or copy `~/.config/cland/sandbox-remote.secrets.toml` or `.cland/secrets.toml`.
- The sandbox hub is running, with Telegram (@cland_app_bot) and Discord connected and `[speech] provider = "elevenlabs"`. `./sbx remote status` shows the state.

## Cases

none

## Manual checks

| id | surface | command | expected |
| --- | --- | --- | --- |
| L0 | hub-api | `./sbx remote status`, `./sbx secret list`, `./sbx hub status` | both remotes connected and unpaired; three fingerprints; the hub serves the sandbox root. |
| L1 | tmux | Start a sandbox Coordinator: `./sbx session launch` with role coordinator on Codex (see `./sbx session launch --help`), a short brief "Answer the human briefly in General; when asked, raise an ask with three options and run one shell command that needs approval", and attach only to watch. | The session connects to the sandbox hub; it is not in the v0 `who`. |
| L2 | phone + hub-api | Pair Telegram: the human presses Start in @cland_app_bot, then QA runs `./sbx remote approve telegram <code>` after the human reads the code and numeric id aloud. Pair Discord: the human runs `/cland pair` in the server channel, then QA runs `./sbx remote approve discord <code>`. | Both paired with the ids the human reads; the bots say "Approved" or "Paired". |
| L3 | phone | The mirror both ways: the human writes in Telegram, then in Discord, then replies to one of the Coordinator's messages on each. | 👌 then 👀 on each human message; the Coordinator's replies arrive on both phones with their headers; the replies thread in their topics. The human's message from Telegram appears in Discord marked "you (Telegram)", and the other way round. |
| L4 | phone | Ask the Coordinator for an ask with three options. Answer one on Telegram with a button; ask for a second and answer it on Discord with **Other answer…** in the modal; decline a third. | Each card turns into its outcome on both remotes and in the workbench inbox; the other remote's copy folds within seconds. |
| L5 | phone | Ask the Coordinator to run its approval-needing command. | A Codex approval card arrives on both remotes; the human approves it from Discord. This is untried on real Discord. The Telegram copy and the inbox fold, and the command runs once. |
| L6 | phone | Attachments: a photo and a file from Telegram, a photo from Discord, a voice note from each. | Each becomes the human's artifact in General; the other remote gets it once, captioned "you (Telegram)" or "you (Discord)"; each voice note becomes a 🎤 transcript with the echo. |
| L7 | phone | Commands on each: `/status`, `/inbox`, `/mute`, then a Coordinator message, then `/unmute`, then `/help`; on Discord the `/cland` forms, plus `/cland decision …` and `/cland question …`. | Private, phone-laid-out replies; mute suppresses and unmute reports the count. |
| L8 | hub-api + phone | An outage while the hub runs: QA turns the Mac's network off for about 30 s, or asks the human to; the human writes on both meanwhile. | Both reconnect; Discord resumes; the messages arrive once. |
| L9 | hub-api + phone | Restarts, **after T-1442 lands and the Coordinator moves `live03-cland` to it**: `./sbx hub stop`, the human presses a card and writes on both, `./sbx hub start` within 90 s; then a stop over 2 minutes with two messages. | Short: Discord resumes and only pressed cards are re-sent. Long: messages arrive marked late on both, every open card is re-sent, one silent gap line. Then check the Discord bot's presence after a stop (untried). |
| L10 | hub-api | `./sbx hub stop` at the end; the Coordinator archives the sandbox session. | The bots go quiet; no process of the sandbox remains. |

Record each step with `sh .agents/skills/qa/qa-record.sh note E-1314 <run> L<n> <surface> "<what you ran>" <result>`, run from the v0 root, with captures under `.cland/qa/E-1314/<run>/`. Scan every capture for token-shaped strings before saving. The human's words go into the note text.

## Probes that mislead

- T-1442 (Telegram after a graceful stop) is not in this build. Before it lands, a Telegram restart shows no late marks and no re-sent cards. That is known, not a finding, so L9 waits for it.
- The v0 project's hub and its crew are unrelated to this run. Their traffic is no evidence.
- A finding is something the human or QA sees go wrong on a step. File it under Bugs with the human's words, and keep going unless it blocks the walk.

## Out of scope

The v0 project hub; droplets of any kind (no token ever goes to one); release steps; E-1314's other criteria.

## Grants

- Run `./sbx` commands in the sandbox project and `session launch` there.
- Turn the Mac's network off briefly for L8, only after telling the human.
- Never read the secrets files. Never start, stop or reload the v0 hub.
