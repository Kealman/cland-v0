import { canonical, recordingKey, type Recording } from '../../nvim/test/frame-fixtures.ts';
import { cardCriteriaInput, cardValue } from '../../nvim/test/card-frame.ts';

export function createFrameRecorder(produce: (operation: string, input: unknown) => unknown, append: (record: Recording) => void) {
  const contexts = new Set<string>();
  const captured = new Set<string>();
  let failed = false;
  let failure: unknown;
  const writable = () => { if (failed) throw failure; };
  const persist = (record: Recording) => {
    writable();
    const key = recordingKey(record.operation, record.input);
    if (!captured.has(key)) {
      try { append(record); } catch (error) { failed = true; failure = error; throw error; }
      captured.add(key);
    }
  };
  const materialize = (context: Record<string, any>, root: string) => {
    const key = recordingKey('card-context', canonical(context, root, context.at).input);
    if (contexts.has(key)) return;
    const records: Recording[] = [];
    const prepare = (operation: string, input: unknown) => {
      const output = produce(operation, input);
      records.push({ operation, input, output });
      return output;
    };
    for (const item of context.items ?? []) {
      const input = canonical(cardCriteriaInput(item), root);
      const criteria = input.restore(prepare('criteria', input.input));
      const frame = { type: 'result', id: '@request@', ok: true, value: cardValue(item, criteria) };
      prepare('frame', canonical({ ...context, frame, requestType: 'task.view' }, root, context.at).input);
    }
    return { key, records };
  };
  const commit = (prepared: ReturnType<typeof materialize>) => {
    if (!prepared) return;
    for (const record of prepared.records) persist(record);
    contexts.add(prepared.key);
  };
  const recorder = Object.assign((operation: string, input: unknown) => {
    writable();
    const value = input as { requestType?: string; frame?: { ok?: boolean } };
    // Card demand is incidental. Its complete set was captured at the scenario
    // boundary; optional selection must neither add entries nor hide a miss.
    if (operation === 'criteria' || operation === 'frame' && value.requestType === 'task.view' && value.frame?.ok === true) {
      if (!captured.has(recordingKey(operation, input))) throw new Error('card requested outside its recorded scenario context');
      return produce(operation, input);
    }
    const output = produce(operation, input);
    persist({ operation, input, output });
    return output;
  }, { cards(context: Record<string, any>, root: string) {
    writable();
    commit(materialize(context, root));
  }, controlContext(read: () => Record<string, any>, root: string) {
    // Control deliberately permits invalid setup. The next ordinary projection
    // retains ownership of its error; valid transient contexts must be captured.
    writable();
    let prepared: ReturnType<typeof materialize>;
    try { prepared = materialize(read(), root); } catch { writable(); return; }
    // Persistence is outside projection deferral. Its failure permanently
    // refuses this capture, even if the caller catches the original exception.
    commit(prepared);
  } });
  return recorder;
}
