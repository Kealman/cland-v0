## Project secrets

`cland secret set <name>` reads one value from stdin or a hidden terminal prompt;
it accepts no value argument. Supported names are `telegram.token`,
`discord.token`, `speech.elevenlabs_key` and `speech.xai_key`. Run it in an
initialized project; it works with the hub stopped. Use the hidden prompt or
pipe from a credential source, keeping the value out of shell history and argv.

Values live in `.cland/secrets.toml`, in `[telegram]`, `[discord]` and `[speech]`
tables with string values. Writes replace the file atomically at mode 600.
The resolver checks and tightens an existing file to 600 before hub startup
opens its logs or listeners; symbolic links, non-regular files and multiple
hard links are refused. Parse errors report a fixed reason without quoting
the file. The resolver returns only the four supported dotted keys. Before provider setup,
Telegram tokens must match `^[1-9]\d{0,16}:[A-Za-z0-9_-]{24,}$` and have at most
80 characters; refusals use a fixed reason without echoing the value. Discord
tokens are opaque. Storage-only reads remain separate from provider resolution,
so set/unset can repair a malformed stored Telegram token and list still shows
only fingerprints. Startup and reload register every resolved token and speech key
with the project's remote redactor before messenger setup. The daemon passes its
explicit environment to the resolver at both boundaries, falling back to the
process environment only when no daemon environment was supplied.

At hub/provider resolution, `CLAND_TELEGRAM_TOKEN`, `CLAND_DISCORD_TOKEN`,
`ELEVENLABS_API_KEY` and `XAI_API_KEY` override `telegram.token`, `discord.token`,
`speech.elevenlabs_key` and `speech.xai_key`, respectively. An absent variable
falls back to the file; a present variable is an explicit override. An absent
file is allowed. File safety and parsing checks still apply when overrides exist.
Set these in the hub's launch environment; changing another shell's environment
does not change a running hub's environment.

All four names, alongside `DIGITALOCEAN_TOKEN`, are removed by the shared
`withoutExecutorCredentials` filter after child environment overlays. Harnesses,
verification workers and fixture children use that filter. The speech command
provider uses the same final filter; its native launcher is covered by
`hub/test/speech-command.test.ts` with synthetic credentials and disposable scripts. The hub retains its own credentials for provider requests.

Secret commands edit and list the file only; environment overrides are never
copied into it, changed by unset, or included in list output.
`cland secret list` prints one stored name and its 12-character SHA-256
fingerprint prefix per line; an empty store prints nothing. `cland secret unset <name>` removes just that value. Set and unset print only the operation and name.
Input is a nonempty line of at most 4096 bytes, with no control characters;
piped input loses only one final LF or CRLF. File reads are limited to 64 KiB.

The managed `.cland/.gitignore`, refreshed by init, update, hub startup and secret
writes, ignores `secrets.toml` and temporary writes. A project-owned unmarked
ignore file is preserved. Set and unset refuse before reading stdin unless its
final non-comment rule is exactly `secrets.toml` or `/secrets.toml`; add that rule
after any negations before storing keys. The command leaves custom bytes intact.
The local hub authentication file `.cland/secret` is separate. Messenger and
speech credentials are never sent through a hub frame. Secret writes save the
file only; loading a messenger and applying rotation belong to its reload path.


<!-- Implementation guidance moved from the implement skill. -->

For binary human uploads, use `docs/agents/tests/hub-test-artifact-upload.test.ts.md`.
Keep bytes beside native frames, authority before ingress replay, and all files plus
one human message in the shared artifact queue and store transaction. Sessions have
no upload authority; refuse every MIME on exact registered-secret bytes through
the shared registry and preserve accepted bytes. Existing role clauses need no
additional permission lines.

For setup's remote offer or hidden question, use the scripted runner and real
frame/fake messenger seams in `docs/agents/tests/hub-test-setup-remotes.test.ts.md`
and `docs/agents/tests/hub-test-setup-remote-component.test.ts.md`. Reuse secret
input/preflight and the config-set writer; release each terminal reader before
the next question. Keep nonterminal untouched `skip`, partial `open`, default-No
offers even with `--yes`, and pairing readback before `ok` or `done`. Setup
pairing uses the local CLI/fake Bot API seam in
`docs/agents/tests/hub-test-setup-pairing-component.test.ts.md`: inject Start
during the pause and observe its durable offset before reading the waiting row;
confirm its identity before approval, keeping no-code waits bounded and declines open.
