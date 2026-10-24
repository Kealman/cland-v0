# hub/test/homebrew-download.test.ts

T1 checksum/HTTP-response fault contract. Run `node --test hub/test/homebrew-download.test.ts`.
The fetch response is fixture-owned in memory: a known SHA-256 vector, HTTP
failure, empty response and interrupted stream. No external network is used.
