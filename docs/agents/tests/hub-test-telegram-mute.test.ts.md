# hub/test/telegram-mute.test.ts

T2 uses sealed `tempProject`/`projectHub`, public Neovim and agent frame clients,
the native Telegram adapter and the loopback fake Bot API with fabricated
credentials. The explicit legacy `gatewayRemotes` injection retains the previous
adapter wire shape. There is no browser, real platform or child hub process.
Run only this file with `node --test hub/test/telegram-mute.test.ts`.
Use `driveTelegram` around command confirmation, notice receive, held-request
setup and restart confirmation. It advances the injected clock only from durable
queued/uncertain work and the stored chat-spacing or bot-hold deadline, never
while HTTP is in flight. Retain every final receipt and assertion below; a clock
advance is not completion evidence.

`Telegram mute suppresses three General messages but keeps a hub notice and
unmute reports the count` approves a real waiting code through the local frame,
checks the existing status mute boolean for `mute_default`, unmutes then mutes
with the bot suffix, and posts three General reports through the agent frame.
Arm the durable missed-count observer before posting; this is the suppression
boundary, not a timer or absence of traffic. Pass a complete recorded hub-notice
frame to the native receive boundary while muted and await its completion. The
final fake accepted-message census proves the notice arrived, the three reports
did not, the exact unmute line arrived, and later General resumes. Discord state
remains independent. The notice frame exercises native delivery, not the hub's
production of that notice. Card production is E-1310 and is not claimed here.

`Telegram unmute interruption after commit preserves the count reset without
replaying its reply` holds the exact unmute reply at the fake after three counted
sources. Observe its request before asserting persisted mute/count and the absent
update receipt. Stop joins the held request and its socket before restarting an
in-process hub on the same database. Await the next poll with the exact offset,
then retain state and accepted-message assertions: the command is consumed without
reapplying its effect or resending its uncertain reply. This tests the durable
handler boundary; the T3 polling restart test separately covers an actual kill.

All observers have bounded setup and final assertions. Cleanup joins remote/hub
writers before closing Store or removing roots. No whole suite, live messenger,
Linux duration or pacing measurement is implied by a local component run.

`Telegram mute counts each eligible source once and a replacement pairing starts
with a fresh count` feeds a duplicate complete General frame, repeats `/mute`,
and checks that a stranger's `/unmute` cannot affect the approved pairing. A new
code approved through the local frame applies the default and clears the old
count. The new human's `/unmute` reports zero; replaying the old suppressed
General source after that cannot emit it or count it again.

The shared `pacingOwner` is registered before root, fake, Store or adapter
acquisition. Register the fake's startup-only close before binding it; register
nullable native adapters before construction, including every recreated adapter.
Start initial and recreated hubs through that owner so a lost serving receipt
cannot strand a late-returned hub. Disposal releases held startup I/O before
joining acquisition, then drains adapters/hubs before closing SQLite.

The generated `mute fixture drains native writers and SQLite after missed
receipt`, `... after aborted startup` and `... after rejected startup` controls
exercise this same owner. Missing/aborted setup holds native getMe before any
hub is returned; a separate FakeClock bounds setup, and owner disposal must
retain the late hub's stopped receipt plus native `{closed: true, connections: 0,
handlers: 0, nativeError: null}`, closed SQLite and zero behavior/setup timers.
The rejected-startup control holds a send writer while malformed scratch config
rejects projectHub; require its exact request-id/socket-close and incomplete-send
result before the same storage/native/timer assertions. The pre-serving fake
close invalidates event observers, so those controls use its completed native
all-connections closure receipt. A finally block releases fake I/O before joining
failed acquisition, keeping negative controls bounded too. These are in-process
fixture-lifetime tests, not OS process-exit or Linux timing claims.

Local approval adds its project confirmation before command replies; retain it
in the exact native sequence even when mute_default is true.
