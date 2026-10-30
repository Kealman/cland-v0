# hub/test/inbox-requests.test.ts

Permission and tool-completion hooks explicitly use the worker's recorded native launch generation via `claudeLaunchIdentity`. Preserve the four pending requests, approval command, exact departure reasons and archive assertions.

Run `node --test hub/test/inbox-requests.test.ts` singly. This T3 file uses
disposable roots and sealed native fixtures; it does not open a browser.
