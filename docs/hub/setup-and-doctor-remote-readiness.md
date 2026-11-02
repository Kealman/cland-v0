## Setup and doctor remote readiness

Setup initial remote reads (paired or unpaired) and post-reload checks use the
same bounded readiness helper. Doctor waits concurrently for enabled remote
rows with a loaded token and a disconnected connection, using local socket
status only. Each wait allows ten seconds, with 50 ms polling and native reads
capped by the remaining budget (at most three seconds). Disabled, missing-token,
missing-row and previous-hub refusal states do not wait. Expiry preserves the
last in-budget state; it supplies no passing connection evidence. Pairing still
requires the existing human gesture and identity approval. This adds no gate,
configuration or role permission.

