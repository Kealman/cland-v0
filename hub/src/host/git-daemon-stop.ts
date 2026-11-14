/** Join the native close receipt; a missing identity never grants signal authority. */
export async function stopGitDaemon<Proof>(owner: {
  disconnect(): void;
  identity: Promise<Proof | null>;
  completed(): boolean;
  stop(proof: Proof): Promise<boolean>;
  done: Promise<void>;
}): Promise<void> {
  owner.disconnect();
  const proof = await owner.identity;
  if (!owner.completed() && proof) await owner.stop(proof);
  // EOF can win the race with both the identity probe and native stop. Neither
  // a missing proof nor a false stop outcome proves that the child is still live.
  // Only its own close receipt permits success; a live unproved child times out.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([owner.done, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Git daemon termination incomplete')), 5_000);
    })]);
  } finally { clearTimeout(timer); }
}
