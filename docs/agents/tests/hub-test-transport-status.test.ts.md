# hub/test/transport-status.test.ts

T2 serves a disposable projectHub and installs status-only carrier facts. It
checks the actual hub.status reply, CLI rendering and the previous wire shape
with hosts absent. No SSH process starts; registered metadata uses a synthetic
secret and the existing private store.
