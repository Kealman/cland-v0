# hub/test/host-tunnel-control.test.ts

T2 uses disposable roots, provider directory records and a Unix socket fake
master. No child process or native signal is used. The table cases reject a
foreign directory symlink, a foreign provider project, and a foreign provider
pool before contacting the master or creating its transport marker. The marker-alias case preserves a foreign target file when a pre-existing symlink occupies the marker path. The fake
master would acknowledge a request, so zero contacts plus the missing marker
prove admission refused before any effect. Teardown closes the server before
root removal. Run with supported Node 24 and inherited CLAND variables stripped.
