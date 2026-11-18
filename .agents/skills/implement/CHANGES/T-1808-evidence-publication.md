Use the shared scan-and-publish helper for evidence publication (T-1808), keeping
the positive control, both repository scanners and session artifact.create in one operation.
The copied kit carries its guide and a PATH-based installed-package locator, so
external projects need no repository-local hub/src or docs path.
