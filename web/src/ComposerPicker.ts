import { createContext } from 'react';
import type { ObjectRow } from './connection.ts';

export type ComposerSelection = ({ kind: 'Sessions' } | { kind: 'Artifacts'; topic: string }) & { choose: (row: ObjectRow) => void };
export const ComposerPicker = createContext<(selection: ComposerSelection) => void>(() => {});
