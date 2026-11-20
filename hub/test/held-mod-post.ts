/** Own the fake's held mod posts through release and native close. */
export function waitForModHold(signal: AbortSignal, edge: {watch(check: () => void): () => void; released(): boolean; publish(): void}): Promise<void> {
  return new Promise<void>((resolve,reject)=>{
    if(signal.aborted){resolve();return;}
    let close=()=>{};
    const cleanup=()=>{close();signal.removeEventListener('abort',finish);};
    const finish=()=>{cleanup();resolve();};
    const check=()=>{if(edge.released())finish();};
    try {
      close=edge.watch(check);
      signal.addEventListener('abort',finish,{once:true});
      edge.publish();
      check();
    } catch(error) { cleanup();reject(error); }
  });
}

export function heldModPosts() {
  const abort = new AbortController();
  const active = new Set<Promise<unknown>>();
  return {
    run<T>(prepare: (signal: AbortSignal) => Promise<void>, launch: () => Promise<T>, cancelled: T): Promise<T> {
      if (abort.signal.aborted) return Promise.resolve(cancelled);
      const work = Promise.resolve().then(async () => {
        if (abort.signal.aborted) return cancelled;
        await prepare(abort.signal);
        if (abort.signal.aborted) return cancelled;
        return launch();
      });
      active.add(work);
      void work.then(() => active.delete(work), () => active.delete(work));
      return work;
    },
    async stop(): Promise<void> {
      abort.abort();
      await Promise.allSettled([...active]);
    },
  };
}
