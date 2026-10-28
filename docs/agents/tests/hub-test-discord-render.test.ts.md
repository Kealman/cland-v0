# hub/test/discord-render.test.ts

T2. Run alone: `node --test hub/test/discord-render.test.ts`.
Uses sealed exchange.project/projectHub, production General frames and loopback
Discord REST/ws. No browser, account, real platform or real credential.

C1 asserts literal output for aligned tables, deep headings, rules, task boxes
and escaped spoilers. C2 retains native ping receipts for create and edit;
`discord-api.test.ts` keeps the raw default-mention positive control. C3 uses
4500 code points (including supplementary Unicode) within the hub's byte cap,
waits for all three durable settlements, then checks numbered headers, native
size, each reopened language fence, full body preservation and original source
mapping. The paragraph control checks a whole block moves to the next part.
C4 uses a production agent send, native hub/Telegram-origin frames and a real
workbench topic.send; assert notification flags, authors and persisted rendered
bytes/silence. C5 uses an unclosed fence as unsupported conversion input and
checks the unchanged plain source plus durable native mapping.

The unchanged old-intent crash/recovery controls in discord-messages.test.ts
remain compatibility evidence: absent silent means false, and replay does not
convert historical content. These component cases do not claim cards, history
catch-up, browser behaviour or live Discord delivery.

The complete-group controls arm the native held-create observer before the fault,
then assert all three parts are durable at that exact I/O boundary. A later
source queues behind the group. Healthy release checks native order; crash
replay uses a consistent SQLite backup captured by an independent reader while
the request is held, then stops/joins the live hub before a fresh native outbox
replays that snapshot. This isolates crash persistence from the existing graceful
stop policy, which counts an aborted General send as missed. Both controls keep
final native bytes, settlements and original-source mappings. The backup remains
inside the sealed fixture root and no captured database is exported.

Every case uses the shared discordExchangeOwner, registered before acquisition.
Its subject hub stop is registered before hub startup; recovered outbox stop is
registered before replay. Stores close only through afterDrain after stops,
native requests, observations and the fake have joined. The root uses the same
close barrier before removal. Preserve the omitted held-publication and aborted
held-setup controls: both use this disposer and require zero pending operations,
held requests, native handlers, connections and observers plus a closed Store.

The held subject-startup control pauses after native projectHub acquisition but
before the tracked startup publishes its subject. Close begins while the
registered stop cannot yet see that subject. The Store stays usable, startup is
released, and the late-acquisition fence must stop/join the returned subject
before the tracked operation settles. Its stop receipt asserts an open Store;
only afterwards may disposal close it. The control failed without the fence
(`late acquired hub stop receipt precedes Store closure: false !== true`).
Preserve its final stop and closed-Store assertions as well as both held-I/O
setup controls. No shared exchange-helper change is needed.
