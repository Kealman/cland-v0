# Voice implementation notes

Read the matching [subsystem reference](../../../hub/README.md) alongside these notes.

Voice echo delivery owns a separate ready intent and terminal outcome from the
inbound FIFO. Preserve bounded numbered parts, stable part keys and unknown-send
fences, and prove held accepted-echo close/restart plus later General input.
Empty/missing speech commands keep audio and name command setup.
