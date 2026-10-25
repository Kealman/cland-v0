---
id: Q-1294
kind: question
title: "Grilling: vocabulary, configuration, secrets and the remote's authority"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1286
blocked_by:
  - Q-1287
  - Q-1288
  - Q-1290
topic: null
branch: null
created: 2026-10-25T10:24:45.985Z
updated: 2026-10-25T11:50:04.469Z
closed: 2026-10-25T11:50:04.469Z
---

## Question

With the API facts and the prior art in hand (map M-1286): the glossary entries (Remote, Gateway, Pairing, Transcript and whatever the research adds), the configuration shape (`[remote]`, `[telegram]`, `[discord]`, `[speech]` keys; what hot-reloads and what needs a restart; how `cland update` adds them), the pairing state file and the secrets file (format, permissions, the env-var override, the deny-list names), the `cland remote …` command set, the remote's authority table rows and the `via` values, how approvals answered from a remote are recorded, and what the workbenches show about remotes.

## Comments

### human · 2026-10-25T11:50:04.332Z

## Resolution (2026-10-25, grilling round 2; the human accepted every recommendation)

1. **Pairing direction reversed** to the proven pattern: the human opens the bot (its `t.me/<bot>` link is printed by `cland remote status`) and presses Start; the bot replies once with an 8-character code (no 0/O/1/I) and the sender's numeric id, "ask the project's owner to approve"; approval happens on the trusted side: an inbox card in the workbench ("Pair Telegram user 12345 (Name)? code …") or `cland remote approve telegram <code>`. Codes live 1 hour, at most 3 pending, a stranger gets at most 2 replies and then silence. Discord: `/cland pair` without an argument in the channel yields an ephemeral code, approved the same way. This supersedes round-1 decisions 6 and 7 on the pairing step; everything else there stands.
2. **Remote state lives in `hub.db`**: pairings, cursors (Telegram offset, Discord last message id and resume data), the outbox and the map from chat messages to cland messages, topics and asks. No separate JSON file; human ids never go into the committed config.
3. **Configuration** in `.cland/config.toml`: `[remote] mute_default`; `[remote.telegram] enabled, format ("rich" | "entities", default chosen by the prototype)`; `[remote.discord] enabled`; `[speech] provider ("elevenlabs" | "command" | "" off), model (scribe_v2), language ("" = detect), max_seconds (600), command (argv)`. A messenger is active when enabled and a token exists. All keys hot-reload on `cland hub reload` (enable/disable connects or disconnects the gateway). `cland init` renders the sections with defaults; `cland update` adds them to existing projects.
4. **Secrets file** `.cland/secrets.toml`, git-ignored, mode 600, checked and tightened at hub start, symlinks refused: `[telegram] token`, `[discord] token`, `[speech] elevenlabs_key, xai_key`. One generic command `cland secret set <name>` (stdin or hidden prompt, never argv), `cland secret list` (names and SHA-256 fingerprint prefixes only), `cland secret unset`. Env overrides `CLAND_TELEGRAM_TOKEN`, `CLAND_DISCORD_TOKEN`, `ELEVENLABS_API_KEY`, `XAI_API_KEY`, all on the sessions' env deny-list. The Telegram token format is validated before any URL is built. This supersedes the `cland remote token` command of round-1 decision 8.
5. **Authority and `via`**: the remote's own actions are exactly `topic.send` (General and replies into topics), `topic.answer`, `approval.answer`, plus reads for `/status` and `/inbox`; narrower than the web table (no session launch or stop, release, push, config, artifacts). Media artifacts are written by the hub inside the gateway and the message is attributed to the human. Every message, answer and approval carries `via = "telegram" | "discord"`; the workbench shows "via Telegram".
6. **Approvals from a remote**: Codex and OpenCode approvals are answered from the card as from the web, recorded with `via`; the inbox row shows "approved via Telegram"; the command text in the card is truncated to a safe length with "full command in the workbench"; no second confirmation for dangerous commands in 0.3.
7. **Vocabulary**: Remote, Gateway, Pairing, Transcript plus **Card** (an ask or approval shown in a remote with buttons), **Gap line** (the one line about messages missed during an outage) and **Outbox** (the remote's durable queue of sends); no implementation detail in the glossary.
8. **`cland remote` commands**: `status` (per messenger: token present with fingerprint, paired with whom, connection state, last inbound and outbound, outbox depth, mute), `approve <messenger> <code>`, `unpair <messenger>`, `test <messenger>`. Secrets through `cland secret`; enabling through `cland config set remote.<messenger>.enabled`.
9. **One pairing per messenger** (one human): one Telegram chat and one Discord channel per project; a new approved pairing replaces the old. Both messengers may be paired at once: the mirror goes to both, the first answer wins everywhere, every copy of a card is edited.
10. **Workbench**: a Remotes row in Sessions (web) and in the Neovim sessions panel (connected, paired with whom, mute, outbox depth, last error); pairing requests arrive as inbox rows; messages from a remote carry a source mark and the voice marker; outage and recovery notices are written to General by the hub.
11. **Deferred past 0.3** (named in the spec as deferred, not fog): Telegram groups and forum topics, Discord Components V2, a thread per item, several humans, webhooks.
