/** Fake native close and independent production interpretations prove the same turn. */
export type ModClose = {
  job: string; turnId: string; event: string;
  payload: { at: number }; pid: number; code: number | null; signal: string | null;
};
export type ModInterpretation = { sessionId: string; event: string; at: number; turnId?: string | undefined; confirms?: string[] | undefined };

export function completedModInput(close: ModClose, expected: {job: string; turnId: string; start: {turnId: string; at: number}; sessionId: string; input: string}, interpretations: ModInterpretation[]): boolean {
  return close.job===expected.job && close.turnId===expected.turnId && close.event==='mod-turn-complete'
    && expected.start.turnId===expected.turnId && Number.isFinite(expected.start.at)
    && close.pid>0 && close.code===0 && close.signal===null && Number.isFinite(close.payload.at)
    && interpretations.some(row=>row.sessionId===expected.sessionId&&row.event==='mod-turn-start'&&row.at===expected.start.at&&row.confirms?.includes(expected.input))
    && interpretations.some(row=>row.sessionId===expected.sessionId&&row.event==='mod-turn-complete'&&row.at===close.payload.at);
}
