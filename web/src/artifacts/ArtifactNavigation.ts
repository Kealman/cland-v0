import { createContext } from 'react';
import type { Artifact } from '../../../shared/wire/index.ts';

export const ArtifactNavigation = createContext<(artifact: Artifact, source: HTMLElement) => void>(() => {});

/** A thread selection can precede the loaded inventory; it is never an inventory row. */
export const ArtifactViewerFallback = createContext<Artifact | undefined>(undefined);
