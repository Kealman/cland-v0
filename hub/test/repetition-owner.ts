/** The operation owns restoration; cleanup failures cannot bypass its join. */
export function ownRepetition<T>(run: () => Promise<T>, restore: () => void) {
  const result = Promise.resolve().then(run).then(
    value => { restore(); return value; },
    error => {
      try { restore(); }
      catch (secondary) { throw new AggregateError([error, secondary], 'repetition and restoration failed'); }
      throw error;
    },
  );
  void result.catch(() => {});
  return {
    result,
    async cleanup(...steps: Array<() => Promise<unknown>>) {
      const secondary: unknown[] = [];
      for (const step of steps) {
        try { await step(); } catch (error) { secondary.push(error); }
      }
      const errors: unknown[] = [];
      try { await result; } catch (error) { errors.push(error); }
      errors.push(...secondary);
      if (errors.length) throw new AggregateError(errors, 'repetition cleanup failed; operation and restoration joined');
    },
  };
}
