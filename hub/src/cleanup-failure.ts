/** Preserve the selected failure; append cleanup diagnostics without losing an existing cause. */
export function withCleanupFailure(primary: unknown, cleanup: unknown): unknown {
  if (primary instanceof Error) {
    try {
      primary.cause = new AggregateError([...(primary.cause === undefined ? [] : [primary.cause]), cleanup], 'cleanup failed');
      return primary;
    } catch { /* Frozen errors still retain the selected failure as the cause below. */ }
  }
  return new AggregateError([primary, cleanup], 'operation failed; cleanup also failed', { cause: primary });
}
