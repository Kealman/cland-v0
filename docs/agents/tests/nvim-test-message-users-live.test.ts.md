# nvim/test/message-users-live.test.ts

T3 uses projectHub with a disposable config, real message subscription and headless Neovim. Wait for installed history and first-user identity before the other-user send; arm the exact production message-frame observer before triggering. Assert both that frame's display name and the rendered header over the exact live body. Fixture cleanup observes native Neovim exit and stopped hub before root removal. No remote services or real harness launches.

The other user has a permitted CR/LF display name: assert the production frame preserves it, while the buffer header shows `Other Person` and the body still renders. Normalization happens before header byte marks are calculated.
