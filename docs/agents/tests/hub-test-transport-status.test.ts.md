# hub/test/transport-status.test.ts

T2 serves a disposable projectHub and installs status-only carrier facts. It
checks the actual hub.status reply, CLI rendering and the previous wire shape
with hosts absent. No SSH process starts; registered metadata uses a synthetic
secret and the existing private store.

The fixture supplies an inert Host for its registered metadata through the
existing projectHub injection seam. This keeps daemon startup from acquiring a
real carrier before the fixture installs its status-only transport. Status and
previous-reply assertions remain unchanged.
