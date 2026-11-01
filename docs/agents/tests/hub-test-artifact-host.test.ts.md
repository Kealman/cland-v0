# hub/test/artifact-host.test.ts

T2 public artifact creation and real frame conversations with a recording Host.
Run `node --test hub/test/artifact-host.test.ts` after checking free disk space.
Disposable projects own all output; remote source paths exist only in the fake.

Cases assert binary file output, recursive folder output, relative session paths,
and human-local paths by reading the persisted files after completed creation.
Upload attachment checks return a missing type from the recording local Host;
the upload must refuse without registering another artifact. Upload bytes stay
in the frame. No process, provider, transport or real remote login is exercised.

Keep artifacts, artifact-create-unit, artifact-folders, artifact-upload and
artifact-cli tests unchanged as preservation controls. Host fileType's native
symlink, missing and ENOTDIR cases live in the reusable host-contract suite.
