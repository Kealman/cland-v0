# hub/test/host-attach-routing.test.ts


T2 uses projectHub session frames and fake adapters. It verifies session.attach
and list carry the same hardened remote command, with the prior local frame
shape still accepted. The host secret is planted in its real private path before
printing; neither it nor admission variable names appear in the command.

Revoked/missing-key printer exceptions leave launch, list and snapshot projection
available with `attach: null`, while explicit attach retains the refusal reason
and another local session remains visible.
