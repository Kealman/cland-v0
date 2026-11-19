T-1956: document retained candidate cleanup and automatic guarded retry separately
from item follow-up repair, preserving landed outcomes and next-batch progress.
Source review corrections add the capped/overflow disposition and exact checkout
ownership fence, including conservative legacy-checkpoint refusal.
Second-review corrections bound encoded diagnostic bytes, guard canonical writer
roots and retain overflow notices in bounded existing-meta replay.
Third-review corrections project minimal notice delivery fields and share
captured requester routing across all retained cleanup notices; publication
diagnostics remain secondary to the cleanup cause.
