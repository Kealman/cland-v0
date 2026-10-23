import { createContext } from 'react';
import type { Area } from './keymap.ts';
import type { ObjectRow } from './connection.ts';

export type ComposerSelection = ({ kind: 'Sessions' } | { kind: 'Artifacts'; topic: string } | { kind: 'Subjects' }) & { choose: (row: ObjectRow & { area?: Area | undefined }) => void };
export const ComposerPicker = createContext<(selection: ComposerSelection) => void>(() => {});
