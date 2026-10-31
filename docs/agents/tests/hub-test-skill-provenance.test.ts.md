# hub/test/skill-provenance.test.ts

T1 checks the stable CHANGES pointer against a copied skill. Missing directories and empty entry bytes fail the existing provenance gate; restoring a nonempty entry succeeds. Each entry has an independent filename. Init/update recursive copying and hashes include those files.
