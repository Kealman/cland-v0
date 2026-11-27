/** Shared card wire shape for the stub and its deterministic recorder. */
export function cardCriteriaInput(item: Record<string, unknown>) {
  return { body: String(item.body ?? ''), criteria: item.criteria };
}

export function cardValue(item: Record<string, unknown>, criteria: unknown) {
  return { item: { body: '', comments: [], verdicts: [], ...item, ...criteria as object, path: `.cland/tasks/${String(item.file)}` } };
}
